// D1 binding accessor.
// In Nuxt/Nitro running on Cloudflare Pages, the D1 binding is exposed at
// `event.context.cloudflare.env.DB` (matches the binding name in wrangler.toml).
// This module returns a drizzle instance bound to that D1, plus the
// underlying binding for callers that need raw `.prepare(...)`.
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import type { H3Event } from 'h3'
import * as schema from './schema'

export type Schema = typeof schema
export type DB = DrizzleD1Database<Schema>

/**
 * Retrieve the D1 binding from a Nitro event. Throws if the binding is
 * absent, which means the runtime isn't Cloudflare Pages or wrangler dev.
 */
export function getD1Binding(event: H3Event): D1Database {
  const env = (event.context as any)?.cloudflare?.env
  const db = env?.DB as D1Database | undefined
  if (!db) {
    throw new Error(
      'D1 binding "DB" is not available on event.context.cloudflare.env. ' +
        'Run via `wrangler pages dev` (or deploy to Pages) so the binding is injected.',
    )
  }
  return db
}

/**
 * Get a typed drizzle instance for the current request, bound to the D1
 * binding declared as `DB` in wrangler.toml.
 */
export function useDb(event: H3Event): DB {
  return drizzle(getD1Binding(event), { schema })
}
