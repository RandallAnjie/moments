<template>
  <HeaderImg />
  <div>
    <div class="content flex flex-col gap-2">
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
import {getImgUrl} from "~/lib/utils";
import { Sun, MoonStar, LogIn, ArrowLeft } from 'lucide-vue-next'

import { settingsUpdateEvent } from '~/lib/event'
import {useAsyncData} from "#imports";
import OnesMemo from "~/components/OnesMemo.vue";
import dayjs from "dayjs";
import {toast} from "vue-sonner";

const token = useCookie('token')
const route = useRoute()

const userId = useCookie('userId');
let findId = userId.value

onMounted(async () => {
  const url = window.location.pathname
  if(url.startsWith('/user/')) {
    findId = url.split('/user/')[1]
  }
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

  // 拿到个人css
  const res = await $fetch('/api/user/settings/get?user=' + findId)
  if (res.success && res.data && res.data.personalCss) {
    const style = document.createElement('style');
    style.innerHTML = res.data.personalCss;
    document.head.appendChild(style);
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

const getMore = ref(null);

let observer: IntersectionObserver | null = null;

const annotatedMemoList = computed(() => {
  if (!state.memoList.length) return [];
  let lastYear = null;
  let lastDay = null;
  let started = false;
  return state.memoList.map((memo) => {
    if (!started && memo.pinned) {
      return memo;
    }
    const currentYear = dayjs(memo.createdAt).locale('zh-cn').format('YYYY');
    const currentDay = dayjs(memo.createdAt).locale('zh-cn').format('YYYYMMDD');
    if (!started && !memo.pinned) {
      started = true;
      lastYear = currentYear;
      lastDay = currentDay;
      return { ...memo, displayYear: currentYear, displayDay: currentDay };
    }else{
      let returns = memo;
      if (currentYear !== lastYear) {
        lastYear = currentYear;
        returns = {...returns, displayYear: currentYear};
      }else{
        returns = {...returns, displayYear: null};
      }
      if (currentDay !== lastDay) {
        lastDay = currentDay;
        returns = {...returns, displayDay: currentDay};
      }else{
        returns = {...returns, displayDay: null};
      }
      return returns;
    }

  });
})


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
  toast.promise($fetch('/api/memo/list', {
        key: 'memoList',
        method: 'POST',
        body: JSON.stringify({
          user: route.params.id,
          page: state.page,
        })
      }), {
        loading: '加载中...',
        success: (data) => {
          if (data.success) {
            state.memoList = data.data as any as Memo[]
            state.hasNext = data.hasNext || false
            return '加载成功';
          } else {
            return '加载失败: ' + data.message;
          }
        },
        error: (error) => {
          if (error.response && error.response.status === 429) {
            return '请求过于频繁，请稍后再试';
          } else {
            return `加载失败: ${error.message || '未知错误'}`;
          }
        },
        finally() {
          loadLock = false; // 确保加载锁被重置
        },
      }
  );
}


let loadLock = false;

const loadMore = async () => {
  if(loadLock) return;
  loadLock = true;

  toast.promise(
      $fetch('/api/memo/list', {
        key: 'memoList',
        method: 'POST',
        body: JSON.stringify({
          user: route.params.id,
          page: state.page + 1 // 先不增加页码
        })
      }), {
        loading: '加载中...',
        success: (data) => {
          if (data.success) {
            state.page += 1; // 成功后增加页码
            if (Array.isArray(data.data)) { // 确保数据是数组
              state.memoList.push(...data.data);
            }
            state.hasNext = data.hasNext;
            return '加载成功';
          } else {
            return '加载失败: ' + data.message;
          }
        },
        error: (error) => {
          if (error.response && error.response.status === 429) {
            return '请求过于频繁，请稍后再试';
          } else {
            return `加载失败: ${error.message || '未知错误'}`;
          }
        },
        finally() {
          loadLock = false; // 确保加载锁被重置
        },
      }
  );
}


</script>

<style scoped></style>
<style>
</style>