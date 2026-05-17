<template>
  <!-- 用 <video> + poster 直接做 Live Photo 交互：
       - 默认显示 still（poster）
       - 长按 / hover 播放视频；松开自动停回 poster
       - preload=none：列表里多张 Live Photo 不会自动拉视频，节省流量
       - 不再依赖 Apple LPK，省一次外部 CDN 请求 + 更稳跨浏览器 -->
  <div class="live-photo-container relative inline-block w-full">
    <video
      ref="videoEl"
      :poster="posterUrl"
      :src="videoUrl"
      :class="imgClass"
      muted
      playsinline
      loop
      preload="none"
      @mousedown.prevent="startPlay"
      @touchstart.prevent="startPlay"
      @mouseup="stopPlay"
      @mouseleave="stopPlay"
      @touchend="stopPlay"
      @touchcancel="stopPlay"
    />
    <span
      class="absolute top-1 right-1 bg-black/45 text-white text-[10px] px-1.5 py-0.5 rounded select-none pointer-events-none uppercase tracking-wide"
    >Live</span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { getImgUrl } from '~/lib/utils'

const props = defineProps<{
  photoUrl: string  // 原始相对 URL，比如 /upload/xxx.jpeg
  videoUrl: string  // 原始相对 URL，比如 /upload/xxx.mov
  imgClass?: string
}>()

const videoEl = ref<HTMLVideoElement | null>(null)
const posterUrl = computed(() => getImgUrl(props.photoUrl))

let pressTimer: ReturnType<typeof setTimeout> | null = null
const PRESS_DELAY_MS = 200 // 长按才播放，避免点击瞬间触发

function startPlay() {
  if (pressTimer) clearTimeout(pressTimer)
  pressTimer = setTimeout(() => {
    videoEl.value?.play().catch(() => {})
  }, PRESS_DELAY_MS)
}

function stopPlay() {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
  const v = videoEl.value
  if (v && !v.paused) {
    v.pause()
    try { v.currentTime = 0 } catch {}
  }
}
</script>

<style scoped>
.live-photo-container > video {
  display: block;
  width: 100%;
  height: auto;
  /* 避免 video 没拉到时高度塌成 0 把 poster 也吞掉 */
  background: #eee;
  min-height: 60px;
}
</style>
