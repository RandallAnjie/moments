<template>
  <HeaderImg />

  <div class="flex flex-col gap-4 p-2 sm:p-4">

    <div class="flex flex-col gap-2">
      <Label for="username" class="font-bold">登陆名</Label>
      <Input type="text" id="username" placeholder="登陆名" autocomplete="off" v-model="state.username" />
    </div>

    <div class="flex flex-col gap-2">
      <Label for="username" class="font-bold">邮箱</Label>
      <div class="flex flex-row gap-2">
        <Input type="text" id="eMail" placeholder="邮箱" autocomplete="off" v-model="state.eMail" disabled="disabled"/>
        <Button @click="changeEmailButtonFunction"
                :disabled="changeEmailButtonDisabled"
                type="button"
        >{{ changeEmailButtonTitle }}</Button>
      </div>
      <template v-if='changeEmail'>
        <div class="flex flex-col gap-2">
          <Label for="newEmail" class="font-bold">新邮箱</Label>
          <div class="flex flex-row gap-2">
            <Input type="text" id="newEmail" placeholder="新邮箱" autocomplete="off" v-model="state.newEMail" />
            <Button id="sendMail"
                    @click="sendMail"
                    :disabled="changeEmailButtonDisabled"
                    type="button"
            >发送验证码</Button>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <Label for="newEmail" class="font-bold">邮箱验证码</Label>
          <Input type="text" id="newEmail" placeholder="邮箱验证码" autocomplete="off" v-model="state.eMailVerificationCode" />
        </div>
      </template>

    </div>

    <div class="flex flex-col gap-2">
      <Label for="password" class="font-bold">密码</Label>
      <Input type="password" id="password" placeholder="留空则不修改密码" autocomplete="off" v-model="state.password" />
    </div>

    <div class="flex flex-col gap-2">
      <Label for="nickname" class="font-bold">昵称</Label>
      <Input type="text" id="nickname" placeholder="头像左边的作者名字" autocomplete="off" v-model="state.nickname" />
    </div>


    <div class="flex flex-col gap-2">
      <Label for="slogan" class="font-bold">心情状态</Label>
      <Input type="text" id="slogan" placeholder="头像下方文字,最好别超过15个汉字" autocomplete="off" v-model="state.slogan" />
    </div>

    <div class="flex flex-col gap-2">
      <Label for="avatarUrl" class="font-bold">头像</Label>
      <div class="flex gap-2">
        <Input type="file" id="avatarUrl" @change="(e: Event) => { uploadImgs(e, 'avatarUrl') }" style="width: 35%"/>
        <Label for="avatarUrl-input" class="font-medium" style="align-content: center;">或者输入在线地址:</Label>
        <Input type="text" id="avatarUrl-input" placeholder="或者填入在线地址" autocomplete="off" v-model="state.avatarUrl" style="width: 35%" />
      </div>
      <img :src="getImgUrl(state.avatarUrl)" alt="avatar" class="w-[70px] h-[70px] rounded-xl" v-if="state.avatarUrl" />
    </div>
    <div class="flex flex-col gap-2">
      <Label for="coverUrl" class="font-bold">顶部图片</Label>
      <div class="flex gap-2">
        <Input type="file" id="coverUrl" autocomplete="off" @change="(e: Event) => { uploadImgs(e, 'coverUrl') }" style="width: 35%"/>
        <Label for="coverUrl-input" class="font-medium" style="align-content: center;">或者输入在线地址:</Label>
        <Input type="text" id="coverUrl-input" placeholder="或者填入在线地址" autocomplete="off" v-model="state.coverUrl" style="width: 35%"/>
      </div>
      <img class="w-full h-[250px]" v-if="state.coverUrl" :src="getImgUrl(state.coverUrl)" alt="" />
    </div>

    <div class="flex flex-col gap-2">
      <Label for="css" class="font-bold">自定义个人页面CSS</Label>
      <Textarea id="css" v-model="state.css" rows="3"></Textarea>
    </div>

    <div class="flex flex-col gap-2">
      <Label for="js" class="font-bold">自定义个人页面JS</Label>
      <Textarea id="js" v-model="state.js" rows="3"></Textarea>
    </div>

    <ClientOnly>
      <div class="flex flex-col gap-2" v-if="twitterLoaded">
        <Label class="font-bold">同步到 X</Label>
        <template v-if="!twitter.siteEnabled">
          <div class="text-xs text-gray-500">站点未启用 X 同步，请联系管理员在后台开启。</div>
        </template>
        <template v-else-if="twitter.connected">
          <div class="flex flex-row items-center gap-2 flex-wrap">
            <span class="text-sm">已绑定<template v-if="twitter.screenName">：@{{ twitter.screenName }}</template></span>
            <Button variant="secondary" type="button" @click="disconnectTwitter">解绑</Button>
          </div>
          <div class="text-xs text-gray-500">发布动态时勾选「同步到 X」即可把动态发到你的 X。</div>
        </template>
        <template v-else>
          <div class="flex flex-row items-center gap-2">
            <Button type="button" @click="connectTwitter">连接 X 账号</Button>
          </div>
          <div class="text-xs text-gray-500">授权后，发布动态时可选择同步到你的 X。</div>
        </template>
      </div>
    </ClientOnly>

    <div class="flex flex-col gap-2 ">
      <Button @click="saveSettings">保存</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { settingsUpdateEvent } from '~/lib/event'
import { getImgUrl } from '~/lib/utils'
const token = useCookie('token')
const userId = useCookie('userId')
import { useStorage } from "@vueuse/core";
import type { User } from '~/lib/types';
import {toast} from "vue-sonner";

const response = await $fetch('/api/user/settings/get?user=0');

const changeEmail = ref(false)
const changeEmailButtonDisabled = ref(false)
const changeEmailButtonTitle = computed(() => changeEmail.value ? '取消变更' : '更改邮箱')

useHead({
  title: '设置-'+(response.data.title || 'Randall的小屋'),
})


const state = reactive({
  username: '',
  eMail: '',
  password: '',
  nickname: '',
  slogan: '',
  avatarUrl: '',
  coverUrl: '',
  css: '',
  js: '',
  newEMail: '',
  eMailVerificationCode: ''
})

const changeEmailButtonFunction = () => {
  changeEmail.value = !changeEmail.value
  if(!changeEmail.value){
    state.newEMail = ''
    state.eMailVerificationCode = ''
  }
}

const sendMail = async () => {
  if(!state.newEMail){
    toast.warning('请填写新邮箱')
    return
  }
  if(state.newEMail === state.eMail){
    toast.warning('新邮箱不能和旧邮箱一样')
    return
  }
  changeEmailButtonDisabled.value = true
  toast.promise( $fetch('/api/user/sendMail', {
        method: 'POST',
        body: JSON.stringify({
          email: state.newEMail,
          action: 'changeEmail'
        })
      }), {
        loading: '发送中...',
        success: (data) => {
          changeEmailButtonDisabled.value = false
          if (data.success) {
            return '发送成功';
          } else {
            return '发送失败: ' + data.message;
          }
        },
        error: (error) => `发送失败: ${error.message || '未知错误'}`, // 显示具体的错误信息
      }
  );
}

const { data: res } = await useFetch<{ data: typeof state }>('/api/user/settings/full',{key:'settings'})
const data = res.value?.data
state.coverUrl = data?.coverUrl || '/cover.webp'
state.avatarUrl = data?.avatarUrl || '/avatar.webp'
state.username = data?.username || ''
state.nickname = data?.nickname || ''
state.eMail = data?.eMail || ''
state.slogan = data?.slogan || ''
state.css = data?.css || ''
state.js = data?.js || ''


const uploadImgs = async (event: Event, id: string) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) {
    return
  }

  await useUpload(file, async (res) => {
    if (res.success) {
      (event.target as HTMLInputElement).value = ''
      if (id === 'coverUrl') {
        state.coverUrl = res.filename
      } else if (id === 'avatarUrl') {
        state.avatarUrl = res.filename
      } else {
        toast.warning('上传失败: 未知图片类型')
      }
    } else {
      toast.warning('上传失败: ' + res.message)
    }
  })
}

// --- X (Twitter) 绑定 ---------------------------------------------------
// 状态走客户端拉取（status 端点要带登录 cookie），用 ClientOnly 包住避免
// SSR 时拿不到 cookie 渲染出错误的「未绑定」态再闪一下。
const twitterLoaded = ref(false)
const twitter = reactive({ siteEnabled: false, connected: false, screenName: '' })

const loadTwitterStatus = async () => {
  try {
    const st = await $fetch('/api/user/twitter/status')
    if (st?.success) {
      twitter.siteEnabled = st.data.siteEnabled
      twitter.connected = st.data.connected
      twitter.screenName = st.data.screenName
    }
  } catch {
    // 忽略：保持默认「未启用」态
  } finally {
    twitterLoaded.value = true
  }
}

const connectTwitter = () => {
  // 整页跳转去发起 OAuth（connect 端点会 302 到 X 授权页）
  window.location.href = '/api/user/twitter/connect'
}

const disconnectTwitter = async () => {
  try {
    const { success } = await $fetch('/api/user/twitter/disconnect', { method: 'POST' })
    if (success) {
      twitter.connected = false
      twitter.screenName = ''
      toast.success('已解绑 X')
    }
  } catch (e: any) {
    toast.warning('解绑失败: ' + (e?.message || '未知错误'))
  }
}

onMounted(() => {
  loadTwitterStatus()
  // 处理 OAuth 回调跳回来的 ?twitter=... 状态提示，然后把 query 清掉
  const params = new URLSearchParams(window.location.search)
  const status = params.get('twitter')
  if (status) {
    const map: Record<string, [boolean, string]> = {
      connected: [true, '已成功连接 X 账号'],
      denied: [false, '已取消 X 授权'],
      expired: [false, 'X 授权超时，请重试'],
      error: [false, 'X 连接失败，请重试'],
    }
    const m = map[status]
    if (m) (m[0] ? toast.success : toast.warning)(m[1])
    window.history.replaceState({}, '', '/settings')
  }
})

const saveSettings = async () => {
  toast.promise($fetch('/api/user/settings/save', {
        method: 'POST',
        body: JSON.stringify(state)
      }), {
        loading: '保存中...',
        success: (data) => {
          if(data.success){
            state.password = ''
            // 让 SPA 级 site-settings 缓存失效，下一次读取会重拉新值（customWeather /
            // customLocation / timeFrontend 等都是从这里读的）。
            // 配合 location.reload() 是冗余的，但 reload 一旦未来被移除就靠它兜底。
            useSiteSettings().invalidate()
            settingsUpdateEvent.emit()
            if (state.password) {
              token.value = ''
              userId.value = '0'
              navigateTo('/login')
              return ('密码修改成功,请重新登录')
            }else{
              location.reload()
              return '保存成功'
            }
          } else {
            throw new Error(data.message)
          }
        },
        error: (error) => `保存失败: ${error || '未知错误'}`,
      }
  );
}
</script>

<style scoped></style>