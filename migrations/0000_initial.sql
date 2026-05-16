-- Initial D1 schema for moments
-- Translated from prisma/schema.prisma (MySQL) to SQLite/D1.
-- Conventions:
--   * `Boolean` -> INTEGER (0/1)
--   * `DateTime` -> TEXT (ISO 8601, stored as string via Drizzle / app code)
--   * `@db.Text` collapses to TEXT (SQLite has no length distinction)
--   * `@default(now())` is enforced by application code, not by SQLite default,
--     because cross-driver portability for CURRENT_TIMESTAMP semantics is awkward
--     and the app already wraps inserts/updates.

CREATE TABLE IF NOT EXISTS "User" (
  "id"              INTEGER PRIMARY KEY AUTOINCREMENT,
  "username"        TEXT    NOT NULL UNIQUE,
  "nickname"        TEXT,
  "password"        TEXT    NOT NULL,
  "avatarUrl"       TEXT,
  "slogan"          TEXT,
  "coverUrl"        TEXT,
  "createdAt"       TEXT    NOT NULL,
  "updatedAt"       TEXT    NOT NULL,
  "enableS3"        INTEGER NOT NULL DEFAULT 0,
  "domain"          TEXT,
  "bucket"          TEXT,
  "region"          TEXT,
  "accessKey"       TEXT,
  "secretKey"       TEXT,
  "endpoint"        TEXT,
  "thumbnailSuffix" TEXT,
  "favicon"         TEXT,
  "title"           TEXT    NOT NULL DEFAULT 'Randall的小屋',
  "css"             TEXT,
  "js"              TEXT,
  "beianNo"         TEXT,
  "eMail"           TEXT,
  "code"            TEXT
);

CREATE TABLE IF NOT EXISTS "Memo" (
  "id"                  INTEGER PRIMARY KEY AUTOINCREMENT,
  "content"             TEXT,
  "imgs"                TEXT,
  "favCount"            INTEGER NOT NULL DEFAULT 0,
  "commentCount"        INTEGER NOT NULL DEFAULT 0,
  "userId"              INTEGER NOT NULL,
  "createdAt"           TEXT    NOT NULL,
  "updatedAt"           TEXT    NOT NULL,
  "music163Url"         TEXT,
  "bilibiliUrl"         TEXT,
  "location"            TEXT,
  "externalUrl"         TEXT,
  "externalTitle"       TEXT,
  "externalFavicon"     TEXT    NOT NULL DEFAULT '/favicon.png',
  "pinned"              INTEGER NOT NULL DEFAULT 0,
  "atpeople"            TEXT,
  "availableForProple"  TEXT,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Memo_userId_idx" ON "Memo" ("userId");
CREATE INDEX IF NOT EXISTS "Memo_createdAt_idx" ON "Memo" ("createdAt");

CREATE TABLE IF NOT EXISTS "Comment" (
  "id"            INTEGER PRIMARY KEY AUTOINCREMENT,
  "content"       TEXT,
  "replyTo"       TEXT,
  "username"      TEXT,
  "email"         TEXT,
  "website"       TEXT,
  "createdAt"     TEXT    NOT NULL,
  "updatedAt"     TEXT    NOT NULL,
  "memoId"        INTEGER NOT NULL,
  "author"        INTEGER,
  "replyToUser"   INTEGER,
  "linkedUser"    INTEGER,
  "replyToId"     INTEGER,
  FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Comment_memoId_idx" ON "Comment" ("memoId");

CREATE TABLE IF NOT EXISTS "Config" (
  "id"                    INTEGER PRIMARY KEY AUTOINCREMENT,
  "enableS3"              INTEGER NOT NULL DEFAULT 0,
  "s3Domain"              TEXT,
  "s3Bucket"              TEXT,
  "s3Region"              TEXT,
  "s3AccessKey"           TEXT,
  "s3SecretKey"           TEXT,
  "s3Endpoint"            TEXT,
  "s3ThumbnailSuffix"     TEXT,
  "favicon"               TEXT,
  "title"                 TEXT    NOT NULL DEFAULT 'Randall的小屋',
  "css"                   TEXT,
  "js"                    TEXT,
  "beianNo"               TEXT,
  "siteUrl"               TEXT,
  "enableRecaptcha"       INTEGER NOT NULL DEFAULT 0,
  "recaptchaSiteKey"      TEXT,
  "recaptchaSecretKey"    TEXT,
  "enableTencentMap"      INTEGER NOT NULL DEFAULT 0,
  "tencentMapKey"         TEXT,
  "enableAliyunDective"   INTEGER NOT NULL DEFAULT 0,
  "aliyunAccessKeyId"     TEXT,
  "aliyunAccessKeySecret" TEXT,
  "enableEmail"           INTEGER NOT NULL DEFAULT 0,
  "mailHost"              TEXT,
  "mailPort"              INTEGER NOT NULL DEFAULT 587,
  "mailSecure"            INTEGER NOT NULL DEFAULT 0,
  "mailUser"              TEXT,
  "mailPass"              TEXT,
  "mailFrom"              TEXT,
  "mailName"              TEXT,
  -- New R2-era fields. Kept alongside legacy s3* columns so admins can migrate
  -- gradually; application code prefers r2* when enableR2 = 1.
  "enableR2"              INTEGER NOT NULL DEFAULT 0,
  "r2PublicBaseUrl"       TEXT,
  "r2ThumbnailSuffix"     TEXT
);

CREATE TABLE IF NOT EXISTS "Notification" (
  "id"              INTEGER PRIMARY KEY AUTOINCREMENT,
  "type"            INTEGER NOT NULL DEFAULT 0,
  "send_from"       INTEGER,
  "send_to_user_id" INTEGER,
  "send_to_email"   TEXT,
  "linked_memo"     INTEGER,
  "message"         TEXT    DEFAULT 'Powered By Randall',
  "time"            TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS "Notification_send_to_user_id_idx" ON "Notification" ("send_to_user_id");

CREATE TABLE IF NOT EXISTS "SystemConfig" (
  "id"    INTEGER PRIMARY KEY AUTOINCREMENT,
  "type"  INTEGER NOT NULL DEFAULT 1,
  "key"   TEXT    NOT NULL,
  "value" TEXT
);
CREATE INDEX IF NOT EXISTS "SystemConfig_key_idx" ON "SystemConfig" ("key");
