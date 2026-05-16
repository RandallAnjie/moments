/// <reference types="@cloudflare/workers-types" />

// Nitro's H3Event gets a `cloudflare.env` context when running on Cloudflare
// Pages (or `wrangler pages dev`). The shape mirrors the bindings declared in
// `wrangler.toml`.
declare module 'h3' {
  interface H3EventContext {
    cloudflare?: {
      env: {
        DB: D1Database
        UPLOADS: R2Bucket
        KV: KVNamespace
        [key: string]: unknown
      }
      context: ExecutionContext
      request: Request
    }
  }
}

export {}
