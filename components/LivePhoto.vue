<template>
  <div
    ref="container"
    class="live-photo-container relative inline-block"
    data-live-photo
  >
    <!-- 占位 still：LPK 加载完会接管这个 img -->
    <img
      :src="photoSrc"
      :class="imgClass"
      loading="lazy"
      alt=""
    />
    <!-- LivePhoto 标志（右上角小标），LPK 自带的也行；这个是 LPK 没加载好时的兜底 -->
    <span
      v-if="!lpkReady"
      class="absolute top-1 right-1 bg-black/40 text-white text-[10px] px-1.5 py-0.5 rounded select-none pointer-events-none"
    >LIVE</span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { getImgUrl } from '~/lib/utils'

const props = defineProps<{
  photoUrl: string  // 原始相对 URL，比如 /upload/xxx.jpeg
  videoUrl: string  // 原始相对 URL，比如 /upload/xxx.mov
  imgClass?: string
}>()

const container = ref<HTMLElement | null>(null)
const lpkReady = ref(false)
let player: any = null

const photoSrc = computed(() => getImgUrl(props.photoUrl))

// Apple 官方 LivePhotosKit JS：
//   https://developer.apple.com/documentation/LivePhotosKitJS
// 一份 CDN：https://cdn.apple-livephotoskit.com/lpk/1/livephotoskit.js
// 它会接管 container 元素，把 still + video 合成 LivePhoto 交互（长按播放等）
const LPK_SRC = 'https://cdn.apple-livephotoskit.com/lpk/1/livephotoskit.js'

function loadLPK(): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  // 已经加载
  const w = window as any
  if (w.LivePhotosKit) return Promise.resolve(w.LivePhotosKit)
  // 已经有 promise 在跑（多个 LivePhoto 同时挂载只加载一次）
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
    // LPK 接管：替换里面的 img + 添加 video，挂上长按等手势
    player = LPK.augmentElementAsPlayer(container.value, {
      photoSrc: photoSrc.value,
      videoSrc: getImgUrl(props.videoUrl),
    })
    lpkReady.value = true
  } catch (e) {
    console.warn('[LivePhoto] LPK load failed, fallback to still only:', e)
  }
}

onMounted(() => {
  // 元素进入视口附近再 mount，省掉 off-screen Live Photo 的脚本初始化和视频预拉
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

// 数据源变了重新挂载（用于编辑替换）
watch(() => [props.photoUrl, props.videoUrl], () => {
  if (player) {
    try { player.photoSrc = photoSrc.value; player.videoSrc = getImgUrl(props.videoUrl) } catch {}
  }
})
</script>

<style scoped>
.live-photo-container {
  width: 100%;
}
.live-photo-container :deep(img),
.live-photo-container :deep(video) {
  width: 100%;
  height: auto;
  display: block;
}
</style>
