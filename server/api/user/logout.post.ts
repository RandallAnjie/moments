// Logout clears the auth cookies. There is no server-side token store to
// purge — JWTs validate purely from their signature + exp. A KV-backed
// denylist can be added later if explicit revocation becomes a requirement.
export default defineEventHandler((event) => {
  setCookie(event, 'token', '', { httpOnly: true, maxAge: 0, path: '/' })
  setCookie(event, 'userId', '', { httpOnly: true, maxAge: 0, path: '/' })
  return { success: true }
})
