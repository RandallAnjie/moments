// Step 3: X redirects the user back here with oauth_token + oauth_verifier.
// We look up the stashed request-token secret + initiating user from KV,
// exchange for the long-lived access token, store it on that user's row, and
// redirect back to the settings page with a status flag the UI can toast.
import { eq } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { config as configTable, users } from '~/lib/db/schema'
import { getCfEnv } from '~/lib/cf-env'
import { getAccessToken } from '~/lib/twitter'

export default defineEventHandler(async (event) => {
  const db = useDb(event)

  const redirectToSettings = async (status: string) => {
    const cfgRows = await db
      .select({ siteUrl: configTable.siteUrl })
      .from(configTable)
      .where(eq(configTable.id, 1))
      .limit(1)
    const origin = cfgRows[0]?.siteUrl?.replace(/\/+$/, '') || getRequestURL(event).origin
    await sendRedirect(event, `${origin}/settings?twitter=${status}`, 302)
  }

  const q = getQuery(event)
  if (q.denied) return redirectToSettings('denied')

  const oauthToken = typeof q.oauth_token === 'string' ? q.oauth_token : ''
  const verifier = typeof q.oauth_verifier === 'string' ? q.oauth_verifier : ''
  if (!oauthToken || !verifier) return redirectToSettings('error')

  const kv = getCfEnv(event).KV
  const stashRaw = kv ? await kv.get(`twitter_oauth_${oauthToken}`) : null
  if (!stashRaw) return redirectToSettings('expired')
  const stash = JSON.parse(stashRaw) as { tokenSecret: string; userId: number }

  const site = await getTwitterSiteCreds(db)
  if (!site.apiKey || !site.apiSecret) return redirectToSettings('error')

  try {
    const access = await getAccessToken(
      {
        consumerKey: site.apiKey,
        consumerSecret: site.apiSecret,
        token: oauthToken,
        tokenSecret: stash.tokenSecret,
      },
      verifier,
    )
    await db
      .update(users)
      .set({
        twitterAccessToken: access.token,
        twitterAccessSecret: access.tokenSecret,
        twitterScreenName: access.screenName,
        twitterUserId: access.userId,
      })
      .where(eq(users.id, stash.userId))
    if (kv) await kv.delete(`twitter_oauth_${oauthToken}`)
    return redirectToSettings('connected')
  } catch (e) {
    console.error('[twitter/callback]', e instanceof Error ? e.message : e)
    return redirectToSettings('error')
  }
})
