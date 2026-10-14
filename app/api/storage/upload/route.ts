import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBackblazeEnv } from "@/lib/env";
import { createLocalUploadSession, hasFilesystemStorage } from "@/lib/filesystem-storage";
import { assertSameOrigin, consumeRateLimit } from "@/lib/security";
import { getStorageClient, storageUrl } from "@/lib/storage";
import { MAX_IMAGE_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES, STORAGE_UPLOAD_URL_EXPIRY_SECONDS } from "@/lib/storage-limits";

export const runtime = "nodejs";

const ALLOWED_TYPES: Record<"video" | "image", Record<string, string>> = {
  video: { "video/mp4": "mp4", "video/webm": "webm" },
  image: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" },
};

function safeBaseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "media";
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await consumeRateLimit(`admin-storage-upload:${session.userId}`, 100, 60 * 60))) {
    return NextResponse.json({ error: "Upload limit reached" }, { status: 429 });
  }

  let body: { fileName?: string; contentType?: string; size?: number; kind?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  }
  if (body.kind !== "video" && body.kind !== "image") return NextResponse.json({ error: "Invalid media type" }, { status: 400 });
  const contentType = String(body.contentType || "").toLowerCase();
  const extension = ALLOWED_TYPES[body.kind][contentType];
  const size = Number(body.size);
  const maxSize = body.kind === "video" ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES;
  if (!extension || !Number.isSafeInteger(size) || size <= 0 || size > maxSize) {
    return NextResponse.json({ error: "Unsupported file type or size" }, { status: 400 });
  }

  const originalName = String(body.fileName || "media").slice(0, 255);
  const folder = body.kind === "video" ? "videos" : "images";
  const key = `${folder}/${Date.now()}-${randomUUID()}-${safeBaseName(originalName)}.${extension}`;
  const asset = { key, url: storageUrl(key), contentType, size, originalName };

  if (hasFilesystemStorage()) {
    try {
      const upload = await createLocalUploadSession({ userId: session.userId, key, contentType, size, originalName });
      return NextResponse.json({
        strategy: "chunked",
        uploadUrl: `/api/storage/upload/${upload.id}`,
        chunkSize: upload.chunkSize,
        asset,
      }, { headers: { "cache-control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "Hostinger storage is unavailable" }, { status: 503 });
    }
  }

  const env = getBackblazeEnv();
  const uploadUrl = await getSignedUrl(
    getStorageClient(),
    new PutObjectCommand({ Bucket: env.bucketName, Key: key, ContentType: contentType }),
    { expiresIn: STORAGE_UPLOAD_URL_EXPIRY_SECONDS },
  );
  return NextResponse.json({ strategy: "single", uploadUrl, asset }, { headers: { "cache-control": "no-store" } });
}
