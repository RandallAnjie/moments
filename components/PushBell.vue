<template>
  <div class="flex flex-row gap-2 items-center text-sm">
    <button
      type="button"
      class="flex flex-row items-center gap-1.5 px-3 py-1.5 rounded border border-[#e1e1e1] dark:border-[#3a3a3a] hover:bg-[#f4f4f4] dark:hover:bg-[#252525] transition-colors"
      :disabled="state === 'busy' || state === 'unsupported'"
      :title="hint"
      @click="onToggle"
    >
      <Bell v-if="state === 'subscribed'" :size="14" />
      <BellOff v-else :size="14" />
      <span>{{ label }}</span>
      <span
        v-if="unreadCount > 0"
        class="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#ef4444] text-white text-[10px] font-medium"
      >{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Bell, BellOff } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { usePushSubscribe } from '~/composables/usePushSubscribe'
import { useSiteSettings } from '~/composables/useSiteSettings'

const { state, subscribe, unsubscribe, test } = usePushSubscribe()
const { fetchSettings } = useSiteSettings()
const unreadCount = ref(0)

const label = computed(() => {
  switch (state.value) {
    case 'unsupported': return '浏览器不支持'
    case 'denied': return '已被拒绝'
    case 'subscribed': return '已订阅通知'
    case 'unsubscribed': return '开启通知'
    case 'busy': return '处理中...'
  }
})

const hint = computed(() => {
  switch (state.value) {
    case 'unsupported': return '当前浏览器或环境不支持 Web Push'
    case 'denied': return '通知权限已被拒绝，需要在浏览器设置里手动允许'
    case 'subscribed': return '点击取消订阅'
    case 'unsubscribed': return '点击订阅，开启浏览器推送通知'
    case 'busy': return '请稍候'
  }
})

async function onToggle() {
  try {
    if (state.value === 'subscribed') {
      await unsubscribe()
      toast.success('已取消通知订阅')
    } else if (state.value === 'unsubscribed') {
      await subscribe()
      toast.success('通知已开启')
      // 订阅成功后自动发一条测试通知验证链路；失败就当没事，不打扰用户
      try { await test() } catch {}
    }
  } catch (e: any) {
    toast.warning('操作失败：' + (e?.message ?? e))
  }
}

// 未读消息数 —— 复用站点设置接口的 notificationRecord
async function refreshUnread() {
  try {
    const s: any = await fetchSettings()
    if (s?.success && Array.isArray(s.data?.notificationRecord)) {
      unreadCount.value = s.data.notificationRecord.length
    }
  } catch {}
}

onMounted(() => { refreshUnread() })
// 切换订阅状态后再刷新一次（订阅成功不会立刻有未读，但保险）
watch(state, () => { refreshUnread() })
</script>
