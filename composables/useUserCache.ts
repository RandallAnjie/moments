// 用户昵称 / 头像等公开信息的应用级缓存。
//
// 原本每个 FriendsMemo / Comment 都会独立 fetch /api/user/settings/get?user=X
// 来拿提到人 / 评论作者的昵称 —— 同一个用户出现 50 次就是 50 次 round-trip，
// 表现为"提到了xxx 缓慢加载出来"。这里用 useState 做全 SPA 共享的 Map<id, info>，
// 并 dedup 并发请求（相同 id 同时被两个组件请求时只发一次）。

import { useState } from '#app'

export type CachedUser = {
  nickname: string | null
  avatarUrl: string | null
  slogan: string | null
  coverUrl: string | null
}

export function useUserCache() {
  // Map<id, CachedUser>
  const cache = useState<Record<string, CachedUser>>('user-info-cache', () => ({}))
  // Map<id, Promise<CachedUser>> —— 进行中请求去重
  const inflight = useState<Record<string, Promise<CachedUser>>>('user-info-inflight', () => ({}))

  function key(id: string | number): string {
    const v = String(id).trim()
    return v === '' || v === 'undefined' || v === 'null' ? '0' : v
  }

  async function fetchUser(id: string | number): Promise<CachedUser> {
    const k = key(id)
    if (cache.value[k]) return cache.value[k]
    if (inflight.value[k]) return inflight.value[k]

    const p = (async () => {
      try {
        const res = await $fetch<{ success: boolean; data: any }>(`/api/user/settings/get?user=${k}`)
        const user: CachedUser = res?.success
          ? {
              nickname: res.data?.nickname ?? null,
              avatarUrl: res.data?.avatarUrl ?? null,
              slogan: res.data?.slogan ?? null,
              coverUrl: res.data?.coverUrl ?? null,
            }
          : { nickname: null, avatarUrl: null, slogan: null, coverUrl: null }
        cache.value[k] = user
        return user
      } finally {
        delete inflight.value[k]
      }
    })()
    inflight.value[k] = p
    return p
  }

  return {
    cache,
    fetchUser,
    /** 已经缓存了就直接返回（同步），否则返回 null */
    peekNickname(id: string | number): string | null {
      return cache.value[key(id)]?.nickname ?? null
    },
  }
}
