<template>
  <div class="header relative mb-8 ">
    <img class="header-img w-full  max-h-[300px]" :src="getImgUrl(res?.data?.coverUrl!)" alt="" />
    <div class="absolute right-2 bottom-[-40px]">
      <div class="userinfo flex flex-col">
        <div class="flex flex-row items-center gap-4 justify-end">
          <div class="username text-lg font-bold text-white">{{ res?.data?.nickname }}</div>
          <img :src="getImgUrl(res?.data?.avatarUrl!)" class="avatar w-[70px] h-[70px] rounded-xl" />
        </div>
        <div class="slogon text-gray truncate w-full text-end text-xs mt-2">{{ res?.data?.slogan }}</div>
      </div>
    </div>

    <div class="absolute right-2 top-2 bg-slate-100 rounded p-1 flex flex-row gap-2">
      <div title="返回" v-if="showBack()" @click="navigateTo('/')">
        <ArrowLeft color="#9FC84A" :size="20" class="cursor-pointer" />
      </div>

      <div title="亮色" v-if="colorMode.value === 'dark'" @click="colorMode.value = 'light'">
        <Sun color="#FDE047" :size="20" class="cursor-pointer" />
      </div>
      <div title="暗色" v-else>
        <MoonStar color="#FDE047" :size="20" class="cursor-pointer" @click="colorMode.value = 'dark'" />
      </div>
    </div>
  </div>
  <div>
    <MemoInput v-if="token" @memo-added="firstLoad" />

    <div class="content flex flex-col divide-y divide-gray-100/50 gap-2">
      <div v-if="state.memoList.length === 0 && !token" class="text-center">
        <div class="my-2 text-sm">什么也没有,赶紧去登录发表Moments吧!</div>
      </div>
      <div v-for="(memo, index) in annotatedMemoList" :key="index">
        <!-- 检查是否需要显示年份 -->
        <div v-if="memo.displayYear">
          <div style="margin: 0 20px">
            <span style="font-size: 30px">{{ memo.displayYear }}</span>
          </div>
        </div>

        <!-- 显示memo -->
        <OnesMemo :memo="memo" :show-more="true" @memo-update="firstLoad" />
      </div>
    </div>

    <div id="get-more" ref="getMore" class="cursor-pointer text-center text-sm opacity-70 my-4" @click="loadMore()" v-if="state.hasNext" >
      加载中...
    </div>
    <div class="cursor-pointer text-center text-sm opacity-70 my-4">
      ———— 没有更多啦～ ————
    </div>
  </div>
</template>

<script setup lang="ts">
import { type Memo } from '~/lib/types';
import {onMounted, onUnmounted, watch, ref, computed} from 'vue';
import jsonp from 'jsonp';
import {getImgUrl} from "~/lib/utils";
import { Sun, MoonStar, LogIn, ArrowLeft } from 'lucide-vue-next'

import { settingsUpdateEvent } from '~/lib/event'
import {useAsyncData} from "#imports";
import OnesMemo from "~/components/OnesMemo.vue";
import dayjs from "dayjs";

const colorMode = useColorMode()
const token = useCookie('token')
const route = useRoute()
const showBack = () => {
  return route.path.startsWith('/detail') || route.path.startsWith('/settings') || route.path.startsWith('/user')
}
const userId = useCookie('userId');
const url = window.location.pathname
let findId = userId.value
if(url.startsWith('/user/')) {
  findId = url.split('/user/')[1]
}
const response = await $fetch('/api/user/settings/get?user=' + (findId == 'undefined' ? '0' : findId));

const { data: res, refresh } = await useAsyncData('userinfo', async () => response)

settingsUpdateEvent.on(async () => {
  await refresh()
})


const getMore = ref(null);
const version = ref('');

let observer: IntersectionObserver | null = null;

const annotatedMemoList = computed(() => {
  if (!state.memoList.length) return [];
  let lastYear = null;
  let started = false;
  return state.memoList.map((memo) => {
    if (!started && memo.pinned) {
      return memo;
    }
    const currentYear = dayjs(memo.createdAt).locale('zh-cn').format('YYYY');
    if (!started && !memo.pinned) {
      started = true;
      lastYear = currentYear;
      return { ...memo, displayYear: currentYear };
    }
    if (currentYear !== lastYear) {
      lastYear = currentYear;
      return { ...memo, displayYear: currentYear };
    }
    return memo;
  });
})

onMounted(async () => {
  await firstLoad();
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      loadMore();
    }
  }, {
    // 上边框距离屏幕底部一定距离时触发
    rootMargin: '500px',
  });

  if (getMore.value) {
    observer.observe(getMore.value);
  }

  // 当组件卸载时，停止观察
  onUnmounted(() => {
    if (getMore.value) {
      observer.unobserve(getMore.value);
    }
  });
  // 监听 getMore 引用的变化，并重新设置观察者
  watch(getMore, () => {
    setupObserver();
  }, {
    immediate: true // 立即触发，确保初始 setup
  });
});
const setupObserver = () => {
  // 清除现有的观察者（如果有）
  if (observer && getMore.value) {
    observer.unobserve(getMore.value);
  }

  // 创建新的观察者实例
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      loadMore();
    }
  }, {
    // 上边框距离屏幕底部一定距离时触发
    rootMargin: '500px',
  });

  // 设置新的观察目标
  if (getMore.value) {
    observer.observe(getMore.value);
  }
};


const state = reactive({
  memoList: Array<Memo>(),
  page: 1,
  hasNext: false
})

const firstLoad = async () => {
  state.page = 1
  const { data, hasNext } = await $fetch('/api/memo/list', {
    key: 'memoList',
    method: 'POST',
    body: JSON.stringify({
      user: route.params.id,
      page: state.page,
    })
  })
  state.memoList = data as any as Memo[]
  state.hasNext = hasNext || false
  // await loadMore()
}

let loadLock = false;

const loadMore = async () => {
  if(loadLock) return;
  loadLock = true;
  try {
    const { data, hasNext } = await $fetch('/api/memo/list', {
      key: 'memoList',
      method: 'POST',
      body: JSON.stringify({
        page: state.page + 1, // 先不增加页码
      })
    });
    state.page += 1;
    state.memoList.push(...data as any as Memo[]);
    state.hasNext = hasNext;
  } catch (error: any) {
    if (error.response && error.response.status === 429) {
      rStatusMessage.warning('请求过于频繁，请稍后再试');
    } else {
      // 处理其他错误
      console.error('Failed to load more memos:', error);
    }
    setTimeout(loadMore, 1000);
  } finally {
    loadLock = false;
  }
}


</script>

<style scoped></style>
<style>
</style>