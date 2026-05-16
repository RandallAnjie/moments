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

  const obj = await uploads.get(filename)
  if (!obj) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  setHeader(event, 'Content-Type', obj.httpMetadata?.contentType ?? 'application/octet-stream')
  setHeader(event, 'Content-Length', obj.size.toString())
  setHeader(event, 'ETag', obj.httpEtag)
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')

  return obj.body
})
