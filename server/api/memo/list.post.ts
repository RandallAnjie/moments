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

  let rawMemos: typeof memos.$inferSelect[] = []

  if (userIdFilter !== undefined) {
    rawMemos = await db
      .select()
      .from(memos)
      .where(and(eq(memos.userId, userIdFilter), availableFilter))
      .orderBy(desc(memos.pinned), desc(memos.createdAt))
      .limit(size)
      .offset((page - 1) * size)
  } else {
    // data1: admin (userId=1) pinned memos with content filter + availability
    const data1 = await db
      .select()
      .from(memos)
      .where(
        and(
          eq(memos.userId, 1),
          eq(memos.pinned, true),
          contentFilter,
          availableFilter,
        ),
      )
      .orderBy(desc(memos.createdAt))

    // data2: everything that is NOT (admin AND pinned), same content filter + availability
    const data2 = await db
      .select()
      .from(memos)
      .where(
        and(
          not(and(eq(memos.userId, 1), eq(memos.pinned, true))!),
          contentFilter,
          availableFilter,
        ),
      )
      .orderBy(desc(memos.createdAt))

    rawMemos = data1.concat(data2).slice((page - 1) * size, page * size)
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

  // Per-memo comment counts (the legacy `_count.comments`).
  const commentCountByMemo = new Map<number, number>()
  if (memoIds.length > 0) {
    const countRows = await db
      .select({
        memoId: comments.memoId,
        cnt: sql<number>`count(*)`.as('cnt'),
      })
      .from(comments)
      .where(inArray(comments.memoId, memoIds))
      .groupBy(comments.memoId)
    for (const r of countRows) {
      commentCountByMemo.set(r.memoId, Number(r.cnt) || 0)
    }
  }

  // Per-memo first-6 comments (take:5+1 in the legacy; the +1 is used to
  // signal hasMoreComments without a separate count).
  const commentsByMemo = new Map<number, typeof comments.$inferSelect[]>()
  if (memoIds.length > 0) {
    const allComments = await db
      .select()
      .from(comments)
      .where(inArray(comments.memoId, memoIds))
      .orderBy(asc(comments.createdAt))
    for (const c of allComments) {
      const arr = commentsByMemo.get(c.memoId) ?? []
      if (arr.length < 6) {
        arr.push(c)
        commentsByMemo.set(c.memoId, arr)
      }
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

  // Total count for pagination. When a user filter is active the count is
  // scoped to that user; otherwise it spans every memo matching the filters.
  const totalWhere = userIdFilter !== undefined
    ? and(eq(memos.userId, userIdFilter), contentFilter, availableFilter)
    : and(contentFilter, availableFilter)

  const totalRows = await db
    .select({ value: sql<number>`count(*)` })
    .from(memos)
    .where(totalWhere)
  const total = Number(totalRows[0]?.value ?? 0)
  const totalPage = Math.ceil(total / size)

  return {
    data,
    referencedUsers,
    hasNext: page < totalPage,
    success: true,
  }
})
