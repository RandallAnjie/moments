// [TEMP one-time] RandallFlare 没有自动应用 0002 迁移，导致部署的代码里
// drizzle select() 引用了 DB 中并不存在的 tweetId 列，而 RF-D1 对未知列
// 静默返回空 → memo 列表全空。这里手动把缺的列补上(纯 ADD COLUMN，
// additive，安全，幂等：已存在则忽略)。跑一次后此文件即删除。
import { sql } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'

const SECRET = 'rf-fix-tw-0002-9q7x'

export default defineEventHandler(async (event) => {
  if (getQuery(event).key !== SECRET) {
    throw createError({ statusCode: 403, statusMessage: 'forbidden' })
  }
  const db = useDb(event)
  const stmts = [
    'ALTER TABLE "User" ADD COLUMN "twitterAccessToken" TEXT',
    'ALTER TABLE "User" ADD COLUMN "twitterAccessSecret" TEXT',
    'ALTER TABLE "User" ADD COLUMN "twitterScreenName" TEXT',
    'ALTER TABLE "User" ADD COLUMN "twitterUserId" TEXT',
    'ALTER TABLE "Memo" ADD COLUMN "tweetId" TEXT',
  ]
  const results: Record<string, string> = {}
  for (const s of stmts) {
    try {
      await db.run(sql.raw(s))
      results[s] = 'ok'
    } catch (e) {
      // 已存在 / 其它错误：记下来继续，不中断
      results[s] = 'skip: ' + (e instanceof Error ? e.message : String(e))
    }
  }

  // 验证：dump Memo 列，确认 tweetId 现在在不在
  let columns: string[] = []
  try {
    const info: any = await db.all(sql`PRAGMA table_info("Memo")`)
    const arr = Array.isArray(info) ? info : info?.results ?? []
    columns = arr.map((r: any) => r.name)
  } catch {
    columns = ['pragma_failed']
  }

  return { success: true, results, hasTweetIdNow: columns.includes('tweetId'), columns }
})
