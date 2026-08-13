import { eq, inArray } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { systemConfig } from '~/lib/db/schema'
import { normaliseMetingVersion } from '~/server/utils/meting'

// Returns the configured music API base URL/version + a flag (not the secret)
// indicating whether auth is configured. The actual token never leaves the
// server — V1 compatibility auth and V2 Bearer auth live in /api/music.
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const rows = await db
    .select({ key: systemConfig.key, value: systemConfig.value })
    .from(systemConfig)
    .where(inArray(systemConfig.key, ['metingApi', 'metingToken', 'metingVersion']))

  const map = Object.fromEntries(rows.map(r => [r.key, r.value]))
  const apiValue = (map.metingApi && map.metingApi !== '')
    ? map.metingApi
    : 'https://meting-dd.2333332.xyz/'
  // Surface the value at the legacy `data` shape for backwards
  // compatibility with the existing /plugins/meting.ts consumer.
  return {
    success: true,
    data: { key: 'metingApi', value: apiValue },
    version: normaliseMetingVersion(map.metingVersion, apiValue),
    authConfigured: !!(map.metingToken && map.metingToken !== ''),
  }
})
