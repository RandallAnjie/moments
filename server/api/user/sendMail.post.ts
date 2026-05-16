// Cloudflare-native verification-code dispatch:
//   - D1 (drizzle) replaces prisma for Config/SystemConfig/User reads
//   - KV replaces redis for the 5-minute verification-code TTL window
//   - sendEmail() now relays through MailChannels (see utils/sendEmail.ts)
//
// Key contract with register.post.ts (and future reset/changeEmail flows):
// the code is written under key `${action}${email}` with expirationTtl=300.
// register.post.ts reads/deletes the same key on consumption.
import { eq } from 'drizzle-orm'
import { sendEmail } from '~/utils/sendEmail'
import { useDb, type DB } from '~/lib/db/d1'
import { config as configTable, systemConfig, users } from '~/lib/db/schema'

type sendMailReq = {
  email: string
  action: string
}

function getKv(event: any): KVNamespace {
  const kv = event?.context?.cloudflare?.env?.KV as KVNamespace | undefined
  if (!kv) {
    throw new Error(
      'KV binding "KV" is not available on event.context.cloudflare.env. ' +
        'Run via `wrangler pages dev` (or deploy to Pages) so the binding is injected.',
    )
  }
  return kv
}

export default defineEventHandler(async (event) => {
  let { email, action } = (await readBody(event)) as sendMailReq
  let userid = 0

  const db = useDb(event)
  const kv = getKv(event)

  if (action === 'resetPassword') {
    // Legacy behaviour: try username lookup first (the form posts a single
    // field that may be either username or email), then fall back to email.
    const byUsername = await db
      .select()
      .from(users)
      .where(eq(users.username, email))
      .limit(1)
    if (byUsername[0] && byUsername[0].eMail) {
      email = byUsername[0].eMail
      userid = byUsername[0].id
    } else {
      const byEmail = await db
        .select()
        .from(users)
        .where(eq(users.eMail, email))
        .limit(1)
      if (byEmail[0] && byEmail[0].eMail) {
        email = byEmail[0].eMail
        userid = byEmail[0].id
      } else {
        // Random 2–8s delay to mask whether the account exists (timing attack).
        await new Promise((resolve) =>
          setTimeout(resolve, Math.floor(Math.random() * 6000) + 2000),
        )
        return {
          success: true,
          message:
            '如果您的登陆名/邮箱存在于我们的数据库中，我们将发送一封邮件到您的邮箱，请注意查收',
        }
      }
    }
  }

  const existing = await kv.get(action + email)
  if (existing) {
    return { success: false, message: '上一条验证码还未过期，请五分钟后再试' }
  }

  if (!email) {
    return { success: false, message: '邮箱不能为空' }
  } else if (!/^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(email)) {
    return { success: false, message: '邮箱格式不正确' }
  }

  if (!['register', 'resetPassword', 'changeEmail'].includes(action)) {
    return { success: false, message: '参数错误' }
  }

  const verificationCode = await generateVerificationCode(db)
  let sendMailTemplate = `您的验证码是：${verificationCode}，五分钟内有效，五分钟内请勿重新尝试发送。`

  const titleRows = await db
    .select({ title: configTable.title, siteUrl: configTable.siteUrl })
    .from(configTable)
    .where(eq(configTable.id, 1))
    .limit(1)
  const title = titleRows[0] ?? { title: null, siteUrl: null }

  if (action === 'register') {
    const enableRegisterRows = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, 'enableRegister'))
      .limit(1)
    if (!enableRegisterRows[0] || enableRegisterRows[0].value !== '1') {
      return { success: false, message: '站点未开启注册' }
    }
    const tpl = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, 'emailRegistrationContent'))
      .limit(1)
    if (tpl[0]?.value) {
      sendMailTemplate = tpl[0].value
    }
  } else if (action === 'resetPassword') {
    const tpl = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, 'emailResetContent'))
      .limit(1)
    if (tpl[0]?.value) {
      sendMailTemplate = tpl[0].value
    }
    // Reset link substitution happens first so {Code} inside the template
    // body (if any) is replaced with the verification code below.
    sendMailTemplate = sendMailTemplate.replaceAll(
      '{Code}',
      (title.siteUrl ?? '') + '/user/recovery/' + userid + '?v=' + verificationCode,
    )
  } else if (action === 'changeEmail') {
    const tpl = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, 'emailChangeContent'))
      .limit(1)
    if (tpl[0]?.value) {
      sendMailTemplate = tpl[0].value
    }
  }

  sendMailTemplate = sendMailTemplate.replaceAll('{Code}', verificationCode)
  sendMailTemplate = sendMailTemplate.replaceAll('{Email}', email)
  sendMailTemplate = sendMailTemplate.replaceAll('{Site}', title.title ?? 'moments')

  let urlFallback = title.siteUrl
  if (!urlFallback) {
    try {
      urlFallback = getRequestURL(event).origin
    } catch {
      urlFallback = ''
    }
  }
  sendMailTemplate = sendMailTemplate.replaceAll('{Url}', urlFallback ?? '')

  const sendData = {
    email,
    subject: title.title == null ? '验证码' : title.title + '验证码',
    message: sendMailTemplate,
  }
  const result = await sendEmail(event, sendData)
  if (result.success) {
    await kv.put(action + email, verificationCode, { expirationTtl: 5 * 60 })
    return {
      success: true,
      message: '验证码已发送至您的邮箱，验证码五分钟内有效，请注意查收',
    }
  }
  return {
    success: false,
    message: '验证码发送失败，请检查邮箱是否正确，或当前邮件服务异常稍后再试',
    error: result.error,
  }
})

async function generateVerificationCode(db: DB): Promise<string> {
  const length = 6
  const rows = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, 'mailVerificationCodeType'))
    .limit(1)
  let codeType = 1
  if (rows[0]?.value) {
    const parsed = parseInt(rows[0].value)
    if (!Number.isNaN(parsed)) {
      codeType = parsed
    }
  }

  let chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  if (codeType === 1) {
    chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  } else if (codeType === 2) {
    chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  } else if (codeType === 3) {
    chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  } else if (codeType === 4) {
    chars = 'abcdefghijklmnopqrstuvwxyz'
  } else if (codeType === 5) {
    chars = '0123456789'
  }

  // Web Crypto-based randomness — works in Workers and Node 22 alike.
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length]
  }
  return code
}
