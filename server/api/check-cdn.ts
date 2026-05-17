// 探测站点前置 CDN。原实现用 axios + event.req（Node-only）在 Cloudflare Workers
// 上跑不通——event.req 不存在，axios 内部也依赖 Node http/https。
// 改成 fetch + getRequestURL（h3 跨平台 API）。

import { defineEventHandler, getRequestURL } from 'h3'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const siteUrl = `${url.protocol}//${url.host}`

  const cdnProviders: Record<string, string[]> = {
    Cloudflare: ['cf-ray', 'cf-visitor'],
    Akamai: ['x-akamai-transformed', 'akamai-x-cache-on'],
    Fastly: ['fastly-client-ip', 'fastly-debug-digest'],
    CloudFront: ['x-amz-cf-id', 'x-amz-cf-pop'],
    EdgeCast: ['ec-range', 'edgecast'],
    Tencent: ['s-tencent'],
    Alibaba: ['ali-swift-global-savetime'],
    Randall: ['x-randall-cdn'],
  }

  try {
    const response = await fetch(siteUrl, { method: 'HEAD', redirect: 'follow' })
    let detectedCDN: string | null = null
    for (const [cdn, keys] of Object.entries(cdnProviders)) {
      if (keys.some((k) => response.headers.has(k))) {
        detectedCDN = cdn
        break
      }
    }
    return { isCDN: detectedCDN !== null, cdn: detectedCDN }
  } catch (error: any) {
    return { isCDN: false, error: error?.message ?? String(error) }
  }
})
