import { eq } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { users } from '~/lib/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const db = useDb(event)
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const row = rows[0]
  if (!row) {
    throw new Error('User not found')
  }
  const data = { ...row, password: '' }
  return {
    success: true,
    data,
  }
})
