import { eq } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { pushSubscriptions } from '~/lib/db/schema'

type UnsubReq = { endpoint: string }

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  if (!userId) return { success: false, message: '请先登录' }
  const body = (await readBody(event)) as UnsubReq
  if (!body?.endpoint) return { success: false, message: '缺少 endpoint' }
  const db = useDb(event)
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, body.endpoint))
  return { success: true }
})
