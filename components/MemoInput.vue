<template>
  <div class="p-2 sm:p-4 pb-2 border-b dark:border-[#C0BEBF]/10">
    <div class="flex flex-row my-2 ">
      <div class="flex flex-1 gap-2 ">
        <Popover :open="linkOpen">
          <PopoverTrigger as="div">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Link :stroke-width="1.5" class="cursor-pointer w-[20px] h-[20px]" @click="linkOpen = true" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>插入链接</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </PopoverTrigger>
          <PopoverContent as-child @interact-outside="linkOpen = false">
            <div class="flex flex-col gap-2">
              <div class="text-xs my-2 flex justify-between"><span>插入链接</span>
              </div>
              <Input class="my-2" placeholder="请输入链接地址" v-model="externalUrl" />
              <template v-if="externalFetchError">
                <Input class="my-2" placeholder="请输入链接标题" v-model="externalTitle" />
                <Input class="my-2" placeholder="请输入链接图标,选填" v-model="externalFavicon" />
              </template>
              <div class="text-sm my-1" v-if="externalPending">获取信息中...</div>
              <Button size="sm" @click="addLink">提交</Button>
              <Button size="sm" class="ml-2" variant="secondary" @click="clearExternalUrl()">清空并关闭</Button>
            </div>
          </PopoverContent>
        </Popover>
        <Popover :open="music163Open">
          <PopoverTrigger as="div">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Music4 :stroke-width="1.5" class="cursor-pointer w-[20px] h-[20px]" @click="music163Open = true" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>插入音乐</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

          </PopoverTrigger>
          <PopoverContent as-child @interact-outside="music163Open = false">
            <div @keyup.enter="importMusic()">
              <div class="flex flex-col space-y">
                <div class=" text-xs my-2 flex justify-between">
                  <span>插入音乐</span>
                  <div class="tooltip">
                  <span class="tooltip-text">
                    目前只支持粘贴网易云音乐和qq音乐的分享链接，暂不支持qq分享短链接，请自行粘贴qq分享链接到浏览器，跳转后复制跳转后的qq链接
                  </span>
                    <div class="circle">
                      <span class="exclamation">!</span>
                    </div>
                  </div>
                </div>
                <Input class="my-2" placeholder="请输入网易云音乐代码" v-model="music163Url" />
              </div>
              <Button size="sm" class="mr-2" @click="importMusic">确定</Button>
              <Button size="sm" variant="ghost"
                      @click="music163Url = ''; music163Url = ''; audioUrl = ''; music163Open = false;">清空</Button>
            </div>
          </PopoverContent>
        </Popover>


        <Label for="imgUpload">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Image :stroke-width="1.5" class="cursor-pointer w-[20px] h-[20px]" />
              </TooltipTrigger>
              <TooltipContent>
                <p>上传本地图片</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <input type="file" id="imgUpload" class="hidden" name="file" @change="uploadImgs">
        </Label>

      </div>
      <div class="flex flex-row gap-2">
        <Button
            @click="submitMemo"
            :disabled="(!content) && imgs.length === 0"
        >提交</Button>
      </div>
    </div>
    <div class="relative">
      <Textarea ref="textareaRef" @paste="pasteImg" autocomplete="new-text" v-model="content" rows="4" @keyup.ctrl.enter="submitMemo()"
                placeholder="今天发点什么呢?" class=" dark:text-[#C0BEBF]"></Textarea>
    </div>
    <div class="flex flex-row gap-2 my-2 bg-[#f7f7f7] dark:bg-[#212121] items-center p-2 border rounded"
         v-if="externalFavicon && externalTitle">
      <div class="flex-1 flex flex-row gap-2 items-center"><img class="w-8 h-8" :src="externalFavicon" alt="">
        <div class="text-sm text-[#576b95] cursor-pointer" v-if="!externalTitleEditing" title="点击编辑标题"
             @click="externalTitleEditing = true">{{ externalTitle }}</div>
        <Input placeholder="请输入链接标题" v-model="externalTitle" v-if="externalTitleEditing" />
      </div>
      <Check class="w-5 h-5 mr-2 cursor-pointer" color="green" v-if="externalTitleEditing"
             @click="externalTitleEditing = false" />
      <CircleX class="w-5 h-5 cursor-pointer" color="red" @click="clearExternalUrl" />
    </div>

    <div class="grid grid-cols-3 my-2 gap-2" v-if="imgs && imgs.length > 0">
      <div v-for="(img, index) in imgs" :key="index" class="relative" draggable="true"
           @dragstart="event => dragStart(event, index)"
           @dragover="dragOver"
           @drop="event => drop(event, index)">
        <img :src="getImgUrl(img)" class="rounded object-cover h-full aspect-square max-h-[200px] cursor-grab" />
        <Trash2 color="#379d1b" :size="15" class="absolute top-1 right-1 cursor-pointer"
                @click="imgs.splice(index, 1)" />
      </div>
    </div>

    <div style="max-width: 100%">
      <ClientOnly>
        <meting-js
            :key="musicBoxKey"
            :server="musicPlatform"
            :type="musicType"
            :id="musicId"
            :list-folded="true"
            v-if="music163Url && musicType && musicId"
        />
      </ClientOnly>
    </div>

    <div style="margin: 10px 10px;">
      <div class="flex flex-row justify-between items-center gap-2 memo-info-list">
        <div class="text-sm flex flex-row gap-1 flex-1 items-center">
          <Popover>
            <PopoverTrigger style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
              <div style="display: flex; align-items: center;">
                <svg t="1715337116609" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4287" width="32" height="32"><path d="M512 427.023m-90 0a90 90 0 1 0 180 0 90 90 0 1 0-180 0Z" fill="#2c2c2c" p-id="4288"></path><path d="M512 910.402c-19.14 0-37.482-5.854-53.042-16.929-14.063-10.01-24.926-23.596-31.589-39.46L255.043 585.177l-0.154-0.25C225.522 537.209 210 482.605 210 427.021c0-80.667 31.414-156.506 88.454-213.546S431.333 125.021 512 125.021s156.506 31.414 213.546 88.454C782.587 270.515 814 346.354 814 427.021c0 55.849-15.655 110.671-45.274 158.539l-0.264 0.419-172.081 268.716c-6.755 15.726-17.66 29.176-31.704 39.055-15.485 10.895-33.7 16.652-52.677 16.652zM309.246 551.141l175.494 273.78 1.194 3.197c4.149 11.107 14.381 18.284 26.066 18.284 11.584 0 21.791-7.071 26.004-18.015l1.165-3.028L714.43 551.678C737.701 513.983 750 470.884 750 427.021c0-63.572-24.756-123.339-69.709-168.292-44.952-44.951-104.719-69.708-168.291-69.708s-123.339 24.756-168.292 69.708S274 363.449 274 427.021c0 43.64 12.186 86.552 35.246 124.12z" fill="#2c2c2c" p-id="4289"></path></svg>
                <div class="text-sm cursor-pointer">所在位置</div>
              </div>
              <div class="text-[#576b95] text-sm cursor-pointer">{{ fmtLocation }}</div>
            </PopoverTrigger>
            <PopoverContent class="w-auto">
              <div class="flex flex-row gap-2 text-sm">
                <Input
                    v-model="locationInfo"
                    class="w-full"
                    placeholder="请输入位置信息"
                    v-if="showLocationInput"
                />
                <Button variant="outline" @click="updateLocation">自动获取</Button>
                <Button variant="outline" @click="locationInfo = ''">清空</Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div class="flex flex-row justify-between items-center gap-2 memo-info-list">
        <div class="text-sm flex flex-row gap-1 flex-1 items-center">
          <Popover>
            <PopoverTrigger style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                <div style="display: flex; align-items: center;">
                  <svg t="1715337381411" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6551" width="32" height="32"><path d="M597.696 426.944c-0.032 1.28-0.896 8.128-9.344 41.952l-22.304 84.384c-7.136 24.96-22.624 47.68-46.144 67.52-24.992 21.44-50.336 32.32-75.36 32.32-21.952 0-38.848-7.584-51.872-23.456-12.32-14.016-18.592-34.432-18.592-60.672 0-61.12 17.44-112.704 51.776-153.184l0.16-0.192c31.776-39.104 67.712-58.08 109.952-58.08 19.616 0 34.4 7.616 45.536 23.776 10.88 14.304 16.192 29.28 16.192 45.632m277.696 248.416a11.2 11.2 0 0 0-9.76-5.728h-53.504a11.2 11.2 0 0 0-9.12 4.704c-27.36 38.56-64.32 70.112-109.664 93.76-52.608 26.272-114.72 39.616-184.64 39.616-91.264 0-165.888-26.464-221.76-78.56-56.384-53.952-84.992-129.76-84.992-225.28 0-89.184 29.632-163.712 88.192-221.632 57.824-58.464 131.68-88.064 219.52-88.064 82.208 0 149.312 24.448 199.264 72.544C755.776 313.6 779.52 372.416 779.52 441.6c0 58.72-17.856 111.04-52.896 155.328-30.08 36.64-59.52 55.2-87.616 55.2-17.472 0-18.944-7.136-18.944-15.04 0-14.304 3.424-31.776 10.336-52.576L700.448 320a11.2 11.2 0 0 0-10.816-14.048h-48.64a11.2 11.2 0 0 0-10.784 8.16l-7.744 27.296c-19.584-35.808-50.88-53.92-93.312-53.92-60.896 0-114.496 27.2-159.136 80.64-47.04 53.696-70.848 120.96-70.848 199.904 0 43.52 13.088 80.064 38.72 108.512 25.504 28.992 60.384 43.712 103.776 43.712 45.504 0 86.176-18.464 121.152-54.912 11.648 43.072 44.128 52.928 71.36 52.928 51.296 0 99.712-27.52 144.064-82.144 44.768-58.144 67.456-123.584 67.456-194.528 0-88.864-29.216-163.168-86.88-220.8C697.92 159.168 615.04 128 512.64 128c-110.88 0-203.84 37.12-276.256 110.176C164.48 308.8 128 397.536 128 501.92c0 110.88 35.52 201.6 105.6 269.696 69.92 66.56 162.464 100.32 275.136 100.32 79.872 0 153.216-16.768 218.016-49.824 63.2-31.936 113.12-77.504 148.416-135.456a11.168 11.168 0 0 0 0.224-11.296" fill="#3E3A39" p-id="6552"></path></svg>
                  <div class="text-sm cursor-pointer">提醒谁看</div>
                </div>
                <div class="text-[#576b95] text-sm cursor-pointer">{{ fmtAite }}</div>
            </PopoverTrigger>
            <PopoverContent class="w-80">
              <div class="flex flex-row gap-2 text-sm">
                <TagsInputRoot
                    v-model="atpeople"
                    class="flex gap-2 items-center border p-2 rounded-lg w-full max-w-[480px] flex-wrap border-blackA7"
                >
                  <TagsInputItem v-for="item in atpeopleNickname" :key="item" :value="item" class=" flex shadow-md items-center justify-center gap-2 bg-green8 aria-[current=true]:bg-green9 rounded p-1">
                    <TagsInputItemText class="text-sm pl-1" />
                    <TagsInputItemDelete
                        class="p-0.5 rounded bg-transparent hover:bg-blackA4"
                        @click="atpeople.splice(atpeopleNickname.indexOf(item), 1);atpeopleNickname.splice(atpeopleNickname.indexOf(item), 1);"
                    >
                      X
                    </TagsInputItemDelete>
                  </TagsInputItem>
                  <ComboboxRoot v-model="v" class="relative">
                    <ComboboxAnchor class="min-w-[160px] inline-flex items-center justify-between rounded px-[15px] text-[13px] leading-none h-[35px] gap-[5px] text-grass11 shadow-[0_2px_10px] shadow-black/10 hover:bg-mauve3 focus:shadow-[0_0_0_2px] focus:shadow-black data-[placeholder]:text-grass9 outline-none">
                      <ComboboxInput
                          :modelValue="inputs0"
                          @input="handleInputDebounced(0, inputs0)"
                          @compositionstart="composing=true"
                          @compositionend="composing = false;handleInputDebounced(0, inputs0)"
                          @keydown.enter.prevent
                          class="!bg-transparent outline-none text-grass11 h-full selection:bg-grass5 placeholder-mauve8"
                          placeholder="请输入需要查询的用户"
                      />
                    </ComboboxAnchor>

                    <ComboboxContent class="absolute z-10 w-full mt-2 min-w-[200px] bg-white dark:bg-black overflow-hidden rounded shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)] will-change-[opacity,transform] data-[side=top]:animate-slideDownAndFade data-[side=right]:animate-slideLeftAndFade data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade">
                      <ComboboxViewport class="p-[5px]">
                        <ComboboxEmpty class="text-mauve8 text-xs font-medium text-center py-2" />

                        <ComboboxGroup>

                          <ComboboxItem
                              v-for="(option, index) in state.options" :key="index"
                              class="text-[13px] leading-none text-grass11 rounded-[3px] flex items-center h-[25px] pr-[35px] pl-[25px] relative select-none data-[disabled]:text-mauve8 data-[disabled]:pointer-events-none data-[highlighted]:outline-none data-[highlighted]:bg-grass9 data-[highlighted]:text-grass1"
                              :value="option"
                              @click="if(atpeople.indexOf(option.id) === -1){atpeopleNickname.push(option.nickname);atpeople.push(option.id); inputs0 = '';judgeAtSafty();}"
                          >
                            <ComboboxItemIndicator
                                class="absolute left-0 w-[25px] inline-flex items-center justify-center"
                            >
                            </ComboboxItemIndicator>
                            <img :src="option.avatarUrl" class="w-[20px] h-[20px] rounded-full" />
                            <span>
                            {{ option.nickname }}
                          </span>
                            <span style="color: #999; font-size: 12px;margin-left: 5px">
                            id：{{ option.id }}
                          </span>
                          </ComboboxItem>
                          <ComboboxSeparator class="h-[1px] bg-grass6 m-[5px]" />
                        </ComboboxGroup>
                      </ComboboxViewport>
                    </ComboboxContent>
                  </ComboboxRoot>
                </TagsInputRoot>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div class="flex flex-row justify-between items-center gap-2 memo-info-list">
        <div class="text-sm flex flex-row gap-1 flex-1 items-center">
          <Popover>
            <PopoverTrigger style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
              <div style="display: flex; align-items: center;">
                <svg t="1715415328668" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4310" width="32" height="32"><path d="M652.8 534.4C723.2 489.6 768 409.6 768 320c0-140.8-115.2-256-256-256S256 179.2 256 320c0 89.6 44.8 169.6 115.2 214.4C192 592 64 761.6 64 960h64c0-211.2 172.8-384 384-384s384 172.8 384 384h64c0-198.4-128-368-307.2-425.6zM512 512c-105.6 0-192-86.4-192-192s86.4-192 192-192 192 86.4 192 192-86.4 192-192 192z" fill="#333333" p-id="4311"></path></svg>
                <div class="text-sm cursor-pointer">谁可以看</div>
              </div>
              <div class="text-[#576b95] text-sm cursor-pointer">{{ fmtAvailable }}</div>
            </PopoverTrigger>
            <PopoverContent class="w-80">
              <div class="flex flex-row gap-2 text-sm">
                <TagsInputRoot
                    v-model="avpeople"
                    class="flex gap-2 items-center border p-2 rounded-lg w-full max-w-[480px] flex-wrap border-blackA7"
                >
                  <TagsInputItem v-for="item in avpeopleNickname" :key="item" :value="item" class=" flex shadow-md items-center justify-center gap-2 bg-green8 aria-[current=true]:bg-green9 rounded p-1">
                    <TagsInputItemText class="text-sm pl-1" />
                    <TagsInputItemDelete
                        class="p-0.5 rounded bg-transparent hover:bg-blackA4"
                        @click="avpeople.splice(avpeopleNickname.indexOf(item), 1);avpeopleNickname.splice(avpeopleNickname.indexOf(item), 1);if(atpeopleNickname.indexOf(item)>0){atpeople.splice(atpeopleNickname.indexOf(item), 1);atpeopleNickname.splice(atpeopleNickname.indexOf(item), 1);}"
                    >
                      X
                    </TagsInputItemDelete>
                  </TagsInputItem>
                  <ComboboxRoot v-model="v" class="relative">
                    <ComboboxAnchor class="min-w-[160px] inline-flex items-center justify-between rounded px-[15px] text-[13px] leading-none h-[35px] gap-[5px] text-grass11 shadow-[0_2px_10px] shadow-black/10 hover:bg-mauve3 focus:shadow-[0_0_0_2px] focus:shadow-black data-[placeholder]:text-grass9 outline-none">
                      <ComboboxInput
                          :modelValue="inputs1"
                          @input="handleInputDebounced(1, inputs1)"
                          @compositionstart="composing = true"
                          @compositionend="composing = false;handleInputDebounced(1, inputs1)"
                          @keydown.enter.prevent
                          class="!bg-transparent outline-none text-grass11 h-full selection:bg-grass5 placeholder-mauve8"
                          placeholder="请输入需要查询的用户"
                      />
                    </ComboboxAnchor>

                    <ComboboxContent class="absolute z-10 w-full mt-2 min-w-[200px] bg-white dark:bg-black overflow-hidden rounded shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)] will-change-[opacity,transform] data-[side=top]:animate-slideDownAndFade data-[side=right]:animate-slideLeftAndFade data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade">
                      <ComboboxViewport class="p-[5px]">
                        <ComboboxEmpty class="text-mauve8 text-xs font-medium text-center py-2" />

                        <ComboboxGroup>

                          <ComboboxItem
                              v-for="(option, index) in state.options" :key="index"
                              class="text-[13px] leading-none text-grass11 rounded-[3px] flex items-center h-[25px] pr-[35px] pl-[25px] relative select-none data-[disabled]:text-mauve8 data-[disabled]:pointer-events-none data-[highlighted]:outline-none data-[highlighted]:bg-grass9 data-[highlighted]:text-grass1"
                              :value="option"
                              @click="if(avpeople.indexOf(option.id) === -1){avpeopleNickname.push(option.nickname);avpeople.push(option.id); inputs1 = '';judgeAtSafty();}"
                          >
                            <ComboboxItemIndicator
                                class="absolute left-0 w-[25px] inline-flex items-center justify-center"
                            >
                            </ComboboxItemIndicator>
                            <img :src="option.avatarUrl" class="w-[20px] h-[20px] rounded-full" />
                            <span>
                            {{ option.nickname }}
                          </span>
                            <span style="color: #999; font-size: 12px;margin-left: 5px">
                            id：{{ option.id }}
                          </span>
                          </ComboboxItem>
                          <ComboboxSeparator class="h-[1px] bg-grass6 m-[5px]" />
                        </ComboboxGroup>
                      </ComboboxViewport>
                    </ComboboxContent>
                  </ComboboxRoot>
                </TagsInputRoot>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div class="flex flex-row justify-between items-center gap-2 memo-info-list" style="">
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getImgUrl, insertTextAtCursor } from '~/lib/utils';
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { memoUpdateEvent, memoAddEvent } from '@/lib/event'
import type { Memo } from '~/lib/types';
import { useAnimate } from '@vueuse/core';
import { Image, Music4, Settings, Trash2, LogOut,  Link, Youtube, CircleX, Check, FileSliders } from 'lucide-vue-next'
import { ref } from 'vue';
import {toast} from "vue-sonner";
import {
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
  TagsInputRoot,
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxLabel,
  ComboboxRoot,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxViewport
} from "radix-vue";
import {memo} from "@tanstack/virtual-core";
import { useState, useAsyncData } from '#imports';
const locationInfo = ref('');
const inputs0 = ref('');
const inputs1 = ref('');
let musicBoxKey = ref(0)

const v = ref('')

const state = reactive({
  options: Array<any>(),
  // page: 1,
  // hasNext: false
})
let composing = false;

let debounceTimer: any = null;

const handleInputDebounced = (withMe: number, inputs: string) => {
  clearTimeout(debounceTimer);
  const value = event.target.value;
  debounceTimer = setTimeout(() => handleInput(withMe, value), 300); // 300ms为防抖时间，可以根据实际需求调整
};

const handleInput = (withMe: number, value: string) => {
  if (composing) {
    return;
  }
  const inputs = withMe === 0 ? inputs0 : inputs1;
  inputs.value = value;
  if (inputs.value === '') {
    state.options = [];
    return;
  }
  $fetch('/api/user/list', {
    method: 'POST',
    body: JSON.stringify({
      find: inputs.value,
      withMe: withMe,
    })
  }).then((res) => {
    if (res.success) {
      state.options = res.data;
    } else {
      state.options = [];
    }
  });
};

const textareaRef = ref()
const showEmojiRef = ref<HTMLElement>()
const keyframes = { transform: 'rotate(360deg)' }
const showEmoji = ref(false)
const emit = defineEmits(['memo-added'])

const music163Url = ref('')
const musicType = ref('')
const musicId = ref('')
const musicPlatform = ref('netease')

const importMusic = () => {
  if(music163Url.value.includes("music.163.com")){
    // 如果里面有playlist
    if(music163Url.value.includes("playlist")){
      musicType.value = 'playlist'
      musicId.value = music163Url.value.split('playlist?id=')[1].split('&')[0]
    }else if(music163Url.value.includes("song")){
      musicType.value = 'song'
      musicId.value = music163Url.value.split('song?id=')[1].split('&')[0]
    }else if(music163Url.value.includes("album")) {
      musicType.value = 'album'
      musicId.value = music163Url.value.split('album?id=')[1].split('&')[0]
    }
  }else if(music163Url.value.includes("y.qq.com")){
    musicPlatform.value = 'tencent'
    if(music163Url.value.includes("songDetail")){
      musicType.value = 'song'
      musicId.value = music163Url.value.split('songDetail/')[1].split('?')[0]
    }else if(music163Url.value.includes("playlist")){
      musicType.value = 'playlist'
      musicId.value = music163Url.value.split('playlist/')[1].split('?')[0]
    }
  }else{
    music163Url.value = ''
  }
  music163Open.value = false
  musicBoxKey++
}

const toggleShowEmoji = () => {
  showEmoji.value = !showEmoji.value
  useAnimate(showEmojiRef.value, keyframes, { duration: 1000, easing: 'ease-in-out' })
}
const fmtLocation = computed(() => {
  if (locationInfo.value) {
    return locationInfo.value.split(' ').join(' · ')
  }
  return ''
})

const fmtAite = computed(() => {
  if(atpeopleNickname.value.length > 0) {
    return '提醒: ' + atpeopleNickname.value.join('、')
  }
  return ''
})

const fmtAvailable = computed(() => {
  if(avpeopleNickname.value.length > 0) {
    if(avpeople.value.length === 1 && avpeople.value[0] === userId.value) {
      return '私密'
    }
    return '仅: ' + avpeopleNickname.value.join('、') + '可见'
  }
  return '公开'
})

const content = ref('')
const id = ref(-1)

const linkOpen = ref(false)
const externalUrl = ref('')
const externalTitle = ref('')
const externalFavicon = ref('')
const externalPending = ref(false)
const externalFetchError = ref(false)
const externalTitleEditing = ref(false)
const music163Open = ref(false)

let shouConfigButton = false
let userId = ref(0)
userId = useCookie('userId') || 0
if (userId.value === 1) {
  shouConfigButton = true
}
const clearExternalUrl = () => {
  externalUrl.value = ''
  externalTitle.value = ''
  externalFavicon.value = ''
  linkOpen.value = false
  externalFetchError.value = false
}
const addLink = async () => {
  if (externalFetchError.value && externalTitle.value === '') {
    toast.warning('请填写标题和图标')
    return
  }
  if (externalFetchError.value && externalTitle.value !== '') {
    externalFetchError.value = false
    linkOpen.value = false
    externalPending.value = false
    externalFavicon.value = externalFavicon.value || '/favicon.png'
    return
  }
  externalPending.value = true
  externalFetchError.value = false
  const { data: res } = await useAsyncData('external_' + externalUrl.value, async () => {
    return await $fetch('/api/memo/readExternal', {
      method: 'POST',
      body: JSON.stringify({ url: externalUrl.value })
    })
  })
  if (res.value?.success) {
    externalTitle.value = res.value?.title || '无法获取标题'
    externalFavicon.value = res.value?.favicon || '/favicon.png'
    linkOpen.value = false
    externalPending.value = false
  } else {
    toast.warning('获取失败: ' + res.value?.message)
    externalPending.value = false
    externalFetchError.value = true
  }
}



const dragStart = (event, index) => {
  event.dataTransfer.setData('text/plain', index);
}

const dragOver = (event) => {
  event.preventDefault();
}

const drop = (event, dropIndex) => {
  event.preventDefault();
  const dragIndex = event.dataTransfer.getData('text/plain');
  const dragImg = imgs.value[dragIndex];
  imgs.value.splice(dragIndex, 1);  // 删除被拖拽的图片
  imgs.value.splice(dropIndex, 0, dragImg);  // 在放置位置插入被拖拽的图片
}


const imgs = ref<string[]>([])
const atpeople = ref<number[]>([])
const atpeopleNickname = ref<string[]>([])

const avpeople = ref<number[]>([])
const avpeopleNickname = ref<string[]>([])

const submitMemo = async () => {
  if (content.value === '') {
    toast.warning('请输入内容')
    return
  }
  judgeAtSafty()
  const body = {
    id: id.value,
    content: content.value,
    imgUrls: imgs.value,
    atpeople: atpeople.value,
    avpeople: avpeople.value,
    location: locationInfo.value,
    externalFavicon: externalFavicon.value,
    externalTitle: externalTitle.value,
    externalUrl: externalUrl.value,
    music163Url: music163Url.value
  }
  toast.promise($fetch('/api/memo/save', {
        method: 'POST',
        body: JSON.stringify(body)
      }), {
        loading: '提交中...',
        success: (data) => {
          if (data.success) {
          //   if(data.id>0){
          //     location.reload();
          //     return '提交成功';
          //   }
            memoAddEvent.emit(data.id, {data:body,atpeopleNickname:atpeopleNickname.value,avpeopleNickname:avpeopleNickname.value})
            if(!body.id || body.id <= 0){
              location.reload();
            }
            content.value = ''
            id.value = -1
            imgs.value = []
            atpeople.value = []
            atpeopleNickname.value = []
            avpeople.value = []
            avpeopleNickname.value = []
            locationInfo.value = ''
            externalFavicon.value = ''
            externalTitle.value = ''
            externalUrl.value = ''
            showEmoji.value = false
            music163Open.value = false
            music163Url.value = ''
            emit('memo-added')
            return '提交成功';
          } else {
            throw new Error(data.message)
          }
        },
        error: (error) => `提交失败: ${error || '未知错误'}`,
      }
  );
}

const pasteImg = async (event: ClipboardEvent) => {
  var items = event.clipboardData?.files
  if (!items || items.length === 0) {
    return;
  }
  await useUpload(items[0], async (res) => {
    if (res.success) {
      imgs.value = [...imgs.value, res.filename]
    } else {
      toast.warning('上传失败' + res.message)
    }
  })
}

const uploadImgs = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) {
    return
  }

  await useUpload(file, async (res) => {
    if (res.success) {
      (event.target as HTMLInputElement).value = ''
      imgs.value = [...imgs.value, res.filename]
    } else {
      toast.warning('上传失败' + res.message)
    }
  })
}

memoUpdateEvent.on((event: Memo) => {
  content.value = event.content
  id.value = event.id
  if (event.imgs) {
    imgs.value = event.imgs?.split(',')
  }
  if(event.atpeople) {
    atpeopleNickname.value = []
    atpeople.value = event.atpeople.split(',').map(Number)
    for (let i = 0; i < atpeople.value.length; i++) {
      $fetch('/api/user/settings/get?user='+atpeople.value[i]).then((res: any) => {
        if (res.success) {
          atpeopleNickname.value.push(res.data.nickname)
        }
      })
    }
  }
  if(event.avpeople) {
    avpeopleNickname.value = []
    avpeople.value = event.avpeople.split(',').map(Number)
    for (let i = 0; i < avpeople.value.length; i++) {
      $fetch('/api/user/settings/get?user='+avpeople.value[i]).then((res: any) => {
        if (res.success) {
          avpeopleNickname.value.push(res.data.nickname)
        }
      })
    }
  }
  locationInfo.value = event.location || ''
  externalFavicon.value = event.externalFavicon || ''
  externalTitle.value = event.externalTitle || ''
  externalUrl.value = event.externalUrl || ''
  music163Url.value = event.music163Url || ''
  if(music163Url.value.includes("music.163.com")){
    // 如果里面有playlist
    if(music163Url.value.includes("playlist")){
      musicType.value = 'playlist'
      musicId.value = music163Url.value.split('playlist?id=')[1].split('&')[0]
    }else if(music163Url.value.includes("song")){
      musicType.value = 'song'
      musicId.value = music163Url.value.split('song?id=')[1].split('&')[0]
    }else if(music163Url.value.includes("album")) {
      musicType.value = 'album'
      musicId.value = music163Url.value.split('album?id=')[1].split('&')[0]
    }
  }else if(music163Url.value.includes("y.qq.com")){
    musicPlatform.value = 'tencent'
    if(music163Url.value.includes("songDetail")){
      musicType.value = 'song'
      musicId.value = music163Url.value.split('songDetail/')[1].split('?')[0]
    }else if(music163Url.value.includes("playlist")){
      musicType.value = 'playlist'
      musicId.value = music163Url.value.split('playlist/')[1].split('?')[0]
    }
  }else{
    music163Url.value = ''
  }
  music163Open.value = false
  musicBoxKey++
})
const showLocationInput = ref(false)
onMounted(async () => {
  // 走 SPA 级缓存，整个会话只发一次（跟 FriendsMemo / HeaderImg 共用）
  const settings = await useSiteSettings().fetchSettings()
  if (settings?.success) {
    showLocationInput.value = (settings.data.customLocation == "1")
  }
})

const getTmpLocation = async () => {
  return new Promise(async (resolve, reject) => {
    try {
      let tencentMapKey: string = '';
      const siteConfig = await $fetch('/api/site/config/get')
      if (siteConfig && siteConfig.success && siteConfig.data && siteConfig.data.enableTencentMap) {
        tencentMapKey = siteConfig.data.tencentMapKey?.trim() || '';
      } else {
        reject('当前站点未开启地图服务，请手动输入位置或者联系管理员开启地图服务');
      }
      const url = 'https://apis.map.qq.com/ws/location/v1/ip';
      const params = {
        key: tencentMapKey,
        output: 'jsonp'
      };
      const queryString = new URLSearchParams(params).toString();
      const jsonpUrl = `${url}?${queryString}`;
      const { default: jsonp } = await import('jsonp');
      jsonp(jsonpUrl, null, (err: any, data: any) => {
        if (err) {
          return '获取位置失败';
        } else {
          const ipLocation = data;
          if (ipLocation.status === 0) {
            let pos = ipLocation.result.ad_info.nation;
            if (ipLocation.result.ad_info.province !== undefined && ipLocation.result.ad_info.province !== '') {
              pos += '-' + ipLocation.result.ad_info.province;
            }
            if (ipLocation.result.ad_info.city !== undefined && ipLocation.result.ad_info.city !== '' && ipLocation.result.ad_info.city !== ipLocation.result.ad_info.province) {
              pos += '-' + ipLocation.result.ad_info.city;
            }
            if (ipLocation.result.ad_info.district !== undefined && ipLocation.result.ad_info.district !== '') {
              pos += '-' + ipLocation.result.ad_info.district;
            }
            if (ipLocation.result.address_reference !== undefined && ipLocation.result.address_reference !== '') {
              if (ipLocation.result.address_reference.famous_area !== undefined && ipLocation.result.address_reference.famous_area !== '') {
                pos += ' ' + ipLocation.result.address_reference.famous_area.title;
              } else if (ipLocation.result.address_reference.business_area !== undefined && ipLocation.result.address_reference.business_area !== '') {
                pos += ' ' + ipLocation.result.address_reference.town.title;
              } else if (ipLocation.result.address_reference.town !== undefined && ipLocation.result.address_reference.town !== '') {
                pos += ' ' + ipLocation.result.address_reference.town.title;
              } else if (ipLocation.result.address_reference.landmark_l1 !== undefined && ipLocation.result.address_reference.landmark_l1 !== '') {
                pos += ' ' + ipLocation.result.address_reference.town.title;
              } else if (ipLocation.result.address_reference.landmark_l2 !== undefined && ipLocation.result.address_reference.landmark_l2 !== '') {
                pos += ' ' + ipLocation.result.address_reference.town.title;
              } else if (ipLocation.result.address_reference.street !== undefined && ipLocation.result.address_reference.street !== '') {
                pos += ' ' + ipLocation.result.address_reference.town.title;
              } else if (ipLocation.result.address_reference.street_number !== undefined && ipLocation.result.address_reference.street_number !== '') {
                pos += ' ' + ipLocation.result.address_reference.town.title;
              } else if (ipLocation.result.address_reference.crossroad !== undefined && ipLocation.result.address_reference.crossroad !== '') {
                pos += ' ' + ipLocation.result.address_reference.town.title;
              } else if (ipLocation.result.address_reference.water !== undefined && ipLocation.result.address_reference.water !== '') {
                pos += ' ' + ipLocation.result.address_reference.town.title;
              } else if (ipLocation.result.address_reference.ocean !== undefined && ipLocation.result.address_reference.ocean !== '') {
                pos += ' ' + ipLocation.result.address_reference.town.title;
              }
            }
            resolve(pos);
          }
        }
        reject('获取位置失败');
      });
    } catch (error) {
      console.error(error);
    }
  });
}

async function updateLocation() {
  try {
    toast.promise(getTmpLocation(), {
      loading: '获取位置中...',
      success: (data: any) => {
        typeof data === "string" ? locationInfo.value = data : locationInfo.value = ''
        return '获取位置成功';
      },
      error: (error: any) => {
        locationInfo.value = '';
        return error;
      }
    });
  } catch (error) {
    console.error(error);
  }
}

const judgeAtSafty = () => {
  if(avpeople.value.length > 0) {
    for(let i = 0; i < atpeople.value.length; i++) {
      if(avpeople.value.indexOf(atpeople.value[i]) === -1) {
        avpeople.value.push(atpeople.value[i]);
        avpeopleNickname.value.push(atpeopleNickname.value[i]);
      }
    }
  }
}

</script>

<style scoped>
.full-cover-image-mult {
  object-fit: cover;
  object-position: center;
  width: 100%;
  aspect-ratio: 1 / 1;
  border: transparent 1px solid;
}
.memo-info-list{
  border-top: 1px solid grey;
  border-bottom: none; border-left: none;
  border-right: none;
  padding: 5px;
}
img{
  pointer-events: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -webkit-user-select:none;
  -o-user-select:none;
  user-select:none;
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

.aplayer-body {
  max-width: 100%; /* 限制宽度不超过父容器 */
  width: 100%; /* 自动调整宽度 */
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
  margin-top: 25px !important; /* 调整歌词与播放器的间距 */
}

</style>