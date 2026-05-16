<template>
<!--  <button id="nothing_button"></button>-->
  <div class="wrapper w-full h-full bg-[#f1f5f9] dark:bg-slate-800 rounded-md dark:text-[#C0BEBF]">
    <ScrollArea class="h-full" type="hover">
      <div class="main lg:w-[567px] mx-auto shadow-2xl bg-white dark:bg-[#181818]">
        <slot />
        <Footer />
        <div class="tigger">
          <DropdownMenuRoot v-model:open="toggleState">
            <DropdownMenuTrigger
                class="rounded-full w-[35px] h-[35px] inline-flex items-center justify-center text-grass11 bg-white shadow-[0_2px_10px] shadow-blackA7 outline-none hover:bg-green3 focus:shadow-[0_0_0_2px] focus:shadow-black"
                aria-label="Customise options"
            >
              <svg t="1714293805645" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4275" width="40" height="40"><path d="M511.998977 113.725134c219.514529 0 398.103974 178.588421 398.103974 398.103974S731.513506 909.933081 511.998977 909.933081 113.895003 731.34466 113.895003 511.829108 292.485471 113.725134 511.998977 113.725134M511.998977 63.961754c-246.947322 0-447.867354 200.919009-447.867354 447.867354s200.920032 447.867354 447.867354 447.867354c246.944252 0 447.867354-200.919009 447.867354-447.867354S758.943228 63.961754 511.998977 63.961754L511.998977 63.961754z" fill="#272636" p-id="4276"></path><path d="M327.384305 511.829108m-45.216831 0a44.187 44.187 0 1 0 90.433662 0 44.187 44.187 0 1 0-90.433662 0Z" fill="#272636" p-id="4277"></path><path d="M511.997953 511.829108m-45.216831 0a44.187 44.187 0 1 0 90.433662 0 44.187 44.187 0 1 0-90.433662 0Z" fill="#272636" p-id="4278"></path><path d="M696.612625 511.829108m-45.216831 0a44.187 44.187 0 1 0 90.433662 0 44.187 44.187 0 1 0-90.433662 0Z" fill="#272636" p-id="4279"></path></svg>
            </DropdownMenuTrigger>

            <DropdownMenuPortal>
              <DropdownMenuContent
                  class="min-w-[150px] outline-none bg-white rounded-md p-[5px] shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)] will-change-[opacity,transform] data-[side=top]:animate-slideDownAndFade data-[side=right]:animate-slideLeftAndFade data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade z-10"
                  :side-offset="5"
              >
                <DropdownMenuSeparator class="h-[1px] bg-green6 m-[5px]" />

                <DropdownMenuItem
                    class="group text-[13px] leading-none text-grass11 rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none data-[disabled]:text-mauve8 data-[disabled]:pointer-events-none data-[highlighted]:bg-green9 data-[highlighted]:text-green1"
                    @click="navigateTo('/')"
                >
                  首页
                </DropdownMenuItem>

                <DropdownMenuSeparator class="h-[1px] bg-green6 m-[5px]" />

                <DropdownMenuItem
                    v-if="!userId"
                    class="group text-[13px] leading-none text-grass11 rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none data-[disabled]:text-mauve8 data-[disabled]:pointer-events-none data-[highlighted]:bg-green9 data-[highlighted]:text-green1"
                    @click="useCookie('token').value = '';useCookie('userId').value = '0';navigateTo('/login');"
                >
                  登陆
                </DropdownMenuItem>

                <DropdownMenuSeparator v-if="!userId" class="h-[1px] bg-green6 m-[5px]" />

                <DropdownMenuItem
                    v-if="!userId && canRegister"
                    class="group text-[13px] leading-none text-grass11 rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none data-[disabled]:text-mauve8 data-[disabled]:pointer-events-none data-[highlighted]:bg-green9 data-[highlighted]:text-green1"
                    @click="navigateTo('/register')"
                >
                  注册
                </DropdownMenuItem>

                <DropdownMenuSeparator v-if="!userId && canRegister" class="h-[1px] bg-green6 m-[5px]" />


                <DropdownMenuItem
                    v-if="userId=='1'"
                    class="group text-[13px] leading-none text-grass11 rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none data-[disabled]:text-mauve8 data-[disabled]:pointer-events-none data-[highlighted]:bg-green9 data-[highlighted]:text-green1"
                    @click="navigateTo('/config')"
                >
                  系统设置
                </DropdownMenuItem>

                <DropdownMenuSeparator v-if="userId=='1'" class="h-[1px] bg-green6 m-[5px]" />


                <DropdownMenuItem
                    v-if="userId"
                    class="group text-[13px] leading-none text-grass11 rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none data-[disabled]:text-mauve8 data-[disabled]:pointer-events-none data-[highlighted]:bg-green9 data-[highlighted]:text-green1"
                    @click="navigateTo('/settings')"
                >
                  个人设置
                </DropdownMenuItem>

                <DropdownMenuSeparator v-if="userId" class="h-[1px] bg-green6 m-[5px]" />

                <DropdownMenuItem
                    v-if="userId"
                    class="group text-[13px] leading-none text-grass11 rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none data-[disabled]:text-mauve8 data-[disabled]:pointer-events-none data-[highlighted]:bg-green9 data-[highlighted]:text-green1"
                    @click="logout"
                >
                  登出
                </DropdownMenuItem>

                <DropdownMenuSeparator v-if="userId" class="h-[1px] bg-green6 m-[5px]" />

                <DropdownMenuItem
                    v-if="colorMode.value === 'dark'"
                    class="group text-[13px] leading-none text-grass11 rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none data-[disabled]:text-mauve8 data-[disabled]:pointer-events-none data-[highlighted]:bg-green9 data-[highlighted]:text-green1"
                    @click="colorMode.value = 'light'"
                >
                  切换白天模式
                </DropdownMenuItem>

                <DropdownMenuSeparator v-if="colorMode.value === 'dark'" class="h-[1px] bg-green6 m-[5px]" />

                <DropdownMenuItem
                    v-if="colorMode.value === 'light'"
                    class="group text-[13px] leading-none text-grass11 rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none data-[disabled]:text-mauve8 data-[disabled]:pointer-events-none data-[highlighted]:bg-green9 data-[highlighted]:text-green1"
                    @click="colorMode.value = 'dark'"
                >
                  切换黑夜模式
                </DropdownMenuItem>

                <DropdownMenuSeparator v-if="colorMode.value === 'light'" class="h-[1px] bg-green6 m-[5px]" />

                <DropdownMenuItem
                    class="group text-[13px] leading-none text-grass11 rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none data-[disabled]:text-mauve8 data-[disabled]:pointer-events-none data-[highlighted]:bg-green9 data-[highlighted]:text-green1"
                    @click="navigateTo('/about')"
                >
                  关于
                </DropdownMenuItem>

                <DropdownMenuSeparator class="h-[1px] bg-green6 m-[5px]" />

<!--                <DropdownMenuItem-->
<!--                    class="group text-[13px] leading-none text-grass11 rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none data-[disabled]:text-mauve8 data-[disabled]:pointer-events-none data-[highlighted]:bg-green9 data-[highlighted]:text-green1"-->
<!--                    @click="translate.setUseVersion2();translate.execute();"-->
<!--                >-->
<!--                  中英文切换-->
<!--                </DropdownMenuItem>-->

<!--                <DropdownMenuSeparator class="h-[1px] bg-green6 m-[5px]" />-->

                <DropdownMenuArrow class="fill-white" />
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenuRoot>
        </div>
      </div>
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  </div>
  <Toaster position="top-right" :expand="true" rich-colors />
</template>
<script setup lang="ts">
import { Toaster } from '@/components/ui/sonner';
import type { User } from '~/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { useState, useAsyncData } from '#imports';
import { ref } from 'vue'
import {
  DropdownMenuArrow,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from 'radix-vue'

const toggleState = ref(false)
const checkboxOne = ref(false)
const checkboxTwo = ref(false)
const person = ref('pedro')
const userId = useCookie('userId')
const colorMode = useColorMode()

const canRegister = ref(false)

onMounted(async () => {
  // document.documentElement.style.overflow = 'hidden';
  // document.body.style.overflow = 'hidden';
  const userinfo = useState<User>('userinfo')
  const url = window.location.pathname
  let findId = userId.value
  if(url.startsWith('/user/')) {
    findId = url.split('/user/')[1]
  }
  const response = await $fetch('/api/user/settings/get?user=' + (findId == 'undefined' ? '0' : findId));
  const { data: res } = await useAsyncData('userinfo', async () => response);
  // 将response存储systemConfig中
  await useAsyncData('systemConfig', async () => response)
  if(res.value?.data.enableRegister){
    canRegister.value = true
  }
  userinfo.value = res.value?.data as any as User;
  useHead({
    link: [
      {
        rel: 'shortcut icon',
        type: 'image/png',
        href: userinfo.value?.favicon || '/favicon.png',
      },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
    ],
    meta: [
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { name: 'apple-mobile-web-app-title', content: userinfo.value?.title || 'Moments' },
      { name: 'mobile-web-app-capable', content: 'yes' },
    ],
    style: [
      {
        textContent: userinfo.value?.css || '',
      }
    ],
    script: [
      {
        type: 'text/javascript',
        textContent: userinfo.value?.js || '',
      }
    ],
    title: userinfo.value.title || 'Randall的小屋',
  })
  const siteConfig = await $fetch('/api/site/config/get')
  if(siteConfig && siteConfig.success && siteConfig.data && siteConfig.data.enableRecaptcha){
    if (!document.getElementById('recaptcha-script')) {
      const script = document.createElement('script');
      script.id = 'recaptcha-script';
      script.type = 'text/javascript';
      script.src = `https://recaptcha.net/recaptcha/api.js?render=${siteConfig.data.recaptchaSiteKey}`;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }
  window.addEventListener('menurefresh', () => {
    userId.value = useCookie('userId').value
  })
  const script = document.createElement('script');
  script.src = 'https://cdn.staticfile.net/translate.js/3.2.3/translate.js';
  script.async = true;
  document.body.appendChild(script);
})

const logout = () => {
  useCookie('token').value = ''
  userId.value = '0'
  $fetch('/api/user/logout',
  {
    method: 'POST',
  })
  window.location.reload()
  navigateTo('/', { replace: true })
}



</script>
<style>
body, html {
  overflow: hidden;
  -ms-overflow-style: none; /* IE 和 Edge */
  scrollbar-width: none; /* Firefox */
}

body::-webkit-scrollbar, html::-webkit-scrollbar {
  display: none; /* Chrome, Safari 和 Opera */
}

.grecaptcha-badge {
  visibility: hidden;
}

div.tigger {
  max-width: 100%;
  position: absolute;
  right: 10px;
  bottom: 10px;
}

@media (min-width: 1024px) {
  div.tigger {
    width: calc((100vw - 480px)/2);
  }
}

@media (max-width: 567px) {
  div.tigger {
    width: 40px;
    right: 0;
    bottom: 0;
  }
}

</style>