// /api/user/settings/get （不带 user 参数）这个端点的响应在整个 SPA session
// 是一个稳定的东西（站点配置 + 当前 cookie 用户的一些字段），但原代码在
// FriendsMemo / HeaderImg / MemoInput 的 onMounted 里都各自单独请求一次，
// 列表里 10 条 memo = 10 次重复 RTT。
//
// Cloudflare Workers 是按 request 计费的，这种纯浪费的请求必须挤掉。
// useState 把响应缓存到 SPA 级别，inflight 表 dedup 并发请求。

import { useState } from '#app'

export function useSiteSettings() {
  const cache = useState<any | null>('site-settings', () => null)
  const inflight = useState<Promise<any> | null>('site-settings-inflight', () => null)

  async function fetchSettings(): Promise<any> {
    if (cache.value) return cache.value
    if (inflight.value) return inflight.value
    const p = (async () => {
      try {
        const res = await $fetch('/api/user/settings/get')
        cache.value = res
        return res
      } finally {
        inflight.value = null
      }
    })()
    inflight.value = p
    return p
  }

  /** 强制重新拉一次（设置页改了字段之后调用）。 */
  function invalidate() {
    cache.value = null
  }

  return { cache, fetchSettings, invalidate }
}
