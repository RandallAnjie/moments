// Cookie-based auth middleware backed by the Workers JWT utility.
// Token revocation (the old redis-backed allowlist) is intentionally dropped;
// the JWT signature + exp claim are now the only source of truth. If we need
// server-side revocation again, add a KV-backed denylist keyed by jti.
import { verifyToken, type JwtPayload } from '~/lib/auth/jwt'

const needLoginUrl = [
  '/api/memo/save',
  '/api/files/s3Presigned',
  '/api/files/upload',
  '/api/memo/remove',
  '/api/user/settings/save',
  '/api/user/settings/full',
  '/api/sendEmail',
]

const needAdminUrl = [
  '/api/site/config/save',
]

export default defineEventHandler(async (event) => {
  const cookieToken = getCookie(event, 'token')
  const payload = cookieToken
    ? await verifyToken<JwtPayload>(event, cookieToken)
    : null

  if (cookieToken && !payload) {
    setCookie(event, 'token', '', { httpOnly: true, maxAge: 0, path: '/' })
    setCookie(event, 'userId', '', { httpOnly: true, maxAge: 0, path: '/' })
  }

  const url = getRequestURL(event)

  if (payload && (url.pathname === '/login' || url.pathname === '/register')) {
    await sendRedirect(event, '/', 302)
    return
  }

  if (needAdminUrl.includes(url.pathname)) {
    if (!payload || payload.userId !== 1) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
  }

  if (needLoginUrl.includes(url.pathname) && !payload) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (payload) {
    event.context.userId = payload.userId
    event.context.token = cookieToken
  }
})
