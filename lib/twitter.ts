// X (Twitter) OAuth 1.0a client for the Workers / RandallFlare runtime.
//
// Everything here is pure `fetch` + Web Crypto (HMAC-SHA1) + btoa — no Node
// builtins — so it runs unchanged on Cloudflare Pages and on RandallFlare's
// pages-agent. We use OAuth 1.0a (not OAuth2) because:
//   - the site registers ONE X App (consumer key/secret), and
//   - each end user authorises via the 3-legged flow to mint their own
//     access token + secret, which never expire (no refresh dance).
//
// Signature rules we rely on (RFC 5849):
//   - Only the oauth_* params (plus form-encoded query/body params, if any)
//     go into the signature base string. JSON bodies and multipart bodies
//     are NOT signed — which is exactly why posting a tweet (JSON) and
//     uploading media (multipart) only need the oauth_* params signed.

const REQUEST_TOKEN_URL = 'https://api.twitter.com/oauth/request_token'
const ACCESS_TOKEN_URL = 'https://api.twitter.com/oauth/access_token'
const AUTHORIZE_URL = 'https://api.twitter.com/oauth/authorize'
const MEDIA_UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json'
const TWEETS_URL = 'https://api.twitter.com/2/tweets'

export type OAuthCreds = {
  consumerKey: string
  consumerSecret: string
  /** Access token OR (mid-flow) request token. */
  token?: string
  /** Access token secret OR (mid-flow) request token secret. */
  tokenSecret?: string
}

// RFC 3986 percent-encoding — encodeURIComponent leaves !*'() alone, OAuth
// requires them encoded.
function rfc3986(s: string): string {
  return encodeURIComponent(s).replace(
    /[!*'()]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  )
}

function nonce(): string {
  const a = new Uint8Array(16)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function hmacSha1Base64(key: string, base: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(base))
  let bin = ''
  for (const b of new Uint8Array(sig)) bin += String.fromCharCode(b)
  return btoa(bin)
}

/**
 * Build the `Authorization: OAuth ...` header value for one request.
 *
 * @param extraOAuth additional oauth_* params for this step
 *                   (oauth_callback on request_token, oauth_verifier on access_token).
 * @param signParams form-encoded query/body params to fold into the signature
 *                   base (leave empty for JSON / multipart bodies).
 */
async function buildOAuthHeader(
  method: string,
  url: string,
  creds: OAuthCreds,
  extraOAuth: Record<string, string> = {},
  signParams: Record<string, string> = {},
): Promise<string> {
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: nonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
    ...extraOAuth,
  }
  if (creds.token) oauth.oauth_token = creds.token

  const allForSig: Record<string, string> = { ...oauth, ...signParams }
  const paramString = Object.keys(allForSig)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(allForSig[k])}`)
    .join('&')
  const base = `${method.toUpperCase()}&${rfc3986(url)}&${rfc3986(paramString)}`
  const signingKey = `${rfc3986(creds.consumerSecret)}&${rfc3986(creds.tokenSecret ?? '')}`
  oauth.oauth_signature = await hmacSha1Base64(signingKey, base)

  return (
    'OAuth ' +
    Object.keys(oauth)
      .sort()
      .map((k) => `${rfc3986(k)}="${rfc3986(oauth[k])}"`)
      .join(', ')
  )
}

function parseFormEncoded(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const pair of body.split('&')) {
    const i = pair.indexOf('=')
    if (i === -1) continue
    out[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1))
  }
  return out
}

// --- 3-legged OAuth -------------------------------------------------------

/** Step 1: obtain a request token. `callbackUrl` must match an App callback URI. */
export async function getRequestToken(
  creds: OAuthCreds,
  callbackUrl: string,
): Promise<{ token: string; tokenSecret: string }> {
  const header = await buildOAuthHeader(
    'POST',
    REQUEST_TOKEN_URL,
    creds,
    { oauth_callback: callbackUrl },
  )
  const resp = await fetch(REQUEST_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: header },
  })
  const text = await resp.text()
  if (!resp.ok) throw new Error(`request_token ${resp.status}: ${text}`)
  const parsed = parseFormEncoded(text)
  if (parsed.oauth_callback_confirmed !== 'true' || !parsed.oauth_token) {
    throw new Error(`request_token unexpected response: ${text}`)
  }
  return { token: parsed.oauth_token, tokenSecret: parsed.oauth_token_secret }
}

/** Step 2: the URL we send the user to so they can authorise the App. */
export function authorizeUrl(requestToken: string): string {
  return `${AUTHORIZE_URL}?oauth_token=${rfc3986(requestToken)}`
}

/** Step 3: swap the authorised request token + verifier for an access token. */
export async function getAccessToken(
  creds: OAuthCreds,
  verifier: string,
): Promise<{
  token: string
  tokenSecret: string
  userId: string
  screenName: string
}> {
  const header = await buildOAuthHeader(
    'POST',
    ACCESS_TOKEN_URL,
    creds,
    { oauth_verifier: verifier },
  )
  const resp = await fetch(ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: header },
  })
  const text = await resp.text()
  if (!resp.ok) throw new Error(`access_token ${resp.status}: ${text}`)
  const parsed = parseFormEncoded(text)
  if (!parsed.oauth_token || !parsed.oauth_token_secret) {
    throw new Error(`access_token unexpected response: ${text}`)
  }
  return {
    token: parsed.oauth_token,
    tokenSecret: parsed.oauth_token_secret,
    userId: parsed.user_id ?? '',
    screenName: parsed.screen_name ?? '',
  }
}

// --- Posting --------------------------------------------------------------

/**
 * Upload one image (single-shot, suitable for ≤5MB images) and return its
 * media_id_string. Multipart body is not signed, so only oauth params go in
 * the signature.
 */
export async function uploadMedia(
  creds: OAuthCreds,
  bytes: ArrayBuffer | Uint8Array,
  mimeType: string,
): Promise<string> {
  const header = await buildOAuthHeader('POST', MEDIA_UPLOAD_URL, creds)
  const form = new FormData()
  form.append('media', new Blob([bytes], { type: mimeType }))
  const resp = await fetch(MEDIA_UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: header },
    body: form,
  })
  const text = await resp.text()
  if (!resp.ok) throw new Error(`media/upload ${resp.status}: ${text}`)
  const json = JSON.parse(text) as { media_id_string?: string }
  if (!json.media_id_string) throw new Error(`media/upload no id: ${text}`)
  return json.media_id_string
}

/** Post a tweet. JSON body is not signed; only oauth params go in the signature. */
export async function postTweet(
  creds: OAuthCreds,
  text: string,
  mediaIds?: string[],
): Promise<{ id: string }> {
  const header = await buildOAuthHeader('POST', TWEETS_URL, creds)
  const payload: Record<string, unknown> = { text }
  if (mediaIds && mediaIds.length > 0) payload.media = { media_ids: mediaIds }
  const resp = await fetch(TWEETS_URL, {
    method: 'POST',
    headers: { Authorization: header, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await resp.text()
  if (!resp.ok) throw new Error(`POST /2/tweets ${resp.status}: ${body}`)
  const json = JSON.parse(body) as { data?: { id?: string } }
  if (!json.data?.id) throw new Error(`POST /2/tweets no id: ${body}`)
  return { id: json.data.id }
}
