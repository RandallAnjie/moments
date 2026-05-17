// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  ssr: true,
  modules: [
    "@nuxtjs/tailwindcss",
    "shadcn-nuxt",
    "@nuxtjs/color-mode",
    "@vite-pwa/nuxt",
  ],
  pwa: {
    registerType: "autoUpdate",
    injectRegister: "auto",
    strategies: "generateSW",
    manifest: {
      name: "Randall的小屋",
      short_name: "Moments",
      description: "Randall的小屋 - Moments 个人时间线",
      lang: "zh-CN",
      theme_color: "#181818",
      background_color: "#f1f5f9",
      display: "standalone",
      orientation: "portrait",
      scope: "/",
      start_url: "/",
      icons: [
        { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/pwa-256x256.png", sizes: "256x256", type: "image/png" },
        { src: "/pwa-384x384.png", sizes: "384x384", type: "image/png" },
        { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
        { src: "/pwa-maskable-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: "/pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    workbox: {
      // 新 SW 立刻接管 + 释放旧 client，避免老页面拿着旧 SW 去 fetch 已经
      // 不存在的旧 asset hash（bad-precaching-response: ... 404）
      skipWaiting: true,
      clientsClaim: true,
      // 把上一版本遗留的 precache 缓存清掉
      cleanupOutdatedCaches: true,
      // 不再 precache HTML，也不再设 navigateFallback —— SSR 站点的 "/" 没有
      // 静态文件，workbox 之前在 createHandlerBoundToURL("/") 上炸 non-precached-url。
      // 导航请求走下面 runtimeCaching 里的 NetworkFirst（在线优先，离线兜底）
      globPatterns: ["**/*.{js,css,ico,png,svg,webp,woff,woff2}"],
      // heic-to 包含 libheif WASM ~2.7MB，太大不预缓存，按需动态 import 即可
      // （触发上传 HEIC 时才下载；之后走 runtimeCaching 的 static-resources 缓存）
      globIgnores: ["**/heic-converter*.js"],
      // 预缓存清单里出现 404 时（部署交错期）容忍而不是整体失败
      navigateFallback: null,
      runtimeCaching: [
        // SSR 页面：在线优先，无网络就回缓存
        {
          urlPattern: ({ request, sameOrigin, url }) =>
            sameOrigin && request.mode === 'navigate'
            && !url.pathname.startsWith('/api/')
            && !url.pathname.startsWith('/upload/'),
          handler: "NetworkFirst",
          options: {
            cacheName: "pages-cache",
            networkTimeoutSeconds: 5,
            expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 7 },
            cacheableResponse: { statuses: [200] },
          },
        },
        {
          urlPattern: ({ url }) => url.pathname.startsWith("/upload/"),
          handler: "StaleWhileRevalidate",
          options: {
            cacheName: "uploads-cache",
            expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: ({ url }) => url.pathname.startsWith("/_nuxt/"),
          handler: "CacheFirst",
          options: {
            cacheName: "nuxt-assets",
            expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: ({ request, url, sameOrigin }) =>
            sameOrigin && request.destination === "image" && !url.pathname.startsWith("/upload/"),
          handler: "StaleWhileRevalidate",
          options: {
            cacheName: "images-cache",
            expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: ({ request, sameOrigin }) =>
            sameOrigin && (request.destination === "style" || request.destination === "script" || request.destination === "font"),
          handler: "StaleWhileRevalidate",
          options: {
            cacheName: "static-resources",
            expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
    client: {
      installPrompt: true,
    },
    devOptions: {
      enabled: false,
      type: "module",
    },
  },
  colorMode: {
    classSuffix: "",
  },
  shadcn: {
    /**
     * Prefix for all the imported component
     */
    prefix: "",
    /**
     * Directory that the component lives in.
     * @default "./components/ui"
     */
    componentDir: "./components/ui",
  },
  nitro: {
    preset: "cloudflare-pages",
    esbuild: {
      options: {
        target: "esnext",
      },
    },
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          // 让 chunk 文件名带上其名字（默认 nuxt 配置只用 hash），方便
          // workbox.globIgnores 按名字精确排除
          chunkFileNames: '_nuxt/[name]-[hash].js',
          manualChunks(id: string) {
            // 把 heic-to + 它带的 libheif WASM 包打成独立 chunk，文件名固定前缀
            if (id.includes('/heic-to/') || id.includes('libheif')) {
              return 'heic-converter';
            }
          },
        },
      },
    },
  },
  runtimeConfig: {
    public: {
      // 通过 env CF_IMAGE_TRANSFORM=on / true / 1 启用 Cloudflare 图片转换；
      // 默认关闭以免 zone 上没启用 Image Transformations 时所有 /cdn-cgi/image 全 404
      cfImageTransform: ['on', 'true', '1', 'yes'].includes(
        (process.env.CF_IMAGE_TRANSFORM || '').toLowerCase(),
      ),
    },
  },
  app: {
    // head: {
    //   style: [
    //     { src: `https://unpkg.com/aplayer/dist/APlayer.min.css`, type: 'text/css' },
    //   ],
    //   script: [
    //     { src: `https://unpkg.com/aplayer/dist/APlayer.min.js`, type: 'text/javascript', async: true, defer: true },
    //     { src: `https://unpkg.com/@xizeyoupan/meting@latest/dist/Meting.min.js`, type: 'text/javascript', async: true, defer: true },
    //   ]
    // }
    head: {
      style: [
        { src: `/css/APlayer.min.css`, type: 'text/css' },
      ],
      script: [
        { src: `/js/APlayer.min.js`, type: 'text/javascript', async: true, defer: true },
        { src: `/js/Meting.min.js`, type: 'text/javascript', async: true, defer: true },
      ]
    }
  },
  plugins: [
    '~/plugins/vue-lazyload.ts',
    '~/plugins/pinia.ts',
    '~/plugins/meting.ts'
  ],
});
