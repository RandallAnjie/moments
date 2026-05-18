<template>
  <div class="memo flex flex-row sm:gap-4 text-sm border-0 sm:py-2 sm:px-4 w-full" :class="{'bg-slate-100 dark:bg-neutral-900':props.memo.pinned}">
    <div class="flex flex-col w-1/5">
      <div v-if="(!props.memo.pinned) && props.memo.displayDay">
        <span style="font-size: 25px">{{dayjs(props.memo.createdAt).locale('zh-cn').format('DD')}}</span> <span>{{dayjs(props.memo.createdAt).locale('zh-cn').format('M')}}月</span>
      </div>
      <div class="text-[#576b95] font-medium dark:text-white text-xs mt-2 mb-1 select-none" v-if="(!props.memo.pinned) && props.memo.displayDay">
        {{props.memo.location?.split(/\s+/g).join(' · ')}}
      </div>
      <div class="flex flex-row justify-between items-center" v-if="props.memo.pinned" style="width: 100%; height: 100%">
        <div style="width: 100%; height: 100%; display: flex; align-items: center;"><span style="font-size: 30px">置顶</span></div>
      </div>
    </div>
    <div class="flex w-full">
      <div class="w-32 h-32" v-if="imgs.length">
        <FancyBox class="grid my-1 gap-0.5" :style="gridStyle"
                  :options="{ Carousel: { infinite: false } }">
          <img loading="lazy"
               class="cursor-pointer rounded full-cover-image-mult"
               v-lazy="getImgUrl(img)"
               v-for="(img, index) in imgs" :key="index"
               style="object-fit: cover; object-position: center;" />
        </FancyBox>
      </div>
      <div class="flex w-full" style="flex-direction: column;" @click="$router.push('/detail/'+props.memo.id)">
        <div class="words-container memo-content text-sm friend-md bg-[#f7f7f7] dark:bg-[#202020]" style="width:100%; padding: 10px" ref="el" v-if="!imgs.length" v-html="replaceNewLinesExceptInCodeBlocks(props.memo.content)"> </div>
        <div class="words-container memo-content text-sm friend-md" style="width:100%; padding: 10px" ref="el" v-if="imgs.length" v-html="replaceNewLinesExceptInCodeBlocks(props.memo.content)"> </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Memo } from '@/lib/types';
import { useElementSize, onClickOutside, watchOnce, useStorage } from '@vueuse/core';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { Heart, HeartCrack, MessageSquareMore, Trash2, FilePenLine, Pin } from 'lucide-vue-next'
import { memoUpdateEvent } from '@/lib/event'
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
} from '@/components/ui/alert-dialog'
const token = useCookie('token')
import DOMPurify from 'dompurify';

const imgs = computed(() => props.memo.imgs ? props.memo.imgs.split(',') : []);
let userId = ref(0)

const gridStyle = computed(() => {
  let style = 'align-items: start;';
  switch (imgs.value.length) {
    case 1:
      style += 'grid-template-columns: 1fr; aspect-ratio: 1 / 1;';
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


const emit = defineEmits(['memo-update'])

const showAll = ref(false)
const showToolbar = ref(false)
const showCommentInput = ref(false)
const toolbarRef = ref(null)
const showUserCommentArray = ref<Array<boolean>>([])
const el = ref<any>(null)
let hh = ref(0)
const { height } = useElementSize(el)
const likeList = useStorage<Array<number>>('likeList', [])

onMounted(async () => {
  if (token) {
    userId = useCookie('userId')
  }
})

onClickOutside(toolbarRef, () => showToolbar.value = false)

watchOnce(height, () => {
  hh.value = height.value
  if (height.value > 96) {
    el.value.classList.add('line-clamp-4')
    // 将内容截断为4行，后面的内容删除
    el.value.style.height = '93px'
  }
})

const replaceNewLinesExceptInCodeBlocks = (text: any) => {
  // 长文章模式：有 markdown 标题就把连续空行折叠成单行
  if (/^#{1,3} /m.test(text)) {
    text = text.replace(/\n{2,}/g, '\n');
  }

  // 不让 ## / ### 这种 heading 被误吃成 tag
  text = text.replaceAll(/#([^\s#]+)/g, '[#$1](/tags/$1)');

  text = text.replace(/```([^\n]*)\n([\s\S]*?)```/g, function (match: string, lang: string, code: string) {
    if(lang) {
      return lang + '\n' + code;
    }else{
      return code;
    }
  });

  // 将链接转换为a标签
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // 处理粗体、斜体、删除线、单词块
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // 粗体
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>'); // 斜体
  text = text.replace(/~~(.*?)~~/g, '<del>$1</del>'); // 删除线
  text = text.replace(/`(.*?)`/g, '<code>$1</code>'); // 单词块

  // 处理待办事项框
  text = text.replace(/^\[ \] (.*?)(?=\n|$)/gmi, '<input type="checkbox" disabled> $1'); // 未完成
  text = text.replace(/^\[[xX]\] (.*?)(?=\n|$)/gmi, '<input type="checkbox" checked disabled> $1'); // 完成

  // 将text根据换行符分割成数组；标题 / 引用 / 分割线在 list / span fallback 之前判
  const spices = text.split('\n');
  for (let j = 0; j < spices.length; j++) {
    const line = spices[j];
    if (line.startsWith('### ')) {
      spices[j] = '<h3>' + line.slice(4) + '</h3>';
    } else if (line.startsWith('## ')) {
      spices[j] = '<h2>' + line.slice(3) + '</h2>';
    } else if (line.startsWith('# ')) {
      spices[j] = '<h1>' + line.slice(2) + '</h1>';
    } else if (/^-{2,}\s*$/.test(line)) {
      spices[j] = '<hr>';
    } else if (line.startsWith('> ')) {
      spices[j] = '<blockquote>' + line.slice(2) + '</blockquote>';
    } else if (line.startsWith('![')) {
      const img = line.match(/!\[(.*?)\]\((.*?)\)/);
      if (img) {
        spices[j] = `<img src="${img[2]}" alt="${img[1]}" class="cursor-pointer" @click="navigateTo('${img[2]}')"/>`;
      }
    } else if (/^\d+\./.test(line)) {
      spices[j] = '<p>' + line + '</p>';
    } else if (/^-/.test(line)) {
      spices[j] = '<li>' + line.replace(/^-/, '') + '</li>';
    } else {
      spices[j] = '<span>' + line + '</span><br />';
    }
  }
  text = spices.join('');
  if (text.endsWith('<br />')) {
    text = text.substring(0, text.length - 6);
  }
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: ['a', 'p', 'span', 'ul', 'ol', 'li', 'img', 'strong', 'em', 'del', 'blockquote', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'hr', 'iframe', 'input'] });
};

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
  max-height: 200px;  /* 最大高度为200px */
  height: auto;      /* 高度自动调整以保持横宽比 */
  width: auto;
  border: transparent 1px solid;
}

.words-container{
  word-break: break-all;
  white-space: pre-wrap;
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

/* 标题 1/2/3 */
.words-container h1 {
  font-size: 1.18em;
  font-weight: 600;
  margin: 0.4em 0;
  line-height: 1.3;
}
.words-container h2 {
  font-size: 1.1em;
  font-weight: 500;
  margin: 0.4em 0;
  line-height: 1.3;
}
.words-container h3 {
  font-size: 1em;
  font-weight: 500;
  margin: 0.35em 0;
  line-height: 1.3;
}

/* 引用块 */
.words-container blockquote {
  background-color: #f1f1f1;
  border-left: 3px solid #c0c0c0;
  padding: 6px 10px;
  margin: 4px 0;
  border-radius: 0 4px 4px 0;
  color: #555;
}
.dark .words-container blockquote {
  background-color: #2a2a2a;
  border-left-color: #555;
  color: #c0c0c0;
}

/* 水平分割线 */
.words-container hr {
  border: none;
  border-top: 1px solid #d1d1d1;
  margin: 10px 0;
  height: 0;
}
.dark .words-container hr {
  border-top-color: #3a3a3a;
}

/* 样式定义 */
.words-container code {
  background-color: #f0f0f0; /* 浅灰色背景 */
  color: #00a7a7; /* 蓝绿色字体颜色 */
  padding: 2px 4px;
  border-radius: 4px; /* 圆润边角 */
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.875rem; /* 调整字体大小 */
  line-height: 1.25rem; /* 调整行高 */
}

.words-container input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 16px; /* 调整复选框宽度 */
  height: 16px; /* 调整复选框高度 */
  border: 2px solid #00a7a7; /* 蓝绿色边框 */
  border-radius: 3px;
  background-color: #fff; /* 白色背景 */
  transform: translate(0, 20%); /* 使对勾符号居中 */
  cursor: pointer;
  position: relative;
  margin-right: 8px;
}

.words-container input[type="checkbox"]:checked {
  background-color: #00a7a7; /* 选中时蓝绿色背景 */
  border: 2px solid #00a7a7; /* 选中时蓝绿色边框 */

}

.words-container input[type="checkbox"]:checked::after {
  content: '✔';
  color: #fff;
  position: absolute;
  top: 50%; /* 调整对勾符号的位置 */
  left: 50%; /* 调整对勾符号的位置 */
  transform: translate(-50%, -50%); /* 使对勾符号居中 */
  font-size: 14px; /* 调整对勾符号的字体大小 */
  line-height: 1.25;
}

.dark .words-container code {
  background-color: #2d2d2d; /* 深灰色背景 */
  color: #66d9ef; /* 浅蓝绿色字体颜色 */
}

.dark .words-container input[type="checkbox"] {
  border: 2px solid #66d9ef; /* 浅蓝绿色边框 */
  background-color: #2d2d2d; /* 深灰色背景 */
}

.dark .words-container input[type="checkbox"]:checked {
  background-color: #66d9ef; /* 选中时浅蓝绿色背景 */
  border: 2px solid #66d9ef; /* 选中时浅蓝绿色边框 */
}


</style>