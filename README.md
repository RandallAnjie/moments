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

## Cloudflare API Token

下面"一次性资源准备" + "部署" + "GitHub Actions CI" 全都通过同一个 API Token 工作。建议先去 https://dash.cloudflare.com/profile/api-tokens **Create Custom Token**，授予下面这一套覆盖**首次完整初始化 + 后续持续部署**所需的全部权限。

| 作用域 | 权限 | 用途 |
| --- | --- | --- |
| Account → **Cloudflare Pages** | Edit | 创建 Pages 项目、写 secrets、`pages deploy` |
| Account → **D1** | Edit | `d1 create`、`d1 migrations apply --remote`、`d1 execute` |
| Account → **Workers R2 Storage** | Edit | `r2 bucket create`、`r2 bucket dev-url enable`、`r2 object` |
| Account → **Workers KV Storage** | Edit | `kv namespace create`、`kv key put/get` |
| Account → **Workers Scripts** | Edit | （某些 Pages 函数相关后端操作需要） |
| Account → **Account Settings** | Read | `wrangler whoami` 列账号 |
| User → **User Details** | Read | `wrangler whoami` 不报警告 |

**Account Resources**：选 "Include → Specific account → 你要部署到的那个账号"。**TTL**：CI 推荐 "不过期"；手动一次性部署可以设短 TTL（比如 1 天）用完即弃。**Zone Resources**：默认 "All zones" 不需要改（除非要绑自定义域名才需要 Zone → DNS → Edit）。

获得 token 后两种用法：

```bash
# A) 命令行手动：用 env var 让 wrangler 拿到，不写盘
export CLOUDFLARE_API_TOKEN='cfut_...'
export CLOUDFLARE_ACCOUNT_ID='<你的 Account ID（仪表盘右侧栏可见）>'
pnpm wrangler whoami   # 验证

# B) GitHub Actions：在 repo Settings → Secrets and variables → Actions 加两个
#   CLOUDFLARE_API_TOKEN = cfut_...
#   CLOUDFLARE_ACCOUNT_ID = <账号 ID>
# 之后 push 到 master / cloudflare-migration 触发 .github/workflows/deploy.yml
```

> 不想用自定义 token 也可以走 `pnpm wrangler login`（OAuth 浏览器跳转），但 CI / 服务器环境不方便。

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

### 方式 A：本地手动部署

```bash
# 第一次：先创建 Pages 项目（绑定通过随后的 deploy 自动从 wrangler.toml 注入）
pnpm wrangler pages project create moments --production-branch=master

# 写机密
echo "<your-jwt-secret>" | pnpm wrangler pages secret put JWT_SECRET --project-name=moments
# 其他可选 secrets：JWT_EXPIRES_IN / SITE_URL / RECAPTCHA_SECRET_KEY / TENCENT_MAP_KEY

# 构建 + 部署
pnpm build
pnpm wrangler pages deploy ./dist --project-name=moments --branch=master
```

部署后 Pages 项目里就会带上 `wrangler.toml` 声明的 D1 / R2 / KV 绑定（名称：`DB` / `UPLOADS` / `KV`）。

### 方式 B：GitHub Actions 自动部署（推荐）

仓库自带 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — push 到 `master` 或 `cloudflare-migration` 分支（也可以手动 `workflow_dispatch`）即自动 build + 部署。

只需要在 GitHub repo 加两个 secrets（前提是 token 按上面"API Token"小节配好了权限）：

```
Settings → Secrets and variables → Actions → New repository secret
  - CLOUDFLARE_API_TOKEN = cfut_...（长 TTL）
  - CLOUDFLARE_ACCOUNT_ID = <你的 Account ID>
```

> ⚠️ 这种方式 Cloudflare Pages 仪表盘里仍然显示 "No Git Provider"，因为部署是通过 API 直接上传 `dist/`，不是 Cloudflare 自己 clone 仓库。优点是构建环境完全可控（Node 22 + pnpm 10）。

### 方式 C：把仓库直接连到 Cloudflare Pages

在 Cloudflare 后台 → Pages → 项目 → Settings → Builds & deployments → Connect to Git，授权 GitHub 之后填：

- 构建命令：`pnpm build`
- 输出目录：`dist`
- Node version 环境变量：`NODE_VERSION=20`（避免 CF 默认的旧 Node）

绑定 D1 / R2 / KV 在 "Settings → Bindings"，名称必须与 `wrangler.toml` 一致：`DB`、`UPLOADS`、`KV`。环境变量按上文表格配置，机密走 "Encrypted variable"。

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
