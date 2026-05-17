// 自定义 Service Worker（vite-plugin-pwa injectManifest 策略）
//
// 职责：
//   1. precache + runtime cache（workbox）—— 取代旧 generateSW
//   2. 'push' 事件：收到服务端 Web Push，弹通知
//   3. 'notificationclick' 事件：点通知打开对应页面
//
// 注意：这文件运行在 ServiceWorker 全局作用域里（不是窗口），用 self 而不是 window。

/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim } from 'workbox-core'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

// 立即接管，清掉旧 precache
self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()

// vite-plugin-pwa 把 precache manifest 替换到 __WB_MANIFEST
precacheAndRoute(self.__WB_MANIFEST || [])

// ---- runtime caching ----
// SSR 页面：在线优先 5s 回缓存，避免离线白屏
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'pages-cache',
      networkTimeoutSeconds: 5,
      plugins: [
        new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 7 }),
        new CacheableResponsePlugin({ statuses: [200] }),
      ],
    }),
    {
      denylist: [/^\/api\//, /^\/upload\//],
    },
  ),
)

// 上传的图片/视频（含 Live Photo MOV）走 R2 worker route：StaleWhileRevalidate
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/upload/'),
  new StaleWhileRevalidate({
    cacheName: 'uploads-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
)

// Nuxt 构建产物 hash 不变就缓存
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/_nuxt/'),
  new CacheFirst({
    cacheName: 'nuxt-assets',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
)

// 静态资源
registerRoute(
  ({ request, sameOrigin }) =>
    sameOrigin &&
    (request.destination === 'style' ||
      request.destination === 'script' ||
      request.destination === 'font' ||
      request.destination === 'image'),
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
)

// ---- Push 通知 ----
type IncomingPayload = {
  title?: string
  body?: string
  url?: string
  tag?: string
  icon?: string
  badge?: number
}

self.addEventListener('push', (event: PushEvent) => {
  let data: IncomingPayload = {}
  try {
    if (event.data) data = event.data.json()
  } catch {
    if (event.data) data = { title: 'Moments', body: event.data.text() }
  }
  const title = data.title || 'Moments'
  const options: NotificationOptions = {
    body: data.body || '',
    icon: data.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.tag,
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const target = (event.notification.data && (event.notification.data as any).url) || '/'
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // 找已经打开的 tab，导航过去 + focus
      for (const c of all) {
        try {
          // 如果已经在站点上，直接 focus + 让前端处理路由
          if ('focus' in c) {
            await (c as WindowClient).focus()
            try { (c as WindowClient).navigate(target) } catch {}
            return
          }
        } catch {}
      }
      await self.clients.openWindow(target)
    })(),
  )
})
