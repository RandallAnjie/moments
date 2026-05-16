// Cloudflare-native password reset: D1 (drizzle) + PBKDF2 password hash +
// KV-backed email verification codes. Verification codes are written by
// sendMail.post.ts under key `resetPassword${email}` with a 5-minute TTL.
import { eq } from 'drizzle-orm'
import { hashPassword } from '~/lib/auth/password'
import { useDb } from '~/lib/db/d1'
import { users } from '~/lib/db/schema'
import { getCfEnv } from '~/lib/cf-env'

type registerReq = {
  user: string
  password: string
  emailVerificationCode: string
}

function getKv(event: any): KVNamespace {
  const kv = getCfEnv(event).KV
  if (!kv) {
    throw new Error(
      'KV binding "KV" is not available on event.context.cloudflare.env or globalThis.__CF_ENV__.',
    )
  }
  return kv
}

export default defineEventHandler(async (event) => {
  const { user, password, emailVerificationCode } =
    (await readBody(event)) as registerReq

  if (!user || !password || !emailVerificationCode) {
    return { success: false, message: '参数错误' }
  }

  if (password.length < 6) {
    return { success: false, message: '密码长度不能小于6位' }
  }

  if (password.length > 20) {
    return { success: false, message: '密码长度不能大于20位' }
  }

  const userId = Number(user)
  if (!Number.isFinite(userId) || userId <= 0) {
    return { success: false, message: '用户不存在或者邮箱未绑定' }
  }

  const db = useDb(event)

  const targetRows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  const target = targetRows[0]
  if (!target || !target.eMail) {
    return { success: false, message: '用户不存在或者邮箱未绑定' }
  }
  const email = target.eMail

  const kv = getKv(event)
  const codeKey = 'resetPassword' + email
  const retrievedCode = await kv.get(codeKey)
  if (retrievedCode === null || retrievedCode !== emailVerificationCode) {
    return { success: false, message: '验证码错误或过期' }
  }

  const now = new Date().toISOString()
  const passwordHash = await hashPassword(password)
  await db
    .update(users)
    .set({ password: passwordHash, updatedAt: now })
    .where(eq(users.id, userId))

  await kv.delete(codeKey)

  return { success: true }
})
