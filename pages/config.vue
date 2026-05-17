<template>
  <HeaderImg />
  <div class="flex flex-col gap-4 p-2 sm:p-4">

    <div class="flex flex-col gap-2 qus-box">
      <Label for="title" class="font-bold">网站标题</Label>
      <Input type="text" id="title" placeholder="网站标题，如：Randall小屋" autocomplete="off" v-model="state.title" />
    </div>

    <div class="flex flex-col gap-2 qus-box">
      <Label for="siteUrl" class="font-bold">网站URL</Label>
      <Input type="text" id="siteUrl" placeholder="网站URL，如：https://moments.randallanjie.com" autocomplete="off" v-model="state.siteUrl" />
    </div>

    <div class="flex flex-col gap-2 qus-box">
      <Label for="favicon" class="font-bold">Favicon</Label>
      <div class="flex gap-2">
        <Input type="file" id="favicon" autocomplete="off" @change="(e: Event) => { uploadImgs(e, 'favicon') }" style="width: 35%" />
        <Label for="favicon-input" class="font-medium" style="align-content: center;">或者输入在线地址:</Label>
        <Input type="text" id="favicon-input" placeholder="或者填入在线地址" autocomplete="off" v-model="state.favicon" style="width: 35%" />
      </div>
      <img class="max-w-[50px] max-h-[50px]" v-if="state.favicon" :src="state.favicon" alt="" />
    </div>

    <div class="flex flex-col gap-2 qus-box">
      <Label for="notification" class="font-bold">通知</Label>
      <Input type="text" id="notification" placeholder="网站通知，如：欢迎访问" autocomplete="off" v-model="state.notification" />
    </div>

    <div class="flex flex-col gap-2 qus-box">
      <Label for="css" class="font-bold">全局自定义CSS</Label>
      <Textarea id="css" v-model="state.css" rows="3"></Textarea>
    </div>

    <div class="flex flex-col gap-2 qus-box">
      <Label for="js" class="font-bold">全局自定义JS</Label>
      <Textarea id="js" v-model="state.js" rows="3"></Textarea>
    </div>

    <div class="flex flex-col gap-2 qus-box">
      <Label for="beianNo" class="font-bold">备案号</Label>
      <Input type="text" id="beianNo" placeholder="备案号,没有可不填写" autocomplete="off" v-model="state.beianNo" />
    </div>

    <div class="flex flex-col gap-2 qus-box">
      <Label for="enableRegister" class="font-bold">启用注册</Label>
      <Switch id="enableRegister" v-model:checked="state.enableRegister" />
    </div>

    <div class="flex flex-col gap-2 qus-box">
      <Label for="customWeather" class="font-bold">启用首页天气展示</Label>
      <Switch id="customWeather" v-model:checked="state.customWeather" />
    </div>

    <div class="flex flex-col gap-2 qus-box">
      <Label for="customLocation" class="font-bold">启用自定义位置</Label>
      <Switch id="customLocation" v-model:checked="state.customLocation" />
    </div>

    <div class="flex flex-col gap-2 qus-box">
      <Label for="timeFrontend" class="font-bold">时间显示格式</Label>
      <Input type="text" id="timeFrontend" placeholder="时间显示格式：如 YYYY-MM-DD HH:mm:ss ，若留空为XXX天前" autocomplete="off" v-model="state.timeFrontend" />
    </div>

    <div class="flex flex-col gap-2 qus-box">
      <div class="flex">
        <Label for="metingApi" class="font-bold">音乐API</Label>
        <div class="tooltip">
                  <span class="tooltip-text">
                    音乐API地址，留空默认使用原版，如果原版不能用可以使用我的服务：https://musicapi.randallanjie.com/
                  </span>
          <div class="circle">
            <span class="exclamation">!</span>
          </div>
        </div>
      </div>
      <Input type="text" id="metingApi" placeholder="填写音乐api，例如：https://musicapi.randallanjie.com/" autocomplete="off" v-model="state.metingApi" />
    </div>

    <div class="flex flex-col gap-2 qus-box">
      <div class="flex">
        <Label for="aboutHtml" class="font-bold">关于页自定义</Label>
      </div>
      <Textarea id="aboutHtml" v-model="state.aboutHtml" rows="3"></Textarea>
    </div>

<!--    <div class="flex flex-col gap-2 qus-box">-->
<!--      <Label for="enableS3" class="font-bold">启用S3存储</Label>-->
<!--      <Switch id="enableS3" v-model:checked="state.enableS3" />-->
<!--    </div>-->

<!--    <template v-if="state.enableS3">-->
<!--      <div class="config-container">-->
<!--        <div class="flex flex-col gap-2 qus-box">-->
<!--          <Label for="domain" class="font-bold">域名</Label>-->
<!--          <Input type="text" id="domain" placeholder="S3 CDN域名" autocomplete="off" v-model="state.domain" />-->
<!--        </div>-->

<!--        <div class="flex flex-col gap-2 qus-box">-->
<!--          <Label for="bucket" class="font-bold">桶名</Label>-->
<!--          <Input type="text" id="bucket" placeholder="bucket" autocomplete="off" v-model="state.bucket" />-->
<!--        </div>-->

<!--        <div class="flex flex-col gap-2 qus-box">-->
<!--          <Label for="region" class="font-bold">地区</Label>-->
<!--          <Input type="text" id="region" placeholder="" autocomplete="off" v-model="state.region" />-->
<!--        </div>-->

<!--        <div class="flex flex-col gap-2 qus-box">-->
<!--          <Label for="accessKey" class="font-bold">accessKey</Label>-->
<!--          <Input type="text" id="accessKey" placeholder="" autocomplete="off" v-model="state.accessKey" />-->
<!--        </div>-->

<!--        <div class="flex flex-col gap-2 qus-box">-->
<!--          <Label for="secretKey" class="font-bold">secretKey</Label>-->
<!--          <Input type="text" id="secretKey" placeholder="" autocomplete="off" v-model="state.secretKey" />-->
<!--        </div>-->

<!--        <div class="flex flex-col gap-2 qus-box">-->
<!--          <Label for="endpoint" class="font-bold">S3接口地址</Label>-->
<!--          <Input type="text" id="endpoint" placeholder="" autocomplete="off" v-model="state.endpoint" />-->
<!--        </div>-->

<!--        <div class="flex flex-col gap-2 qus-box">-->
<!--          <Label for="thumbnailSuffix" class="font-bold">后缀</Label>-->
<!--          <Input type="text" id="thumbnailSuffix" placeholder="" autocomplete="off" v-model="state.thumbnailSuffix" />-->
<!--        </div>-->
<!--      </div>-->

<!--    </template>-->

    <div class="flex flex-col gap-2 qus-box">
      <Label for="enableEmail" class="font-bold">启用邮箱</Label>
      <Switch id="enableEmail" v-model:checked="state.enableEmail" />
    </div>

    <template v-if="state.enableEmail">
      <div class="config-container">
        <div class="flex flex-col gap-2 qus-box">
          <Label for="mailHost" class="font-bold">邮局服务器地址</Label>
          <Input type="text" id="mailHost" placeholder="邮局服务器地址" autocomplete="off" v-model="state.mailHost" />
        </div>

        <div class="flex flex-col gap-2 qus-box">
          <Label for="email" class="font-bold">邮局服务器端口</Label>
          <Input type="number" id="mailPort" placeholder="邮局服务器端口" autocomplete="off" v-model="state.mailPort" />
        </div>

        <div class="flex flex-col gap-2 qus-box">
          <Label for="mailSecure" class="font-bold">邮局安全连接</Label>
          <Switch id="mailSecure" v-model:checked="state.mailSecure" />
        </div>

        <div class="flex flex-col gap-2 qus-box">
          <Label for="mailUser" class="font-bold">邮局用户名</Label>
          <Input type="text" id="mailUser" placeholder="邮局用户名，一般同邮局发件人" autocomplete="off" v-model="state.mailUser" />
        </div>

        <div class="flex flex-col gap-2 qus-box">
          <Label for="mailPass" class="font-bold">邮局密码</Label>
          <Input type="text" id="mailPass" placeholder="邮局密码" autocomplete="off" v-model="state.mailPass" />
        </div>

        <div class="flex flex-col gap-2 qus-box">
          <Label for="mailFrom" class="font-bold">邮局发件人</Label>
          <Input type="text" id="mailFrom" placeholder="邮局发件人，一般同邮局用户名" autocomplete="off" v-model="state.mailFrom" />
        </div>

        <div class="flex flex-col gap-2 qus-box">
          <Label for="mailName" class="font-bold">邮局发件人名</Label>
          <Input type="text" id="mailName" placeholder="邮局发件人名" autocomplete="off" v-model="state.mailName" />
        </div>

        <div class="flex flex-col gap-2 qus-box">
          <Label for="mailVerificationCodeType" class="font-bold">验证码类型</Label>
<!--          下拉选择-->
          <Select id="mailVerificationCodeType" v-model="state.mailVerificationCodeType">
            <option value="1">数字和字母大小写</option>
            <option value="2">数字和字母小写</option>
            <option value="3">纯字母大小写</option>
            <option value="4">纯字母小写</option>
            <option value="5">纯数字（不推荐）</option>
          </Select>
        </div>

        <div class="flex flex-col gap-2 qus-box">
          <div class="flex">
            <Label for="emailRegistrationContent" class="font-bold">注册邮件模板</Label>
            <div class="tooltip">
                  <span class="tooltip-text">
                    邮件模板变量：<br />{Code} 验证码 <br />{Email} 邮箱 <br />{Site} 网站名称 <br />{Url} 网站地址
                  </span>
              <div class="circle">
                <span class="exclamation">!</span>
              </div>
            </div>
          </div>
          <Textarea id="emailRegistrationContent" v-model="state.emailRegistrationContent" rows="3"></Textarea>
        </div>

        <div class="flex flex-col gap-2 qus-box">
          <div class="flex">
            <Label for="emailChangeContent" class="font-bold">更换邮箱邮件模板</Label>
            <div class="tooltip">
                  <span class="tooltip-text">
                    邮件模板变量：<br />{Code} 验证码 <br />{Email} 邮箱 <br />{Site} 网站名称 <br />{Url} 网站地址
                  </span>
              <div class="circle">
                <span class="exclamation">!</span>
              </div>
            </div>
          </div>
          <Textarea id="emailChangeContent" v-model="state.emailChangeContent" rows="3"></Textarea>
        </div>

        <div class="flex flex-col gap-2 qus-box">
          <div class="flex">
            <Label for="emailResetContent" class="font-bold">找回密码邮件模板</Label>
            <div class="tooltip">
                  <span class="tooltip-text">
                    邮件模板变量：<br />{Code} 找回密码验证URL <br />{Email} 邮箱 <br />{Site} 网站名称 <br />{Url} 网站地址
                  </span>
              <div class="circle">
                <span class="exclamation">!</span>
              </div>
            </div>
          </div>
          <Textarea id="emailResetContent" v-model="state.emailResetContent" rows="3"></Textarea>
        </div>

        <div class="flex flex-col gap-2 qus-box">
          <div class="flex">
            <Label for="emailMentionNotification" class="font-bold">新Memo提及模板</Label>
            <div class="tooltip">
                  <span class="tooltip-text">
                    邮件模板变量：<br />{Content} Memo内容 <br />{Nickname} Memo所属用户昵称 <br />{Sitename} 网站名称 <br />{SiteUrl} 网站Url <br />{MemoUrl} MemoUrl
                  </span>
              <div class="circle">
                <span class="exclamation">!</span>
              </div>
            </div>
          </div>
          <Textarea id="emailMentionNotification" v-model="state.emailMentionNotification" rows="3"></Textarea>
        </div>

        <div class="flex flex-col gap-2 qus-box">
          <div class="flex">
            <Label for="emailNewCommentNotification" class="font-bold">新评论模板</Label>
            <div class="tooltip">
                  <span class="tooltip-text">
                    邮件模板变量：<br />{Memo} 原文内容 <br />{Content} 评论内容 <br />{Nickname} 评论用户昵称 <br />{Sitename} 网站名称 <br />{SiteUrl} 网站Url <br />{MemoUrl} MemoUrl
                  </span>
              <div class="circle">
                <span class="exclamation">!</span>
              </div>
            </div>
          </div>
          <Textarea id="emailNewCommentNotification" v-model="state.emailNewCommentNotification" rows="3"></Textarea>
        </div>

        <div class="flex flex-col gap-2 qus-box">
          <div class="flex">
            <Label for="emailNewReplyCommentNotification" class="font-bold">新回复模板</Label>
            <div class="tooltip">
                  <span class="tooltip-text">
                    邮件模板变量：<br />{Memo} 原文内容 <br />{OriginalContent} 原评论内容 <br />{Content} 回复内容 <br />{Nickname} 评论用户昵称 <br />{Sitename} 网站名称 <br />{SiteUrl} 网站Url <br />{MemoUrl} MemoUrl
                  </span>
              <div class="circle">
                <span class="exclamation">!</span>
              </div>
            </div>
          </div>
          <Textarea id="emailNewReplyCommentNotification" v-model="state.emailNewReplyCommentNotification" rows="3"></Textarea>
        </div>

        <div class="flex flex-col gap-2 qus-box">
          <div class="flex">
            <Label for="emailNewMentionCommentNotification" class="font-bold">新提及评论模板</Label>
            <div class="tooltip">
                  <span class="tooltip-text">
                    邮件模板变量：<br />{Memo} 原文内容 <br />{Content} 回复内容 <br />{Nickname} 评论用户昵称 <br />{Sitename} 网站名称 <br />{SiteUrl} 网站Url <br />{MemoUrl} MemoUrl
                  </span>
              <div class="circle">
                <span class="exclamation">!</span>
              </div>
            </div>
          </div>
          <Textarea id="emailNewMentionCommentNotification" v-model="state.emailNewMentionCommentNotification" rows="3"></Textarea>
        </div>
      </div>
    </template>

    <div class="flex flex-col gap-2 qus-box">
      <Label for="enableRecaptcha" class="font-bold">启用 reCaptcha 验证</Label>
      <Switch id="enableRecaptcha" v-model:checked="state.enableRecaptcha" />
    </div>

    <template v-if="state.enableRecaptcha">
      <div class="config-container">
        <div class="flex flex-col gap-2 qus-box">
          <Label for="recaptchaSiteKey" class="font-bold">reCaptcha Site Key</Label>
          <Input type="text" id="recaptchaSiteKey" placeholder="reCaptcha Site Key" autocomplete="off" v-model="state.recaptchaSiteKey" />
        </div>

        <div class="flex flex-col gap-2 qus-box">
          <Label for="recaptchaSecretKey" class="font-bold">reCaptcha Secret Key</Label>
          <Input type="text" id="recaptchaSecretKey" placeholder="reCaptcha Secret Key" autocomplete="off" v-model="state.recaptchaSecretKey" />
        </div>
      </div>
    </template>

    <div class="flex flex-col gap-2 qus-box">
      <Label for="enableTencentMap" class="font-bold">启用腾讯地图</Label>
      <Switch id="enableTencentMap" v-model:checked="state.enableTencentMap" />
    </div>

    <template v-if="state.enableTencentMap">
      <div class="config-container">
        <div class="flex flex-col gap-2 qus-box">
          <Label for="tencentMapKey" class="font-bold">腾讯地图Key</Label>
          <Input type="text" id="tencentMapKey" placeholder="腾讯地图Key" autocomplete="off" v-model="state.tencentMapKey" />
        </div>
      </div>
    </template>

    <div class="flex flex-col gap-2 qus-box">
      <Label for="enableAliyunDective" class="font-bold">启用阿里云文本检测</Label>
      <Switch id="enableAliyunDective" v-model:checked="state.enableAliyunDective" />
    </div>

    <template v-if="state.enableAliyunDective">
      <div class="config-container">
        <div class="flex flex-col gap-2 qus-box">
          <Label for="aliyunAccessKeyId" class="font-bold">阿里云AccessKeyId</Label>
          <Input type="text" id="aliyunAccessKeyId" placeholder="阿里云AccessKeyId" autocomplete="off" v-model="state.aliyunAccessKeyId" />
        </div>

        <div class="flex flex-col gap-2 qus-box">
          <Label for="aliyunAccessKeySecret" class="font-bold">阿里云AccessKeySecret</Label>
          <Input type="text" id="aliyunAccessKeySecret" placeholder="阿里云AccessKeySecret" autocomplete="off" v-model="state.aliyunAccessKeySecret" />
        </div>
      </div>
    </template>

    <div class="flex flex-col gap-2 qus-box ">
      <Button @click="saveConfig">保存</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { settingsUpdateEvent } from '~/lib/event'
const token = useCookie('token')
import { useStorage } from "@vueuse/core";
import type { User } from '~/lib/types';
import {toast} from "vue-sonner";
import { Select } from '~/components/ui/select'

const response = await $fetch('/api/user/settings/get?user=0');

if(!response.success || !response.data.isadmin){
  navigateTo('/')
}

useHead({
  title: '设置-'+(response.data.title || 'Randall的小屋'),
})

const enableS3 = useStorage("enableS3", false);


const state = reactive({
  enableS3: false,
  domain: '',
  bucket: '',
  region: '',
  accessKey: '',
  secretKey: '',
  endpoint: '',
  thumbnailSuffix: '',
  title: '',
  favicon: "",
  css:"",
  js:"",
  beianNo:"",

  enableEmail: false,
  mailHost: '',
  mailPort: 587,
  mailSecure: false,
  mailUser: '',
  mailPass: '',
  mailFrom: '',
  mailName: '',

  siteUrl: '',

  enableRecaptcha: false,
  recaptchaSiteKey: '',
  recaptchaSecretKey: '',

  enableTencentMap: false,
  tencentMapKey: '',

  enableAliyunDective: false,
  aliyunAccessKeyId: '',
  aliyunAccessKeySecret: '',

  notification: '',

  mailVerificationCodeType: 1,
  enableRegister: false,
  timeFrontend: '',
  customLocation: false,
  emailRegistrationContent: '',
  emailChangeContent: '',
  emailResetContent: '',
  emailMentionNotification: '',
  emailNewCommentNotification: '',
  emailNewReplyCommentNotification: '',
  emailNewMentionCommentNotification: '',
  metingApi: '',
  customWeather: false,
  aboutHtml: ''
})

const { data: res } = await useFetch<{ data: typeof state }>('/api/site/config/get',{key:'settings'})
const data = res.value?.data
state.title = data?.title || 'Randall的小屋'
state.favicon = data?.favicon || '/favicon.png'
state.enableS3 = data?.enableS3 || false
state.domain = data?.s3Domain || ''
state.bucket = data?.s3Bucket || ''
state.region = data?.s3Region || ''
state.accessKey = data?.s3AccessKey || ''
state.secretKey = data?.s3SecretKey || ''
state.endpoint = data?.s3Endpoint || ''
state.thumbnailSuffix = data?.s3ThumbnailSuffix || ''
state.css = data?.css || ''
state.js = data?.js || ''
state.beianNo = data?.beianNo || ''
state.enableEmail = data?.enableEmail || false
state.mailHost = data?.mailHost || ''
state.mailPort = data?.mailPort || 587
state.mailSecure = data?.mailSecure || false
state.mailUser = data?.mailUser || ''
state.mailPass = data?.mailPass || ''
state.mailFrom = data?.mailFrom || ''
state.mailName = data?.mailName || ''
state.siteUrl = data?.siteUrl || ''
state.enableRecaptcha = data?.enableRecaptcha || false
state.recaptchaSiteKey = data?.recaptchaSiteKey || ''
state.recaptchaSecretKey = data?.recaptchaSecretKey || ''
state.enableTencentMap = data?.enableTencentMap || false
state.tencentMapKey = data?.tencentMapKey || ''
state.enableAliyunDective = data?.enableAliyunDective || false
state.aliyunAccessKeyId = data?.aliyunAccessKeyId || ''
state.aliyunAccessKeySecret = data?.aliyunAccessKeySecret || ''
enableS3.value = state.enableS3
state.notification = data?.notification.message || ''
state.mailVerificationCodeType = data?.mailVerificationCodeType || 1
state.enableRegister = data.enableRegister ? data.enableRegister == "1" : false
state.timeFrontend = data?.timeFrontend || ''
state.customLocation = data.customLocation ? data.customLocation == "1" : false
state.emailRegistrationContent = data?.emailRegistrationContent || ''
state.emailChangeContent = data?.emailChangeContent || ''
state.emailResetContent = data?.emailResetContent || ''
state.emailMentionNotification = data?.emailMentionNotification || ''
state.emailNewCommentNotification = data?.emailNewCommentNotification || ''
state.emailNewReplyCommentNotification = data?.emailNewReplyCommentNotification || ''
state.emailNewMentionCommentNotification = data?.emailNewMentionCommentNotification || ''
state.metingApi = data?.metingApi || ''
state.customWeather = data.customWeather ? data.customWeather == "1" : false
state.aboutHtml = data?.aboutHtml || ''


const uploadImgs = async (event: Event, id: string) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) {
    return
  }

  await useUpload(file, async (res) => {
    if (res.success) {
      (event.target as HTMLInputElement).value = ''
      if (id === 'favicon') {
        state.favicon = res.filename
      }
    } else {
      toast.warning('上传失败' + res.message)
    }
  })
}

const saveConfig = async () => {
  const { success } = await $fetch('/api/site/config/save', {
    method: 'POST',
    body: JSON.stringify(state)
  })
  if (success) {
    enableS3.value = state.enableS3
    toast.success('保存成功')
    // SPA 级 site-settings 缓存失效，下次读取重新拉。reload 在此之后仍然冗余兜底。
    useSiteSettings().invalidate()
    location.reload()
    settingsUpdateEvent.emit()
  }
}
</script>

<style scoped>
.config-container{
  padding:5px;
  border-radius:5px;
  border: 1px solid grey;
}
.qus-box{
  margin-bottom: 10px;
}

.circle {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 15px;
  height: 15px;
  background-color: white;
  border: 1px solid black;
  border-radius: 50%;
  position: relative;
}

.exclamation {
  color: black;
  font-size: 10pt;
  font-weight: bold;
}

.tooltip {
  position: relative;
  display: inline-block;
}

.tooltip-text {
  visibility: hidden;
  width: 150px;
  background-color: #555;
  color: #fff;
  text-align: left;
  padding: 5px;
  border-radius: 6px;
  font-size: 10pt;

  position: absolute;
  z-index: 1;
  bottom: 125%;
  left: 50%;
  margin-left: -75px;
  opacity: 0;
  transition: opacity 1s;
}

.tooltip:hover .tooltip-text {
  visibility: visible;
  opacity: 1;
}
</style>