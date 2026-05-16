import { eq } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { memos } from '~/lib/db/schema'

type PinnedMemoReq = {
  memoId?: number
  pinned: boolean
}

export default defineEventHandler(async (event) => {
  const { memoId, pinned } = (await readBody(event)) as PinnedMemoReq
  if (memoId === undefined || memoId === null) {
    return { success: false, message: 'memoId 不能为空' }
  }

  const db = useDb(event)
  const memoRows = await db
    .select({ userId: memos.userId })
    .from(memos)
    .where(eq(memos.id, memoId))
    .limit(1)
  const memo = memoRows[0] ?? null

  if (memo && memo.userId !== event.context.userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  await db
    .update(memos)
    .set({ pinned, updatedAt: new Date().toISOString() })
    .where(eq(memos.id, memoId))

  return {
    success: true,
  }
})
