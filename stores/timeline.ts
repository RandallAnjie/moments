import { defineStore } from 'pinia';
import type { Memo } from '~/lib/types';

interface TimelineState {
    memoList: Memo[];
    page: number;
    hasNext: boolean;
    // 锚点恢复：返回首页时把视口顶部最近的那个 memo（anchorId）滚回来，
    // 不再用 scrollTop 像素 —— content-visibility: auto 下视口外用 320px 占位估算，
    // 真实高度有偏差，按 scrollTop 落点会偏到别的 memo 上。
    anchorId: number | null;
    anchorOffset: number; // anchor memo 距视口顶部的偏移
    hasCache: boolean;
}

export const useTimelineStore = defineStore('timeline', {
    state: (): TimelineState => ({
        memoList: [],
        page: 1,
        hasNext: false,
        anchorId: null,
        anchorOffset: 0,
        hasCache: false,
    }),
    actions: {
        setCache(payload: { memoList: Memo[]; page: number; hasNext: boolean }) {
            this.memoList = payload.memoList;
            this.page = payload.page;
            this.hasNext = payload.hasNext;
            this.hasCache = true;
        },
        setAnchor(anchorId: number | null, anchorOffset: number) {
            this.anchorId = anchorId;
            this.anchorOffset = anchorOffset;
        },
        clear() {
            this.memoList = [];
            this.page = 1;
            this.hasNext = false;
            this.anchorId = null;
            this.anchorOffset = 0;
            this.hasCache = false;
        },
    },
});
