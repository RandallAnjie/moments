// Capture the Cloudflare bindings off the first real request that enters
// the worker, then make them available to synthesised events created by
// internal `$fetch` (which doesn't go through the Pages entry handler and
// so loses `event.context.cloudflare`).
//
// Per-isolate globalThis is safe: each isolate has its own env, and a single
// isolate's env never changes across requests.

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    const cf = (event.context as any)?.cloudflare
    if (cf?.env) {
      ;(globalThis as any).__CF_ENV__ = cf.env
    }
  })
})
