// Password hashing for the Cloudflare deployment.
//
// New hashes use PBKDF2-SHA256 (100k iterations, 16-byte salt, 32-byte hash)
// via Web Crypto so the same code runs on Cloudflare Workers and Node 19+.
//
// Legacy bcrypt hashes from the pre-migration MySQL data (`$2a$/$2b$/$2y$`)
// are still verified — through bcryptjs (pure JS, Workers-safe) — and
// `verifyPassword` returns `needsRehash: true` for them so callers can
// persist a fresh PBKDF2 hash after the next successful login.

import bcryptjs from 'bcryptjs'

const PBKDF2_ITERATIONS = 100_000
const PBKDF2_SALT_BYTES = 16
const PBKDF2_HASH_BYTES = 32
const PBKDF2_PREFIX = 'pbkdf2-sha256'

export type VerifyResult = {
  valid: boolean
  needsRehash: boolean
}

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
  byteLength: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password) as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    byteLength * 8,
  )
  return new Uint8Array(bits)
}

/** Produce a new PBKDF2-SHA256 password hash in PHC-style format. */
export async function hashPassword(plain: string): Promise<string> {
  if (!plain) throw new Error('hashPassword: empty password')
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES))
  const hash = await pbkdf2(plain, salt, PBKDF2_ITERATIONS, PBKDF2_HASH_BYTES)
  return `$${PBKDF2_PREFIX}$i=${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`
}

/**
 * Verify a plaintext password against a stored hash.
 *
 * Supports both formats:
 *   - PBKDF2 (`$pbkdf2-sha256$i=<n>$<salt>$<hash>`) — recomputed in constant time.
 *   - bcrypt legacy (`$2a$/$2b$/$2y$`) — verified via bcryptjs; if valid the
 *     result carries `needsRehash: true` so the caller can upgrade the stored
 *     hash with `hashPassword(plain)` and persist it.
 */
export async function verifyPassword(plain: string, stored: string): Promise<VerifyResult> {
  if (!plain || !stored) return { valid: false, needsRehash: false }

  if (stored.startsWith(`$${PBKDF2_PREFIX}$`)) {
    const parts = stored.split('$')
    // ["", PBKDF2_PREFIX, "i=<n>", salt, hash]
    if (parts.length !== 5) return { valid: false, needsRehash: false }
    const iterMatch = parts[2].match(/^i=(\d+)$/)
    if (!iterMatch) return { valid: false, needsRehash: false }
    const iterations = Number.parseInt(iterMatch[1], 10)
    if (!Number.isFinite(iterations) || iterations <= 0) {
      return { valid: false, needsRehash: false }
    }
    const salt = fromBase64(parts[3])
    const expected = fromBase64(parts[4])
    const actual = await pbkdf2(plain, salt, iterations, expected.length)
    return { valid: timingSafeEqual(actual, expected), needsRehash: false }
  }

  if (
    stored.startsWith('$2a$') ||
    stored.startsWith('$2b$') ||
    stored.startsWith('$2y$')
  ) {
    const valid = bcryptjs.compareSync(plain, stored)
    return { valid, needsRehash: valid }
  }

  return { valid: false, needsRehash: false }
}
