// Server-side compatibility proxy for Meting API v1 and v2.
//
// MetingJS always calls the legacy `server/type/id` protocol and expects a
// flat track array. V1 is forwarded unchanged. V2 uses REST resource routes
// and `{ data, meta, links }`, so JSON resources are translated back to the
// legacy player shape. Protected stream/artwork/lyrics links are rewritten
// through this proxy, keeping METING_TOKEN on the server.
import { inArray } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { systemConfig } from '~/lib/db/schema'
import {
  buildMetingV1Url,
  buildMetingV2Request,
  isMetingV2JsonType,
  metingV2ToLegacyTracks,
  normaliseMetingVersion,
} from '~/server/utils/meting'

function normaliseBase (raw: string): string {
  const v = raw.trim()
  if (!v) return ''
  return v.endsWith('/') ? v.slice(0, -1) : v
}

const FORWARDED_HEADERS = [
  'accept-ranges',
  'cache-control',
  'content-length',
  'content-range',
  'content-type',
  'etag',
  'last-modified',
  'location',
  'x-cache-source',
  'x-meting-bitrate-kbps',
  'x-meting-quality',
] as const

function forwardResponseHeaders (event: Parameters<typeof setHeader>[0], res: Response) {
  for (const name of FORWARDED_HEADERS) {
    const value = res.headers.get(name)
    if (value) setHeader(event, name, value)
  }
}

export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const rows = await db
    .select({ key: systemConfig.key, value: systemConfig.value })
    .from(systemConfig)
    .where(inArray(systemConfig.key, ['metingApi', 'metingToken', 'metingVersion']))
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]))

  const base = normaliseBase(map.metingApi || 'https://meting-dd.2333332.xyz/')
  const token = (map.metingToken || '').trim()
  const version = normaliseMetingVersion(map.metingVersion, base)

  const q = getQuery(event)
  const server = String(q.server || 'netease')
  const type = String(q.type || 'search')
  const id = String(q.id || 'hello')
  const r = String(q.r || Math.random())

  let upstream: string
  let isV2Media = false
  try {
    if (version === 'v2') {
      const request = buildMetingV2Request(base, { server, type, id, r })
      upstream = request.url
      isV2Media = request.media
    } else {
      upstream = buildMetingV1Url(
        base,
        { server, type, id, r },
        token,
        q.auth ? String(q.auth) : undefined,
      )
    }
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    throw createError({ statusCode: 400, statusMessage: reason })
  }

  const headers: Record<string, string> = {
    referer: getRequestHeader(event, 'referer') || '',
    accept: isV2Media ? '*/*' : 'application/json, */*',
  }
  if (version === 'v2' && token) headers.authorization = `Bearer ${token}`
  const range = getRequestHeader(event, 'range')
  if (version === 'v2' && type === 'url' && range) headers.range = range

  let res: Response
  try {
    res = await fetch(upstream, {
      method: 'GET',
      redirect: 'manual',
      headers,
    })
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    throw createError({ statusCode: 502, statusMessage: `upstream fetch failed: ${reason}` })
  }

  const status = res.status
  const transformsV2Json = version === 'v2'
    && isMetingV2JsonType(type)
    && status >= 200
    && status < 300
  setResponseStatus(event, status)
  // A transformed V2 JSON response has different bytes from upstream, so its
  // Content-Length/ETag must not leak into the legacy response.
  if (transformsV2Json) {
    const cacheControl = res.headers.get('cache-control')
    if (cacheControl) setHeader(event, 'Cache-Control', cacheControl)
  } else {
    forwardResponseHeaders(event, res)
  }
  if (status >= 200 && status < 300) {
    if (!res.headers.has('cache-control')) {
      setHeader(event, 'Cache-Control', isV2Media
        ? 'public, max-age=3600'
        : 'public, max-age=300')
    }
  }
  if (status >= 300 && status < 400) {
    return ''
  }

  if (transformsV2Json) {
    let payload: unknown
    try {
      payload = await res.json()
    } catch {
      throw createError({ statusCode: 502, statusMessage: 'Meting v2 returned invalid JSON' })
    }
    return metingV2ToLegacyTracks(payload)
  }

  // V1 responses and V2 media/error bodies are passed through byte-for-byte.
  return res.body
})
