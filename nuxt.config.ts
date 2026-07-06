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
    // 切到 injectManifest：我们自己写 SW（要处理 push event），workbox 帮忙打 precache
    strategies: "injectManifest",
    srcDir: "service-worker",
    filename: "sw.ts",
    injectManifest: {
      globPatterns: ["**/*.{js,css,ico,png,svg,webp,woff,woff2}"],
      globIgnores: ["**/heic-converter*.js"],
      maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
    },
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
    // workbox 的 runtimeCaching / skipWaiting 等改到了自定义 SW 里（service-worker/sw.ts）
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
      // Web Push VAPID 公钥（浏览器订阅时需要）。私钥/subject 在 server 端用
      // 默认值跟 wrangler.toml [vars] 同步：build 时 process.env 取不到，避免 baked 成空串
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY
        || 'BBWjYp1l-pjKkNcjNghpQb5B7DmwtnOhLsCbBERCUbzSI40D5CouDewrIg5sWTpXb1ClbJBCNE_VZmxof395Ch8',
      // R2 公网 URL —— 浏览器直接拉，绕过 Worker 节省请求；不设的话
      // 走 Worker 的 /upload/[filename] 路由(SSR + R2 binding 兜底)。
      //
      // 之前 fallback 默认 'https://pub-...r2.dev' 是一条 CF specific
      // 的死链 —— 在自托管 / RandallFlare 部署下,如果忘了往构建环境
      // 灌 R2_PUBLIC_BASE_URL,前端图片 src 会直接打这个 CF 域名 404,
      // 而 Pages Worker 的 /upload 路由完全用不上。改成空字符串后,
      // rewriteToR2 自动 fallback 到相对路径,浏览器 resolve 到当前
      // origin → 走自托管的 Pages Worker → R2 binding → bucket。
      // 想直 CDN 才需要显式设 R2_PUBLIC_BASE_URL=https://<bucket-host>.
      r2PublicBaseUrl: (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
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
        // bigrandall.io 站点分析
        { src: 'https://bigrandall.io/insights.js', defer: true, 'data-site': 'cmr8m3efu1ohx1jahicqya1mj' },
      ]
    }
  },
  plugins: [
    '~/plugins/vue-lazyload.ts',
    '~/plugins/pinia.ts',
    '~/plugins/meting.ts'
  ],
});
