import { toast } from "vue-sonner";

export type UploadCallBack = (res: {
  success: boolean;
  message: string;
  filename: string;
}) => void;

export const useUpload = async (file: File, cb: UploadCallBack) => {

  if(!file.type.startsWith("image")){
    toast.error("只支持上传图片文件");
    return
  }

  const formData = new FormData();
  formData.append("file", file);
  const res = await $fetch("/api/files/upload", {
    method: "POST",
    body: formData,
  });
  cb(res);
};
