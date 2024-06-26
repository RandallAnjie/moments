// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  ssr: true,
  modules: [
    "@nuxtjs/tailwindcss",
    "shadcn-nuxt",
    "@nuxtjs/color-mode",
  ],
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
