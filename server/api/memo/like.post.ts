import { eq, sql } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { memos } from '~/lib/db/schema'

type LikeMemoReq = {
  memoId?: number
  like: boolean
}

export default defineEventHandler(async (event) => {
  const { memoId, like } = (await readBody(event)) as LikeMemoReq
  if (memoId === undefined || memoId === null) {
    return { success: false, message: 'memoId 不能为空' }
  }
  const delta = like ? 1 : -1
  const db = useDb(event)
  const updated = await db
    .update(memos)
    .set({
      favCount: sql`${memos.favCount} + ${delta}`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(memos.id, memoId))
    .returning({ favCount: memos.favCount })

  const data = updated[0] ?? null
  return {
    success: true,
    data,
  }
})
