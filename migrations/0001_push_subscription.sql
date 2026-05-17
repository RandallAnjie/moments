-- Web Push 订阅。每个浏览器 / 设备 一个 endpoint；同一 user 可以有多个。
-- 同一个 endpoint 不会重复（unique）；登录 cookie 切换会更新 userId。
CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id"        INTEGER PRIMARY KEY AUTOINCREMENT,
  "userId"    INTEGER NOT NULL,
  "endpoint"  TEXT    NOT NULL UNIQUE,
  "p256dh"    TEXT    NOT NULL,
  "auth"      TEXT    NOT NULL,
  "createdAt" TEXT    NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx"
  ON "PushSubscription" ("userId");
