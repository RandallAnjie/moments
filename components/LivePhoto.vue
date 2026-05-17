<template>
  <!-- 纯 LPK：outer 用 aspect-ratio 占住高度；fallback img 在 LPK 接管前显示；
       LPK container 是空盒，由 LPK 自己注入 canvas + video + 它自带的 Live 角标。
       - data-src 让 FancyBox 知道点击进灯箱时该展示 still（FancyBox v5 用 data-src）
       - 顶层 click 在 capture 阶段处理：落在 LPK 角标按钮上的点击 stopPropagation
         避免触发 FancyBox -->
  <div
    class="lpk-outer relative w-full overflow-hidden bg-gray-100"
    :style="outerStyle"
    :data-src="photoSrcAbs"
    @click.capture="onOuterClickCapture"
  >
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
const aspect = ref<string>('4 / 3')
let player: any = null

const outerStyle = computed(() => ({ aspectRatio: aspect.value }))

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

// 在 capture 阶段先于 FancyBox 的委托 click 跑：
// 如果点击落在 LPK 自带的按钮（角标 / 播放控件）上，吃掉事件 → FancyBox 不会响应。
// 普通区域的点击继续冒泡 → FancyBox 打开灯箱展示 still。
// 长按由 LPK 自己接管 (touchstart/touchend)，浏览器不会再生成 click → FancyBox 也不会响应。
function onOuterClickCapture(e: MouseEvent) {
  const t = e.target as HTMLElement | null
  if (!t) return
  if (t.closest('button, [role="button"], a, [class*="lpk-button"], [class*="livephoto-button"]')) {
    e.stopPropagation()
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
    player = LPK.augmentElementAsPlayer(container.value)
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
.lpk-fallback {
  transition: opacity .2s ease;
}
</style>
