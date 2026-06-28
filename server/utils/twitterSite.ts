// Server-side helpers for the X (Twitter) sync feature. Nitro auto-imports
// everything under server/utils, so these are callable from any handler
// without an explicit import.
import { inArray } from 'drizzle-orm'
import type { DB } from '~/lib/db/d1'
import { systemConfig } from '~/lib/db/schema'

export type TwitterSiteCreds = {
  enabled: boolean
  apiKey: string
  apiSecret: string
}

/**
 * Read the site-wide X App credentials (consumer key/secret) the admin set
 * in the backend. Stored in SystemConfig with type=2 so config/get only ever
 * returns them to userId=1 (never to the public).
 */
export async function getTwitterSiteCreds(db: DB): Promise<TwitterSiteCreds> {
  const rows = await db
    .select()
    .from(systemConfig)
    .where(inArray(systemConfig.key, ['twitterEnable', 'twitterApiKey', 'twitterApiSecret']))
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value ?? '']))
  return {
    enabled: map.twitterEnable === '1',
    apiKey: map.twitterApiKey ?? '',
    apiSecret: map.twitterApiSecret ?? '',
  }
}

/** A configured-and-enabled check used by both the status endpoint and save. */
export function twitterSiteReady(creds: TwitterSiteCreds): boolean {
  return creds.enabled && !!creds.apiKey && !!creds.apiSecret
}

// X counts every URL as 23 chars (t.co wrapping) regardless of real length;
// +1 for the newline separator we put before the backlink.
const URL_WEIGHT = 24
const TWEET_LIMIT = 280

/**
 * Compose the tweet body from a memo's content plus a backlink to the memo.
 * Truncates the content (by Unicode code point, so emoji/CJK count as 1) so
 * content + link fit in 280. Returns content-only when no link is given.
 */
export function buildTweetText(content: string, link: string): string {
  const trimmed = (content || '').trim()
  const budget = TWEET_LIMIT - (link ? URL_WEIGHT : 0)
  const chars = Array.from(trimmed)
  let body = trimmed
  if (chars.length > budget) {
    body = chars.slice(0, Math.max(0, budget - 1)).join('').trimEnd() + '…'
  }
  return link ? (body ? `${body}\n${link}` : link) : body
}

/** Best-effort MIME from a filename extension, for R2 objects missing one. */
export function guessImageMime(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    default:
      return 'application/octet-stream'
  }
}
