import { and, eq, inArray } from 'drizzle-orm'
import { useDb } from '~/lib/db/d1'
import { config, notifications, systemConfig } from '~/lib/db/schema'

export default defineEventHandler(async (event) => {
    const db = useDb(event)

    const url = getRequestURL(event)
    const params = url.searchParams
    const geteventnotification = params.get('geteventnotification')
    const email = params.get('email')

    const configRows = await db
        .select()
        .from(config)
        .where(eq(config.id, 1))
        .limit(1)
    let configRow = configRows[0]

    if (!configRow) {
        throw new Error('Info not found')
    }

    let notification = (
        await db
            .select()
            .from(notifications)
            .where(eq(notifications.type, 2))
            .limit(1)
    )[0]
    if (!notification) {
        await db.insert(notifications).values({
            type: 2,
            sendFrom: null,
            sendToUserId: 0,
            sendToEmail: '',
            linkedMemo: 0,
            message: '',
            time: new Date().toISOString(),
        })
        notification = (
            await db
                .select()
                .from(notifications)
                .where(eq(notifications.type, 2))
                .limit(1)
        )[0]
    }

    let configData
    let data: Record<string, unknown>

    if (event.context.userId === 1) {
        configData = await db
            .select()
            .from(systemConfig)
            .where(inArray(systemConfig.type, [1, 2]))
        data = {
            notification,
            ...configRow,
            ...Object.fromEntries(configData.map((item) => [item.key, item.value])),
        }
    } else {
        configData = await db
            .select()
            .from(systemConfig)
            .where(inArray(systemConfig.type, [1]))
        // 公开请求绝不能拿到敏感 secret —— metingToken 是 HMAC 签名密钥,
        // 一旦泄到前端 anyone 就能签出任意 url/pic/lrc 请求。在这里 strip。
        // 别的 type=1 secret 同理(将来加新 secret 时往这个 set 里加)。
        const PUBLIC_SECRET_KEYS = new Set(['metingToken'])
        const publicConfig = Object.fromEntries(
            configData
                .filter((item) => !PUBLIC_SECRET_KEYS.has(item.key))
                .map((item) => [item.key, item.value]),
        )
        data = {
            notification,
            enableS3: configRow.enableS3,
            enableRecaptcha: configRow.enableRecaptcha,
            recaptchaSiteKey: configRow.recaptchaSiteKey,
            enableTencentMap: configRow.enableTencentMap,
            tencentMapKey: configRow.tencentMapKey,
            ...publicConfig,
        }
    }

    if (event.context.userId) {
        const ctxUserId = event.context.userId as number
        const notificationRecord = await db
            .select()
            .from(notifications)
            .where(
                and(
                    eq(notifications.type, 1),
                    eq(notifications.sendToUserId, ctxUserId),
                ),
            )
        if (notificationRecord.length > 0) {
            data = { notificationRecord, ...data }
            await db
                .update(notifications)
                .set({ type: 0 })
                .where(
                    and(
                        eq(notifications.type, 1),
                        eq(notifications.sendToUserId, ctxUserId),
                    ),
                )
        }
    } else if (geteventnotification && email) {
        const notificationRecord = await db
            .select()
            .from(notifications)
            .where(
                and(
                    eq(notifications.type, 1),
                    eq(notifications.sendToEmail, email),
                ),
            )
        if (notificationRecord.length > 0) {
            data = { notificationRecord, ...data }
            await db
                .update(notifications)
                .set({ type: 0 })
                .where(
                    and(
                        eq(notifications.type, 1),
                        eq(notifications.sendToEmail, email),
                    ),
                )
        }
    }

    return {
        success: true,
        data: data,
    }
})
