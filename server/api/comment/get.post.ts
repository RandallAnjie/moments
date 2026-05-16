import { asc, eq } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { comments } from '~/lib/db/schema'

type GetCommentReq = {
  memoId: number
}

export default defineEventHandler(async (event) => {
  const { memoId } = (await readBody(event)) as GetCommentReq
  const db = useDb(event)
  const data = await db
    .select()
    .from(comments)
    .where(eq(comments.memoId, memoId))
    .orderBy(asc(comments.createdAt))
    .limit(10)
  return {
    success: true,
    data,
  }
})
