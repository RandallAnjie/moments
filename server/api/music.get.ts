// Server-side proxy for the music API. Signs each request with the
// configured METING_TOKEN (system_config.metingToken) before forwarding
// to the upstream API base — Meting-API style url/pic/lrc routes
// require an HMAC-SHA1(token, server+type+id) signature, and that
// secret must never leave the server.
//
// meting-js calls `<this URL>?server=:server&type=:type&id=:id&r=:r`;
// we attach &auth=<sig> when the token is set, otherwise pass through
// unchanged (works against legacy unauthenticated APIs too).
//
// 302/301 from upstream — re-emitted as a Location header so meting-js
// gets the same URL it would've gotten talking to upstream directly.
import { createHmac } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { systemConfig } from '~/lib/db/schema'

function sign (token: string, server: string, type: string, id: string): string {
  return createHmac('sha1', token).update(`${server}${type}${id}`).digest('hex')
}

function normaliseBase (raw: string): string {
  let v = raw.trim()
  if (!v) return ''
  // Allow both `https://host/` and `https://host` — we always emit
  // `<base>/api?...`.
  return v.endsWith('/') ? v.slice(0, -1) : v
}

export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const rows = await db
    .select({ key: systemConfig.key, value: systemConfig.value })
    .from(systemConfig)
    .where(inArray(systemConfig.key, ['metingApi', 'metingToken']))
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]))

  const base = normaliseBase(map.metingApi || 'https://meting-dd.2333332.xyz/')
  const token = (map.metingToken || '').trim()

  const q = getQuery(event)
  const server = String(q.server || 'netease')
  const type = String(q.type || 'search')
  const id = String(q.id || 'hello')
  const r = String(q.r || Math.random())

  const params = new URLSearchParams({ server, type, id, r })
  if (token) {
    params.set('auth', sign(token, server, type, id))
  } else if (q.auth) {
    // Caller pre-signed (unusual) — let it through.
    params.set('auth', String(q.auth))
  }

  const upstream = `${base}/api?${params.toString()}`

  let res: Response
  try {
    res = await fetch(upstream, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        // Forward Referer so the upstream (Meting-API) can decide
        // whether to attach platform cookies — same gating as
        // calling directly.
        'referer': getRequestHeader(event, 'referer') || '',
        'accept': 'application/json, */*',
      },
    })
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    throw createError({ statusCode: 502, statusMessage: `upstream fetch failed: ${reason}` })
  }

  // Surface 3xx Location verbatim — url / pic types redirect to the
  // real media URL and meting-js wants the final media link.
  const status = res.status
  setResponseStatus(event, status)
  const ct = res.headers.get('content-type')
  if (ct) setHeader(event, 'Content-Type', ct)
  const loc = res.headers.get('location')
  if (loc) setHeader(event, 'Location', loc)
  // Mirror cache header on success so an aggressive CDN doesn't
  // hammer upstream for the same playlist.
  if (status >= 200 && status < 300) {
    setHeader(event, 'Cache-Control', 'public, max-age=300')
  }
  if (status >= 300 && status < 400) {
    return ''
  }
  // Stream body — works for JSON and lrc text alike.
  return res.body
})
