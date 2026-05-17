import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Cloudflare Image Transformations：CF 边缘现场把 HEIC / 大图按浏览器支持
// 自动转成 WebP / AVIF / JPEG 并按 CDN 缓存。
//   /cdn-cgi/image/<options>/<source>
//   format=auto      → 按 Accept 头选 webp/avif/jpeg（HEIC 输入也支持）
//   onerror=redirect → 转换失败时回原图，避免单图挂掉
//
// 启用步骤（首次）：
//   1. Cloudflare 仪表盘 → 选你的 zone（randallanjie.com）→ Speed → Optimization
//      → Image Optimization → "Image Transformations" → Enable
//      或新仪表盘：Images → Transformations → Enable for zone
//   2. 在 Pages 项目里加环境变量 CF_IMAGE_TRANSFORM=on（Production + Preview）
//      或者 wrangler pages secret put CF_IMAGE_TRANSFORM
//   3. 重新部署
// 未启用时这里直接返回原 URL，避免域名上没开导致全站图 404。
const CF_IMG_PREFIX = '/cdn-cgi/image/format=auto,onerror=redirect';

function runtimeConf() {
  try {
    // @ts-ignore Nuxt 自动注入 useRuntimeConfig
    return useRuntimeConfig?.() ?? null;
  } catch { return null; }
}

/**
 * 把 /upload/<key> 这种相对路径重写到 R2 公网 URL，让浏览器直接拉，
 * 不走 Worker 的 server/routes/upload/[filename].get.ts —— 这样：
 *   - 不再消耗一次 Worker 请求（Cloudflare 按请求计费）
 *   - 不再走 R2 binding read（少一次 Class B op）
 *   - 浏览器拿到的 URL 是稳定的，HTTP 缓存命中率更高
 * 没配 R2_PUBLIC_BASE_URL 就保持原样，由 Worker 路由 fallback。
 */
function rewriteToR2(url: string): string {
  if (!url.startsWith('/upload/')) return url;
  const base = (runtimeConf()?.public?.r2PublicBaseUrl as string | undefined) || '';
  if (!base) return url;
  // /upload/x.jpg -> https://pub-xxx.r2.dev/x.jpg
  return base + url.slice('/upload'.length);
}

export const getImgUrl = (url: string) => {
  if (!url) return url;
  if (url.startsWith('/cdn-cgi/') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  // 1) 先把本地 /upload/ 重写到 R2 公网（无论 cf-image transform 开不开）
  let out = url.startsWith('/upload/') ? rewriteToR2(url) : url;

  // 2) 如果开了 cf image transformation，再包一层（HEIC -> webp/avif 等）
  const cfOn = !!runtimeConf()?.public?.cfImageTransform;
  if (cfOn) {
    if (out.startsWith('/')) out = `${CF_IMG_PREFIX}${out}`;
    else if (out.startsWith('http')) out = `${CF_IMG_PREFIX}/${out}`;
  }
  return out;
};

export const insertTextAtCursor = (text: string, textarea: HTMLTextAreaElement | undefined) => {
  if (!textarea) return; // 检查textarea是否存在

  var cursor = textarea.selectionStart;
  var textLength = textarea.value.length;
  var selectedText = textarea.value.substring(cursor, textarea.selectionEnd);

  // 如果选中了文本，则替换选中的文本，否则插入新文本
  var newText = selectedText.length > 0 ? text : selectedText + text;

  // 边界检查
  if (cursor > textLength) cursor = textLength;
  if (cursor < 0) cursor = 0;

  // 更新文本内容
  textarea.value =
    textarea.value.substring(0, cursor) +
    newText +
    textarea.value.substring(textarea.selectionEnd);

  // 重新设置光标位置
  textarea.setSelectionRange(cursor + text.length, cursor + text.length);

  // 确保新插入的文本可见
  textarea.scrollTop = textarea.scrollHeight;
}