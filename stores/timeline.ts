import { defineStore } from 'pinia';
import type { Memo } from '~/lib/types';

interface TimelineState {
    memoList: Memo[];
    page: number;
    hasNext: boolean;
    scrollTop: number;
    hasCache: boolean;
}

export const useTimelineStore = defineStore('timeline', {
    state: (): TimelineState => ({
        memoList: [],
        page: 1,
        hasNext: false,
        scrollTop: 0,
        hasCache: false,
    }),
    actions: {
        setCache(payload: { memoList: Memo[]; page: number; hasNext: boolean }) {
            this.memoList = payload.memoList;
            this.page = payload.page;
            this.hasNext = payload.hasNext;
            this.hasCache = true;
        },
        setScrollTop(scrollTop: number) {
            this.scrollTop = scrollTop;
        },
        clear() {
            this.memoList = [];
            this.page = 1;
            this.hasNext = false;
            this.scrollTop = 0;
            this.hasCache = false;
        },
    },
});
