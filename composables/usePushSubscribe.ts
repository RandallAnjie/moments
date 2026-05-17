// 浏览器端 Web Push 订阅管理。
// 用法：
//   const { state, isSupported, subscribe, unsubscribe, test } = usePushSubscribe()
//   state 取值：'unsupported' | 'denied' | 'unsubscribed' | 'subscribed' | 'busy'

import { ref, onMounted } from 'vue'

const b64uDecode = (s: string): Uint8Array => {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = (4 - (s.length % 4)) % 4
  s += '='.repeat(pad)
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
const b64uEncode = (buf: ArrayBuffer | null): string => {
  if (!buf) return ''
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export type PushState = 'unsupported' | 'denied' | 'unsubscribed' | 'subscribed' | 'busy'

export function usePushSubscribe() {
  const state = ref<PushState>('unsupported')

  const isSupported = () =>
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window

  async function refresh() {
    if (!isSupported()) { state.value = 'unsupported'; return }
    if (Notification.permission === 'denied') { state.value = 'denied'; return }
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    state.value = sub ? 'subscribed' : 'unsubscribed'
  }

  async function subscribe() {
    if (!isSupported()) return
    state.value = 'busy'
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { state.value = 'denied'; return }
      const cfg = useRuntimeConfig()
      const publicKey: string = cfg.public.vapidPublicKey as string
      if (!publicKey) { state.value = 'unsubscribed'; throw new Error('VAPID 公钥未配置') }

      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64uDecode(publicKey) as BufferSource,
        })
      }
      const p = sub.toJSON()
      await $fetch('/api/push/subscribe', {
        method: 'POST',
        body: {
          endpoint: sub.endpoint,
          keys: { p256dh: p.keys?.p256dh, auth: p.keys?.auth },
        },
      })
      state.value = 'subscribed'
    } catch (e) {
      console.warn('[push] subscribe failed:', e)
      await refresh()
      throw e
    }
  }

  async function unsubscribe() {
    if (!isSupported()) return
    state.value = 'busy'
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        try { await $fetch('/api/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }) } catch {}
        await sub.unsubscribe()
      }
      state.value = 'unsubscribed'
    } catch (e) {
      console.warn('[push] unsubscribe failed:', e)
      await refresh()
    }
  }

  async function test() {
    return await $fetch('/api/push/test', { method: 'POST' })
  }

  onMounted(() => { refresh() })

  return { state, isSupported, subscribe, unsubscribe, test, refresh }
}
