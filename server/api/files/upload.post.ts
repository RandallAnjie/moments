import short from 'short-uuid'
import { getCfEnv } from '~/lib/cf-env'

type FileInfo = { name: string; filename: string; data: Uint8Array; type: string }

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

  const uploads = getCfEnv(event).UPLOADS
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

  return {
    success: true,
    filename: `/upload/${key}`,
    message: '上传文件成功!',
  }
})
