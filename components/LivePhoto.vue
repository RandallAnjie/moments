<template>
  <!-- 结构说明：
       outer: relative，建立定位上下文，宽度跟随父 grid 的 cell（width: 100%）；
              aspect-ratio 在 still 拿到自然尺寸后动态设置，没拿到前用 4/3 兜底，
              这样 LPK 接管空容器时也有非零尺寸可填。
       still-fallback: 绝对覆盖整个 outer，给用户立刻能看的图像，LPK 一旦接管就淡出。
       lpk-container: 绝对覆盖整个 outer，**初始空白**给 LPK 去填（augmentElementAsPlayer
                       会清空+注入 canvas/video）。data-live-photo 标记必需，
                       data-photo-src / data-video-src 是 LPK 读取的源。
       badge: 角标在 outer 内的 sibling 位置，LPK augment 影响不到。 -->
  <div class="lpk-outer relative w-full" :style="outerStyle">
    <img
      v-show="!lpkReady"
      :src="photoSrcAbs"
      :class="imgClass"
      loading="lazy"
      alt=""
      class="lpk-fallback absolute inset-0 w-full h-full object-cover"
      @load="onStillLoaded"
    />
    <div
      ref="container"
      class="lpk-container absolute inset-0"
      data-live-photo
      data-effect="live"
      :data-photo-src="photoSrcAbs"
      :data-video-src="videoSrcAbs"
    ></div>
    <span
      class="absolute top-1 right-1 bg-black/55 text-white text-[10px] px-1.5 py-0.5 rounded select-none pointer-events-none uppercase tracking-wide z-10"
    >Live</span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { getImgUrl } from '~/lib/utils'

const props = defineProps<{
  photoUrl: string
  videoUrl: string
  imgClass?: string
}>()

const container = ref<HTMLElement | null>(null)
const lpkReady = ref(false)
const aspect = ref<string>('4 / 3') // 默认占位，still 加载完会被覆盖
let player: any = null

const outerStyle = computed(() => ({ aspectRatio: aspect.value }))

// LPK 需要 fetch 视频，绝对 URL 更稳
const toAbs = (u: string): string => {
  if (!u) return u
  const wrapped = getImgUrl(u)
  if (typeof window === 'undefined') return wrapped
  if (wrapped.startsWith('http')) return wrapped
  return new URL(wrapped, window.location.origin).href
}
const photoSrcAbs = computed(() => toAbs(props.photoUrl))
const videoSrcAbs = computed(() => toAbs(props.videoUrl))

function onStillLoaded(e: Event) {
  const img = e.target as HTMLImageElement
  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    aspect.value = `${img.naturalWidth} / ${img.naturalHeight}`
  }
}

const LPK_SRC = 'https://cdn.apple-livephotoskit.com/lpk/1/livephotoskit.js'

function loadLPK(): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  const w = window as any
  if (w.LivePhotosKit) return Promise.resolve(w.LivePhotosKit)
  if (w.__lpkPromise) return w.__lpkPromise
  w.__lpkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = LPK_SRC
    s.async = true
    s.crossOrigin = 'anonymous'
    s.onload = () => resolve(w.LivePhotosKit)
    s.onerror = (e) => { w.__lpkPromise = null; reject(e) }
    document.head.appendChild(s)
  })
  return w.__lpkPromise
}

async function mountPlayer() {
  if (!container.value) return
  try {
    const LPK = await loadLPK()
    if (!LPK || !container.value) return
    // augmentElementAsPlayer 把 container 内容替换为 LPK 的 canvas + video
    player = LPK.augmentElementAsPlayer(container.value)
    // LPK 用 data-photo-src 直接接管；标志位让 fallback 淡出
    lpkReady.value = true
  } catch (e) {
    console.warn('[LivePhoto] LPK load/augment failed, still fallback remains:', e)
  }
}

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') {
    mountPlayer()
    return
  }
  const io = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) {
      io.disconnect()
      mountPlayer()
    }
  }, { rootMargin: '400px' })
  io.observe(container.value!)
})

onBeforeUnmount(() => {
  try { player?.stop?.() } catch {}
  player = null
})
</script>

<style scoped>
.lpk-outer {
  overflow: hidden;
  background: #f0f0f0;
}
.lpk-container :deep(canvas),
.lpk-container :deep(video) {
  width: 100% !important;
  height: 100% !important;
  display: block;
  object-fit: cover;
}
.lpk-fallback {
  transition: opacity .2s ease;
}
</style>
