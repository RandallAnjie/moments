// Workers 原生 Web Push 实现（RFC 8030 + RFC 8291 aes128gcm payload + VAPID）
// 不依赖 npm 的 web-push（要 Node crypto），只用 Web Crypto subtle。
//
// 用法：
//   await sendWebPush({
//     subscription: { endpoint, keys: { p256dh, auth } },
//     payload: JSON.stringify({ title, body, url }),
//     vapid: { publicKey, privateKey, subject },
//     ttl: 86400,
//   })

const b64uEncode = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const b64uDecode = (s: string): Uint8Array => {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = (4 - (s.length % 4)) % 4
  s += '='.repeat(pad)
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
const concat = (...arrs: Uint8Array[]): Uint8Array => {
  const total = arrs.reduce((n, a) => n + a.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const a of arrs) { out.set(a, off); off += a.length }
  return out
}
const u16be = (n: number): Uint8Array => new Uint8Array([(n >> 8) & 0xff, n & 0xff])
const u32be = (n: number): Uint8Array =>
  new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff])

// HMAC-SHA256
async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data as BufferSource))
}
// HKDF-Expand (RFC 5869) — single block, since we always want <= 32 bytes here
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const prk = await hmacSha256(salt, ikm)
  const t = await hmacSha256(prk, concat(info, new Uint8Array([0x01])))
  return t.slice(0, length)
}

// Import EC P-256 raw public key (65 bytes 0x04||X||Y) into Web Crypto
async function importEcPub(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
}

// Convert raw secret-key bytes (32-byte d) + corresponding public key bytes (65-byte 0x04XY)
// into a JWK and import as ECDH privateKey (Web Crypto requires the matching public X/Y in the JWK).
async function importEcPrivJwk(d: Uint8Array, publicRaw: Uint8Array): Promise<CryptoKey> {
  const x = publicRaw.slice(1, 33)
  const y = publicRaw.slice(33, 65)
  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      d: b64uEncode(d),
      x: b64uEncode(x),
      y: b64uEncode(y),
      ext: true,
    },
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  )
}

// Same idea but for ECDSA (signing JWT)
async function importEcdsaPrivJwk(d: Uint8Array, publicRaw: Uint8Array): Promise<CryptoKey> {
  const x = publicRaw.slice(1, 33)
  const y = publicRaw.slice(33, 65)
  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      d: b64uEncode(d),
      x: b64uEncode(x),
      y: b64uEncode(y),
      ext: true,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
}

export type PushSubscriptionInfo = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}
export type VapidKeys = {
  publicKey: string // base64url uncompressed 65-byte P-256
  privateKey: string // base64url 32-byte scalar
  subject: string // mailto:... or https://...
}

/** 给定 audience（push endpoint origin），生成 VAPID JWT 头 + 已编码 base64url 公钥。 */
async function buildVapidHeader(vapid: VapidKeys, audience: string) {
  const header = { typ: 'JWT', alg: 'ES256' }
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600 // 12h
  const claims = { aud: audience, exp, sub: vapid.subject }
  const signingInput = `${b64uEncode(new TextEncoder().encode(JSON.stringify(header)))}.${b64uEncode(
    new TextEncoder().encode(JSON.stringify(claims)),
  )}`
  const privateRaw = b64uDecode(vapid.privateKey)
  const publicRaw = b64uDecode(vapid.publicKey)
  const privKey = await importEcdsaPrivJwk(privateRaw, publicRaw)
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privKey,
      new TextEncoder().encode(signingInput) as BufferSource,
    ),
  )
  const jwt = `${signingInput}.${b64uEncode(sig)}`
  return {
    Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
  }
}

/** RFC 8291 aes128gcm 加密：返回完整 body 字节（salt + rs + idlen + serverPub + ciphertext）。 */
async function encryptAes128gcm(
  plaintext: Uint8Array,
  recipientPub: Uint8Array, // 65 bytes raw
  authSecret: Uint8Array, // 16 bytes
): Promise<Uint8Array> {
  // 1) 生成一次性 server ECDH 密钥对
  const serverKp = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )
  const serverPubRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKp.publicKey),
  )

  // 2) ECDH 共享密钥
  const recipientPubKey = await importEcPub(recipientPub)
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: recipientPubKey },
      serverKp.privateKey,
      256,
    ),
  )

  // 3) 派生 IKM = HKDF(auth_secret, sharedSecret, "WebPush: info\0" || ua_pub || ua_pub_priv?)
  //    RFC 8291: info = "WebPush: info\0" || ua_public || as_public（双方公钥）
  const info1 = concat(
    new TextEncoder().encode('WebPush: info\0'),
    recipientPub,
    serverPubRaw,
  )
  const ikm = await hkdf(authSecret, sharedSecret, info1, 32)

  // 4) Salt 16 字节随机
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // 5) cek / nonce 从 ikm + salt 派生
  const cek = await hkdf(salt, ikm, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, new TextEncoder().encode('Content-Encoding: nonce\0'), 12)

  // 6) padding：plaintext || 0x02 || padding 0
  const padded = concat(plaintext, new Uint8Array([0x02]))

  // 7) AES-GCM 加密
  const cekKey = await crypto.subtle.importKey('raw', cek as BufferSource, { name: 'AES-GCM' }, false, ['encrypt'])
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, cekKey, padded as BufferSource),
  )

  // 8) 组装 aes128gcm 头：salt(16) || rs(4 BE) || idlen(1) || keyid(serverPub 65) || ciphertext
  const rs = 4096
  const idlen = serverPubRaw.length // 65
  return concat(salt, u32be(rs), new Uint8Array([idlen]), serverPubRaw, ciphertext)
}

export type SendResult = {
  ok: boolean
  status: number
  body?: string
  /** 408/410/404 视为订阅失效，建议删除该 subscription */
  isGone?: boolean
}

export async function sendWebPush(opts: {
  subscription: PushSubscriptionInfo
  payload: string
  vapid: VapidKeys
  ttl?: number
}): Promise<SendResult> {
  const { subscription, payload, vapid } = opts
  const ttl = opts.ttl ?? 86400

  const aud = new URL(subscription.endpoint).origin
  const vapidHeaders = await buildVapidHeader(vapid, aud)

  const recipientPub = b64uDecode(subscription.keys.p256dh)
  const auth = b64uDecode(subscription.keys.auth)
  const body = await encryptAes128gcm(new TextEncoder().encode(payload), recipientPub, auth)

  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      ...vapidHeaders,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': String(ttl),
      'Urgency': 'normal',
    },
    body: body as BodyInit,
  })

  const text = res.status >= 400 ? await res.text().catch(() => '') : undefined
  return {
    ok: res.ok,
    status: res.status,
    body: text,
    isGone: res.status === 404 || res.status === 410 || res.status === 408,
  }
}
