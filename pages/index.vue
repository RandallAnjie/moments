<template>
  <HeaderImg />
  <div>
    <MemoInput v-if="token" @memo-added="firstLoad"/>
    <div class="flex-1 flex flex-row gap-2 items-center px-10 py-5 input-div" v-if="onlineUsers && onlineUsers!==''">
      {{ onlineUsers }}
    </div>
    <div class="flex-1 flex flex-row gap-2 items-center px-10 py-5 input-div">
      <Input
          v-model="search"
          class="w-full"
          placeholder=""
          @keyup.enter="searchMemo"
      />
      <Button
          variant="outline"
          @click="searchMemo"
      >搜索</Button>
    </div>
    <div class="content flex flex-col gap-0">
      <div v-if="state.memoList.length === 0 && !token" class="text-center">
        <div class="my-2 text-sm">什么也没有,赶紧去登录发表Moments吧!</div>
        <Button @click="navigateTo('/login')">去登录</Button>
      </div>

      <div
        v-for="(memo, idx) in state.memoList"
        :key="memo.id ?? idx"
        class="memo-row border-b border-[#C0BEBF]/10 dark:border-[#2d2d2d]"
      >
        <FriendsMemo
          :memo="memo"
          :show-more="true"
          @memo-update="firstLoad"
        />
      </div>
    </div>

    <div ref="loadMoreSentinel" id="get-more" class="cursor-pointer text-center text-sm opacity-70 my-4" @click="loadMore()" v-if="state.hasNext" >
      加载中...
    </div>
    <div class="cursor-pointer text-center text-sm opacity-70 my-4" v-else>
      ———— 没有更多啦～ ————
    </div>
  </div>
</template>

<script setup lang="ts">
import { type Memo } from '~/lib/types';
import { onMounted, onBeforeUnmount, ref, reactive, nextTick, watch } from 'vue';
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { useTimelineStore } from '~/stores/timeline';

definePageMeta({
  scrollToTop: false,
});

const token = useCookie('token');

const search = ref('');

const searchMemo = async () => {
  if(search.value && search.value!==''){
    navigateTo('/search/'+search.value);
  }
};

const onlineUsers = ref<string>('');
const timelineStore = useTimelineStore();

const state = reactive({
  memoList: [] as Memo[],
  page: 1,
  hasNext: false,
});

const loadMoreSentinel = ref<HTMLElement | null>(null);
let intersectionObserver: IntersectionObserver | null = null;

let scrollSaveTimer: ReturnType<typeof setTimeout> | null = null;
const handleScroll = () => {
  if (scrollSaveTimer) clearTimeout(scrollSaveTimer);
  scrollSaveTimer = setTimeout(() => {
    timelineStore.setScrollTop(window.scrollY);
  }, 150);
};

// 哨兵 v-if="state.hasNext" 控制挂载/卸载；用 watch 跟随 ref 变化，避免在
// onMounted 时刻去 observe 一个尚未挂载的元素（firstLoad 是异步的，且 toast.promise
// 不返回底层 promise，await firstLoad() 实际不等数据回来）。
watch(loadMoreSentinel, (el) => {
  if (intersectionObserver) {
    intersectionObserver.disconnect();
    intersectionObserver = null;
  }
  if (!el) return;
  intersectionObserver = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting && state.hasNext && !loadLock) {
      loadMore();
    }
  }, { rootMargin: '300px' });
  intersectionObserver.observe(el);
});

onMounted(async () => {
  if (timelineStore.hasCache && timelineStore.memoList.length > 0) {
    state.memoList = [...timelineStore.memoList];
    state.page = timelineStore.page;
    state.hasNext = timelineStore.hasNext;
    const savedScrollTop = timelineStore.scrollTop;
    await nextTick();
    window.scrollTo(0, savedScrollTop);
  } else {
    firstLoad();
    welcome();
  }
  window.addEventListener('scroll', handleScroll, { passive: true });
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    timelineStore.setScrollTop(window.scrollY);
    window.removeEventListener('scroll', handleScroll);
    if (intersectionObserver) intersectionObserver.disconnect();
    if (scrollSaveTimer) clearTimeout(scrollSaveTimer);
  }
});

const firstLoad = async () => {
  state.page = 1;
  toast.promise($fetch('/api/memo/list', {
    key: 'memoList',
    method: 'POST',
    body: JSON.stringify({ page: state.page })
  }), {
    loading: '加载中...',
    success: (data) => {
      if (data.success) {
        state.memoList = data.data as Memo[];
        state.hasNext = data.hasNext || false;
        timelineStore.setCache({
          memoList: state.memoList,
          page: state.page,
          hasNext: state.hasNext,
        });
        timelineStore.setScrollTop(0);
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
      loadLock = false;
    }
  });
};

let loadLock = false;

const loadMore = async () => {
  if(loadLock) return;
  loadLock = true;

  toast.promise(
      $fetch('/api/memo/list', {
        key: 'memoList',
        method: 'POST',
        body: JSON.stringify({ page: state.page + 1 })
      }), {
        loading: '加载中...',
        success: (data) => {
          if (data.success) {
            state.page += 1;
            if (Array.isArray(data.data)) {
              state.memoList.push(...data.data);
            }
            state.hasNext = data.hasNext;
            timelineStore.setCache({
              memoList: state.memoList,
              page: state.page,
              hasNext: state.hasNext,
            });
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
          loadLock = false;
        }
      }
  );
};

const welcome = async () => {
  try {
    let tencentMapKey = '';
    const anonymous = JSON.parse(localStorage.getItem('anonymous') || '{}');
    let siteConfig;

    if (anonymous && anonymous.email) {
      siteConfig = await $fetch(`/api/site/config/get?geteventnotification=true&email=${anonymous.email}`);
    } else {
      siteConfig = await $fetch('/api/site/config/get');
    }

    if (siteConfig && siteConfig.success) {
      if (siteConfig.data.notification && siteConfig.data.notification.message.length > 0) {
        setTimeout(() => {
          toast.message('站点通知', { description: siteConfig.data.notification.message });
        }, 5);
      }

      if (siteConfig.data.notificationRecord) {
        siteConfig.data.notificationRecord.forEach((record, index) => {
          setTimeout(() => {
            toast.message('互动通知', { description: record.message });
          }, (index + 1) * 10);
        });
      }

      if (siteConfig.data.enableTencentMap) {
        tencentMapKey = siteConfig.data.tencentMapKey;
      } else {
        return;
      }

      const url = 'https://apis.map.qq.com/ws/location/v1/ip';
      const params = { key: tencentMapKey, output: 'jsonp' };
      const queryString = new URLSearchParams(params).toString();
      const jsonpUrl = `${url}?${queryString}`;

      const { default: jsonp } = await import('jsonp');
      jsonp(jsonpUrl, null, (err, data) => {
        if (err) {
          console.error(err.message);
        } else {
          const ipLocation = data;
          if (ipLocation.status == 0) {
            let pos = ipLocation.result.ad_info.nation;
            let ip;
            let posdesc;

            switch (ipLocation.result.ad_info.nation) {
              case "日本":
                posdesc = "よろしく，一起去看樱花吗";
                break;
              case "美国":
                posdesc = "Let us live in peace!";
                break;
              case "英国":
                posdesc = "想同你一起夜乘伦敦眼";
                break;
              case "俄罗斯":
                posdesc = "干了这瓶伏特加！";
                break;
              case "法国":
                posdesc = "C'est La Vie";
                break;
              case "德国":
                posdesc = "Die Zeit verging im Fluge.";
                break;
              case "澳大利亚":
                posdesc = "一起去大堡礁吧！";
                break;
              case "加拿大":
                posdesc = "拾起一片枫叶赠予你";
                break;
              case "中国":
                pos = ipLocation.result.ad_info.province + " " + ipLocation.result.ad_info.city == ipLocation.result.ad_info.province ? '' : ipLocation.result.ad_info.city + " " + ipLocation.result.ad_info.district;
                ip = ipLocation.result.ip;
                switch (ipLocation.result.ad_info.province) {
                  case "北京市":
                    posdesc = "北——京——欢迎你~~~";
                    break;
                  case "天津市":
                    posdesc = "讲段相声吧";
                    break;
                  case "河北省":
                    posdesc = "山势巍巍成壁垒，天下雄关铁马金戈由此向，无限江山";
                    break;
                  case "山西省":
                    posdesc = "展开坐具长三尺，已占山河五百余";
                    break;
                  case "内蒙古自治区":
                    posdesc = "天苍苍，野茫茫，风吹草低见牛羊";
                    break;
                  case "辽宁省":
                    posdesc = "我想吃烤鸡架！";
                    break;
                  case "吉林省":
                    posdesc = "状元阁就是东北烧烤之王";
                    break;
                  case "黑龙江省":
                    posdesc = "很喜欢哈尔滨大剧院";
                    break;
                  case "上海市":
                    posdesc = "众所周知，中国只有两个城市";
                    break;
                  case "江苏省":
                    switch (ipLocation.result.ad_info.city) {
                      case "南京市":
                        posdesc = "这是我挺想去的城市啦";
                        break;
                      case "苏州市":
                        posdesc = "上有天堂，下有苏杭";
                        break;
                      default:
                        posdesc = "散装是必须要散装的";
                        break;
                    }
                    break;
                  case "浙江省":
                    posdesc = "东风渐绿西湖柳，雁已还人未南归";
                    break;
                  case "河南省":
                    switch (ipLocation.result.ad_info.city) {
                      case "郑州市":
                        posdesc = "豫州之域，天地之中";
                        break;
                      case "南阳市":
                        posdesc = "臣本布衣，躬耕于南阳此南阳非彼南阳！";
                        break;
                      case "驻马店市":
                        posdesc = "峰峰有奇石，石石挟仙气嵖岈山的花很美哦！";
                        break;
                      case "开封市":
                        posdesc = "刚正不阿包青天";
                        break;
                      case "洛阳市":
                        posdesc = "洛阳牡丹甲天下";
                        break;
                      default:
                        posdesc = "可否带我品尝河南烩面啦？";
                        break;
                    }
                    break;
                  case "安徽省":
                    posdesc = "蚌埠住了，芜湖起飞";
                    break;
                  case "福建省":
                    posdesc = "井邑白云间，岩城远带山";
                    break;
                  case "江西省":
                    posdesc = "落霞与孤鹜齐飞，秋水共长天一色";
                    break;
                  case "山东省":
                    posdesc = "遥望齐州九点烟，一泓海水杯中泻";
                    break;
                  case "湖北省":
                    switch (ipLocation.result.ad_info.city) {
                      case "黄冈市":
                        posdesc = "红安将军县！辈出将才！";
                        break;
                      default:
                        posdesc = "来碗热干面~";
                        break;
                    }
                    break;
                  case "湖南省":
                    posdesc = "74751，长沙斯塔克";
                    break;
                  case "广东省":
                    switch (ipLocation.result.ad_info.city) {
                      case "广州市":
                        posdesc = "看小蛮腰，喝早茶了嘛~";
                        break;
                      case "深圳市":
                        posdesc = "今天你逛商场了嘛~";
                        break;
                      case "阳江市":
                        posdesc = "阳春合水！博主家乡~ 欢迎来玩~";
                        break;
                      default:
                        posdesc = "来两斤福建人~";
                        break;
                    }
                    break;
                  case "广西壮族自治区":
                    posdesc = "桂林山水甲天下";
                    break;
                  case "海南省":
                    posdesc = "朝观日出逐白浪，夕看云起收霞光";
                    break;
                  case "四川省":
                    posdesc = "康康川妹子";
                    break;
                  case "贵州省":
                    posdesc = "茅台，学生，再塞200";
                    break;
                  case "云南省":
                    posdesc = "玉龙飞舞云缠绕，万仞冰川直耸天";
                    break;
                  case "西藏自治区":
                    posdesc = "躺在茫茫草原上，仰望蓝天";
                    break;
                  case "陕西省":
                    posdesc = "来份臊子面加馍";
                    break;
                  case "甘肃省":
                    posdesc = "羌笛何须怨杨柳，春风不度玉门关";
                    break;
                  case "青海省":
                    posdesc = "牛肉干和老酸奶都好好吃";
                    break;
                  case "宁夏回族自治区":
                    posdesc = "大漠孤烟直，长河落日圆";
                    break;
                  case "新疆维吾尔自治区":
                    posdesc = "驼铃古道丝绸路，胡马犹闻唐汉风";
                    break;
                  case "台湾省":
                    posdesc = "我在这头，大陆在那头";
                    break;
                  case "香港特别行政区":
                    posdesc = "永定贼有残留地鬼嚎，迎击光非岁玉";
                    break;
                  case "澳门特别行政区":
                    posdesc = "性感荷官，在线发牌";
                    break;
                  default:
                    posdesc = "带我去你的城市逛逛吧！";
                    break;
                }
                break;
              default:
                posdesc = "带我去你的国家逛逛吧";
                break;
            }

            let timeChange;
            let date = new Date();
            if (date.getHours() >= 5 && date.getHours() < 11) timeChange = "️ 早上好，一日之计在于晨";
            else if (date.getHours() >= 11 && date.getHours() < 13) timeChange = "☀️ 中午好，记得午休喔~";
            else if (date.getHours() >= 13 && date.getHours() < 17) timeChange = "🕞 下午好，饮茶先啦！";
            else if (date.getHours() >= 17 && date.getHours() < 19) timeChange = "🚶‍♂️ 即将下班，记得按时吃饭~";
            else if (date.getHours() >= 19 && date.getHours() < 24) timeChange = "🌙 晚上好，夜生活嗨起来！";
            else timeChange = "夜深了，早点休息，少熬夜";

            if (ip.indexOf(":") > -1) {
              ip = "您的IP地址为：IPv6";
            }

            toast(`欢迎来自${pos}的朋友\n${posdesc}🍂\n您的IP地址为：\n${ip}\n${timeChange}`);
          }
        }
      });
    }
  } catch (error: any) {
    console.error('Failed to get ip:', error);
  }
};

</script>

<style scoped>
.input-div {
  border-bottom: rgb(192 190 191 / 0.1) 1px solid;
}
.dark.input-div {
  border-bottom: #2d2d2d 1px solid;
}
/* 浏览器原生 "render-as-needed"：远离视口的 memo 跳过布局/绘制，把它们当 320px 高占位符。
   Chrome 85+ / Safari 18+ / Firefox 125+ 支持；老浏览器降级为正常渲染。
   不破坏 FancyBox 灯箱/showAll/点击/popup —— 因为节点本身一直在 DOM 里 */
.memo-row {
  content-visibility: auto;
  contain-intrinsic-size: 0 320px;
}
</style>
