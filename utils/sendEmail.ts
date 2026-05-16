// Outbound email via SMTP, using `worker-mailer` so it runs on the Workers /
// Pages runtime (which can't load nodemailer because nodemailer needs Node's
// `net`/`tls` modules — workerd's unenv polyfills don't cover those deeply
// enough). worker-mailer talks SMTP directly over Cloudflare's `connect()`
// API.
//
// SMTP credentials live in the `Config` table (id=1), set via the admin UI:
//   - mailHost / mailPort / mailSecure (1 = direct TLS port 465; 0 = STARTTLS port 587)
//   - mailUser / mailPass
//   - mailFrom (sender address) / mailName (display name)
// `Config.enableEmail` is the master gate.
//
// Cloudflare blocks outbound port 25 permanently, so use 465 (TLS) or 587
// (STARTTLS) on your SMTP server.
import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { WorkerMailer } from 'worker-mailer'
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

  const host = (siteConfig.mailHost ?? '').trim()
  const port = siteConfig.mailPort ?? 0
  const username = (siteConfig.mailUser ?? '').trim()
  const password = (siteConfig.mailPass ?? '').trim()
  const fromAddress = (siteConfig.mailFrom ?? '').trim() || username
  const fromName = (siteConfig.mailName ?? '').trim() || 'Moments'

  if (!host || !port || !username || !password || !fromAddress) {
    return {
      success: false,
      error:
        'SMTP not fully configured. Need mailHost, mailPort, mailUser, mailPass, mailFrom in Config.',
    }
  }

  // mailSecure = 1 means direct TLS from the start (port 465).
  // mailSecure = 0 means plain socket + STARTTLS upgrade (port 587).
  const useSecure = !!siteConfig.mailSecure

  let mailer: WorkerMailer | null = null
  try {
    mailer = await WorkerMailer.connect({
      credentials: { username, password },
      authType: 'plain',
      host,
      port,
      secure: useSecure,
      startTls: !useSecure,
    })

    await mailer.send({
      from: { name: fromName, email: fromAddress },
      to: { email: options.email },
      subject: options.subject,
      html: options.message,
      text: stripHtml(options.message),
    })

    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) }
  } finally {
    try {
      await mailer?.close()
    } catch {
      // ignore close errors
    }
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}
