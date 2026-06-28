// [TEMP DEBUG] 排查「memo 列表返回空」。返回 Memo 表的真实行数（绕过
// 可见性过滤）+ 公开/受限拆分 + 一个不含正文的样本。查清后删除此文件。
// 只回聚合数字和 id/createdAt，不回任何 memo 正文，避免泄露。
import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { memos, users } from '~/lib/db/schema'

export default defineEventHandler(async (event) => {
  const db = useDb(event)

  const count = async (where?: any): Promise<number> => {
    const rows = await db.select({ c: sql<number>`count(*)` }).from(memos).where(where as any)
    return Number(rows[0]?.c ?? 0)
  }

  const totalMemos = await count(undefined)
  const publicMemos = await count(
    or(isNull(memos.availableForProple), eq(memos.availableForProple, '')),
  )
  const nullContentMemos = await count(isNull(memos.content))

  const userRows = await db.select({ c: sql<number>`count(*)` }).from(users)
  const userCount = Number(userRows[0]?.c ?? 0)

  const sample = await db
    .select({ id: memos.id, userId: memos.userId, createdAt: memos.createdAt })
    .from(memos)
    .orderBy(sql`${memos.id} DESC`)
    .limit(5)

  const payload = {
    success: true,
    totalMemos,
    publicMemos,
    restrictedMemos: totalMemos - publicMemos,
    nullContentMemos,
    userCount,
    sampleLatestIds: sample,
  }
  console.log('[memo/debug-count]', JSON.stringify(payload))
  return payload
})
