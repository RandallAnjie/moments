import short from 'short-uuid'

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
  if (!file?.type || !file.type.startsWith('image/')) {
    return {
      success: false,
      message: '只支持上传图片文件',
      filename: '',
    }
  }

  const uploads = event.context.cloudflare?.env.UPLOADS
  if (!uploads) {
    return {
      success: false,
      message: 'R2 UPLOADS binding is not configured',
      filename: '',
    }
  }

  const filetype = file.type.split('/')[1] || 'bin'
  const filename = short.generate()
  const key = `${filename}.${filetype}`

  try {
    await uploads.put(key, file.data, {
      httpMetadata: { contentType: file.type },
    })
  } catch (e) {
    console.log('R2 put error:', e)
    return {
      success: false,
      message: '上传文件失败',
      filename: '',
    }
  }

  return {
    success: true,
    filename: `/upload/${key}`,
    message: '上传文件成功!',
  }
})
