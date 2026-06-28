// Cloudflare-native memo upsert:
//   - D1 (drizzle) replaces prisma for Memo/User/Config/SystemConfig
//   - sendEmail() now takes the event so it can read Config from D1
//
// Prisma upsert semantics are preserved: if a Memo row with body.id exists
// (and belongs to the authenticated user), update it; otherwise insert a
// new row with the current user as owner.
import { and, desc, eq } from 'drizzle-orm'
import { aliTextJudge } from '~/utils/aliTextJudge'
import { sendEmail } from '~/utils/sendEmail'
import { useDb } from '~/lib/db/d1'
import { pushToUser } from '~/lib/push'
import { getCfEnv } from '~/lib/cf-env'
import { postTweet, uploadMedia } from '~/lib/twitter'
import { config as configTable, memos, systemConfig, users } from '~/lib/db/schema'

type SaveMemoReq = {
  id?: number
  content: string
  imgUrls?: string[]
  atpeople?: number[]
  avpeople?: number[]
  location?: string
  externalUrl?: string
  externalTitle?: string
  externalFavicon?: string
  music163Url?: string
  /** When true and the author has bound their X account, mirror this new memo to X. */
  syncTwitter?: boolean
}

const staticWord: Record<string, string> = {
  ad: '广告引流',
  political_content: '涉政内容',
  profanity: '辱骂内容',
  contraband: '违禁内容',
  sexual_content: '色情内容',
  violence: '暴恐内容',
  nonsense: '无意义内容',
  negative_content: '不良内容',
  religion: '宗教内容',
  cyberbullying: '网络暴力',
  ad_compliance: '广告法合规',
  C_customized: '违反本站规定',
}

export default defineEventHandler(async (event) => {
  // Wrap the whole handler so unexpected errors come back as a real
  // JSON body with a reason, not an opaque "Server Error" 500. The
  // previous behaviour swallowed every D1 / schema / fetch error
  // into nitro's catch-all, which left both the user and the operator
  // staring at the same useless 500 page.
  //
  // Stage tagging: we set `stage` before each meaningful operation so
  // the catch knows which step blew up. Cheap to maintain, makes the
  // worker log line readable at a glance.
  let stage = 'init'
  try {
    const body = (await readBody(event)) as SaveMemoReq

    if (!body.content) {
      return { success: false, message: '内容不能为空' }
    }

    stage = 'db-init'
    const db = useDb(event)

    stage = 'load-site-config'
    const configRows = await db
      .select()
      .from(configTable)
      .where(eq(configTable.id, 1))
      .limit(1)
    const siteConfig = configRows[0] ?? null
    const siteUrl = siteConfig?.siteUrl ?? ''

    const userId = event.context.userId as number | undefined
    if (!userId) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    stage = 'lookup-existing-memo'
    // Body id can arrive as a string from form-encoded sources or
    // legacy clients; coerce so the D1 query gets a number.
    const lookupId =
      body.id == null || body.id === ''
        ? -1
        : typeof body.id === 'number'
          ? body.id
          : Number(body.id) || -1
    const memoRows = await db
      .select()
      .from(memos)
      .where(eq(memos.id, lookupId))
      .limit(1)
    const existingMemo = memoRows[0] ?? null

    if (existingMemo && existingMemo.userId !== userId) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    if (
      siteConfig?.enableAliyunDective &&
      siteConfig?.aliyunAccessKeyId !== '' &&
      siteConfig?.aliyunAccessKeySecret !== '' &&
      userId !== 1
    ) {
      stage = 'aliyun-text-judge'
      const contentArray = body.content.match(/[\s\S]{1,600}/g) ?? []
      for (let i = 0; i < contentArray.length; i++) {
        const aliJudgeResponse1: any = await aliTextJudge(
          contentArray[i],
          'comment_detection',
          siteConfig?.aliyunAccessKeyId || '',
          siteConfig?.aliyunAccessKeySecret || '',
        )
        if (
          aliJudgeResponse1?.Data &&
          aliJudgeResponse1.Data.labels &&
          aliJudgeResponse1.Data.labels !== ''
        ) {
          const labelsList = String(aliJudgeResponse1.Data.labels).split(',')
          return {
            success: false,
            message:
              '内容不符合规范：' +
              labelsList.map((label) => staticWord[label] ?? label).join(', '),
          }
        }
      }
    }

    // Defensive: only treat atpeople/avpeople as arrays if they really
    // are. Clients have shipped them as null, undefined, '', and even
    // bare numbers in the wild — `.filter` on a non-array would 500.
    let atpeople = Array.isArray(body.atpeople) ? body.atpeople : undefined
    if (atpeople) {
      atpeople = atpeople.filter((item) => item !== userId)
    }
    let avpeople = Array.isArray(body.avpeople) ? body.avpeople : undefined
    let avpeopleString: string[] = []
    if (avpeople && avpeople.length > 0) {
      if (!avpeople.includes(userId)) {
        avpeople.push(userId)
      }
      if (atpeople) {
        atpeople.forEach((item) => {
          if (!avpeople!.includes(item)) {
            avpeople!.push(item)
          }
        })
      }
      avpeopleString = avpeople.map((item) => '#' + item + '$')
    }

    const now = new Date().toISOString()
    const updated = {
      imgs: body.imgUrls?.join(',') ?? null,
      atpeople: atpeople?.join(',') ?? null,
      availableForProple: avpeopleString.join(',') || null,
      location: body.location ?? null,
      externalUrl: body.externalUrl ?? null,
      externalTitle: body.externalTitle ?? null,
      externalFavicon: body.externalFavicon ?? '/favicon.png',
      content: body.content,
      music163Url: body.music163Url ?? null,
      updatedAt: now,
    }

    stage = existingMemo ? 'update-memo' : 'insert-memo'
    let resultId: number
    if (existingMemo) {
      const updatedRows = await db
        .update(memos)
        .set(updated)
        .where(eq(memos.id, existingMemo.id))
        .returning({ id: memos.id })
      resultId = updatedRows[0]?.id ?? existingMemo.id
    } else {
      const insertedRows = await db
        .insert(memos)
        .values({
          userId,
          createdAt: now,
          ...updated,
        })
        .returning({ id: memos.id })
      let insertedId = insertedRows[0]?.id ?? null
      if (insertedId == null) {
        // D1 sometimes answers returning() with [] even though the row
        // landed on disk (observed when the worker hits its CPU budget
        // mid-statement). Re-resolve by the unique (userId, createdAt)
        // tuple we just wrote so the client still gets a usable id —
        // otherwise the next line throws and the visible side effect
        // is "saved on the server, error on the client" which is the
        // exact symptom we keep seeing in production.
        stage = 'insert-memo-reselect'
        const fallback = await db
          .select({ id: memos.id })
          .from(memos)
          .where(and(eq(memos.userId, userId), eq(memos.createdAt, now)))
          .orderBy(desc(memos.id))
          .limit(1)
        insertedId = fallback[0]?.id ?? null
        if (insertedId == null) {
          throw new Error(
            'D1 insert returned no id and the (userId, createdAt) re-lookup was empty',
          )
        }
      }
      resultId = insertedId
    }

    // Notifications are non-essential to the save itself; if anything
    // in the email-or-push side path blows up we shouldn't fail the
    // memo create/update that the user actually requested.
    try {
      stage = 'notifications'
      const pushTargets = new Set<number>()
      if (atpeople && atpeople.length > 0) {
        const senderRows = await db
          .select({ nickname: users.nickname, eMail: users.eMail })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
        const sender = senderRows[0] ?? null
        const senderNickname = sender?.nickname ?? ''
        for (const item of atpeople) {
          if (item && item !== userId) pushTargets.add(item)
          const targetRows = await db
            .select({ eMail: users.eMail })
            .from(users)
            .where(eq(users.id, item))
            .limit(1)
          const userat = targetRows[0] ?? null
          if (
            userat &&
            userat.eMail &&
            userat.eMail !== '' &&
            userat.eMail !== sender?.eMail
          ) {
            let tmpmsg = `有一条新提及您的动态！\n                用户名为:  ${senderNickname} 的用户在动态中提及了您，点击查看: ${siteUrl}/detail/${resultId}`
            const templateRows = await db
              .select()
              .from(systemConfig)
              .where(eq(systemConfig.key, 'emailNewMentionCommentNotification'))
              .limit(1)
            const template = templateRows[0] ?? null
            if (template && template.value && template.value !== '') {
              tmpmsg = template.value
            }
            tmpmsg = tmpmsg.replaceAll('{Sitename}', siteConfig?.title ?? '')
            tmpmsg = tmpmsg.replaceAll('{SiteUrl}', siteUrl)
            tmpmsg = tmpmsg.replaceAll(
              '{MemoUrl}',
              `${siteUrl}/detail/${resultId}`,
            )
            tmpmsg = tmpmsg.replaceAll('{Nickname}', senderNickname)
            tmpmsg = tmpmsg.replaceAll('{Content}', body.content)
            if (siteConfig?.enableEmail) {
              await sendEmail(event, {
                email: userat.eMail,
                subject: '新提及',
                message: tmpmsg,
              })
            }
          }
        }
      }

      if (pushTargets.size > 0) {
        const senderRowsForPush = await db
          .select({ nickname: users.nickname })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
        const senderNick = senderRowsForPush[0]?.nickname ?? '某人'
        await Promise.allSettled(
          Array.from(pushTargets).map((uid) =>
            pushToUser(event, uid, {
              title: `${senderNick} 提到了你`,
              body: (body.content || '').slice(0, 80),
              url: `/detail/${resultId}`,
              tag: `at-memo-${resultId}`,
            }).catch(() => null),
          ),
        )
      }
    } catch (notifyErr) {
      console.warn(
        '[memo/save] notifications failed (memo itself was saved):',
        notifyErr instanceof Error ? notifyErr.message : notifyErr,
      )
    }

    // X (Twitter) 同步：和 notifications 一样是非核心副作用,失败绝不能
    // 把已经写好的 memo 搞挂。只在「新建 memo」时触发(编辑不重复发推)。
    let tweetId: string | null = null
    if (body.syncTwitter && !existingMemo) {
      try {
        stage = 'twitter-sync'
        const site = await getTwitterSiteCreds(db)
        if (twitterSiteReady(site)) {
          const [author] = await db
            .select({
              token: users.twitterAccessToken,
              secret: users.twitterAccessSecret,
            })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1)
          if (author?.token && author?.secret) {
            const creds = {
              consumerKey: site.apiKey,
              consumerSecret: site.apiSecret,
              token: author.token,
              tokenSecret: author.secret,
            }
            const link = siteUrl ? `${siteUrl.replace(/\/+$/, '')}/detail/${resultId}` : ''
            const text = buildTweetText(body.content, link)

            // 上传图片(最多 4 张,X 限制)。从 R2 取原始字节再 multipart 上传。
            // Live Photo 存成 "still|video",只取 still 那半;视频暂不传。
            const mediaIds: string[] = []
            const uploads = getCfEnv(event).UPLOADS
            const imgList = Array.isArray(body.imgUrls) ? body.imgUrls.slice(0, 4) : []
            if (uploads && imgList.length > 0) {
              for (const raw of imgList) {
                try {
                  const still = raw.includes('|') ? raw.split('|')[0] : raw
                  const key = still.replace(/^\/upload\//, '')
                  const obj = await uploads.get(key)
                  if (!obj) continue
                  const mime = obj.httpMetadata?.contentType || guessImageMime(key)
                  if (!mime.startsWith('image/')) continue
                  const buf = await obj.arrayBuffer()
                  mediaIds.push(await uploadMedia(creds, buf, mime))
                } catch (mediaErr) {
                  console.warn(
                    '[memo/save] tweet media upload skipped:',
                    mediaErr instanceof Error ? mediaErr.message : mediaErr,
                  )
                }
              }
            }

            const tweet = await postTweet(creds, text, mediaIds.length ? mediaIds : undefined)
            tweetId = tweet.id
            await db.update(memos).set({ tweetId }).where(eq(memos.id, resultId))
          }
        }
      } catch (twErr) {
        console.warn(
          '[memo/save] twitter sync failed (memo itself was saved):',
          twErr instanceof Error ? twErr.message : twErr,
        )
      }
    }

    return {
      success: true,
      id: resultId,
      tweetId,
    }
  } catch (err) {
    // Re-throw createError-style structured throws untouched so the
    // 401 path still surfaces correctly. Anything else gets a 500
    // with the real cause so the next repro is debuggable.
    const e = err as { statusCode?: number; statusMessage?: string; message?: string }
    if (e?.statusCode && e.statusCode >= 400 && e.statusCode < 500) {
      throw err
    }
    const reason = e?.message ?? String(err)
    console.error(`[memo/save] FAIL at stage=${stage}: ${reason}`)
    return {
      success: false,
      message: `保存失败 (${stage}): ${reason}`,
    }
  }
})
