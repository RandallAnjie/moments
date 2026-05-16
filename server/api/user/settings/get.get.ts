import { eq } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { users, config as configTable, systemConfig } from '~/lib/db/schema'

type UserPublic = {
  nickname: string | null
  avatarUrl: string | null
  slogan: string | null
  coverUrl: string | null
  personalCss: string
  eMail?: string | null
}

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const paramUser = url.searchParams.get('user')

  let userId = 1
  if (paramUser && /^\d+$/.test(paramUser)) {
    userId = parseInt(paramUser, 10)
  }
  if (!userId || userId < 1) {
    userId = event.context.userId ?? 1
  }
  userId = userId ? userId : 1

  const db = useDb(event)

  const includeEmail = event.context.userId === userId
  const userRows = await db
    .select({
      nickname: users.nickname,
      avatarUrl: users.avatarUrl,
      slogan: users.slogan,
      coverUrl: users.coverUrl,
      css: users.css,
      eMail: users.eMail,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  let userData: UserPublic | null = null
  if (userRows[0]) {
    const row = userRows[0]
    userData = {
      nickname: row.nickname,
      avatarUrl: row.avatarUrl,
      slogan: row.slogan,
      coverUrl: row.coverUrl,
      personalCss: row.css ?? '',
    }
    if (includeEmail) {
      userData.eMail = row.eMail
    }
  }

  const configRows = await db
    .select({
      favicon: configTable.favicon,
      title: configTable.title,
      css: configTable.css,
      js: configTable.js,
      beianNo: configTable.beianNo,
    })
    .from(configTable)
    .where(eq(configTable.id, 1))
    .limit(1)
  let configData = configRows[0] ?? null

  if (!userData || !configData) {
    if (!userData && userId === 1) {
      const now = new Date().toISOString()
      // Legacy bcrypt hash of "admin" — verifyPassword falls back to bcryptjs and
      // transparently re-hashes to PBKDF2 on the first successful login.
      const defaultPasswordHash =
        '$2a$10$J0SQQJcEAg4jQGZNCPHndu.Ehh6EZQxjhvuPkhJTpPBMqtFStbCYm'
      await db.insert(users).values({
        username: 'admin',
        nickname: 'admin',
        password: defaultPasswordHash,
        avatarUrl: '/avatar.webp',
        slogan: '这个人很懒，什么都没有留下',
        coverUrl: '/cover.webp',
        createdAt: now,
        updatedAt: now,
        enableS3: false,
        title: 'admin',
        eMail: 'example@randallanjie.com',
      })
      const reReadUser = await db
        .select({
          nickname: users.nickname,
          avatarUrl: users.avatarUrl,
          slogan: users.slogan,
          coverUrl: users.coverUrl,
          eMail: users.eMail,
          css: users.css,
        })
        .from(users)
        .where(eq(users.id, 1))
        .limit(1)
      if (reReadUser[0]) {
        userData = {
          nickname: reReadUser[0].nickname,
          avatarUrl: reReadUser[0].avatarUrl,
          slogan: reReadUser[0].slogan,
          coverUrl: reReadUser[0].coverUrl,
          personalCss: reReadUser[0].css ?? '',
          eMail: reReadUser[0].eMail,
        }
      }
    }
    if (!configData) {
      await db.insert(configTable).values({
        enableS3: false,
        favicon: '/favicon.ico',
        title: 'Randall的小屋',
        css: '',
        js: '',
        beianNo: '',
      })
      const reReadConfig = await db
        .select({
          favicon: configTable.favicon,
          title: configTable.title,
          css: configTable.css,
          js: configTable.js,
          beianNo: configTable.beianNo,
        })
        .from(configTable)
        .where(eq(configTable.id, 1))
        .limit(1)
      configData = reReadConfig[0] ?? null
    }
    if (userId !== 1 && !userData) {
      throw new Error('User not found')
    }
  }

  const systemConfigRows = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.type, 1))

  const data = {
    ...(userData ?? {}),
    ...(configData ?? {}),
    isadmin: event.context.userId === 1,
    ...Object.fromEntries(systemConfigRows.map((item) => [item.key, item.value])),
  }

  return {
    success: true,
    data,
  }
})
