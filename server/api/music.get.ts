// Server-side proxy for the music API. We share the configured
// METING_TOKEN with the upstream Meting-API worker, so the simplest
// thing to do is forward the master token directly via `?token=`
// — the upstream's master-key bypass then signs search/song/
// playlist responses for the embedded player and waves through
// url/pic/lrc without making us compute a per-id HMAC.
//
// (The HMAC dance is still supported upstream for clients that
// don't know the master token, e.g. the meting-js fetcher when
// it follows a signed search row. We're not one of those clients
// because we're server-side and already trust ourselves.)
//
// meting-js calls `<this URL>?server=:server&type=:type&id=:id&r=:r`.
// 302 from upstream — re-emitted as a Location header so meting-js
// gets the same URL it would've gotten talking to upstream directly.
import { inArray } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { systemConfig } from '~/lib/db/schema'

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
    // Master-key bypass — upstream treats ?token=METING_TOKEN as
    // "this caller is trusted, sign search rows + waive HMAC".
    params.set('token', token)
  } else if (q.auth) {
    // No configured token but the caller already pre-signed.
    // Forward the HMAC verbatim — works against legacy upstreams
    // that don't speak the master-key channel.
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
