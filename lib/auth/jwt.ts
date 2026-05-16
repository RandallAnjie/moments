// JWT signing/verification for the Cloudflare deployment.
//
// Uses `@tsndr/cloudflare-worker-jwt`, a tiny HS256 implementation that
// runs on Web Crypto (so the same source works on Cloudflare Workers,
// Pages Functions, and Node 19+).
//
// Secret resolution order, per request:
//   1. `env.JWT_SECRET` from wrangler vars/secrets (.dev.vars locally,
//      `wrangler pages secret put JWT_SECRET` in prod).
//   2. Fallback: `SystemConfig` row keyed `jwtKey` — preserves
//      compatibility with pre-migration MySQL data so tokens minted
//      before the cutover keep verifying. Generated and persisted on
//      first miss so the secret survives across requests.

import jwt from '@tsndr/cloudflare-worker-jwt'
import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { getCfEnv } from '~/lib/cf-env'
import { useDb } from '~/lib/db/d1'
import { systemConfig } from '~/lib/db/schema'

const SYSTEM_CONFIG_JWT_KEY = 'jwtKey'
const DEFAULT_EXPIRES_IN_SECONDS = 60 * 60 * 24 // 24h, matching legacy login.post.ts

export type JwtPayload = {
  userId: number
  username: string
  iat?: number
  exp?: number
}

function toHex(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0')
  return s
}

/**
 * Parse a duration like "7d", "24h", "60m", "30s", or a bare number of
 * seconds. Throws on invalid input.
 */
export function parseDurationSeconds(value: string): number {
  const trimmed = value.trim()
  const match = /^(\d+)([smhd])$/.exec(trimmed)
  if (match) {
    const n = Number(match[1])
    switch (match[2]) {
      case 's':
        return n
      case 'm':
        return n * 60
      case 'h':
        return n * 60 * 60
      case 'd':
        return n * 60 * 60 * 24
    }
  }
  const asNumber = Number(trimmed)
  if (Number.isFinite(asNumber) && asNumber > 0) return Math.floor(asNumber)
  throw new Error(`Invalid duration: ${value}`)
}

async function loadOrCreateJwtKeyInDb(event: H3Event): Promise<string> {
  const db = useDb(event)
  const rows = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, SYSTEM_CONFIG_JWT_KEY))
    .limit(1)
  const existing = rows[0]?.value
  if (existing) return existing
  const fresh = toHex(crypto.getRandomValues(new Uint8Array(32)))
  await db.insert(systemConfig).values({
    type: 0,
    key: SYSTEM_CONFIG_JWT_KEY,
    value: fresh,
  })
  return fresh
}

function getEnv(event: H3Event): Record<string, unknown> | undefined {
  return getCfEnv(event) as Record<string, unknown>
}

/** Resolve the active JWT signing secret for this request. */
export async function getJwtSecret(event: H3Event): Promise<string> {
  const env = getEnv(event)
  const fromEnv = env?.JWT_SECRET
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv
  return loadOrCreateJwtKeyInDb(event)
}

/** Resolve the configured token lifetime, defaulting to 24h. */
export function getJwtExpiresInSeconds(event: H3Event): number {
  const env = getEnv(event)
  const raw = env?.JWT_EXPIRES_IN
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      return parseDurationSeconds(raw)
    } catch {
      return DEFAULT_EXPIRES_IN_SECONDS
    }
  }
  return DEFAULT_EXPIRES_IN_SECONDS
}

export type SignTokenOptions = {
  /** Override the lifetime (seconds). Defaults to env JWT_EXPIRES_IN or 24h. */
  expiresInSeconds?: number
}

/**
 * Sign a payload as an HS256 JWT using the request-scoped secret. Always
 * sets `iat`; sets `exp` to `now + expiresInSeconds` unless the caller
 * already supplied an `exp` on the payload.
 */
export async function signToken(
  event: H3Event,
  payload: JwtPayload,
  options: SignTokenOptions = {},
): Promise<string> {
  const secret = await getJwtSecret(event)
  const now = Math.floor(Date.now() / 1000)
  const ttl = options.expiresInSeconds ?? getJwtExpiresInSeconds(event)
  const finalPayload: JwtPayload = {
    ...payload,
    iat: payload.iat ?? now,
    exp: payload.exp ?? now + ttl,
  }
  return jwt.sign(finalPayload as unknown as Record<string, unknown>, secret)
}

/**
 * Verify an HS256 JWT against the request-scoped secret. Returns the
 * decoded payload on success, or `null` if the token is missing,
 * malformed, expired, or signed with a different secret.
 */
export async function verifyToken<T extends object = JwtPayload>(
  event: H3Event,
  token: string | undefined | null,
): Promise<T | null> {
  if (!token) return null
  try {
    const secret = await getJwtSecret(event)
    const valid = await jwt.verify(token, secret)
    if (!valid) return null
    const decoded = jwt.decode<T>(token)
    return decoded?.payload ?? null
  } catch {
    return null
  }
}
