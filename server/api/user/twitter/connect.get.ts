// Step 1 of the 3-legged OAuth 1.0a flow: get a request token from X and
// redirect the (logged-in) user to X's authorize page. The request token
// secret is stashed in KV keyed by the request token so the callback can
// finish the exchange. Browser navigates here, so login is enforced by the
// session cookie.
import { eq } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { config as configTable } from '~/lib/db/schema'
import { getCfEnv } from '~/lib/cf-env'
import { authorizeUrl, getRequestToken } from '~/lib/twitter'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as number | undefined
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = useDb(event)
  const site = await getTwitterSiteCreds(db)
  if (!twitterSiteReady(site)) {
    throw createError({ statusCode: 400, statusMessage: 'X 同步未在站点后台启用/配置' })
  }

  const kv = getCfEnv(event).KV
  if (!kv) {
    throw createError({ statusCode: 500, statusMessage: 'KV 绑定不可用，无法完成 X 授权' })
  }

  const cfgRows = await db
    .select({ siteUrl: configTable.siteUrl })
    .from(configTable)
    .where(eq(configTable.id, 1))
    .limit(1)
  const origin = (cfgRows[0]?.siteUrl?.replace(/\/+$/, '') || getRequestURL(event).origin)
  const callbackUrl = `${origin}/api/user/twitter/callback`

  const { token, tokenSecret } = await getRequestToken(
    { consumerKey: site.apiKey, consumerSecret: site.apiSecret },
    callbackUrl,
  )

  // 10 minutes is plenty for a human to click "Authorize app".
  await kv.put(
    `twitter_oauth_${token}`,
    JSON.stringify({ tokenSecret, userId }),
    { expirationTtl: 600 },
  )

  await sendRedirect(event, authorizeUrl(token), 302)
})
