import { and, like, ne } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { users } from '~/lib/db/schema'

type ListUserReq = {
  find?: string
  withMe?: number
}

export default defineEventHandler(async (event) => {
  const { find, withMe } = (await readBody(event)) as ListUserReq
  const pattern = `%${find ?? ''}%`
  const db = useDb(event)

  let rows: Array<{ id: number; nickname: string | null; avatarUrl: string | null }> = []
  if (withMe === 0) {
    const ctxUserId = event.context.userId
    const cond = ctxUserId
      ? and(like(users.nickname, pattern), ne(users.id, ctxUserId))
      : like(users.nickname, pattern)
    rows = await db
      .select({ id: users.id, nickname: users.nickname, avatarUrl: users.avatarUrl })
      .from(users)
      .where(cond)
  } else if (withMe === 1) {
    rows = await db
      .select({ id: users.id, nickname: users.nickname, avatarUrl: users.avatarUrl })
      .from(users)
      .where(like(users.nickname, pattern))
  }

  return {
    data: rows,
    success: true,
  }
})
