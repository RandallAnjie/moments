# Moments

> 一个基于 Nuxt 3 的 朋友圈 应用，已完全迁移到 **Cloudflare** 平台部署。
>
> 本项目复刻自 [kingwrcy/moments](https://github.com/kingwrcy/moments)。

## 技术栈

- 框架：Nuxt 3 (SSR) + Vue 3 + Pinia + Tailwind / shadcn-vue
- 部署：Cloudflare Pages（Nitro 的 `cloudflare-pages` preset）
- 数据库：Cloudflare D1（SQLite）+ drizzle-orm
- 对象存储：Cloudflare R2（图片上传 / 读取）
- 缓存 / 短期状态：Cloudflare KV（邮件验证码、找回密码 token 等）
- 邮件：MailChannels（Workers 上免费的 HTTPS 邮件中继）
- 密码哈希：Web Crypto PBKDF2-SHA256（兼容验证遗留的 bcrypt 哈希并在登录时自动重哈希）
- JWT：`@tsndr/cloudflare-worker-jwt`

> ⚠️ 此分支不再支持 Docker / MySQL / Redis / S3 / Minio 部署。如需要传统部署方式，请使用 [上游仓库](https://github.com/kingwrcy/moments)。

## 前置准备

1. [Cloudflare 账号](https://dash.cloudflare.com/sign-up)
2. Node.js ≥ 20 以及 [pnpm](https://pnpm.io/installation)
3. Wrangler CLI（项目已经把 `wrangler` 加到 devDependencies，下面所有命令都通过 `pnpm wrangler …` 调用）
4. （可选）一个用于 R2 公开访问的自定义域名；不配置时可以使用 `*.r2.dev` 公开 URL

## 一次性资源准备

下面命令只在第一次部署时执行；得到的 ID 写回 `wrangler.toml`。

```bash
# 1. 安装依赖
pnpm install

# 2. 登录 Cloudflare
pnpm wrangler login

# 3. 创建 D1 数据库（把输出里的 database_id 写回 wrangler.toml）
pnpm wrangler d1 create moments-db

# 4. 创建 R2 桶（名字保持和 wrangler.toml 一致即可，不需要 ID）
pnpm wrangler r2 bucket create moments-uploads

# 5. 创建 KV 命名空间（把输出里的 id 写回 wrangler.toml）
pnpm wrangler kv namespace create moments-kv

# 6. 应用数据库迁移（migrations/0000_initial.sql）
#    本地预览：
pnpm wrangler d1 migrations apply moments-db --local
#    生产：
pnpm wrangler d1 migrations apply moments-db --remote
```

### R2 公开访问

上传后图片以 `/upload/<uuid>.<ext>` 的形式存进 R2 桶，前端通过同名路径请求。线上有两种方式让浏览器拿到图片：

- **走 Pages 路由**（默认）：`server/routes/upload/[filename].get.ts` 已经把 R2 流式响应包装好，无需额外配置
- **直接走 R2 公开域名**：在 Cloudflare 后台给 `moments-uploads` 开启 `r2.dev` 域名或绑定自定义域名，然后把对应 URL 写到 `wrangler.toml` 的 `R2_PUBLIC_BASE_URL` 里

## 环境变量

公开变量直接放在 `wrangler.toml` 的 `[vars]` 里；机密变量通过 `pnpm wrangler pages secret put <NAME>` 写入，本地开发用 `.dev.vars`（已 gitignored）。

| 变量 | 说明 | 必需 |
| ---- | ---- | ---- |
| `JWT_SECRET` | 签发会话 JWT 的密钥，请用足够长的随机字符串 | ✅ |
| `JWT_EXPIRES_IN` | JWT 有效期，例如 `7d` / `24h` / `60m`（默认 24h） | ❌ |
| `MAIL_FROM` | MailChannels 发件人邮箱（域名需配置 SPF + DKIM） | 启用邮件时需要 |
| `MAIL_FROM_NAME` | 发件人显示名称 | ❌ |
| `R2_PUBLIC_BASE_URL` | R2 公开访问基准 URL，用于在 OG / 邮件等绝对链接里拼图片地址 | ❌ |
| `RECAPTCHA_SECRET_KEY` | reCAPTCHA v3 后端校验 secret | 启用人机校验时需要 |
| `TENCENT_MAP_KEY` | 腾讯地图 Key（位置信息） | 启用位置时需要 |
| `SITE_URL` | 站点对外 URL，用于邮件 / 跳转等绝对链接 | ❌ |
| `SITE_NAME` | 站点名称（默认 `Moments`） | ❌ |

详细模板见 [`.dev.vars.example`](./.dev.vars.example)。

## 本地开发

```bash
# Nuxt 开发服务器（无 Cloudflare 绑定，仅前端 UI 调试）
pnpm dev

# 用真实的 D1 / R2 / KV 本地副本预览（推荐用来跑后端接口）
pnpm build
pnpm wrangler pages dev ./dist
```

`pnpm wrangler pages dev` 会读取 `wrangler.toml` 上声明的绑定并启动本地 D1 / R2 / KV 模拟器，同时加载 `.dev.vars` 里的机密。

> 第一次启动前请确认已经跑过 `pnpm wrangler d1 migrations apply moments-db --local`，否则本地 D1 没有任何表。

## 部署到 Cloudflare Pages

```bash
pnpm build
pnpm wrangler pages deploy ./dist --project-name=<your-pages-project>
```

或在 Cloudflare 后台把仓库连到 Pages，设置：

- 构建命令：`pnpm build`
- 输出目录：`dist`
- 环境变量：按上面的列表配置

Pages 项目设置里需要绑定上面创建的 D1 / R2 / KV，绑定名称必须与 `wrangler.toml` 一致：`DB`、`UPLOADS`、`KV`。

## 默认账号

首次访问 `/api/user/settings/get?userId=1` 时会自动创建管理员账号：

- 用户名 `admin`
- 密码 `admin`（首次登录会自动升级到 PBKDF2 哈希）

请尽快在管理后台修改默认密码。

## 数据库 / 存储设计

- D1 结构定义在 [`migrations/0000_initial.sql`](./migrations/0000_initial.sql)，TS 端的 schema 在 [`lib/db/schema.ts`](./lib/db/schema.ts)
- 图片 R2 key 规范：`<short-uuid>.<ext>`，前端引用形式 `/upload/<short-uuid>.<ext>`
- KV key 规范：`<action><email>`（例如 `register${email}`、`resetPassword${email}`、`changeEmail${email}`），TTL 5 分钟

## 已知限制

- 上传不再做 heic → jpeg 转换（Workers 不能跑原生二进制），iOS Safari 自带支持，其他浏览器需要客户端转换或后续接入 Cloudflare Images
- WebSocket 实时功能已暂时移除；若需要可后续用 Durable Object hibernation API 重新实现
- 没有内置请求限流；如需要可以基于 KV 或 Durable Object 加一个简单的滑动窗口限流中间件

## 许可证

[MIT](./LICENSE)
