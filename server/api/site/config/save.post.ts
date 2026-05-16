import { eq } from 'drizzle-orm'
import { useDb, type DB } from '~/lib/db/d1'
import { config, notifications, systemConfig } from '~/lib/db/schema'

type SaveConfigsReq = {
    enableS3: boolean,
    domain?: string,
    bucket?: string,
    region?: string,
    accessKey?: string,
    secretKey?: string,
    endpoint?: string,
    thumbnailSuffix?: string,
    title?: string,
    favicon?: string,
    css?: string,
    js?: string,
    beianNo?: string,
    siteUrl?: string,
    enableRecaptcha?: boolean,
    recaptchaSiteKey?: string,
    recaptchaSecretKey?: string,
    enableTencentMap?: boolean,
    tencentMapKey?: string,
    enableAliyunDective?: boolean,
    aliyunAccessKeyId?: string,
    aliyunAccessKeySecret?: string,
    enableEmail?: boolean,
    mailHost?: string,
    mailPort?: number,
    mailSecure?: boolean,
    mailUser?: string,
    mailPass?: string,
    mailFrom?: string,
    mailName?: string,
    notification?: string,

    mailVerificationCodeType?: number,
    enableRegister?: boolean,
    timeFrontend?: string,
    customLocation?: boolean,
    emailRegistrationContent?: string,
    emailChangeContent?: string,
    emailResetContent?: string,
    emailMentionNotification?: string,
    emailNewCommentNotification?: string,
    emailNewReplyCommentNotification?: string,
    emailNewMentionCommentNotification?: string,
    metingApi?: string,
    customWeather?: boolean,
    aboutHtml?: string,
}

export default defineEventHandler(async (event) => {
    const data = (await readBody(event)) as SaveConfigsReq

    if (event.context.userId !== 1) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    const db = useDb(event)

    // Build a sparse update payload so undefined values are SKIPPED rather
    // than persisted as NULL (drizzle does not drop undefined values from .set()).
    const setPayload: Partial<typeof config.$inferInsert> = {}
    const assign = <K extends keyof typeof config.$inferInsert>(key: K, val: typeof config.$inferInsert[K] | undefined) => {
        if (val !== undefined) setPayload[key] = val
    }
    assign('enableS3', data.enableS3)
    assign('s3Domain', data.domain)
    assign('s3Bucket', data.bucket)
    assign('s3Region', data.region)
    assign('s3AccessKey', data.accessKey)
    assign('s3SecretKey', data.secretKey)
    assign('s3Endpoint', data.endpoint)
    assign('s3ThumbnailSuffix', data.thumbnailSuffix)
    assign('title', data.title)
    assign('favicon', data.favicon)
    assign('css', data.css)
    assign('js', data.js)
    assign('beianNo', data.beianNo)
    assign('siteUrl', data.siteUrl)
    assign('enableRecaptcha', data.enableRecaptcha)
    assign('recaptchaSiteKey', data.recaptchaSiteKey)
    assign('recaptchaSecretKey', data.recaptchaSecretKey)
    assign('enableTencentMap', data.enableTencentMap)
    assign('tencentMapKey', data.tencentMapKey)
    assign('enableAliyunDective', data.enableAliyunDective)
    assign('aliyunAccessKeyId', data.aliyunAccessKeyId)
    assign('aliyunAccessKeySecret', data.aliyunAccessKeySecret)
    assign('enableEmail', data.enableEmail)
    assign('mailHost', data.mailHost)
    assign('mailPort', data.mailPort)
    assign('mailSecure', data.mailSecure)
    assign('mailUser', data.mailUser)
    assign('mailPass', data.mailPass)
    assign('mailFrom', data.mailFrom)
    assign('mailName', data.mailName)

    if (Object.keys(setPayload).length > 0) {
        await db.update(config).set(setPayload).where(eq(config.id, 1))
    }

    // Preserve prisma's undefined-skip semantic: only touch the type=2
    // notification when the caller actually provided a message.
    if (data.notification !== undefined) {
        const [existingNotification] = await db
            .select({ id: notifications.id })
            .from(notifications)
            .where(eq(notifications.type, 2))
            .limit(1)

        if (existingNotification) {
            await db
                .update(notifications)
                .set({ message: data.notification })
                .where(eq(notifications.id, existingNotification.id))
        } else {
            await db.insert(notifications).values({
                type: 2,
                message: data.notification,
                time: new Date().toISOString(),
            })
        }
    }

    await updateSystemConfig(db, 'mailVerificationCodeType', data.mailVerificationCodeType?.toString() || '1', 1)
    await updateSystemConfig(db, 'enableRegister', data.enableRegister ? '1' : '0', 1)
    await updateSystemConfig(db, 'timeFrontend', data?.timeFrontend || '', 1)
    await updateSystemConfig(db, 'customLocation', data.customLocation ? '1' : '0', 1)
    await updateSystemConfig(db, 'emailRegistrationContent', data.emailRegistrationContent || '', 2)
    await updateSystemConfig(db, 'emailChangeContent', data.emailChangeContent || '', 2)
    await updateSystemConfig(db, 'emailResetContent', data.emailResetContent || '', 2)
    await updateSystemConfig(db, 'emailMentionNotification', data.emailMentionNotification || '', 2)
    await updateSystemConfig(db, 'emailNewCommentNotification', data.emailNewCommentNotification || '', 2)
    await updateSystemConfig(db, 'emailNewReplyCommentNotification', data.emailNewReplyCommentNotification || '', 2)
    await updateSystemConfig(db, 'emailNewMentionCommentNotification', data.emailNewMentionCommentNotification || '', 2)
    await updateSystemConfig(db, 'metingApi', data.metingApi || '', 1)
    await updateSystemConfig(db, 'customWeather', data.customWeather ? '1' : '0', 1)
    await updateSystemConfig(db, 'aboutHtml', data.aboutHtml || '', 2)

    return {
        success: true,
    }
})

async function updateSystemConfig(db: DB, key: string, value: string, type: number) {
    const [record] = await db
        .select({ id: systemConfig.id })
        .from(systemConfig)
        .where(eq(systemConfig.key, key))
        .limit(1)
    if (record) {
        await db
            .update(systemConfig)
            .set({ type, value })
            .where(eq(systemConfig.id, record.id))
    } else {
        await db.insert(systemConfig).values({ type, key, value })
    }
}
