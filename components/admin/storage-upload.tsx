"use client";

import { useRef, useState } from "react";
import {
  IMAGE_UPLOAD_LIMIT_LABEL,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  VIDEO_UPLOAD_LIMIT_LABEL,
} from "@/lib/storage-limits";

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

type UploadAuthorization = {
  strategy?: "single" | "chunked";
  uploadUrl?: string;
  chunkSize?: number;
  asset?: UploadedAsset;
  error?: string;
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

function putBlob(url: string, blob: Blob, headers: Record<string, string>, onProgress: (loaded: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
    request.upload.addEventListener("progress", (event) => onProgress(event.loaded));
    request.addEventListener("load", () => request.status >= 200 && request.status < 300
      ? resolve()
      : reject(new Error("Storage upload failed")));
    request.addEventListener("error", () => reject(new Error("Storage upload failed")));
    request.addEventListener("abort", () => reject(new Error("Upload cancelled")));
    request.send(blob);
  });
}

async function uploadSingle(url: string, file: File, onProgress: (percent: number) => void) {
  await putBlob(url, file, { "Content-Type": file.type }, (loaded) => onProgress(Math.round((loaded / file.size) * 100)));
}

async function uploadChunks(url: string, file: File, chunkSize: number, onProgress: (percent: number) => void) {
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, file.size);
    const chunk = file.slice(offset, end, file.type);
    await putBlob(url, chunk, {
      "Content-Type": file.type,
      "Content-Range": `bytes ${offset}-${end - 1}/${file.size}`,
    }, (loaded) => onProgress(Math.round(((offset + loaded) / file.size) * 100)));
  }
  const completion = await fetch(url, { method: "POST" });
  const result = await completion.json() as { error?: string };
  if (!completion.ok) throw new Error(result.error || "The upload could not be completed");
}

export function StorageUpload({ kind, inputName, initialJson, label }: { kind: "video" | "image"; inputName: string; initialJson?: string; label: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [assetJson, setAssetJson] = useState(initialJson || "");
  const [status, setStatus] = useState(initialJson ? "Media attached" : "");
  const [uploading, setUploading] = useState(false);

  const asset = (() => {
    try { return JSON.parse(assetJson) as UploadedAsset; } catch { return null; }
  })();

  async function upload(file?: File) {
    if (!file) return;
    const maxSize = kind === "video" ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES;
    const limitLabel = kind === "video" ? VIDEO_UPLOAD_LIMIT_LABEL : IMAGE_UPLOAD_LIMIT_LABEL;
    if (file.size <= 0 || file.size > maxSize) {
      setStatus(`Choose a non-empty ${kind} file no larger than ${limitLabel}.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(true);
    setStatus("Preparing upload…");
    let authorization: UploadAuthorization | undefined;
    try {
      const metadata = kind === "video" ? await readVideoMetadata(file) : {};
      const response = await fetch("/api/storage/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size, kind }),
      });
      authorization = await response.json() as UploadAuthorization;
      if (!response.ok || !authorization.uploadUrl || !authorization.asset || !authorization.strategy) {
        throw new Error(authorization.error || "Could not authorize upload");
      }

      const progress = (percent: number) => setStatus(`Uploading to storage… ${percent}%`);
      if (authorization.strategy === "chunked") {
        if (!authorization.chunkSize) throw new Error("The storage chunk size is missing");
        await uploadChunks(authorization.uploadUrl, file, authorization.chunkSize, progress);
      } else {
        await uploadSingle(authorization.uploadUrl, file, progress);
      }
      setAssetJson(JSON.stringify({ ...authorization.asset, ...metadata }));
      setStatus(`${file.name} uploaded — save or publish below to attach it`);
    } catch (error) {
      if (authorization?.strategy === "chunked" && authorization.uploadUrl) {
        void fetch(authorization.uploadUrl, { method: "DELETE" }).catch(() => undefined);
      }
      setStatus(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="upload-box" aria-busy={uploading}>
      <strong>{label}</strong>
      <p>{kind === "video" ? "Upload a web-ready MP4 or WebM file. Add a separate poster image for the gallery thumbnail." : `JPG, PNG, WebP, or AVIF, up to ${IMAGE_UPLOAD_LIMIT_LABEL}.`}</p>
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
