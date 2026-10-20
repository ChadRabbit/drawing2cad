"use client";

import { supabaseBrowser } from "./supabase/client";

/** Uploads a file to Supabase Storage through a signed upload URL, reporting progress (0–1). */
export async function uploadWithProgress(bucket: string, path: string, file: Blob, onProgress?: (p: number) => void) {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message ?? "Could not start the upload.");
  await putSigned(data.signedUrl, file, onProgress);
  return data.path;
}

/** PUT a file to a signed upload URL (also used for URLs the server signs). */
export function putSigned(signedUrl: string, file: Blob, onProgress?: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
      } else {
        let message = "The upload failed.";
        try {
          message = JSON.parse(xhr.responseText).message ?? message;
        } catch {}
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error("The upload failed. Check your connection and try again."));
    xhr.send(form);
  });
}
