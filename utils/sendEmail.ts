// Workers-native email delivery via MailChannels.
//
// MailChannels (https://api.mailchannels.net/tx/v1/send) is the standard
// outbound relay for Cloudflare Workers / Pages — it accepts unauthenticated
// POST requests from Workers and routes them through SPF/DKIM-aligned
// senders. Replaces the legacy nodemailer + SMTP path; no Node TCP/TLS
// runtime needed.
//
// Sender resolution order (first non-empty wins):
//   1. Config row (id=1)  →  mailUser (address) + mailFrom/mailName (display)
//   2. env.MAIL_FROM  +  env.MAIL_FROM_NAME
// `Config.enableEmail` is the master gate. If it's off, sendEmail returns
// {success:false} without making a network call.
import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { getCfEnv } from '~/lib/cf-env'
import { useDb } from '~/lib/db/d1'
import { config as configTable } from '~/lib/db/schema'

type SendEmailOptions = {
  email: string
  subject: string
  message: string
}

export type SendEmailResult =
  | { success: true; messageId?: string }
  | { success: false; error: string }

export async function sendEmail(
  event: H3Event,
  options: SendEmailOptions,
): Promise<SendEmailResult> {
  const db = useDb(event)
  const rows = await db
    .select()
    .from(configTable)
    .where(eq(configTable.id, 1))
    .limit(1)
  const siteConfig = rows[0]

  if (!siteConfig?.enableEmail) {
    return { success: false, error: 'Email service is not enabled' }
  }

  const env = getCfEnv(event) as Record<string, any>
  const fromAddress =
    (siteConfig.mailUser && siteConfig.mailUser.trim()) ||
    (typeof env.MAIL_FROM === 'string' ? env.MAIL_FROM : '')
  const fromName =
    (siteConfig.mailFrom && siteConfig.mailFrom.trim()) ||
    (siteConfig.mailName && siteConfig.mailName.trim()) ||
    (typeof env.MAIL_FROM_NAME === 'string' ? env.MAIL_FROM_NAME : 'Moments')

  if (!fromAddress) {
    return {
      success: false,
      error:
        'No sender address configured (set Config.mailUser or env MAIL_FROM)',
    }
  }

  // MailChannels requires text/plain before text/html when both are present.
  const body = {
    personalizations: [{ to: [{ email: options.email }] }],
    from: { email: fromAddress, name: fromName },
    subject: options.subject,
    content: [
      { type: 'text/plain', value: options.message },
      { type: 'text/html', value: options.message },
    ],
  }

  try {
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      return {
        success: false,
        error: `MailChannels ${response.status}: ${errText || response.statusText}`,
      }
    }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) }
  }
}
