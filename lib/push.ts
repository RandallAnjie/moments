// 给定 userId，向他所有订阅推送一条通知。失败的 endpoint（404/410/408）从 DB 删掉。
import { eq, inArray } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { getCfEnv } from '~/lib/cf-env'
import { useDb } from '~/lib/db/d1'
import { pushSubscriptions } from '~/lib/db/schema'
import { sendWebPush, type VapidKeys } from '~/lib/webpush'

export type NotificationPayload = {
  title: string
  body: string
  /** 点通知打开的页面（相对 URL） */
  url?: string
  /** badge 计数（PWA） */
  badge?: number
  /** 用于去重的 tag —— 同 tag 的新通知会覆盖旧的 */
  tag?: string
  /** icon 图片 URL（默认用站点 logo） */
  icon?: string
}

function getVapid(event: H3Event): VapidKeys | null {
  const env = getCfEnv(event) as Record<string, string | undefined>
  const publicKey = env.VAPID_PUBLIC_KEY
  const privateKey = env.VAPID_PRIVATE_KEY
  const subject = env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) return null
  return { publicKey, privateKey, subject }
}

export async function pushToUser(
  event: H3Event,
  userId: number,
  payload: NotificationPayload,
): Promise<{ sent: number; failed: number }> {
  const vapid = getVapid(event)
  if (!vapid) {
    console.warn('[push] VAPID 未配置，跳过')
    return { sent: 0, failed: 0 }
  }
  const db = useDb(event)
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
  if (subs.length === 0) return { sent: 0, failed: 0 }

  const body = JSON.stringify(payload)
  const goneIds: number[] = []
  let sent = 0, failed = 0
  await Promise.all(
    subs.map(async (s) => {
      try {
        const res = await sendWebPush({
          subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload: body,
          vapid,
        })
        if (res.ok) sent++
        else {
          failed++
          if (res.isGone) goneIds.push(s.id)
        }
      } catch (e) {
        failed++
        console.warn('[push] send fail', s.endpoint, e)
      }
    }),
  )
  if (goneIds.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, goneIds))
  }
  return { sent, failed }
}
