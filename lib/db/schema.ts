// Drizzle ORM schema for moments — mirrors migrations/0000_initial.sql.
// Application code uses these table definitions; D1 (production) and
// better-sqlite3 (local dev) both work because everything below is
// dialect-agnostic SQLite-core syntax.
import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('User', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  nickname: text('nickname'),
  password: text('password').notNull(),
  avatarUrl: text('avatarUrl'),
  slogan: text('slogan'),
  coverUrl: text('coverUrl'),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
  enableS3: integer('enableS3', { mode: 'boolean' }).notNull().default(false),
  domain: text('domain'),
  bucket: text('bucket'),
  region: text('region'),
  accessKey: text('accessKey'),
  secretKey: text('secretKey'),
  endpoint: text('endpoint'),
  thumbnailSuffix: text('thumbnailSuffix'),
  favicon: text('favicon'),
  title: text('title').notNull().default('Randall的小屋'),
  css: text('css'),
  js: text('js'),
  beianNo: text('beianNo'),
  eMail: text('eMail'),
  code: text('code'),
})

export const memos = sqliteTable(
  'Memo',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    content: text('content'),
    imgs: text('imgs'),
    favCount: integer('favCount').notNull().default(0),
    commentCount: integer('commentCount').notNull().default(0),
    userId: integer('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: text('createdAt').notNull(),
    updatedAt: text('updatedAt').notNull(),
    music163Url: text('music163Url'),
    bilibiliUrl: text('bilibiliUrl'),
    location: text('location'),
    externalUrl: text('externalUrl'),
    externalTitle: text('externalTitle'),
    externalFavicon: text('externalFavicon').notNull().default('/favicon.png'),
    pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
    atpeople: text('atpeople'),
    availableForProple: text('availableForProple'),
  },
  (t) => ({
    userIdIdx: index('Memo_userId_idx').on(t.userId),
    createdAtIdx: index('Memo_createdAt_idx').on(t.createdAt),
  }),
)

export const comments = sqliteTable(
  'Comment',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    content: text('content'),
    replyTo: text('replyTo'),
    username: text('username'),
    email: text('email'),
    website: text('website'),
    createdAt: text('createdAt').notNull(),
    updatedAt: text('updatedAt').notNull(),
    memoId: integer('memoId')
      .notNull()
      .references(() => memos.id, { onDelete: 'cascade' }),
    author: integer('author'),
    replyToUser: integer('replyToUser'),
    linkedUser: integer('linkedUser'),
    replyToId: integer('replyToId'),
  },
  (t) => ({
    memoIdIdx: index('Comment_memoId_idx').on(t.memoId),
  }),
)

export const config = sqliteTable('Config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  enableS3: integer('enableS3', { mode: 'boolean' }).notNull().default(false),
  s3Domain: text('s3Domain'),
  s3Bucket: text('s3Bucket'),
  s3Region: text('s3Region'),
  s3AccessKey: text('s3AccessKey'),
  s3SecretKey: text('s3SecretKey'),
  s3Endpoint: text('s3Endpoint'),
  s3ThumbnailSuffix: text('s3ThumbnailSuffix'),
  favicon: text('favicon'),
  title: text('title').notNull().default('Randall的小屋'),
  css: text('css'),
  js: text('js'),
  beianNo: text('beianNo'),
  siteUrl: text('siteUrl'),
  enableRecaptcha: integer('enableRecaptcha', { mode: 'boolean' }).notNull().default(false),
  recaptchaSiteKey: text('recaptchaSiteKey'),
  recaptchaSecretKey: text('recaptchaSecretKey'),
  enableTencentMap: integer('enableTencentMap', { mode: 'boolean' }).notNull().default(false),
  tencentMapKey: text('tencentMapKey'),
  enableAliyunDective: integer('enableAliyunDective', { mode: 'boolean' }).notNull().default(false),
  aliyunAccessKeyId: text('aliyunAccessKeyId'),
  aliyunAccessKeySecret: text('aliyunAccessKeySecret'),
  enableEmail: integer('enableEmail', { mode: 'boolean' }).notNull().default(false),
  mailHost: text('mailHost'),
  mailPort: integer('mailPort').notNull().default(587),
  mailSecure: integer('mailSecure', { mode: 'boolean' }).notNull().default(false),
  mailUser: text('mailUser'),
  mailPass: text('mailPass'),
  mailFrom: text('mailFrom'),
  mailName: text('mailName'),
  // R2-era columns. Parallel with legacy s3* until admins migrate.
  enableR2: integer('enableR2', { mode: 'boolean' }).notNull().default(false),
  r2PublicBaseUrl: text('r2PublicBaseUrl'),
  r2ThumbnailSuffix: text('r2ThumbnailSuffix'),
})

export const notifications = sqliteTable(
  'Notification',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: integer('type').notNull().default(0),
    sendFrom: integer('send_from'),
    sendToUserId: integer('send_to_user_id'),
    sendToEmail: text('send_to_email'),
    linkedMemo: integer('linked_memo'),
    message: text('message').default('Powered By Randall'),
    time: text('time').notNull(),
  },
  (t) => ({
    sendToUserIdIdx: index('Notification_send_to_user_id_idx').on(t.sendToUserId),
  }),
)

export const systemConfig = sqliteTable(
  'SystemConfig',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: integer('type').notNull().default(1),
    key: text('key').notNull(),
    value: text('value'),
  },
  (t) => ({
    keyIdx: index('SystemConfig_key_idx').on(t.key),
  }),
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Memo = typeof memos.$inferSelect
export type NewMemo = typeof memos.$inferInsert
export type Comment = typeof comments.$inferSelect
export type NewComment = typeof comments.$inferInsert
export type Config = typeof config.$inferSelect
export type NewConfig = typeof config.$inferInsert
export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
export type SystemConfig = typeof systemConfig.$inferSelect
export type NewSystemConfig = typeof systemConfig.$inferInsert
