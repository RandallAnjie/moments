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

  const data: typeof memo & {
    user: typeof user
    comments: typeof commentRows
    _count: { comments: number }
  } = {
    ...memo,
    user,
    comments: commentRows,
    _count: { comments: commentRows.length },
  }

  if (data.availableForProple && data.availableForProple !== '') {
    const info = data.availableForProple.split(',')
    if (info.includes('#' + event.context.userId + '$')) {
      return {
        data,
        success: true,
      }
    }
    return {
      success: false,
      message: '401 Unauthorized 未授权查看该内容，请登陆或者联系作者获取权限',
    }
  }

  if (data.content) {
    try {
      const res = await fetch(
        `https://translate.api.randallanjie.com/?text=${encodeURIComponent(data.content)}`,
      )
      const result = (await res.json()) as
        | { response?: { translated_text?: string } }
        | null
      if (result && result.response && result.response.translated_text) {
        data.content = result.response.translated_text
      }
    } catch (_e) {
      // Translation is best-effort; on failure, return the original content.
    }
  }

  return {
    data,
    success: true,
  }
})
