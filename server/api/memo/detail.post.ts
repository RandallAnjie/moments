import { asc, eq } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { comments, memos, users } from '~/lib/db/schema'

type DetailMemoReq = {
  id: any
}

export default defineEventHandler(async (event) => {
  let { id } = (await readBody(event)) as DetailMemoReq
  if (!id) {
    return {
      success: false,
      message: 'id 不能为空',
    }
  }
  id = parseInt(id)

  const db = useDb(event)
  const memoRows = await db
    .select()
    .from(memos)
    .where(eq(memos.id, id))
    .limit(1)
  const memo = memoRows[0] ?? null

  if (!memo) {
    return { data: null, success: true }
  }

  if (memo.availableForProple && memo.availableForProple !== '') {
    const info = memo.availableForProple.split(',')
    if (!info.includes('#' + event.context.userId + '$')) {
      return {
        success: false,
        message: '401 Unauthorized 未授权查看该内容，请登陆或者联系作者获取权限',
      }
    }
  }

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
    .where(eq(users.id, memo.userId))
    .limit(1)
  const user = userRows[0] ?? null

  const commentRows = await db
    .select()
    .from(comments)
    .where(eq(comments.memoId, memo.id))
    .orderBy(asc(comments.createdAt))

  const data = {
    ...memo,
    user,
    comments: commentRows,
    _count: { comments: commentRows.length },
  }

  return {
    data,
    success: true,
  }
})
