// Cloudflare-native memo listing:
//   - D1 (drizzle) replaces prisma for User/Memo/Comment reads
//   - Two-query no-user branch preserved verbatim (admin pinned memos first,
//     everything-else second, JS slice into pages)
//   - Per-memo {user, comments:[first 6], _count:{comments}} shape matches
//     the legacy include payload the frontend consumes
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  like,
  not,
  or,
  sql,
} from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { comments, memos, users } from '~/lib/db/schema'

type ListMemoReq = {
  user: any
  tagname: any
  searchname: any
  page: number
}

export default defineEventHandler(async (event) => {
  let { user, page, tagname, searchname } = (await readBody(event)) as ListMemoReq
  let userIdFilter: number | undefined = parseInt(user)
  if (!Number.isFinite(userIdFilter) || userIdFilter <= 0) {
    userIdFilter = undefined
  }

  const db = useDb(event)

  if (userIdFilter !== undefined) {
    const userRows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userIdFilter))
      .limit(1)
    if (userRows.length === 0) {
      userIdFilter = undefined
    }
  }

  const size = 10
  const ctxUserId = event.context.userId
  const needle = tagname ? '#' + tagname : (searchname ? searchname : '')

  // The availableForProple filter: row is visible iff
  //   availableForProple IS NULL OR availableForProple='' OR contains "#<viewer>$"
  const availableFilter = or(
    isNull(memos.availableForProple),
    eq(memos.availableForProple, ''),
    like(memos.availableForProple, `%#${ctxUserId}$%`),
  )

  // Content contains filter (Prisma's `contains: ''` becomes `LIKE '%%'`,
  // which matches every non-null content row — preserve that semantic).
  const contentFilter = like(memos.content, `%${needle}%`)

  // +1 trick：多取 1 条来判断 hasNext，省掉单独的 COUNT(*) 查询
  const fetchLimit = size + 1
  let rawMemos: typeof memos.$inferSelect[] = []
  let hasNext = false

  if (userIdFilter !== undefined) {
    const rows = await db
      .select()
      .from(memos)
      .where(and(eq(memos.userId, userIdFilter), availableFilter))
      .orderBy(desc(memos.pinned), desc(memos.createdAt))
      .limit(fetchLimit)
      .offset((page - 1) * size)
    hasNext = rows.length > size
    rawMemos = rows.slice(0, size)
  } else {
    // 用单条 SQL 直接实现 "admin pinned 在前 + 其它按 createdAt 倒序"：
    //   ORDER BY (userId=1 AND pinned=1) DESC, createdAt DESC
    // 旧实现拉全表 pinned + 全表非 pinned 再 JS slice，N 越大越浪费。现在按需 LIMIT。
    const rows = await db
      .select()
      .from(memos)
      .where(and(contentFilter, availableFilter))
      .orderBy(
        sql`(CASE WHEN ${memos.userId} = 1 AND ${memos.pinned} = 1 THEN 0 ELSE 1 END) ASC`,
        desc(memos.createdAt),
      )
      .limit(fetchLimit)
      .offset((page - 1) * size)
    hasNext = rows.length > size
    rawMemos = rows.slice(0, size)
  }

  // [TEMP DEBUG] 排查「list 返回空」—— 打印 Memo 表真实总行数 + 本次过滤参数。
  // 查清后删除（连同 debug-count.get.ts）。
  try {
    const totalRows = await db.select({ c: sql<number>`count(*)` }).from(memos)
    const total = Number(totalRows[0]?.c ?? 0)
    console.log(
      '[memo/list][DEBUG]',
      JSON.stringify({ totalMemoRows: total, ctxUserId, userIdFilter, page, matched: rawMemos.length, hasNext }),
    )
  } catch (e) {
    console.log('[memo/list][DEBUG] count failed:', e instanceof Error ? e.message : e)
  }

  // Hydrate users + comments in batch, then assemble the legacy response shape.
  const memoIds = rawMemos.map((m) => m.id)
  const userIds = Array.from(new Set(rawMemos.map((m) => m.userId)))

  const userById = new Map<number, {
    username: string | null
    nickname: string | null
    slogan: string | null
    id: number
    avatarUrl: string | null
    coverUrl: string | null
  }>()
  if (userIds.length > 0) {
    const userRows = await db
      .select({
        username: users.username,
        nickname: users.nickname,
        slogan: users.slogan,
        id: users.id,
        avatarUrl: users.avatarUrl,
        coverUrl: users.coverUrl,
      })
      .from(users)
      .where(inArray(users.id, userIds))
    for (const u of userRows) {
      userById.set(u.id, u)
    }
  }

  // Per-memo comment 计数 + 每 memo 取前 6 条（hasMoreComments = total > 5）
  // 用一条带 ROW_NUMBER 窗口函数的 SQL 只读必要的行，避免评论多的 memo 全表扫描
  const commentCountByMemo = new Map<number, number>()
  const commentsByMemo = new Map<number, typeof comments.$inferSelect[]>()
  if (memoIds.length > 0) {
    // 取出每条评论 + 其在所属 memo 内的排序号 + 该 memo 评论总数
    const rows = await db.all<any>(sql`
      WITH ranked AS (
        SELECT *,
               ROW_NUMBER() OVER (PARTITION BY memoId ORDER BY createdAt ASC) AS rn,
               COUNT(*)     OVER (PARTITION BY memoId)                        AS total
        FROM Comment
        WHERE memoId IN (${sql.join(memoIds, sql`, `)})
      )
      SELECT * FROM ranked WHERE rn <= 6
    `)
    for (const c of rows as any[]) {
      if (!commentCountByMemo.has(c.memoId)) {
        commentCountByMemo.set(c.memoId, Number(c.total) || 0)
      }
      const arr = commentsByMemo.get(c.memoId) ?? []
      arr.push(c)
      commentsByMemo.set(c.memoId, arr)
    }
  }

  let data: any[] = rawMemos.map((memo) => {
    const memoComments = commentsByMemo.get(memo.id) ?? []
    const totalCount = commentCountByMemo.get(memo.id) ?? 0
    return {
      ...memo,
      user: userById.get(memo.userId) ?? null,
      comments: memoComments,
      _count: { comments: totalCount },
    }
  })

  // Drop comments with content too long for the inline preview (legacy parity).
  data = data.map((memo) => ({
    ...memo,
    comments: memo.comments.filter(
      (comment: any) => comment.content && comment.content.length < 100,
    ),
    hasMoreComments:
      memo._count.comments > 5 ||
      memo.comments.some(
        (comment: any) => comment.content && comment.content.length >= 100,
      ),
    avpeople: (memo.availableForProple
      ? memo.availableForProple
          .split(',')
          .map((item: string) => item.split('#')[1].split('$')[0])
      : []
    ).join(','),
  }))
  // Trim to the first 5 (the +1 was only to detect "more").
  data = data.map((memo) => ({
    ...memo,
    comments: memo.comments.slice(0, 5),
  }))

  // ---------------------------------------------------------------------------
  // 顺便把这一页所有 memo 引用到的用户（atpeople + avpeople + comment 作者）
  // 的昵称/头像 一起 batch 出来，让前端 SPA 缓存命中，省掉每条 memo 单独
  // /api/user/settings/get?user=X 的请求（Cloudflare 上 request-count 敏感）。
  // ---------------------------------------------------------------------------
  const referencedUserIds = new Set<number>()
  for (const memo of data) {
    if (memo.atpeople) {
      for (const id of memo.atpeople.split(',')) {
        const n = parseInt(id, 10)
        if (n > 0) referencedUserIds.add(n)
      }
    }
    if (memo.avpeople) {
      for (const id of memo.avpeople.split(',')) {
        const n = parseInt(id, 10)
        if (n > 0) referencedUserIds.add(n)
      }
    }
    for (const c of memo.comments) {
      if (typeof c.author === 'number' && c.author > 0) referencedUserIds.add(c.author)
      if (typeof c.replyToUser === 'number' && c.replyToUser > 0) referencedUserIds.add(c.replyToUser)
      if (typeof c.linkedUser === 'number' && c.linkedUser > 0) referencedUserIds.add(c.linkedUser)
    }
  }
  // 主作者那 N 个用户已经在 userById 里了，不用再查
  for (const id of userById.keys()) referencedUserIds.delete(id)

  const referencedUsers: Record<string, {
    nickname: string | null
    avatarUrl: string | null
    slogan: string | null
    coverUrl: string | null
  }> = {}
  // 先把 userById 里的也带上
  for (const [id, u] of userById) {
    referencedUsers[String(id)] = {
      nickname: u.nickname,
      avatarUrl: u.avatarUrl,
      slogan: u.slogan,
      coverUrl: u.coverUrl,
    }
  }
  if (referencedUserIds.size > 0) {
    const extra = await db
      .select({
        id: users.id,
        nickname: users.nickname,
        avatarUrl: users.avatarUrl,
        slogan: users.slogan,
        coverUrl: users.coverUrl,
      })
      .from(users)
      .where(inArray(users.id, Array.from(referencedUserIds)))
    for (const u of extra) {
      referencedUsers[String(u.id)] = {
        nickname: u.nickname,
        avatarUrl: u.avatarUrl,
        slogan: u.slogan,
        coverUrl: u.coverUrl,
      }
    }
  }

  // hasNext 来自上面 +1 trick，无需再发 COUNT(*) 查询
  return {
    data,
    referencedUsers,
    hasNext,
    success: true,
  }
})
