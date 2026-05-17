<template>
  <!-- 外层 wrap：badge 放这里，不会被 LPK augment 时连带删除
       内层 container：LPK 接管的元素，data-photo-src / data-video-src 由它读 -->
  <div class="live-photo-outer relative inline-block w-full">
    <div
      ref="container"
      class="live-photo-inner block w-full"
      :data-photo-src="photoSrcAbs"
      :data-video-src="videoSrcAbs"
    >
      <!-- 占位 still：LPK 加载/接管前用户就能看到内容；container 由它确定高度 -->
      <img :src="photoSrcAbs" :class="imgClass" loading="lazy" alt="" />
    </div>
    <span
      class="absolute top-1 right-1 bg-black/55 text-white text-[10px] px-1.5 py-0.5 rounded select-none pointer-events-none uppercase tracking-wide"
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
let player: any = null

// LPK 偏好绝对 URL（它要 fetch 视频做处理），把相对 /upload/... 转绝对
const toAbs = (u: string): string => {
  if (!u) return u
  const wrapped = getImgUrl(u)
  if (typeof window === 'undefined') return wrapped
  if (wrapped.startsWith('http')) return wrapped
  return new URL(wrapped, window.location.origin).href
}
const photoSrcAbs = computed(() => toAbs(props.photoUrl))
const videoSrcAbs = computed(() => toAbs(props.videoUrl))

// Apple 官方 LivePhotosKit JS：https://developer.apple.com/documentation/livephotoskitjs
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
    // augmentElementAsPlayer 读 data-photo-src / data-video-src，把内部 DOM
    // 替换成 LPK 自己的 canvas + video；外层 badge 在另一个 div 不会被动到
    player = LPK.augmentElementAsPlayer(container.value)
  } catch (e) {
    console.warn('[LivePhoto] LPK load/augment failed, still image fallback remains visible:', e)
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
/* LPK augment 后会注入 canvas + video，让它们填满容器并保持图片比例 */
.live-photo-inner :deep(canvas),
.live-photo-inner :deep(video) {
  width: 100% !important;
  height: auto !important;
  display: block;
}
.live-photo-inner :deep(img) {
  width: 100%;
  height: auto;
  display: block;
}
</style>
