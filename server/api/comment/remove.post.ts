import { eq } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { comments, memos } from '~/lib/db/schema'

type RemoveCommentReq = {
  commentId: number
}

export default defineEventHandler(async (event) => {
  const { commentId } = (await readBody(event)) as RemoveCommentReq
  const db = useDb(event)

  const commentRows = await db
    .select({ memoId: comments.memoId })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1)
  const comment = commentRows[0] ?? null

  if (comment) {
    const memoRows = await db
      .select({ userId: memos.userId })
      .from(memos)
      .where(eq(memos.id, comment.memoId))
      .limit(1)
    const memo = memoRows[0] ?? null
    if (memo && memo.userId !== event.context.userId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
      })
    }
  }

  await db.delete(comments).where(eq(comments.id, commentId))

  return {
    success: true,
  }
})
