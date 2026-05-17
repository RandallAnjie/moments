import { toast } from "vue-sonner";

export type UploadCallBack = (res: {
  success: boolean;
  message: string;
  filename: string;
}) => void;

// 仅 iOS 设备拍摄/相册原图常见为 HEIC/HEIF；其他浏览器不能原生显示。
// 浏览器端用 heic-to（libheif-js 的轻包装）转成 JPEG 再上传，服务端就不用
// 处理任何原生 codec（Workers 跑不了 sharp/libheif）。
// heic-to 是浏览器专属库，用动态 import 避免被打进 SSR bundle。
async function maybeConvertHeic(file: File): Promise<File> {
  // SSR 构建时 import.meta.server 被静态替换为 true，整段被 tree-shake 掉，
  // heic-to + libheif WASM 不会被打进 _worker.js（Cloudflare Workers 1MB 脚本限制）
  if (import.meta.server) return file;

  const looksHeic =
    /\.hei[cf]$/i.test(file.name) ||
    /image\/hei[cf]/i.test(file.type) ||
    // iOS 偶尔不带 MIME，纯靠扩展名识别
    (file.type === '' && /\.hei[cf]$/i.test(file.name));
  if (!looksHeic) return file;

  try {
    const { heicTo, isHeic } = await import('heic-to');
    // heic-to 自己再校验一次魔数，更准确
    if (!(await isHeic(file))) return file;
    const blob = (await heicTo({
      blob: file,
      type: 'image/jpeg',
      quality: 0.85,
    })) as Blob;
    const baseName = file.name.replace(/\.hei[cf]$/i, '') || 'image';
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } catch (e) {
    console.warn('[heic-to] convert failed, fallback to original:', e);
    return file;
  }
}

export const useUpload = async (file: File, cb: UploadCallBack) => {
  // 先尝试把 HEIC/HEIF 转 JPEG（非 HEIC 直接原文件返回，开销 ≈ 0）
  const finalFile = await maybeConvertHeic(file);

  // 接受图片，以及 Live Photo 配套的 .mov/.mp4 视频
  const isImg = finalFile.type.startsWith('image');
  const isVideo =
    finalFile.type.startsWith('video') ||
    /\.(mov|mp4|m4v)$/i.test(finalFile.name);
  if (!isImg && !isVideo) {
    toast.error('只支持上传图片或视频文件');
    return;
  }

  // 转换发生时提示一下
  if (finalFile !== file) {
    toast.info('已自动将 HEIC 转换为 JPEG');
  }

  const formData = new FormData();
  formData.append('file', finalFile);
  const res = await $fetch('/api/files/upload', {
    method: 'POST',
    body: formData,
  });
  cb(res);
};
