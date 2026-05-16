import { eq } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { systemConfig } from '~/lib/db/schema'

export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const rows = await db
    .select({ key: systemConfig.key, value: systemConfig.value })
    .from(systemConfig)
    .where(eq(systemConfig.key, 'metingApi'))
    .limit(1)
  const row = rows[0]
  const data = row && row.value && row.value !== ''
    ? row
    : { key: 'metingApi', value: 'https://meting-dd.2333332.xyz/' }
  return {
    success: true,
    data,
  }
})
