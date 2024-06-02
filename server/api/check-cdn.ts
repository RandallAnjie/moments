import { defineEventHandler } from 'h3';
import axios from 'axios';

export default defineEventHandler(async (event) => {
    const siteUrl = new URL(event.req.url, `http://${event.req.headers.host}`).origin;

    // const siteUrl = "https://m.zhuanjie.ltd"

    try {
        const response = await axios.head(siteUrl);
        const headers = response.headers;

        const cdnProviders = {
            'Cloudflare': ['cf-ray', 'cf-visitor'],
            // 'KuDun': ['x-cache', 'x-cdn'],
            'Akamai': ['x-akamai-transformed', 'akamai-x-cache-on'],
            'Fastly': ['x-served-by', 'x-cache', 'x-cache-hits'],
            'CloudFront': ['x-amz-cf-id', 'x-amz-cf-pop'],
            'EdgeCast': ['ec-range', 'edgecast'],
            'Tencent': ['s-tencent'],
            'Alibaba': ['cdn-caching']
        };

        let detectedCDN = null;

        for (const [cdn, keys] of Object.entries(cdnProviders)) {
            if (keys.some(key => key in headers)) {
                detectedCDN = cdn;
                break;
            }
        }

        return { isCDN: detectedCDN !== null, cdn: detectedCDN };
    } catch (error: any) {
        return { isCDN: false, error: error.message };
    }
});