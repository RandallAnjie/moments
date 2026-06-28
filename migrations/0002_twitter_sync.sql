-- X (Twitter) 多用户同步。
-- 每个用户在设置页用 3-legged OAuth 1.0a 绑定自己的 X 账号，access token
-- 存在 User 行上（token/secret 不过期，无需 refresh）。发 memo 勾「同步到 X」
-- 时用「站点 App consumer key + 该用户 token」发到他自己的 X。
-- Memo.tweetId 记录同步生成的推文 id，用于前端打 X 徽标并回链到那条推。
ALTER TABLE "User" ADD COLUMN "twitterAccessToken" TEXT;
ALTER TABLE "User" ADD COLUMN "twitterAccessSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "twitterScreenName" TEXT;
ALTER TABLE "User" ADD COLUMN "twitterUserId" TEXT;

ALTER TABLE "Memo" ADD COLUMN "tweetId" TEXT;
