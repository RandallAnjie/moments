// Cloudflare Workers-native Aliyun POP RPC text moderation client.
// Replaces the Node-only @alicloud/pop-core with a hand-rolled signer that
// uses fetch + Web Crypto (HMAC-SHA1), keeping the same call signature
// (content, Service, aliyunAccessKeyId, aliyunAccessKeySecret) so existing
// call sites in memo/save.post.ts and comment/save.post.ts do not change.

const ALIYUN_ENDPOINTS = [
  'https://green-cip.cn-shanghai.aliyuncs.com',
  'https://green-cip.cn-beijing.aliyuncs.com',
]
const API_VERSION = '2022-03-02'

// RFC 3986 percent-encode used by Aliyun POP signatures: encodeURIComponent
// covers most reserved chars, but ! ' ( ) * are not encoded by the spec and
// must be patched up to match the canonical Java/Go reference encoders.
function aliyunPercentEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
}

function uuidV4(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex: string[] = []
  for (let i = 0; i < 16; i++) hex.push(bytes[i].toString(16).padStart(2, '0'))
  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  )
}

function toBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < view.byteLength; i++) binary += String.fromCharCode(view[i])
  return btoa(binary)
}

async function hmacSha1Base64(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret) as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message) as BufferSource)
  return toBase64(sig)
}

// Iso8601 in the exact shape Aliyun POP expects: "YYYY-MM-DDTHH:mm:ssZ"
// (Date.toISOString() emits .sssZ which Aliyun also accepts, but the
// reference signers strip milliseconds.)
function aliyunTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

// Exported for unit-testability: builds the canonical string-to-sign and
// the final signature for a parameter map, identical to the body sent
// over the wire (minus the Signature param itself).
export async function __aliyunSignForTest(
  params: Record<string, string>,
  accessKeySecret: string,
): Promise<{ stringToSign: string; signature: string; body: string }> {
  const sortedKeys = Object.keys(params).sort()
  const canonical = sortedKeys
    .map((k) => `${aliyunPercentEncode(k)}=${aliyunPercentEncode(params[k])}`)
    .join('&')
  const stringToSign = `POST&${aliyunPercentEncode('/')}&${aliyunPercentEncode(canonical)}`
  const signature = await hmacSha1Base64(accessKeySecret + '&', stringToSign)
  const all: Record<string, string> = { ...params, Signature: signature }
  const body = Object.keys(all)
    .map((k) => `${aliyunPercentEncode(k)}=${aliyunPercentEncode(all[k])}`)
    .join('&')
  return { stringToSign, signature, body }
}

async function callOnce(
  endpoint: string,
  params: Record<string, string>,
  accessKeySecret: string,
): Promise<any> {
  const { body } = await __aliyunSignForTest(params, accessKeySecret)
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  // Aliyun POP returns JSON for Format=JSON; if the response is not JSON
  // (e.g. HTML error page from upstream), surface the raw text under a
  // synthetic Code=500 so the caller can decide to retry the next endpoint.
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { Code: 500, Message: text || `HTTP ${res.status}` }
  }
}

// Aliyun text moderation. Preserves the legacy signature and return shape:
// resolves to the parsed Aliyun response (the caller reads .Data.labels),
// or the thrown error if both endpoints fail.
export async function aliTextJudge(
  content: string,
  Service: string = 'comment_detection',
  aliyunAccessKeyId: string,
  aliyunAccessKeySecret: string,
): Promise<any> {
  const params: Record<string, string> = {
    Format: 'JSON',
    Version: API_VERSION,
    AccessKeyId: aliyunAccessKeyId || 'default',
    SignatureMethod: 'HMAC-SHA1',
    Timestamp: aliyunTimestamp(),
    SignatureVersion: '1.0',
    SignatureNonce: uuidV4(),
    Action: 'TextModeration',
    Service,
    ServiceParameters: JSON.stringify({ content }),
  }

  let lastErr: unknown = null
  for (let i = 0; i < ALIYUN_ENDPOINTS.length; i++) {
    try {
      const response = await callOnce(ALIYUN_ENDPOINTS[i], params, aliyunAccessKeySecret || 'default')
      if (response?.Code === 500 && i < ALIYUN_ENDPOINTS.length - 1) {
        // legacy behaviour: fall through to the next region on Code=500
        continue
      }
      return response
    } catch (err) {
      lastErr = err
      if (i === ALIYUN_ENDPOINTS.length - 1) {
        console.log(err)
        return err
      }
    }
  }
  return lastErr
}
