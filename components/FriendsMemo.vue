<template>

  <div class="memo flex flex-row gap-2 sm:gap-4 text-sm border-x-0 pt-2 p-2 sm:p-4" :class="{'bg-slate-100 dark:bg-neutral-900':props.memo.pinned && props.memo.userId == 1}" style="max-width: 100vw">
    <img :src="props.memo.user.avatarUrl" class="avatar w-9 h-9 rounded" @click="gotouser" />
    <div class="flex flex-col gap-.5 flex-1 overflow-auto">
      <div class="flex flex-row justify-between items-center">
        <div class="username text-[#576b95] cursor-default mb-1 dark:text-white" @click="gotouser">{{ props.memo.user.nickname }}</div>
        <Pin :size=14 v-if="props.memo.pinned && props.memo.userId == 1" />
      </div>
      <div :id="'content-' + props.memo.id" class="memo-content text-sm friend-md words-container" ref="el" v-html="replaceNewLinesExceptInCodeBlocks(props.memo.content)"> </div>
      <div class="text-[#576b95] cursor-pointer" v-if="hh > 96 && !showAll" @click="showMore">全文</div>
      <div class="text-[#576b95] cursor-pointer " v-if="showAll" @click="showLess">收起</div>
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
          <img
              loading="lazy"
              :class="imgs.length === 1 ? 'cursor-pointer rounded full-cover-image-single' : ' rounded cursor-grab full-cover-image-mult'"
              v-lazy="getImgUrl(img)"
              v-for="(img, index) in imgs" :key="index"
          />
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
        <div @click="showToolbar = !showToolbar"
          class="toolbar-icon mb-2 px-2 py-1 bg-[#f7f7f7] dark:bg-slate-700 hover:bg-[#dedede] cursor-pointer rounded flex items-center justify-center">
          <img src="~/assets/img/dian.svg" class="w-3 h-3" />
        </div>
        <div class="text-xs absolute top-[-8px] right-[30px] bg-[#4c4c4c] rounded text-white p-2" v-if="showToolbar"
          ref="toolbarRef">
          <div class="flex flex-row gap-4">
            <div class="flex flex-row gap-2 cursor-pointer items-center" v-if="token && userId === props.memo.userId && (!isDetail)"
              @click="pinned(); showToolbar = false">
              <Pin :size=14 />
              <div>{{ (props.memo.pinned ? '取消' :'') + '置顶'}}</div>
            </div>
            <div class="flex flex-row gap-2 cursor-pointer items-center" v-if="token && userId === props.memo.userId && (!isDetail)" @click="editMemo">
              <FilePenLine :size=14 />
              <div>编辑</div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <div class="flex flex-row gap-2 cursor-pointer items-center" v-if="token && userId === props.memo.userId">
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

            <div class="flex flex-row gap-2 cursor-pointer items-center" @click="like">
              <Heart :size=14 v-if="likeList.findIndex((id) => id === props.memo.id) < 0" />
              <HeartCrack :size=14 v-else />
              <div>{{ likeList.findIndex((id) => id === props.memo.id) >= 0 ? '取消' : '赞' }}</div>
            </div>

            <div class="flex flex-row gap-2 cursor-pointer items-center"
              @click="showCommentInput = !showCommentInput; showUserCommentArray = []; showToolbar = false">
              <MessageSquareMore :size=14 />
              <div>评论</div>
            </div>

            <div class="flex flex-row gap-2 cursor-pointer items-center"
                 v-if="!isDetail"
                 @click="navigateTo(`/detail/${props.memo.id}`)">
              <Info :size=14 />
              <div>详情</div>
            </div>

            <div class="flex flex-row gap-2 cursor-pointer items-center"
                 @click="translateText()">
              <div>{{ translated?'原文':'翻译' }}</div>
            </div>

            <div class="flex flex-row gap-2 cursor-pointer items-center"
                 @click="copyShare(`/detail/${props.memo.id}`)">
              <Share :size=14 />
              <div>分享</div>
            </div>
          </div>
        </div>
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
import { Heart, HeartCrack, MessageSquareMore, Trash2, FilePenLine, Pin, Info, Share } from 'lucide-vue-next'
import { memoUpdateEvent, memoAddEvent, headigUpdateEvent, memoDeleteEvent} from '@/lib/event'
import { getImgUrl } from '~/lib/utils';
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

const isDetail = ref(false)

if (window.location.pathname.startsWith('/detail/')) {
  isDetail.value = true
}else if(window.location.pathname.startsWith('/user/')) {
  isDetail.value = true
}else if(window.location.pathname.startsWith('/tags/')) {
  isDetail.value = true
}

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
const refreshAtpeople = async ()=>{
  if(props.memo.atpeople?.split(',')){
    atpeoplenickname.value = ''
    for(let i=0;i<props.memo.atpeople?.split(',').length;i++){
      $fetch('/api/user/settings/get?user='+props.memo.atpeople?.split(',')[i]).then(res => {
        if (res.success) {
          atpeoplenickname.value += ' ' + res.data.nickname
        }
      })
    }
  }
}

refreshAtpeople()

const emit = defineEmits(['memo-update'])

const showAll = ref(false)
const showToolbar = ref(false)
const showCommentInput = ref(false)
const toolbarRef = ref(null)
const showUserCommentArray = ref<Array<boolean>>([])
const el = ref<any>(null)
let hh = ref(0)
const likeList = useStorage<Array<number>>('likeList', [])

const measureAndClamp = () => {
  if (!el.value) return
  // 测量真实内容高度时不能带 line-clamp,否则 scrollHeight 会被截断
  const hadClamp = el.value.classList.contains('line-clamp-4')
  if (hadClamp) el.value.classList.remove('line-clamp-4')
  const fullHeight = el.value.scrollHeight
  hh.value = fullHeight
  if (fullHeight > 96 && !showAll.value) {
    el.value.classList.add('line-clamp-4')
  }
}

onClickOutside(toolbarRef, () => {
  showToolbar.value = false
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
  await $fetch('/api/user/settings/get').then((res) => {
    if (res.success) {
      timeFrontend.value = res.data.timeFrontend
    }
  })

  await nextTick()
  measureAndClamp()

  // 图片异步加载后高度会变,需要重新测量以决定是否显示"全文"
  if (el.value) {
    const innerImgs = el.value.querySelectorAll('img')
    innerImgs.forEach((img: HTMLImageElement) => {
      if (!img.complete) {
        img.addEventListener('load', () => {
          if (!showAll.value) measureAndClamp()
        }, { once: true })
      }
    })
  }
})

// 翻译切换 / 编辑后内容会变,需要重测高度
watch(() => props.memo.content, async () => {
  if (!el.value) return
  showAll.value = false
  el.value.classList.remove('line-clamp-4')
  await nextTick()
  measureAndClamp()
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


const showMore = () => {
  showAll.value = true
  el.value.classList.remove('line-clamp-4')
}
const showLess = () => {
  showAll.value = false
  el.value.classList.add('line-clamp-4')
}

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

</style>