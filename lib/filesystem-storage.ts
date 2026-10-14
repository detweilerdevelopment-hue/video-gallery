import "server-only";

import { randomUUID } from "node:crypto";
import { constants, createReadStream, createWriteStream } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  rename,
  stat,
  truncate,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import type { StorageAsset } from "@/lib/types";

export const FILESYSTEM_UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;

const STORAGE_KEY_PATTERN = /^(videos|images)\/[a-zA-Z0-9/_\-.]+$/;
const UPLOAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface UploadSession {
  id: string;
  userId: string;
  key: string;
  contentType: string;
  size: number;
  originalName?: string;
  createdAt: string;
}

export function hasFilesystemStorage() {
  return Boolean(process.env.STORAGE_ROOT?.trim());
}

export function getStorageRoot() {
  const configured = process.env.STORAGE_ROOT?.trim();
  if (!configured) throw new Error("STORAGE_ROOT is not configured");
  if (!path.isAbsolute(configured)) throw new Error("STORAGE_ROOT must be an absolute path");
  const normalized = path.normalize(configured);
  if (normalized === path.parse(normalized).root) throw new Error("STORAGE_ROOT cannot be a filesystem root");
  return normalized;
}

export function assertStorageKey(key: string) {
  if (!STORAGE_KEY_PATTERN.test(key) || key.includes("..")) throw new Error("Invalid storage key");
  return key;
}

export function storageFilePath(key: string) {
  const root = getStorageRoot();
  const resolved = path.resolve(root, assertStorageKey(key));
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("Invalid storage key");
  return resolved;
}

function uploadDirectory() {
  return path.join(getStorageRoot(), ".uploads");
}

function uploadPaths(uploadId: string) {
  if (!UPLOAD_ID_PATTERN.test(uploadId)) throw new Error("Invalid upload identifier");
  const directory = uploadDirectory();
  return {
    metadata: path.join(directory, `${uploadId}.json`),
    part: path.join(directory, `${uploadId}.part`),
  };
}

async function removeIfPresent(filePath: string) {
  try {
    await unlink(/* turbopackIgnore: true */ filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function readUploadSession(uploadId: string) {
  const paths = uploadPaths(uploadId);
  const parsed = JSON.parse(await readFile(/* turbopackIgnore: true */ paths.metadata, "utf8")) as Partial<UploadSession>;
  if (
    parsed.id !== uploadId
    || typeof parsed.userId !== "string"
    || typeof parsed.key !== "string"
    || typeof parsed.contentType !== "string"
    || !Number.isSafeInteger(parsed.size)
    || Number(parsed.size) <= 0
    || typeof parsed.createdAt !== "string"
  ) throw new Error("The upload session is invalid");
  assertStorageKey(parsed.key);
  return { session: parsed as UploadSession, paths };
}

export async function createLocalUploadSession(input: {
  userId: string;
  key: string;
  contentType: string;
  size: number;
  originalName?: string;
}) {
  const root = getStorageRoot();
  const rootInfo = await stat(/* turbopackIgnore: true */ root);
  if (!rootInfo.isDirectory()) throw new Error("STORAGE_ROOT is not a directory");
  await access(/* turbopackIgnore: true */ root, constants.R_OK | constants.W_OK);
  assertStorageKey(input.key);

  const directory = uploadDirectory();
  await mkdir(/* turbopackIgnore: true */ directory, { recursive: true, mode: 0o700 });
  const id = randomUUID();
  const paths = uploadPaths(id);
  const session: UploadSession = {
    id,
    userId: input.userId,
    key: input.key,
    contentType: input.contentType,
    size: input.size,
    originalName: input.originalName,
    createdAt: new Date().toISOString(),
  };

  await writeFile(/* turbopackIgnore: true */ paths.metadata, `${JSON.stringify(session)}\n`, { flag: "wx", mode: 0o600 });
  try {
    await writeFile(/* turbopackIgnore: true */ paths.part, new Uint8Array(), { flag: "wx", mode: 0o600 });
  } catch (error) {
    await removeIfPresent(paths.metadata);
    throw error;
  }
  return { id, chunkSize: FILESYSTEM_UPLOAD_CHUNK_BYTES };
}

function parseContentRange(value: string | null) {
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(value || "");
  if (!match) throw new Error("A valid Content-Range header is required");
  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);
  if (![start, end, total].every(Number.isSafeInteger) || start < 0 || end < start || total <= end) {
    throw new Error("The upload byte range is invalid");
  }
  return { start, end, total, length: end - start + 1 };
}

export async function appendLocalUploadChunk(input: {
  uploadId: string;
  userId: string;
  contentRange: string | null;
  contentLength: string | null;
  body: ReadableStream<Uint8Array> | null;
}) {
  if (!input.body) throw new Error("The upload chunk is empty");
  const { session, paths } = await readUploadSession(input.uploadId);
  if (session.userId !== input.userId) throw new Error("The upload session does not belong to this user");
  const range = parseContentRange(input.contentRange);
  if (range.total !== session.size || range.length > FILESYSTEM_UPLOAD_CHUNK_BYTES) throw new Error("The upload chunk size is invalid");
  if (input.contentLength && Number(input.contentLength) !== range.length) throw new Error("The upload Content-Length is invalid");

  const partInfo = await stat(/* turbopackIgnore: true */ paths.part);
  if (partInfo.size !== range.start) throw new Error(`The next upload offset is ${partInfo.size}`);

  let received = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      callback(received <= range.length ? null : new Error("The upload chunk exceeded its declared size"), chunk);
    },
  });

  try {
    const source = Readable.fromWeb(input.body as Parameters<typeof Readable.fromWeb>[0]);
    await pipeline(source, counter, createWriteStream(/* turbopackIgnore: true */ paths.part, { flags: "a", mode: 0o600 }));
    if (received !== range.length) throw new Error("The upload chunk was incomplete");
  } catch (error) {
    await truncate(/* turbopackIgnore: true */ paths.part, range.start);
    throw error;
  }

  const nextOffset = (await stat(/* turbopackIgnore: true */ paths.part)).size;
  if (nextOffset > session.size) {
    await truncate(/* turbopackIgnore: true */ paths.part, range.start);
    throw new Error("The uploaded file exceeded its declared size");
  }
  return { received: nextOffset, size: session.size };
}

export async function completeLocalUpload(uploadId: string, userId: string): Promise<StorageAsset> {
  const { session, paths } = await readUploadSession(uploadId);
  if (session.userId !== userId) throw new Error("The upload session does not belong to this user");
  const partInfo = await stat(/* turbopackIgnore: true */ paths.part);
  if (partInfo.size !== session.size) throw new Error(`The upload is incomplete (${partInfo.size} of ${session.size} bytes)`);

  const destination = storageFilePath(session.key);
  await mkdir(/* turbopackIgnore: true */ path.dirname(destination), { recursive: true, mode: 0o755 });
  await rename(/* turbopackIgnore: true */ paths.part, /* turbopackIgnore: true */ destination);
  await removeIfPresent(paths.metadata);
  return {
    key: session.key,
    contentType: session.contentType,
    size: session.size,
    originalName: session.originalName,
  };
}

export async function cancelLocalUpload(uploadId: string, userId: string) {
  const { session, paths } = await readUploadSession(uploadId);
  if (session.userId !== userId) throw new Error("The upload session does not belong to this user");
  await Promise.all([removeIfPresent(paths.part), removeIfPresent(paths.metadata)]);
}

export async function localAssetStatus(key: string) {
  const filePath = storageFilePath(key);
  try {
    const file = await stat(/* turbopackIgnore: true */ filePath);
    return { exists: file.isFile(), size: file.isFile() ? file.size : 0, filePath, modifiedAt: file.mtime };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { exists: false, size: 0, filePath };
    throw error;
  }
}

export async function deleteLocalAsset(key: string) {
  const filePath = storageFilePath(key);
  try {
    await unlink(/* turbopackIgnore: true */ filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function copyRemoteAssetToLocal(asset: StorageAsset, sourceUrl: string) {
  const current = await localAssetStatus(asset.key);
  if (current.exists && current.size === asset.size) return "already-local" as const;

  const response = await fetch(sourceUrl, { cache: "no-store", redirect: "follow" });
  if (!response.ok || !response.body) throw new Error(`Storage download failed with status ${response.status}`);
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > 0 && declaredSize !== asset.size) {
    throw new Error("The remote file size does not match the database record");
  }

  const directory = uploadDirectory();
  await mkdir(/* turbopackIgnore: true */ directory, { recursive: true, mode: 0o700 });
  const temporaryPath = path.join(directory, `${randomUUID()}.migration`);
  let received = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      callback(received <= asset.size ? null : new Error("The remote file exceeded its expected size"), chunk);
    },
  });

  try {
    const source = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
    await pipeline(source, counter, createWriteStream(/* turbopackIgnore: true */ temporaryPath, { flags: "wx", mode: 0o600 }));
    if (received !== asset.size) throw new Error("The remote file was incomplete");
    const destination = storageFilePath(asset.key);
    await mkdir(/* turbopackIgnore: true */ path.dirname(destination), { recursive: true, mode: 0o755 });
    if (current.exists) await removeIfPresent(destination);
    await rename(/* turbopackIgnore: true */ temporaryPath, /* turbopackIgnore: true */ destination);
    return "migrated" as const;
  } catch (error) {
    await removeIfPresent(temporaryPath);
    throw error;
  }
}

export function createLocalReadStream(filePath: string, range?: { start: number; end: number }) {
  return createReadStream(/* turbopackIgnore: true */ filePath, range);
}
