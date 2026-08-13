// Configure meting-js's API base URL on the client. The default
// upstream URL had `:auth` placeholder but no signing logic — the
// auth slot was always empty, so any music API that required
// HMAC-signed requests (url / pic / lrc) returned 401.
//
// We now point meting-js at our own server-side proxy
// (`/api/music`), which:
//   - reads metingApi + metingToken + metingVersion from system_config
//   - forwards V1 unchanged or translates the V2 REST resources
//   - keeps all upstream authentication on the server
//
// The token stays on the server. From the browser's perspective,
// the player just calls `/api/music?...` and gets a playlist /
// redirect / lrc back.
//
// We also keep the legacy global mention (`window.meting_api =
// "<upstream>/api?..."`) for backwards compat with any external
// embed that bypasses our DOM (e.g. raw HTML notes), but only when
// auth is NOT configured — if auth is on, exposing the unsigned
// upstream URL would just produce 401s.
export default defineNuxtPlugin(async () => {
  if (!process.client) return

  let upstream = ''
  let authConfigured = false
  let version = 'v1'
  try {
    const r = await fetch('/api/getMetingApi')
    const data = await r.json() as {
      success?: boolean
      data?: { value?: unknown }
      authConfigured?: boolean
      version?: string
    }
    if (data?.success && typeof data.data?.value === 'string' && data.data.value !== '') {
      upstream = data.data.value
    }
    authConfigured = !!data?.authConfigured
    version = data?.version === 'v2' ? 'v2' : 'v1'
  } catch {
    // Fallthrough — defaults below cover the offline case.
  }

  // meting-js placeholders: :server / :type / :id / :auth / :r
  // Our proxy handles the auth piece, so the template doesn't need it.
  const w = window as Window & { meting_api?: string }
  w.meting_api = '/api/music?server=:server&type=:type&id=:id&r=:r'

  // Backwards-compat global (only when no auth → external embeds
  // calling upstream directly still work)
  if (version === 'v1' && !authConfigured && upstream) {
    const base = upstream.endsWith('/') ? upstream : upstream + '/'
    ;(window as any).meting_api_upstream = base + 'api?server=:server&type=:type&id=:id&r=:r'
  }
})
