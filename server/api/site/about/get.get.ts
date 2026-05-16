import { eq } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { systemConfig } from '~/lib/db/schema'

export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const rows = await db
    .select({ value: systemConfig.value })
    .from(systemConfig)
    .where(eq(systemConfig.key, 'aboutHtml'))
    .limit(1)
  const value = rows[0]?.value
  if (!value || value === '') {
    return { success: false }
  }
  return {
    success: true,
    data: value,
  }
})
