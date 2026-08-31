"use client";

import { useRef, useState } from "react";

type UploadedAsset = {
  key: string;
  url: string;
  contentType: string;
  size: number;
  originalName?: string;
  duration?: number;
  width?: number;
  height?: number;
};

function readVideoMetadata(file: File) {
  return new Promise<Pick<UploadedAsset, "duration" | "width" | "height">>((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
      URL.revokeObjectURL(url);
    };
    video.onerror = () => {
      resolve({});
      URL.revokeObjectURL(url);
    };
    video.src = url;
  });
}

function uploadToSignedUrl(url: string, file: File, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("Storage upload failed")));
    request.addEventListener("error", () => reject(new Error("Storage upload failed")));
    request.addEventListener("abort", () => reject(new Error("Upload cancelled")));
    request.send(file);
  });
}

export function BackblazeUpload({ kind, inputName, initialJson, label }: { kind: "video" | "image"; inputName: string; initialJson?: string; label: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [assetJson, setAssetJson] = useState(initialJson || "");
  const [status, setStatus] = useState(initialJson ? "Media attached" : "");
  const [uploading, setUploading] = useState(false);

  const asset = (() => {
    try { return JSON.parse(assetJson) as UploadedAsset; } catch { return null; }
  })();

  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    setStatus("Preparing upload…");
    try {
      const metadata = kind === "video" ? await readVideoMetadata(file) : {};
      const response = await fetch("/api/backblaze/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size, kind }),
      });
      const data = await response.json() as { uploadUrl?: string; asset?: UploadedAsset; error?: string };
      if (!response.ok || !data.uploadUrl || !data.asset) throw new Error(data.error || "Could not authorize upload");
      await uploadToSignedUrl(data.uploadUrl, file, (percent) => setStatus(`Uploading to Backblaze… ${percent}%`));
      setAssetJson(JSON.stringify({ ...data.asset, ...metadata }));
      setStatus(`${file.name} uploaded — save or publish below to attach it`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="upload-box" aria-busy={uploading}>
      <strong>{label}</strong>
      <p>{kind === "video" ? "Web-ready MP4 or WebM, up to 1 GB. Upload a poster image separately for gallery thumbnails." : "JPG, PNG, WebP, or AVIF, up to 15 MB."}</p>
      {asset?.url && (kind === "video"
        ? <video className="upload-preview" src={asset.url} controls preload="metadata" />
        : <img className="upload-preview" src={asset.url} alt={`${label} preview`} />)}
      <input type="hidden" name={inputName} value={assetJson} />
      <input ref={inputRef} className="sr-only" type="file" accept={kind === "video" ? "video/mp4,video/webm" : "image/jpeg,image/png,image/webp,image/avif"} onChange={(event) => void upload(event.target.files?.[0])} disabled={uploading} />
      <button className="ghost upload-button" type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading && <span className="spinner" aria-hidden="true" />}
        {uploading ? "Uploading…" : `Choose ${kind}`}
      </button>
      {status && <div className="upload-success" aria-live="polite">{status}</div>}
    </div>
  );
}
