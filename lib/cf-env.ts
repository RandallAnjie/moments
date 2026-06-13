// Resolve Cloudflare bindings from either the request event or the
// per-isolate global fallback populated by `server/plugins/cloudflare-env.ts`.
// Internal `$fetch` calls during SSR don't get `event.context.cloudflare`,
// so falling back to the global keeps D1/R2/KV reachable on those paths.

import type { H3Event } from 'h3'
import { maybeWrapR2 } from './r2-shim'

export type CfEnv = {
  DB?: D1Database
  UPLOADS?: R2Bucket
  KV?: KVNamespace
  /** Set by self-hosted edge planes alongside the raw UPLOADS Fetcher
   *  service binding. Triggers the moments-side R2 shim wrap so
   *  env.UPLOADS.put(...) doesn't get RPC'd to fetch(key). */
  UPLOADS_ID?: string
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

/**
 * Return a CfEnv where UPLOADS is guaranteed to expose proper R2Bucket
 * semantics. On real Cloudflare Pages this is a no-op (the binding is
 * already R2Bucket). On self-hosted planes that hand us a raw service
 * binding + `UPLOADS_ID` text binding, we wrap it on the fly so
 * `env.UPLOADS.put(key, data)` doesn't blow up with
 * `Fetch API cannot load: <key>`.
 *
 * Wraps are returned by reference per binding object — if you call
 * this twice with the same underlying env, you'll get distinct shim
 * instances but they behave identically. We don't bother to memoise
 * because the cost is trivial.
 */
export function getCfEnv(event: H3Event | undefined | null): CfEnv {
  const fromEvent = (event?.context as any)?.cloudflare?.env as CfEnv | undefined
  const raw = fromEvent ?? (globalThis as any).__CF_ENV__ as CfEnv | undefined ?? ({} as CfEnv)
  const wrappedUploads = maybeWrapR2(raw.UPLOADS, raw.UPLOADS_ID)
  if (wrappedUploads === raw.UPLOADS) return raw
  // Don't mutate the source env (other consumers may not want the
  // shim layered on). Return a shallow copy with UPLOADS replaced.
  return { ...raw, UPLOADS: wrappedUploads as R2Bucket }
}
