// Resolve Cloudflare bindings from either the request event or the
// per-isolate global fallback populated by `server/plugins/cloudflare-env.ts`.
// Internal `$fetch` calls during SSR don't get `event.context.cloudflare`,
// so falling back to the global keeps D1/R2/KV reachable on those paths.

import type { H3Event } from 'h3'

export type CfEnv = {
  DB?: D1Database
  UPLOADS?: R2Bucket
  KV?: KVNamespace
  JWT_SECRET?: string
  JWT_EXPIRES_IN?: string
  MAIL_FROM?: string
  MAIL_FROM_NAME?: string
  R2_PUBLIC_BASE_URL?: string
  SITE_NAME?: string
  SITE_URL?: string
  RECAPTCHA_SECRET_KEY?: string
  TENCENT_MAP_KEY?: string
  [k: string]: unknown
}

export function getCfEnv(event: H3Event | undefined | null): CfEnv {
  const fromEvent = (event?.context as any)?.cloudflare?.env as CfEnv | undefined
  if (fromEvent) return fromEvent
  const fromGlobal = (globalThis as any).__CF_ENV__ as CfEnv | undefined
  return fromGlobal ?? ({} as CfEnv)
}
