import { eq } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { memos } from '~/lib/db/schema'

type RemoveMemoReq = {
  memoId?: number
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as RemoveMemoReq
  const memoId = Number(body?.memoId)
  if (!Number.isFinite(memoId) || memoId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'memoId is required' })
  }

  const db = useDb(event)
  const found = await db
    .select({ userId: memos.userId, imgs: memos.imgs })
    .from(memos)
    .where(eq(memos.id, memoId))
    .limit(1)
  const memo = found[0]
  if (!memo) {
    return { success: true }
  }
  if (memo.userId !== event.context.userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  await db.delete(memos).where(eq(memos.id, memoId))

  const uploads = event.context.cloudflare?.env.UPLOADS
  if (uploads && memo.imgs) {
    const keys = memo.imgs
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.startsWith('/upload/'))
      .map((s) => s.replace(/^\/upload\//, ''))
      .filter((k) => k.length > 0)
    await Promise.all(
      keys.map(async (key) => {
        try {
          await uploads.delete(key)
        } catch (e) {
          console.log('R2 delete error:', e)
        }
      }),
    )
  }

  return { success: true }
})
