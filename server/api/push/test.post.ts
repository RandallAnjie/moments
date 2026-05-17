// 让登录用户给自己发一条测试通知。用于验证整条链路。
import { pushToUser } from '~/lib/push'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  if (!userId) return { success: false, message: '请先登录' }
  const r = await pushToUser(event, userId, {
    title: 'Moments 测试通知',
    body: '如果你看到了这条，说明 Web Push 已经通了 🎉',
    url: '/',
    tag: 'moments-test',
  })
  return { success: true, ...r }
})
