import { getCfEnv } from '~/lib/cf-env'

export default defineEventHandler(async (event) => {
  const filename = getRouterParam(event, 'filename')
  if (!filename) {
    throw createError({ statusCode: 400, statusMessage: 'filename is required' })
  }

  const uploads = getCfEnv(event).UPLOADS
  if (!uploads) {
    throw createError({ statusCode: 500, statusMessage: 'R2 UPLOADS binding is not configured' })
  }

  // 之前 await uploads.get(...) 不 catch,shim 在上游返 5xx 时直接
  // throw 出来,Nuxt 兜底吐 500 给客户端,看不到具体哪个 key 出错。
  // 把异常转成 502 + 真实错误 message,操作员能立刻看到是 "R2 get
  // 502" 之类。已 deploy 节点 cache 可能撒手 → 这边给 502 比 500
  // 准确。
  let obj: Awaited<ReturnType<typeof uploads.get>>
  try {
    obj = await uploads.get(filename)
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    console.log('R2 get error:', filename, reason)
    throw createError({
      statusCode: 502,
      statusMessage: `R2 fetch failed: ${reason}`,
    })
  }
  if (!obj) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  setHeader(event, 'Content-Type', obj.httpMetadata?.contentType ?? 'application/octet-stream')
  setHeader(event, 'Content-Length', obj.size.toString())
  // CF 官方 R2Object 暴露 httpEtag(带引号);第三方 R2 兼容 shim
  // 偶尔只暴露 etag(裸 sha)。两个都 fallback,setHeader 不会拿到
  // undefined。
  const etagHeader = (obj as { httpEtag?: string }).httpEtag
    ?? (obj.etag ? `"${obj.etag}"` : undefined)
  if (etagHeader) {
    setHeader(event, 'ETag', etagHeader)
  }
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')

  return obj.body
})
