// Cloudflare-native registration: D1 (drizzle) + PBKDF2 password hash +
// KV-backed email verification codes. Verification codes are written by
// sendMail.post.ts under key `register${email}` with a 5-minute TTL.
import { eq, like } from 'drizzle-orm'
import { hashPassword } from '~/lib/auth/password'
import { useDb } from '~/lib/db/d1'
import { systemConfig, users } from '~/lib/db/schema'

type registerReq = {
  username: string
  email: string
  password: string
  emailVerificationCode: string
}

function getKv(event: any): KVNamespace {
  const kv = event?.context?.cloudflare?.env?.KV as KVNamespace | undefined
  if (!kv) {
    throw new Error(
      'KV binding "KV" is not available on event.context.cloudflare.env. ' +
        'Run via `wrangler pages dev` (or deploy to Pages) so the binding is injected.',
    )
  }
  return kv
}

export default defineEventHandler(async (event) => {
  const { username, email, password, emailVerificationCode } =
    (await readBody(event)) as registerReq

  if (!email) {
    return { success: false, message: '邮箱不能为空' }
  } else if (!/^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(email)) {
    return { success: false, message: '邮箱格式不正确' }
  }

  if (!username) {
    return { success: false, message: '用户名不能为空' }
  }

  if (!password) {
    return { success: false, message: '密码不能为空' }
  }

  if (password.length < 6) {
    return { success: false, message: '密码长度不能小于6位' }
  }

  if (password.length > 20) {
    return { success: false, message: '密码长度不能大于20位' }
  }

  if (!emailVerificationCode) {
    return { success: false, message: '验证码不能为空' }
  }

  const db = useDb(event)

  const enableRegisterRows = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, 'enableRegister'))
    .limit(1)
  const enableRegister = enableRegisterRows[0]
  if (!enableRegister || enableRegister.value !== '1') {
    return { success: false, message: '站点未开启注册' }
  }

  const kv = getKv(event)
  const codeKey = 'register' + email
  const retrievedCode = await kv.get(codeKey)
  if (retrievedCode === null || retrievedCode !== emailVerificationCode) {
    return { success: false, message: '验证码错误' }
  }

  const existingByEmail = await db
    .select()
    .from(users)
    .where(eq(users.eMail, email))
    .limit(1)
  if (existingByEmail[0]) {
    return { success: false, message: '该邮箱已经注册' }
  }

  // Preserve legacy substring-match semantic on username uniqueness.
  const existingByUsername = await db
    .select()
    .from(users)
    .where(like(users.username, '%' + username + '%'))
    .limit(1)
  if (existingByUsername[0]) {
    return { success: false, message: '用户名已经注册' }
  }

  const now = new Date().toISOString()
  const passwordHash = await hashPassword(password)
  await db.insert(users).values({
    username,
    nickname: username,
    eMail: email,
    avatarUrl: '/avatar.webp',
    coverUrl: '/cover.webp',
    slogan: '这个人很懒，什么都没有留下',
    password: passwordHash,
    enableS3: false,
    createdAt: now,
    updatedAt: now,
  })

  await kv.delete(codeKey)

  return { success: true }
})
