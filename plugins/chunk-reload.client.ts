// 部署新版本后，老客户端 SPA 路由会去 fetch 已经不存在的旧 hash chunk
// （typical: "Failed to fetch dynamically imported module: .../_nuxt/index-XXXX.js"）。
// Nuxt 用 'app:chunkError' hook 告诉我们这种失败，重载页面拿新 bundle 就行。
// 关键：必须仅在客户端跑（plugin 文件名 .client.ts），SSR 没 window.location.

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:chunkError', ({ error }) => {
    console.warn('[chunk-reload] dynamic chunk fetch failed, reloading:', error)
    // 把目标路径塞进 url query 让用户 navigation 不丢
    const target = (nuxtApp.$router as any)?.currentRoute?.value?.fullPath
      || window.location.pathname + window.location.search
    window.location.replace(target)
  })

  // 兜底：监听 window 级别的 unhandled rejection，遇到 chunk fetch 错也重载
  window.addEventListener('unhandledrejection', (e) => {
    const msg = String(e?.reason?.message ?? e?.reason ?? '')
    if (msg.includes('Failed to fetch dynamically imported module')) {
      console.warn('[chunk-reload] unhandled chunk fetch error, reloading')
      window.location.reload()
    }
  })
})
