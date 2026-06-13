import short from 'short-uuid'
import { getCfEnv } from '~/lib/cf-env'

type FileInfo = { name: string; filename: string; data: Uint8Array; type: string }

/**
 * After R2.put resolves, the public hostname (`R2_PUBLIC_BASE_URL`,
 * usually `pub-*.r2.dev` or a custom domain) can still 404 the new
 * key for up to a few seconds. The client receives the upload
 * response and immediately sets `<img src=getImgUrl(/upload/<key>)>`,
 * which navigates to that public URL — and the browser sees the 404,
 * which doesn't auto-retry.
 *
 * Poll HEAD against the public URL until it's reachable, with short
 * back-off. Returns once the object is visible OR after the timeout
 * budget. We return success even on timeout (the upload itself
 * succeeded — better to let the client retry image load than to
 * fail the whole flow).
 */
async function waitForR2Propagation(
  publicBase: string | undefined,
  key: string,
): Promise<{ visible: boolean; waitedMs: number }> {
  if (!publicBase) return { visible: true, waitedMs: 0 }
  const start = Date.now()
  // Total budget ≈ 6.2s in the worst case (200 + 400 + 800 + 1600 + 3200).
  const delays = [0, 200, 400, 800, 1600, 3200]
  for (const d of delays) {
    if (d > 0) await new Promise((r) => setTimeout(r, d))
    try {
      const r = await fetch(`${publicBase}/${key}`, { method: 'HEAD' })
      if (r.ok) return { visible: true, waitedMs: Date.now() - start }
      // Anything other than 404 is "weird but reachable" — bail out
      // and let the client deal with it; we don't want to spin
      // through a 5xx outage.
      if (r.status !== 404) return { visible: true, waitedMs: Date.now() - start }
    } catch {
      // Fetch threw — DNS hiccup, CORS, whatever. Retry on the
      // next tick rather than failing.
    }
  }
  return { visible: false, waitedMs: Date.now() - start }
}

export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    return {
      success: false,
      message: 'No file found',
      filename: '',
    }
  }
  const file = formData[0] as FileInfo
  // 允许 image/*（普通照片）和 video/quicktime + video/mp4（Live Photo 配套视频）
  const isImage = file?.type?.startsWith('image/')
  const isVideo = file?.type === 'video/quicktime'
    || file?.type === 'video/mp4'
    || /\.(mov|mp4|m4v)$/i.test(file?.filename || file?.name || '')
  if (!isImage && !isVideo) {
    return {
      success: false,
      message: '只支持上传图片或视频文件',
      filename: '',
    }
  }

  const env = getCfEnv(event)
  const uploads = env.UPLOADS
  if (!uploads) {
    return {
      success: false,
      message: 'R2 UPLOADS binding is not configured',
      filename: '',
    }
  }

  // 文件扩展名优先取上传文件名（保留 .mov/.heic 等），fallback 用 MIME
  const nameForExt = file?.filename || file?.name || ''
  const extFromName = nameForExt.includes('.') ? nameForExt.split('.').pop()!.toLowerCase() : ''
  const filetype = extFromName || (file?.type?.split('/')[1] || 'bin')
  const filename = short.generate()
  const key = `${filename}.${filetype}`

  try {
    await uploads.put(key, file.data, {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
    })
  } catch (e) {
    // 之前只 console.log 错误,接口返「上传文件失败」无任何细节,
    // 排查只能去 worker 日志翻。把真实错误 message 透出来 ——
    // R2Bucket.put 的 shim 抛 'R2 put 4xx/5xx',直接看 status
    // 就能定位是 quota / bucket-not-found / proxy-down 哪一种。
    const reason = e instanceof Error ? e.message : String(e)
    console.log('R2 put error:', reason)
    return {
      success: false,
      message: `上传文件失败: ${reason}`,
      filename: '',
    }
  }

  // R2 propagation guard — see waitForR2Propagation docstring above
  // for why this exists. Read base URL from runtimeConfig (public
  // side has the URL even when the worker env doesn't seed
  // process.env).
  const publicBase =
    (env.R2_PUBLIC_BASE_URL as string | undefined)
    || (useRuntimeConfig().public?.r2PublicBaseUrl as string | undefined)
    || ''
  const propagation = await waitForR2Propagation(
    publicBase.replace(/\/+$/, ''),
    key,
  )
  if (!propagation.visible) {
    // Object is in the bucket; the public hostname just hasn't seen
    // it yet. Log this so we can spot if our timeout is too tight.
    console.log(
      `R2 public propagation timeout (${propagation.waitedMs}ms) for ${key}`,
    )
  }

  return {
    success: true,
    filename: `/upload/${key}`,
    message: '上传文件成功!',
  }
})
