// [TEMP DEBUG] 排查「memo 列表返回空但表里有 219 条」。查清后删除此文件。
import { and, eq, isNull, like, or, sql } from 'drizzle-orm'
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

  // 1) Memo 表真实列（确认 0002 迁移有没有把 tweetId 加上）
  let columns: string[] = []
  try {
    const info: any = await db.all(sql`PRAGMA table_info("Memo")`)
    const arr = Array.isArray(info) ? info : info?.results ?? []
    columns = arr.map((r: any) => r.name)
  } catch (e) {
    columns = ['PRAGMA_FAILED:' + (e instanceof Error ? e.message : String(e))]
  }

  // 2) drizzle select() 选全部列(含 tweetId)能不能跑
  let selectAllOk = true
  let selectAllErr = ''
  try {
    await db.select().from(memos).limit(1)
  } catch (e) {
    selectAllOk = false
    selectAllErr = e instanceof Error ? e.message : String(e)
  }

  // 3) 完全复刻 list 匿名分支的 WHERE，看到底 match 几条
  const ctxUserId = undefined as unknown as number
  const listWhere = and(
    like(memos.content, `%%`),
    or(
      isNull(memos.availableForProple),
      eq(memos.availableForProple, ''),
      like(memos.availableForProple, `%#${ctxUserId}$%`),
    ),
  )
  const listAnonMatch = await count(listWhere)
  const contentLikeAll = await count(like(memos.content, `%%`))

  const payload = {
    success: true,
    totalMemos,
    publicMemos,
    listAnonMatch,
    contentLikeAll,
    selectAllOk,
    selectAllErr,
    hasTweetIdColumn: columns.includes('tweetId'),
    columns,
  }
  console.log('[memo/debug-count]', JSON.stringify(payload))
  return payload
})
