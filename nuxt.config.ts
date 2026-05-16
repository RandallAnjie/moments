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
      navigateFallback: "/",
      navigateFallbackDenylist: [/^\/api\//, /^\/upload\//],
      globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2}"],
      runtimeCaching: [
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
