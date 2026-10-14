import { Readable } from "node:stream";
import { getBackblazeEnv, hasBackblazeConfiguration } from "@/lib/env";
import { assertStorageKey, createLocalReadStream, hasFilesystemStorage, localAssetStatus } from "@/lib/filesystem-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

function contentType(key: string) {
  const extension = key.slice(key.lastIndexOf(".")).toLowerCase();
  return CONTENT_TYPES[extension] || "application/octet-stream";
}

function backblazeUrl(key: string) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${getBackblazeEnv().publicBaseUrl}/${encodedKey}`;
}

function parseRange(value: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return null;
  let start: number;
  let end: number;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}

async function mediaResponse(request: Request, keyParts: string[], headOnly: boolean) {
  let key: string;
  try {
    key = assertStorageKey(keyParts.join("/"));
  } catch {
    return new Response("Not found", { status: 404 });
  }

  if (hasFilesystemStorage()) {
    const local = await localAssetStatus(key);
    if (local.exists && local.modifiedAt) {
      const etag = `"${local.size.toString(16)}-${Math.trunc(local.modifiedAt.getTime()).toString(16)}"`;
      const baseHeaders = new Headers({
        "accept-ranges": "bytes",
        "cache-control": "public, max-age=86400, immutable",
        "content-type": contentType(key),
        "etag": etag,
        "last-modified": local.modifiedAt.toUTCString(),
        "x-content-type-options": "nosniff",
      });
      if (!request.headers.has("range") && request.headers.get("if-none-match") === etag) {
        return new Response(null, { status: 304, headers: baseHeaders });
      }

      const requestedRange = request.headers.get("range");
      if (requestedRange) {
        const range = parseRange(requestedRange, local.size);
        if (!range) {
          baseHeaders.set("content-range", `bytes */${local.size}`);
          return new Response(null, { status: 416, headers: baseHeaders });
        }
        const length = range.end - range.start + 1;
        baseHeaders.set("content-length", String(length));
        baseHeaders.set("content-range", `bytes ${range.start}-${range.end}/${local.size}`);
        const body = headOnly ? null : Readable.toWeb(createLocalReadStream(local.filePath, range)) as ReadableStream;
        return new Response(body, { status: 206, headers: baseHeaders });
      }

      baseHeaders.set("content-length", String(local.size));
      const body = headOnly ? null : Readable.toWeb(createLocalReadStream(local.filePath)) as ReadableStream;
      return new Response(body, { status: 200, headers: baseHeaders });
    }
  }

  if (hasBackblazeConfiguration()) return Response.redirect(backblazeUrl(key), 307);
  return new Response("Not found", { status: 404 });
}

export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  return mediaResponse(request, (await params).key, false);
}

export async function HEAD(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  return mediaResponse(request, (await params).key, true);
}
