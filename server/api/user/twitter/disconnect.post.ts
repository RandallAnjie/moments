// Clear the logged-in user's X binding. (We don't revoke server-side at X;
// the user can revoke the app from their X settings if they want.)
import { eq } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { users } from '~/lib/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as number | undefined
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const db = useDb(event)
  await db
    .update(users)
    .set({
      twitterAccessToken: null,
      twitterAccessSecret: null,
      twitterScreenName: null,
      twitterUserId: null,
    })
    .where(eq(users.id, userId))
  return { success: true }
})
