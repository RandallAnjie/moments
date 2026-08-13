export type MetingApiVersion = 'v1' | 'v2'

export type MetingLegacyQuery = {
  server: string
  type: string
  id: string
  r: string
}

type MetingV2Artist = {
  name?: unknown
}

type MetingV2Track = {
  id?: unknown
  source?: unknown
  title?: unknown
  artists?: unknown
  album?: { id?: unknown, name?: unknown } | null
  artwork?: { url?: unknown } | null
  playback?: { available?: unknown } | null
  links?: {
    stream?: unknown
    artwork?: unknown
    lyrics?: unknown
  } | null
}

export type MetingV2Request = {
  url: string
  media: boolean
}

const V2_JSON_TYPES = new Set(['search', 'song', 'playlist', 'album', 'artist'])
const V2_MEDIA_TYPES = new Set(['url', 'pic', 'lrc'])

function trimTrailingSlash (value: string): string {
  return value.replace(/\/+$/, '')
}

function v1Root (base: string): string {
  const root = trimTrailingSlash(base)
  return root.endsWith('/api') ? root : `${root}/api`
}

function v2Root (base: string): string {
  const root = trimTrailingSlash(base)
  return root.endsWith('/api/v2') ? root : `${root}/api/v2`
}

function pathSegment (value: string): string {
  return encodeURIComponent(value)
}

export function normaliseMetingVersion (value: unknown, base = ''): MetingApiVersion {
  if (value === 'v1' || value === 'v2') return value
  // Existing installations predate the version field. Recognise the official
  // V2 endpoint (and explicit /api/v2 bases) without changing other legacy
  // installations, which must continue to default to V1.
  try {
    const url = new URL(base)
    if (url.hostname === 'music.rapi.rest' || /\/api\/v2\/?$/.test(url.pathname)) {
      return 'v2'
    }
  } catch {
    // An invalid/relative legacy value follows the conservative V1 fallback.
  }
  return 'v1'
}

export function buildMetingV1Url (
  base: string,
  query: MetingLegacyQuery,
  token: string,
  auth?: string,
): string {
  const params = new URLSearchParams(query)
  if (token) params.set('token', token)
  else if (auth) params.set('auth', auth)
  return `${v1Root(base)}?${params.toString()}`
}

export function buildMetingV2Request (
  base: string,
  query: MetingLegacyQuery,
): MetingV2Request {
  const root = v2Root(base)
  const source = pathSegment(query.server)
  const id = pathSegment(query.id)
  let url: URL

  switch (query.type) {
    case 'search':
      url = new URL(`${root}/tracks`)
      url.searchParams.set('query', query.id)
      url.searchParams.set('source', query.server)
      url.searchParams.set('view', 'compact')
      url.searchParams.set('limit', '30')
      break
    case 'song':
      url = new URL(`${root}/tracks/${source}`)
      url.searchParams.set('ids', query.id)
      url.searchParams.set('view', 'compact')
      break
    case 'playlist':
      url = new URL(`${root}/playlists/${source}/${id}/tracks`)
      url.searchParams.set('view', 'compact')
      url.searchParams.set('limit', '100')
      break
    case 'album':
      url = new URL(`${root}/albums/${source}/${id}/tracks`)
      url.searchParams.set('view', 'compact')
      url.searchParams.set('limit', '100')
      break
    case 'artist':
      url = new URL(`${root}/artists/${source}/${id}/top-tracks`)
      url.searchParams.set('view', 'compact')
      url.searchParams.set('limit', '100')
      break
    case 'url':
      url = new URL(`${root}/streams/${source}/${id}`)
      url.searchParams.set('quality', 'auto')
      break
    case 'pic':
      url = new URL(`${root}/artworks/${source}/${id}`)
      break
    case 'lrc':
      url = new URL(`${root}/lyrics/${source}/${id}`)
      url.searchParams.set('granularity', 'line')
      break
    default:
      throw new Error(`unsupported Meting v2 type: ${query.type}`)
  }

  return { url: url.toString(), media: V2_MEDIA_TYPES.has(query.type) }
}

export function isMetingV2JsonType (type: string): boolean {
  return V2_JSON_TYPES.has(type)
}

function stringValue (value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function mediaTarget (
  link: unknown,
  resource: 'streams' | 'artworks' | 'lyrics',
  fallbackSource: string,
  fallbackId: string,
): { source: string, id: string } {
  if (typeof link === 'string') {
    try {
      const pathname = new URL(link, 'https://meting.invalid').pathname
      const match = pathname.match(new RegExp(`/api/v2/${resource}/([^/]+)/([^/]+)$`))
      const matchedSource = match?.[1]
      const matchedId = match?.[2]
      if (matchedSource && matchedId) {
        return {
          source: decodeURIComponent(matchedSource),
          id: decodeURIComponent(matchedId),
        }
      }
    } catch {
      // Fall back to the coordinates on the track itself.
    }
  }
  return { source: fallbackSource, id: fallbackId }
}

function localMediaUrl (type: 'url' | 'pic' | 'lrc', source: string, id: string): string {
  const params = new URLSearchParams({ server: source, type, id })
  return `/api/music?${params.toString()}`
}

function toLegacyTrack (track: MetingV2Track): Record<string, unknown> | null {
  const id = stringValue(track.id)
  const source = stringValue(track.source)
  if (!id || !source) return null

  const artists = Array.isArray(track.artists)
    ? track.artists
      .map(artist => stringValue((artist as MetingV2Artist)?.name))
      .filter(Boolean)
    : []
  const stream = mediaTarget(track.links?.stream, 'streams', source, id)
  const artworkFallbackId = stringValue(track.album?.id) || id
  const artwork = mediaTarget(
    track.links?.artwork || track.artwork?.url,
    'artworks',
    source,
    artworkFallbackId,
  )
  const lyrics = mediaTarget(track.links?.lyrics, 'lyrics', source, id)
  const cover = localMediaUrl('pic', artwork.source, artwork.id)

  return {
    name: stringValue(track.title) || id,
    artist: artists.join(' / '),
    album: stringValue(track.album?.name),
    url: track.playback?.available === false
      ? ''
      : localMediaUrl('url', stream.source, stream.id),
    pic: cover,
    cover,
    lrc: localMediaUrl('lrc', lyrics.source, lyrics.id),
    id,
    source,
  }
}

export function metingV2ToLegacyTracks (payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== 'object') return []
  const data = (payload as { data?: unknown }).data
  const tracks = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { tracks?: { items?: unknown } }).tracks?.items)
      ? (data as { tracks: { items: unknown[] } }).tracks.items
      : data && typeof data === 'object'
        ? [data]
        : []

  return tracks
    .map(track => toLegacyTrack(track as MetingV2Track))
    .filter((track): track is Record<string, unknown> => track !== null)
}
