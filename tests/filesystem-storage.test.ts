import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("server-only", () => ({}));

import {
  appendLocalUploadChunk,
  completeLocalUpload,
  createLocalUploadSession,
  localAssetStatus,
  storageFilePath,
} from "@/lib/filesystem-storage";

describe("Hostinger filesystem uploads", () => {
  let directory: string;
  const previousRoot = process.env.STORAGE_ROOT;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "framevault-filesystem-storage-"));
    process.env.STORAGE_ROOT = directory;
  });

  afterEach(async () => {
    if (previousRoot === undefined) delete process.env.STORAGE_ROOT;
    else process.env.STORAGE_ROOT = previousRoot;
    await rm(directory, { recursive: true, force: true });
  });

  it("writes sequential chunks and atomically completes the asset", async () => {
    const bytes = new TextEncoder().encode("video-data");
    const upload = await createLocalUploadSession({
      userId: "user-1",
      key: "videos/example.mp4",
      contentType: "video/mp4",
      size: bytes.length,
      originalName: "example.mp4",
    });
    const first = bytes.slice(0, 5);
    const second = bytes.slice(5);
    await appendLocalUploadChunk({
      uploadId: upload.id,
      userId: "user-1",
      contentRange: `bytes 0-4/${bytes.length}`,
      contentLength: String(first.length),
      body: new Response(first).body,
    });
    await appendLocalUploadChunk({
      uploadId: upload.id,
      userId: "user-1",
      contentRange: `bytes 5-${bytes.length - 1}/${bytes.length}`,
      contentLength: String(second.length),
      body: new Response(second).body,
    });

    const asset = await completeLocalUpload(upload.id, "user-1");
    expect(asset).toMatchObject({ key: "videos/example.mp4", size: bytes.length, contentType: "video/mp4" });
    expect(await readFile(storageFilePath(asset.key), "utf8")).toBe("video-data");
    expect(await localAssetStatus(asset.key)).toMatchObject({ exists: true, size: bytes.length });
  });

  it("rolls back an incomplete chunk so it can be retried", async () => {
    const upload = await createLocalUploadSession({
      userId: "user-1",
      key: "images/example.jpg",
      contentType: "image/jpeg",
      size: 3,
    });
    await expect(appendLocalUploadChunk({
      uploadId: upload.id,
      userId: "user-1",
      contentRange: "bytes 0-2/3",
      contentLength: null,
      body: new Response(new Uint8Array([1, 2])).body,
    })).rejects.toThrow("incomplete");
    await expect(appendLocalUploadChunk({
      uploadId: upload.id,
      userId: "user-1",
      contentRange: "bytes 0-2/3",
      contentLength: "3",
      body: new Response(new Uint8Array([1, 2, 3])).body,
    })).resolves.toMatchObject({ received: 3 });
  });

  it("rejects traversal and non-media keys", () => {
    expect(() => storageFilePath("videos/../secret")).toThrow("Invalid storage key");
    expect(() => storageFilePath("private/example.mp4")).toThrow("Invalid storage key");
  });
});
