<template>
  <div class="header relative mb-12">
    <div class="w-full aspect-[3/1] max-h-[300px] overflow-hidden bg-gray-200 dark:bg-gray-800">
      <img
          v-if="user.coverUrl"
          :key="user.headImgKey"
          class="header-img w-full h-full object-cover"
          :src="getImgUrl(user.coverUrl)"
          alt=""
          loading="eager"
          fetchpriority="high"
      />
    </div>
    <div class="absolute right-2 left-2 bottom-[-40px]" style="width: calc(100% - 16px)">
      <div class="userinfo flex flex-col">
        <div class="flex flex-row items-center gap-4 justify-end">
          <div
              :key="user.headImgKey"
              class="username text-lg font-bold text-white"
          >{{ user.nickname }}</div>
          <img
              :key="user.headImgKey"
              :src="getImgUrl(user.avatarUrl)"
              class="avatar w-[70px] h-[70px] rounded-xl"
          />
        </div>
        <div class="flex flex-row items-center gap-4 justify-end">
          <div v-if="shwoWeather">
            <iframe
                scrolling="no"
                src="https://widget.tianqiapi.com/?style=tz&skin=pitaya&color=000"
                frameborder="0"
                width="200"
                height="20"
                allowtransparency="true"
                v-if="colorMode.value === 'light'"
            ></iframe>
            <iframe
                scrolling="no"
                src="https://widget.tianqiapi.com/?style=tz&skin=pitaya&color=fff"
                frameborder="0"
                width="200"
                height="20"
                allowtransparency="true"
                v-if="colorMode.value === 'dark'"
            ></iframe>
          </div>
          <div
              :key="user.headImgKey"
              class="slogon text-gray truncate w-full text-end text-xs mt-2"
          >{{ user.slogan }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { headigUpdateEvent, settingsUpdateEvent } from '~/lib/event';
import { getImgUrl } from '~/lib/utils';
import { onMounted, ref, computed } from 'vue';
const colorMode = useColorMode();
const token = useCookie('token');
const route = useRoute();

const userId = useCookie('userId');
let findId = userId.value;

type HeaderUser = {
  headImgKey: number;
  coverUrl: string;
  nickname: string;
  avatarUrl: string;
  slogan: string;
};

const headerUserCache = useState<Record<string, HeaderUser>>('header-user-cache', () => ({}));
const showWeatherCache = useState<boolean | null>('header-show-weather', () => null);

function getCacheKey(id: any) {
  return id == 'undefined' || id == null ? '0' : String(id);
}

const user = ref<HeaderUser>(
  headerUserCache.value[getCacheKey(findId)] ?? {
    headImgKey: 0,
    coverUrl: '',
    nickname: '',
    avatarUrl: '',
    slogan: ''
  }
);

async function fetchUserData(id: any) {
  const key = getCacheKey(id);
  const response = await $fetch('/api/user/settings/get?user=' + key);
  if (response && response.success) {
    const next: HeaderUser = {
      headImgKey: (user.value.headImgKey ?? 0) + 1,
      coverUrl: response.data.coverUrl,
      nickname: response.data.nickname,
      avatarUrl: response.data.avatarUrl,
      slogan: response.data.slogan
    };
    user.value = next;
    headerUserCache.value[key] = next;
  }
}
const shwoWeather = ref(showWeatherCache.value ?? false);

const preloadHref = computed(() => user.value.coverUrl ? getImgUrl(user.value.coverUrl) : '');
useHead(() => ({
  link: preloadHref.value
    ? [{ rel: 'preload', as: 'image', href: preloadHref.value }]
    : []
}));

onMounted(async () => {
  const url = window.location.pathname;
  if (url.startsWith('/user/')) {
    findId = url.split('/user/')[1];
  }
  const cacheKey = getCacheKey(findId);
  const cached = headerUserCache.value[cacheKey];
  if (cached) {
    user.value = cached;
    // refresh in background so updates eventually propagate
    fetchUserData(findId).catch(() => {});
  } else {
    await fetchUserData(findId);
  }

  if (showWeatherCache.value === null) {
    await $fetch('/api/user/settings/get').then((res) => {
      if (res.success) {
        const v = (res.data.customWeather == "1");
        shwoWeather.value = v;
        showWeatherCache.value = v;
      }
    })
  } else {
    shwoWeather.value = showWeatherCache.value;
  }

});

settingsUpdateEvent.on(async () => {
  await fetchUserData(findId);
});

headigUpdateEvent.on(async (event) => {
  const userId = event.detail.userId + '';
  await fetchUserData(userId);
});
</script>

<style scoped></style>
