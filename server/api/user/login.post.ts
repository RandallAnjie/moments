// Cloudflare-native login: D1 (drizzle) + Web Crypto PBKDF2 + Workers JWT.
// Legacy bcrypt hashes still verify and are transparently upgraded to PBKDF2
// on first successful login (see verifyPassword → needsRehash).
import { eq, or } from 'drizzle-orm'
import { signToken, getJwtExpiresInSeconds } from '~/lib/auth/jwt'
import { hashPassword, verifyPassword } from '~/lib/auth/password'
import { useDb } from '~/lib/db/d1'
import { users } from '~/lib/db/schema'

type loginReq = {
  username: string
  password: string
}

export type JwtPayload = {
  username: string
  exp: number
  userId: number
}

export default defineEventHandler(async (event) => {
  const { username, password } = (await readBody(event)) as loginReq
  let token = ''
  if (!username || !password) {
    return {
      success: false,
      message: '用户名（邮箱）或密码不能为空',
      token,
    }
  }

  const db = useDb(event)
  const rows = await db
    .select()
    .from(users)
    .where(or(eq(users.username, username), eq(users.eMail, username)))
    .limit(1)
  const user = rows[0]

  if (!user) {
    return {
      message: '用户名（邮箱）或密码错误',
      success: false,
      token,
    }
  }

  const result = await verifyPassword(password, user.password)
  if (!result.valid) {
    return {
      message: '用户名（邮箱）或密码错误',
      success: false,
      token,
    }
  }

  if (result.needsRehash) {
    const newHash = await hashPassword(password)
    await db.update(users).set({ password: newHash }).where(eq(users.id, user.id))
  }

  token = await signToken(event, {
    username: user.username,
    userId: user.id,
  })

  const ttlSeconds = getJwtExpiresInSeconds(event)
  const cookieExpires = new Date(Date.now() + ttlSeconds * 1000)
  setCookie(event, 'token', token, { expires: cookieExpires })
  setCookie(event, 'userId', '' + user.id, { expires: cookieExpires })

  return {
    success: true,
    userinfo: {
      username: user.username,
      userId: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      slogan: user.slogan,
      coverUrl: user.coverUrl,
      favicon: user.favicon,
      title: user.title,
      css: user.css,
      js: user.js,
    },
    message: '',
  }
})
