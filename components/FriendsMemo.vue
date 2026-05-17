<template>

  <div class="memo flex flex-row gap-2 sm:gap-4 text-sm border-x-0 pt-2 p-2 sm:p-4" :class="{'bg-slate-100 dark:bg-neutral-900':props.memo.pinned && props.memo.userId == 1}" style="max-width: 100vw">
    <img :src="props.memo.user.avatarUrl" class="avatar w-9 h-9 rounded" @click="gotouser" />
    <div class="flex flex-col gap-.5 flex-1 min-w-0">
      <div class="flex flex-row justify-between items-center">
        <div class="username text-[#576b95] cursor-default mb-1 dark:text-white" @click="gotouser">{{ props.memo.user.nickname }}</div>
        <Pin :size=14 v-if="props.memo.pinned && props.memo.userId == 1" />
      </div>
      <div
        :id="'content-' + props.memo.id"
        class="memo-content text-sm friend-md words-container"
        :class="{ 'memo-clamp': !showAll }"
        ref="el"
        v-html="replaceNewLinesExceptInCodeBlocks(props.memo.content)"
      ></div>
      <div class="text-[#576b95] cursor-pointer" v-if="isOverflowing && !showAll" @click="showAll = true">全文</div>
      <div class="text-[#576b95] cursor-pointer" v-if="isOverflowing && showAll" @click="showAll = false">收起</div>
      <div class="flex flex-row gap-2 my-2 bg-[#f7f7f7] dark:bg-[#212121] items-center p-2 border rounded"
        v-if="props.memo.externalFavicon && props.memo.externalTitle">
        <img class="w-8 h-8" :src="props.memo.externalFavicon" alt="">
        <a :href="props.memo.externalUrl" target="_blank" class="text-[#576b95]">{{ props.memo.externalTitle }}</a>
      </div>

      <div v-if="imgs.length">
        <FancyBox
            :key="fancyBoxKey"
            class="grid my-1 gap-0.5"
            :style="gridStyle"
            ref="myFancyBox"
            :options="{ Carousel: { infinite: false } }"
        >
          <template v-for="(img, index) in imgs" :key="index">
            <!-- Live Photo: imgs 中以 "still|video" 形式编码，长按播放（LivePhoto 自带 SSR safe 占位） -->
            <LivePhoto
              v-if="isLivePhoto(img)"
              :photo-url="parseLivePhoto(img).still"
              :video-url="parseLivePhoto(img).video"
              :img-class="imgs.length === 1 ? 'cursor-pointer rounded full-cover-image-single' : 'rounded cursor-grab full-cover-image-mult'"
            />
            <img
              v-else
              loading="lazy"
              :class="imgs.length === 1 ? 'cursor-pointer rounded full-cover-image-single' : ' rounded cursor-grab full-cover-image-mult'"
              v-lazy="getImgUrl(img)"
            />
          </template>
        </FancyBox>
      </div>
      <div
          style="max-width: 100%"
          v-if="props.memo.music163Url && props.memo.music163Url !== '' && musicType && musicId"
      >
        <ClientOnly>
          <meting-js
              :key="musicBoxKey"
              :server="musicPlatform"
              :type="musicType"
              :id="musicId"
              :list-folded="true"
          />
        </ClientOnly>
      </div>

      <div class="text-[#57BE6B] font-medium dark:text-white text-xs mt-3 select-none" v-if="memo.userId === userId">
        {{(props.memo.atpeople?('提到了'+atpeoplenickname):'')}}
      </div>
      <div class="text-[#57BE6B] font-medium dark:text-white text-xs mt-3 select-none" v-if="memo.userId !== userId">
        {{(props.memo.atpeople?(props.memo.atpeople?.split(',').indexOf(''+userId)===-1?'':'提到了我'):'')}}
      </div>
      <div class="text-[#576b95] font-medium dark:text-white text-xs mt-1 mb-1 select-none">{{props.memo.location?.split(/\s+/g).join(' · ')}}</div>
      <div class="toolbar relative flex flex-row justify-between select-none my-1">
        <div class="flex-1 text-gray text-xs text-[#9DA4B0] ">{{ timeFormateFunction(props.memo.createdAt) }}</div>
        <div @click="toggleToolbar"
          ref="dotIconRef"
          class="toolbar-icon mb-2 px-2 py-1 bg-[#f7f7f7] dark:bg-slate-700 hover:bg-[#dedede] cursor-pointer rounded flex items-center justify-center">
          <img src="~/assets/img/dian.svg" class="w-3 h-3" />
        </div>
        <!-- Teleport 到 body 之外：父级 .memo-row 有 content-visibility:auto，
             隐式 contain:paint 会裁掉超出 memo 范围的子元素。
             用 fixed 定位+实时算坐标避免裁切。 -->
        <Teleport to="body">
          <div class="text-xs bg-[#4c4c4c] rounded text-white p-1 min-w-[110px]" v-if="showToolbar"
            ref="toolbarRef"
            :style="toolbarStyle">
          <div class="flex flex-col gap-0.5">
            <div class="flex flex-row gap-2 cursor-pointer items-center whitespace-nowrap px-2 py-1.5 rounded hover:bg-[#5c5c5c] w-full" v-if="token && userId === props.memo.userId && (!isDetail)"
              @click="pinned(); showToolbar = false">
              <Pin :size=14 />
              <div>{{ (props.memo.pinned ? '取消' :'') + '置顶'}}</div>
            </div>
            <div class="flex flex-row gap-2 cursor-pointer items-center whitespace-nowrap px-2 py-1.5 rounded hover:bg-[#5c5c5c] w-full" v-if="token && userId === props.memo.userId && (!isDetail)" @click="editMemo">
              <FilePenLine :size=14 />
              <div>编辑</div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <div class="flex flex-row gap-2 cursor-pointer items-center whitespace-nowrap px-2 py-1.5 rounded hover:bg-[#5c5c5c] w-full" v-if="token && userId === props.memo.userId">
                  <Trash2 :size=14 />
                  <div>删除</div>
                </div>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确定删除吗?</AlertDialogTitle>
                  <AlertDialogDescription>
                    无法恢复,你确定删除吗?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction @click="removeMemo">确定</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div class="flex flex-row gap-2 cursor-pointer items-center whitespace-nowrap px-2 py-1.5 rounded hover:bg-[#5c5c5c] w-full" @click="like">
              <Heart :size=14 v-if="likeList.findIndex((id) => id === props.memo.id) < 0" />
              <HeartCrack :size=14 v-else />
              <div>{{ likeList.findIndex((id) => id === props.memo.id) >= 0 ? '取消' : '赞' }}</div>
            </div>

            <div class="flex flex-row gap-2 cursor-pointer items-center whitespace-nowrap px-2 py-1.5 rounded hover:bg-[#5c5c5c] w-full"
              @click="showCommentInput = !showCommentInput; showUserCommentArray = []; showToolbar = false">
              <MessageSquareMore :size=14 />
              <div>评论</div>
            </div>

            <div class="flex flex-row gap-2 cursor-pointer items-center whitespace-nowrap px-2 py-1.5 rounded hover:bg-[#5c5c5c] w-full"
                 v-if="!isDetail"
                 @click="navigateTo(`/detail/${props.memo.id}`)">
              <Info :size=14 />
              <div>详情</div>
            </div>

            <div class="flex flex-row gap-2 cursor-pointer items-center whitespace-nowrap px-2 py-1.5 rounded hover:bg-[#5c5c5c] w-full"
                 @click="translateText()">
              <Languages :size=14 />
              <div>{{ translated?'原文':'翻译' }}</div>
            </div>

            <div class="flex flex-row gap-2 cursor-pointer items-center whitespace-nowrap px-2 py-1.5 rounded hover:bg-[#5c5c5c] w-full"
                 @click="copyShare(`/detail/${props.memo.id}`)">
              <Share :size=14 />
              <div>分享</div>
            </div>
          </div>
        </div>
        </Teleport>
      </div>
      <div class="rounded bottom-shadow bg-[#f7f7f7] dark:bg-[#202020] flex flex-col gap-1  ">
        <div class="flex flex-row py-2 px-4 gap-2 items-center text-sm" v-if="props.memo.favCount > 0">
          <Heart :size=14 color="#C64A4A" />
          <div class="text-[#576b95]"><span class="mx-1">{{ props.memo.favCount }}</span>位访客赞过</div>
        </div>
        <FriendsCommentInput :memoId="props.memo.id" @commentAdded="refreshComment" v-if="showCommentInput" />
        <template v-if="props.memo.comments.length > 0">
          <div class="px-4 py-2 flex flex-col gap-1">
            <div class="relative flex flex-col gap-2 text-sm" v-for="(comment, index) in props.memo.comments" :key="index">
              <Comment :comment="comment" :belongToMe="userId === props.memo.userId" @memo-update="refreshComment" />
            </div>
            <div v-if="props.memo.hasMoreComments" class="text-[#576b95] cursor-pointer"
              @click="navigateTo(`/detail/${props.memo.id}`)">查看更多...</div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Memo } from '@/lib/types';
import { onClickOutside, useStorage } from '@vueuse/core';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { Heart, HeartCrack, MessageSquareMore, Trash2, FilePenLine, Pin, Info, Share, Languages } from 'lucide-vue-next'
import { memoUpdateEvent, memoAddEvent, headigUpdateEvent, memoDeleteEvent} from '@/lib/event'
import { getImgUrl } from '~/lib/utils';
import LivePhoto from '~/components/LivePhoto.vue';

// "still|video" 编码识别（详见 useUpload + uploadImgs Live Photo 配对逻辑）
const isLivePhoto = (entry: string) => entry.includes('|');
const parseLivePhoto = (entry: string) => {
  const [still, video] = entry.split('|');
  return { still, video };
};
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {toast} from "vue-sonner";
import DOMPurify from 'dompurify';
import 'aplayer/dist/APlayer.min.css';

const token = useCookie('token')
let fancyBoxKey = ref(0);
let musicBoxKey = ref(0);

let imgs = computed(() => props.memo.imgs ? props.memo.imgs.split(',') : []);

const myFancyBox = ref()

const atpeoplenickname = ref('')

let userId = ref(0)

// 用 useRoute() 而不是 window.location.pathname —— 后者在 SSR 时被 unenv 用空对象
// stub 掉了，server 渲染时 isDetail 永远是 false，hydrate 到客户端真实路径是
// /detail/... 时翻成 true，DOM 跟着不一样就触发 "Hydration mismatch"。
// useRoute 在 server 和 client 是同一份反应式路由状态。
const _route = useRoute()
const isDetail = computed(() =>
  _route.path.startsWith('/detail/')
  || _route.path.startsWith('/user/')
  || _route.path.startsWith('/tags/'),
)

const gridStyle = computed(() => {
  let style = 'align-items: start;'; // 确保内容顶部对齐
  switch (imgs.value.length) {
    case 1:
      style += 'grid-template-columns: 1fr;';
      break;
    case 2:
      style += 'grid-template-columns: 1fr 1fr; aspect-ratio: 2 / 1;';
      break;
    case 3:
      style += 'grid-template-columns: 1fr 1fr 1fr; aspect-ratio: 3 / 1;';
      break;
    case 4:
      style += 'grid-template-columns: 1fr 1fr; aspect-ratio: 1;';
      break;
    default:
      style += 'grid-template-columns: 1fr 1fr 1fr; aspect-ratio: 3 / 1;';
  }
  return style;
});

dayjs.extend(relativeTime)

const props = withDefaults(
  defineProps<{
    memo: Memo,
    showMore: boolean,
  }>(), {}
)
const musicType = ref('')
const musicId = ref('')
const musicPlatform = ref('netease')

if(props.memo.music163Url){
  if(props.memo.music163Url.includes("music.163.com")){
    // 如果里面有playlist
    if(props.memo.music163Url.includes("playlist")){
      musicType.value = 'playlist'
      musicId.value = props.memo.music163Url.split('playlist?id=')[1].split('&')[0]
    }else if(props.memo.music163Url.includes("song")){
      musicType.value = 'song'
      musicId.value = props.memo.music163Url.split('song?id=')[1].split('&')[0]
    }else if(props.memo.music163Url.includes("album")) {
      musicType.value = 'album'
      musicId.value = props.memo.music163Url.split('album?id=')[1].split('&')[0]
    }
  }else if(props.memo.music163Url.includes("y.qq.com")){
    musicPlatform.value = 'tencent'
    if(props.memo.music163Url.includes("songDetail")){
      musicType.value = 'song'
      musicId.value = props.memo.music163Url.split('songDetail/')[1].split('?')[0]
    }else if(props.memo.music163Url.includes("playlist")){
      musicType.value = 'playlist'
      musicId.value = props.memo.music163Url.split('playlist/')[1].split('?')[0]
    }
  }else{
    props.memo.music163Url = ''
  }
}

const copyShare = (path: string) => {
  const url = window.location.origin + path;
  navigator.clipboard.writeText(url).then(() => {
    toast.success('本文链接已复制到剪贴板，快去分享吧');
  }, (err) => {
    console.error('链接复制失败: ', err);
  });
};

const timeFormateFunction = (time: string) => {
  if(timeFrontend && timeFrontend.value !== ''){
    return dayjs(time).locale('zh-cn').format(timeFrontend.value)
  }else{
    return dayjs(time).locale('zh-cn').fromNow().replaceAll(/\s+/g, '')
  }
}
const { fetchUser, peekNickname } = useUserCache()

const refreshAtpeople = async () => {
  if (!props.memo.atpeople) return
  const ids = props.memo.atpeople.split(',').filter(Boolean)
  // 先用缓存填一遍，避免初始为空导致"提到了" 慢慢出来的视觉效果
  const cachedNames: string[] = []
  const toFetch: string[] = []
  for (const id of ids) {
    const cached = peekNickname(id)
    if (cached) cachedNames.push(cached)
    else toFetch.push(id)
  }
  atpeoplenickname.value = cachedNames.length ? ' ' + cachedNames.join(' ') : ''

  // 没缓存的并行 fetch（同一 id 跨组件自动 dedup），完成后增量补到字符串里
  await Promise.all(
    toFetch.map(async (id) => {
      const user = await fetchUser(id)
      if (user.nickname) atpeoplenickname.value += ' ' + user.nickname
    })
  )
}

refreshAtpeople()

const emit = defineEmits(['memo-update'])

const showAll = ref(false)
const showToolbar = ref(false)
const showCommentInput = ref(false)
const toolbarRef = ref<HTMLElement | null>(null)
const dotIconRef = ref<HTMLElement | null>(null)
const toolbarStyle = ref<Record<string, string>>({ position: 'fixed', visibility: 'hidden' })
const showUserCommentArray = ref<Array<boolean>>([])
const el = ref<any>(null)
// 内容是否超过 4 行被截断了；仅当 true 时才显示「全文 / 收起」
const isOverflowing = ref(false)
const likeList = useStorage<Array<number>>('likeList', [])

// 当 line-clamp-4 已通过 :class 绑定生效时，scrollHeight 是自然全高、
// clientHeight 是被截断后的可视高度；差值就是是否溢出。
// `+1` 容差是为了避开 sub-pixel rounding 误判。
const checkOverflow = () => {
  if (!el.value) return
  if (showAll.value) return // 展开状态下不重判，避免「收起」消失
  isOverflowing.value = el.value.scrollHeight > el.value.clientHeight + 1
}

onClickOutside(toolbarRef, (e) => {
  // 点 dot 图标本身要走 toggleToolbar，不被 outside-click 二次关掉
  if (dotIconRef.value && e.target && dotIconRef.value.contains(e.target as Node)) return
  showToolbar.value = false
})

// popup 用 Teleport 渲到 body，要按 dot 图标的视口坐标 fixed 定位
function computeToolbarStyle() {
  const dot = dotIconRef.value
  if (!dot) return
  const r = dot.getBoundingClientRect()
  toolbarStyle.value = {
    position: 'fixed',
    bottom: `${Math.max(8, window.innerHeight - r.top + 6)}px`,
    right: `${Math.max(8, window.innerWidth - r.right + 30)}px`,
    zIndex: '50',
    visibility: 'visible',
  }
}

function toggleToolbar() {
  if (showToolbar.value) {
    showToolbar.value = false
    return
  }
  computeToolbarStyle()
  showToolbar.value = true
}

// 打开 popup 期间滚动 / 改窗口大小，重算位置
let toolbarScrollHandler: (() => void) | null = null
let toolbarResizeHandler: (() => void) | null = null
watch(showToolbar, (v) => {
  if (typeof window === 'undefined') return
  if (v) {
    toolbarScrollHandler = () => computeToolbarStyle()
    toolbarResizeHandler = () => computeToolbarStyle()
    window.addEventListener('scroll', toolbarScrollHandler, { passive: true, capture: true })
    window.addEventListener('resize', toolbarResizeHandler, { passive: true })
  } else {
    if (toolbarScrollHandler) window.removeEventListener('scroll', toolbarScrollHandler, { capture: true } as any)
    if (toolbarResizeHandler) window.removeEventListener('resize', toolbarResizeHandler)
    toolbarScrollHandler = null
    toolbarResizeHandler = null
  }
})

const timeFrontend = ref('')

onMounted(async () => {
  if (token) {
    userId = useCookie('userId')
  }
  el.value.addEventListener('click', (e: any) => {
    if (e.target.tagName === 'CODE') {
      navigator.clipboard.writeText(e.target.innerText).then(() => {
        toast.success('已复制到剪贴板')
      })
    }
  })
  // 站点设置在 SPA 内不会变 —— 用共享缓存，整个会话只发一次请求
  // （之前每个 FriendsMemo onMounted 都拉一次，列表里 10 条 memo 就是 10 次重复请求）
  const siteSettings = await useSiteSettings().fetchSettings()
  if (siteSettings?.success) {
    timeFrontend.value = siteSettings.data.timeFrontend
  }

  await nextTick()

  // 父级 .memo-row 有 content-visibility: auto，视口外的元素 clientHeight 是 0。
  // 用 ResizeObserver 在元素一拿到真实高度（content-visibility 激活那一刻）就立刻判断溢出
  // —— 比 IntersectionObserver 更早，因为 RO 在浏览器内部布局阶段触发，
  //    避免「全文」按钮要等用户滚到才慢吞吞出现的视觉延迟。
  const runCheck = (): boolean => {
    if (!el.value || el.value.clientHeight === 0) return false
    checkOverflow()
    return true
  }

  // 给所有内嵌 img 挂 onload：图片晚于文本载入会改变高度，重测一次
  if (el.value) {
    el.value.querySelectorAll('img').forEach((img: HTMLImageElement) => {
      if (!img.complete) {
        img.addEventListener('load', () => {
          if (!showAll.value) checkOverflow()
        }, { once: true })
      }
    })
  }

  if (!runCheck() && el.value) {
    const ro = new ResizeObserver(() => {
      if (runCheck()) ro.disconnect()
    })
    ro.observe(el.value)
  }
})

// 翻译切换 / 编辑后内容会变,需要重测溢出
watch(() => props.memo.content, async () => {
  if (!el.value) return
  showAll.value = false
  isOverflowing.value = false
  await nextTick()
  checkOverflow()
})

const gridCols = computed(() => {
  const imgLen = (props.memo.imgs || '').split(',').length;
  return imgLen >= 3 ? 3 : imgLen
})

const like = async () => {
  showToolbar.value = false
  const contain = likeList.value.find((id) => id === props.memo.id)
  const res = await $fetch('/api/memo/like', {
    method: 'POST',
    body: JSON.stringify({
      memoId: props.memo.id,
      like: !contain
    })
  })
  if (res.success) {
    if (contain) {
      likeList.value = likeList.value.filter((id) => id !== props.memo.id)
    } else {
      likeList.value.push(props.memo.id)
    }
    emit('memo-update')
  }
}

const pinned = async ()=>{
  showToolbar.value = false
  const res = await $fetch('/api/memo/pinned', {
    method: 'POST',
    body: JSON.stringify({
      memoId: props.memo.id,
      pinned:!(props.memo.pinned)
    })
  })
  if (res.success) {
    toast.success('操作成功')
    emit('memo-update')
  }
}

const removeMemo = async () => {
  showToolbar.value = false
  const res = await $fetch('/api/memo/remove', {
    method: 'POST',
    body: JSON.stringify({
      memoId: props.memo.id
    })
  })
  if (res.success) {
    toast.success('删除成功')
    emit('memo-update')
    memoDeleteEvent.emit()
    location.reload()
  }
}

const editMemo = async () => {
  showToolbar.value = false
  memoUpdateEvent.emit(props.memo)
}

memoAddEvent.on((id: any, body: any) => {
  if (id == props.memo.id) {
    emit('memo-update')
    atpeoplenickname.value = ''
    props.memo.atpeople = body.data.atpeople
    for (let i = 0; i < body.atpeopleNickname.length; i++) {
      atpeoplenickname.value += ' ' + body.atpeopleNickname[i]
    }
    if(body.data.imgUrls.join(',') !== imgs.value.join(',')){
      props.memo.imgs = body.data.imgUrls.join(',')
      fancyBoxKey.value++;
    }
    props.memo.music163Url = body.data.music163Url
    if(props.memo.music163Url) {
      if (props.memo.music163Url.includes("music.163.com")) {
        // 如果里面有playlist
        if (props.memo.music163Url.includes("playlist")) {
          musicType.value = 'playlist'
          musicId.value = props.memo.music163Url.split('playlist?id=')[1].split('&')[0]
        } else if (props.memo.music163Url.includes("song")) {
          musicType.value = 'song'
          musicId.value = props.memo.music163Url.split('song?id=')[1].split('&')[0]
        } else if (props.memo.music163Url.includes("album")) {
          musicType.value = 'album'
          musicId.value = props.memo.music163Url.split('album?id=')[1].split('&')[0]
        }
      }else if(props.memo.music163Url.includes("y.qq.com")){
        musicPlatform.value = 'tencent'
        if(props.memo.music163Url.includes("songDetail")){
          musicType.value = 'song'
          musicId.value = props.memo.music163Url.split('songDetail/')[1].split('?')[0]
        }else if(props.memo.music163Url.includes("playlist")){
          musicType.value = 'playlist'
          musicId.value = props.memo.music163Url.split('playlist/')[1].split('?')[0]
        }
      } else {
        props.memo.music163Url = ''
      }
    }
    musicBoxKey.value++;
  }
  if(body.data.id <= 0){
    emit('memo-update')
    fancyBoxKey.value++;
    // props.memo.music163Url = body.data.music163Url
    if(props.memo.music163Url) {
      if (props.memo.music163Url.includes("music.163.com")) {
        // 如果里面有playlist
        if (props.memo.music163Url.includes("playlist")) {
          musicType.value = 'playlist'
          musicId.value = props.memo.music163Url.split('playlist?id=')[1].split('&')[0]
        } else if (props.memo.music163Url.includes("song")) {
          musicType.value = 'song'
          musicId.value = props.memo.music163Url.split('song?id=')[1].split('&')[0]
        } else if (props.memo.music163Url.includes("album")) {
          musicType.value = 'album'
          musicId.value = props.memo.music163Url.split('album?id=')[1].split('&')[0]
        }
      } else if(props.memo.music163Url.includes("y.qq.com")){
        musicPlatform.value = 'tencent'
        if(props.memo.music163Url.includes("songDetail")){
          musicType.value = 'song'
          musicId.value = props.memo.music163Url.split('songDetail/')[1].split('?')[0]
        }else if(props.memo.music163Url.includes("playlist")){
          musicType.value = 'playlist'
          musicId.value = props.memo.music163Url.split('playlist/')[1].split('?')[0]
        }
      }else {
        props.memo.music163Url = ''
      }
    }else{
      props.memo.music163Url = ''
    }
    musicBoxKey.value++;
  }
})

memoDeleteEvent.on(() => {
  emit('memo-update')
  fancyBoxKey.value++;
})

const refreshComment = async () => {
  emit('memo-update', props.memo)
  showUserCommentArray.value = []
  showCommentInput.value = false
}


// showAll 直接通过 :class 绑定 line-clamp-4 反应式控制，无需额外的 showMore/showLess
// 函数；click handler 直接 `@click="showAll = true/false"`。

const colorMode = useColorMode()

const replaceNewLinesExceptInCodeBlocks = (text: string) => {
  let flag = false
  if (text.endsWith('```')) {
    text += '\n'
    flag = true
  }
  // 保存代码块内容
  let codeBlocks: any = [];
  text = text.replace(/```([^\n]*)\n([\s\S]*?)```\n/g, function (match: string, lang: string, code: string) {
    codeBlocks.push({ lang, code });
    return `<<code-block-${codeBlocks.length - 1}>>`;
  });

  // Markdown链接转换为a标签
  text = text.replaceAll(/#(\S+)/g, '[#$1](/tags/$1)');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // 格式化粗体、斜体、删除线、代码
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  text = text.replace(/~~(.*?)~~/g, '<del>$1</del>');
  text = text.replace(/`(.*?)`/g, `<code class='code-character'>$1</code>`);

  // 处理待办事项
  text = text.replace(/^\[ \] (.*?)(?=\n|$)/gmi, '<input type="checkbox" disabled> $1');
  text = text.replace(/^\[[xX]\] (.*?)(?=\n|$)/gmi, '<input type="checkbox" checked disabled> $1');

  // 切割文本并处理列表等
  const lines = text.split('\n');
  text = lines.map(line => {
    if (line.startsWith('![')) {
      const img = line.match(/!\[(.*?)\]\((.*?)\)/);
      return `<img src="${img[2]}" alt="${img[1]}" class="cursor-pointer" @click="navigateTo('${img[2]}')"/>`;
    } else if (/^\d+\./.test(line)) {
      return '<p>' + line + '</p>';
    } else if (/^-/.test(line)) {
      return '<li>' + line.replace(/^-/, '') + '</li>';
    } else {
      return '<span>' + line + '</span><br />';
    }
  }).join('');

  // 恢复代码块并使用code标签包裹
  text = text.replace(/<<code-block-(\d+)>>/g, function (match, index) {
    const { lang, code } = codeBlocks[index];
    return `<pre><code class='code-block ${lang}'>${code}</code></pre>`;
  });

  if (flag) {
    text = text.slice(0, -1)
  }

  const returns =  DOMPurify.sanitize(text, { ALLOWED_TAGS: ['a', 'p', 'span', 'ul', 'ol', 'li', 'img', 'strong', 'em', 'del', 'blockquote', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'iframe', 'input'] });
  return returns;
};


const gotouser = () => {
  navigateTo(`/user/${props.memo.userId}`)
  let event = new CustomEvent('headimgrefresh', { detail: { userId: props.memo.userId } });
  // window.dispatchEvent(event);
  headigUpdateEvent.emit(event)
}

const translated = ref(false)
var originalContent = props.memo.content

const translateText = async () => {

  if(translated.value){
    props.memo.content = originalContent
    translated.value = false
  }else{
    const id = props.memo.id
    await $fetch('/api/memo/translate', {
      method: 'POST',
      body: JSON.stringify({
        id: id
      })
    }).then(res => {
      if(res.success){
        props.memo.content = res.data.content
      }
    })
    translated.value = true
  }
}

</script>

<style>
.full-cover-image-mult {
  object-fit: cover;
  object-position: center;
  width: 100%;
  aspect-ratio: 1 / 1;
  border: transparent 1px solid;
}

.full-cover-image-single {
  object-fit: cover;
  object-position: center;
  max-height: 200px;
  height: auto;
  width: auto;
  border: transparent 1px solid;
}

.words-container{
  word-break: break-all;
  white-space: pre-wrap;
  width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.words-container a{
  color: #3C4F7E;
  text-decoration: none;
}

.words-container ul {
  list-style-type: circle;
  padding-left: 20px;
  margin-left: 0;
}
.words-container ol {
  list-style-type: roman;
  padding-left: 20px;
  margin-left: 0;
}


.code-character {
  background-color: #f0f0f0;
  color: #00a7a7;
  padding: 2px 4px;
  border-radius: 4px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.875rem;
  line-height: 1.25rem;
  overflow-x: auto;
}

pre {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  background-color: #f0f0f0;
  color: #00a7a7;
  padding: 8px;
  border-radius: 10px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.875rem;
  line-height: 1.25rem;
  box-sizing: border-box;
  white-space: pre;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}

pre::-webkit-scrollbar {
  display: none !important;
}

pre code {
  max-width: 100%;
  overflow-x: auto;
  white-space: pre;
  display: block;
}


.words-container input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border: 2px solid #00a7a7;
  border-radius: 3px;
  background-color: #fff;
  transform: translate(0, 20%);
  cursor: pointer;
  position: relative;
  margin-right: 8px;
}

.words-container input[type="checkbox"]:checked {
  background-color: #00a7a7;
  border: 2px solid #00a7a7;

}

.words-container input[type="checkbox"]:checked::after {
  content: '✔';
  color: #fff;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 14px;
  line-height: 1.25;
}

.dark .code-character{
  background-color: #2d2d2d;
  color: #66d9ef;
}

.dark pre {
  background-color: #2d2d2d;
  color: #66d9ef;
}

.dark .words-container input[type="checkbox"] {
  border: 2px solid #66d9ef;
  background-color: #2d2d2d; /* 深灰色背景 */
}

.dark .words-container input[type="checkbox"]:checked {
  background-color: #66d9ef;
  border: 2px solid #66d9ef;
}

.aplayer-body {
  max-width: 100%;
  width: 100%;
}

.aplayer-pic{
  z-index: 1;
}

.aplayer-music {
  overflow: hidden;
  display: inline-block;
  align-items: center;
  width: 100%;
  position: absolute;
  animation: scroll 8s linear infinite;
}

.aplayer-title, .aplayer-author {
  padding-right: 10px;
}

@keyframes scroll {
  from { transform: translateX(100%); }
  to { transform: translateX(-100%); }
}

.aplayer-lrc {
  margin-top: 25px !important;
}

/* 自定义 4 行截断 —— 不依赖 Tailwind 的 line-clamp utility（@nuxtjs/tailwindcss
   在这个项目里没把它生成进 CSS，所以直接写死） */
.memo-clamp {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  overflow: hidden;
}

</style>