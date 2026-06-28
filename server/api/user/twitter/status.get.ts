// Tells the frontend whether to show X UI: is the site feature configured,
// and has THIS user connected their account (+ their @handle for display).
import { eq } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { users } from '~/lib/db/schema'

export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const site = await getTwitterSiteCreds(db)
  const siteEnabled = twitterSiteReady(site)

  const userId = event.context.userId as number | undefined
  if (!userId) {
    return { success: true, data: { siteEnabled, connected: false, screenName: '' } }
  }

  const rows = await db
    .select({ token: users.twitterAccessToken, screenName: users.twitterScreenName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return {
    success: true,
    data: {
      siteEnabled,
      connected: !!rows[0]?.token,
      screenName: rows[0]?.screenName ?? '',
    },
  }
})
