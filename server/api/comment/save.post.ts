import prisma from "~/lib/db";
import { readBody } from "h3";
import { sendEmail } from '~/utils/sendEmail';
import RPCClient from '@alicloud/pop-core';

// 定义评论请求的数据类型
type SaveCommentReq = {
    memoId: number;
    content: string;
    replyTo?: string;
    replyToId?: number;
    email?: string;
    website?: string;
    username: string;
    author: number;
    reToken: string;
};

const staticWord = {
    'ad': '广告引流',
    'political_content': '涉政内容',
    'profanity': '辱骂内容',
    'contraband': '违禁内容',
    'sexual_content': '色情内容',
    'violence': '暴恐内容',
    'nonsense': '无意义内容',
    'negative_content': '不良内容',
    'religion': '宗教内容',
    'cyberbullying': '网络暴力',
    'ad_compliance': '广告法合规',
    'C_customized': '违反本站规定',
}

export default defineEventHandler(async (event) => {
    // 从请求体中读取数据
    const { memoId, content, replyTo, replyToId, username, email, website, reToken } =
        (await readBody(event)) as SaveCommentReq;

    if (content.length > 500) {
        return { success: false, message: "评论内容长度不能超过500个字符",};
    }
    if (username.length > 10) {
        return { success: false, message: "用户名长度不能超过8个字符" };
    }
    if (email && email.length > 30) {
        return { success: false, message: "邮箱长度不能超过30个字符" };
    }
    if (website && website.length > 100) {
        return { success: false, message: "网址长度不能超过100个字符" };
    }
    if (email && !/^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(email)) {
        return { success: false, message: "邮箱格式不正确" };
    }
    if (website && !/^(https?:\/\/)?[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(website)) {
        return { success: false, message: "网址格式不正确" };
    }

    if(process.env.RECAPTCHA_SITE_KEY === undefined || process.env.RECAPTCHA_SITE_KEY === '' || process.env.RECAPTCHA_SITE_KEY === 'undefined' || process.env.RECAPTCHA_SITE_KEY === 'null' ||
        process.env.RECAPTCHA_SECRET_KEY === undefined || process.env.RECAPTCHA_SECRET_KEY === '' || process.env.RECAPTCHA_SECRET_KEY === 'undefined' || process.env.RECAPTCHA_SECRET_KEY === 'null'){

    }else{
        // 验证 reCAPTCHA 响应
        const recaptchaResult = await validateRecaptcha(reToken);
        if (!recaptchaResult.success || recaptchaResult.score < 0.5) {
            return {
                success: false,
                message: "reCAPTCHA failed: " + recaptchaResult["error-codes"].join(", ")
            };
        }
    }

    // 文本内容检查
    if(process.env.ALIYUN_ACCESS_KEY_ID === undefined || process.env.ALIYUN_ACCESS_KEY_ID === '' || process.env.ALIYUN_ACCESS_KEY_ID === 'undefined' || process.env.ALIYUN_ACCESS_KEY_ID === 'null' ||
        process.env.ALIYUN_ACCESS_KEY_SECRET === undefined || process.env.ALIYUN_ACCESS_KEY_SECRET === '' || process.env.ALIYUN_ACCESS_KEY_SECRET === 'undefined' || process.env.ALIYUN_ACCESS_KEY_SECRET === 'null'){

    }else{
        const aliJudgeResponse1 = await aliTextJudge(content, 'comment_detection');
        if (aliJudgeResponse1.Data && aliJudgeResponse1.Data.labels && aliJudgeResponse1.Data.labels !== '') {
            let labelsList = aliJudgeResponse1.Data.labels.split(',');

            return {
                success: false,
                message: "评论内容不符合规范：" + labelsList.map((label: string) => staticWord[label]).join(', '),
            };
        }

        const aliJudgeResponse2 = await aliTextJudge(username, 'nickname_detection');
        if (aliJudgeResponse2.Data && aliJudgeResponse2.Data.labels && aliJudgeResponse2.Data.labels !== '') {
            let labelsList = aliJudgeResponse2.Data.labels.split(',');

            return {
                success: false,
                message: "用户名不符合规范：" + labelsList.map((label: string) => staticWord[label]).join(', '),
            };
        }

    }

    // 根据memoId查找memo的作者
    const memo = await prisma.memo.findUnique({
        where: {
            id: memoId,
        },
        select: {
            userId: true,
        },
    });
    // 创建评论
    await prisma.comment.create({
        data: {
            content,
            replyTo,
            memoId,
            username,
            email,
            website,
            author: event.context.userId !== undefined? (event.context.userId === memo?.userId? 1: 2): 0,
        },
    });
    let flag = true;
    if(replyToId !== undefined && replyToId !== 0){
        const comment = await prisma.comment.findUnique({
            where: {
                id: replyToId,
            }
        });
        if(comment !== null && comment.email !== null && comment.email !== ''){
            if(comment.email === process.env.NOTIFY_MAIL){
                flag = false;
            }
            // 邮箱通知被回复者
            const result = sendEmail({
                email: comment.email,
                subject: '新回复',
                message: `您在moments中的评论有新回复！
                用户名为:  ${username} 回复了您的评论(${comment.content})，他回复道: ${content}，点击查看: ${process.env.SITE_URL}/detail/${memoId}`,
            });
        }
    }

    // 非管理员
    if(event.context.userId == undefined && flag){
        // 判断process.env.SITE_URL是否以/结尾，如果是则去掉
        let siteUrl = process.env.SITE_URL;
        if(siteUrl === undefined || siteUrl === '' || siteUrl === 'undefined' || siteUrl === 'null'){
            siteUrl = '';
        }
        if(siteUrl.endsWith('/')){
            siteUrl = siteUrl.slice(0, -1);
        }

        // 邮箱通知管理员
        const result = sendEmail({
            email: process.env.NOTIFY_MAIL || '',
            subject: '新评论',
            message: `您的moments有新评论！
            用户名为:  ${username} 在您的moment中发表了评论: ${content}，点击查看: ${siteUrl}/detail/${memoId}`,
        });
    }

    // 返回成功响应
    return {
        success: true,
    };
});

// reCAPTCHA 验证函数
async function validateRecaptcha(reToken: string) {
    try {
        const response = await fetch('https://recaptcha.net/recaptcha/api/siteverify', {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${reToken}`
        });
        return await response.json();
    } catch (error) {
        console.error("Failed to verify reCAPTCHA:", error);
        return { success: false, "error-codes": ["verification_failed"] };
    }
}

// 阿里云文本审核
async function aliTextJudge(content: string, Service: string = "comment_detection") {
    // 注意，此处实例化的client请尽可能重复使用，避免重复建立连接，提升检测性能。
    let client = new RPCClient({
        /**
         * 阿里云账号AccessKey拥有所有API的访问权限，建议您使用RAM用户进行API访问或日常运维。
         * 强烈建议不要把AccessKey ID和AccessKey Secret保存到工程代码里，否则可能导致AccessKey泄露，威胁您账号下所有资源的安全。
         * 常见获取环境变量方式: 
         * 获取RAM用户AccessKey ID: process.env['ALIBABA_CLOUD_ACCESS_KEY_ID']
         * 获取RAM用户AccessKey Secret: process.env['ALIBABA_CLOUD_ACCESS_KEY_SECRET']
         */
        accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || 'default',
        accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || 'default',
        // 接入区域和地址请根据实际情况修改
        endpoint: "https://green-cip.cn-shanghai.aliyuncs.com",
        apiVersion: '2022-03-02',
        // 设置http代理
        // httpProxy: "http://xx.xx.xx.xx:xxxx",
        // 设置https代理
        // httpsProxy: "https://username:password@xxx.xxx.xxx.xxx:9999",
    });
    // 通过以下代码创建API请求并设置参数。
    const params = {
        // 文本检测service: 内容安全控制台文本增强版规则配置的serviceCode，示例: chat_detection
        "Service": Service,
        "ServiceParameters": JSON.stringify({
            //待检测文本内容。
            "content": content,
        }),
    };

    const requestOption = {
        method: 'POST',
        formatParams: false,
    };

    let response: any;
    try {
        response = await client.request('TextModeration', params, requestOption);
        if (response.Code === 500) {
            client.endpoint = "https://green-cip.cn-beijing.aliyuncs.com";
            response = await client.request('TextModeration', params, requestOption);
        }
    } catch (err) {
        console.log(err);
        // 确保在错误情况下也返回一个值，或者抛出一个错误
        return err;
    }
    return response;
}