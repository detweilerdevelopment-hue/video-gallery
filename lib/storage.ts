import "server-only";

import { DeleteObjectCommand, HeadObjectCommand, ListObjectVersionsCommand, S3Client } from "@aws-sdk/client-s3";
import { getBackblazeEnv, hasBackblazeConfiguration } from "@/lib/env";
import {
  assertStorageKey,
  copyRemoteAssetToLocal,
  deleteLocalAsset,
  hasFilesystemStorage,
  localAssetStatus,
} from "@/lib/filesystem-storage";
import type { StorageAsset } from "@/lib/types";
import { storageAssetInputSchema } from "@/lib/validation";

let storageClient: S3Client | undefined;

export function getStorageClient() {
  if (!storageClient) {
    const env = getBackblazeEnv();
    storageClient = new S3Client({
      region: env.region,
      endpoint: env.endpoint,
      forcePathStyle: true,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: env.keyId,
        secretAccessKey: env.applicationKey,
      },
    });
  }
  return storageClient;
}

function backblazeUrl(key: string) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${getBackblazeEnv().publicBaseUrl}/${encodedKey}`;
}

export function storageUrl(key: string) {
  assertStorageKey(key);
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return hasFilesystemStorage() ? `/media/${encodedKey}` : backblazeUrl(key);
}

async function deleteBackblazeAsset(key: string) {
  const { bucketName } = getBackblazeEnv();
  const client = getStorageClient();
  const versions: string[] = [];
  let keyMarker: string | undefined;
  let versionMarker: string | undefined;
  // B2 requires version IDs for permanent deletion, including hidden versions.
  do {
    const page = await client.send(new ListObjectVersionsCommand({ Bucket: bucketName, Prefix: key, KeyMarker: keyMarker, VersionIdMarker: versionMarker }));
    for (const item of [...(page.Versions ?? []), ...(page.DeleteMarkers ?? [])]) {
      if (item.Key === key && item.VersionId) versions.push(item.VersionId);
    }
    if (!page.IsTruncated) break;
    if (!page.NextKeyMarker) throw new Error("Missing storage pagination marker");
    keyMarker = page.NextKeyMarker;
    versionMarker = page.NextVersionIdMarker;
  } while (true);
  for (const versionId of versions) {
    await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key, VersionId: versionId }));
  }
}

export async function deleteStoredAsset(key: string) {
  assertStorageKey(key);
  let deletedLocally = false;
  if (hasFilesystemStorage()) deletedLocally = await deleteLocalAsset(key);

  if (hasBackblazeConfiguration()) {
    try {
      await deleteBackblazeAsset(key);
    } catch (error) {
      // Once a file exists on Hostinger, stale Backblaze credentials should not
      // prevent an administrator from deleting the authoritative local copy.
      if (!deletedLocally) throw error;
    }
    return;
  }
  if (!hasFilesystemStorage()) getBackblazeEnv();
}

export function parseStorageAsset(value?: string | null, kind?: "video" | "image"): StorageAsset | null {
  if (!value) return null;
  try {
    const result = storageAssetInputSchema.safeParse(JSON.parse(value));
    if (!result.success) return null;
    const parsed = result.data;
    const { key, contentType, size } = parsed;
    const requiredPrefix = kind === "video" ? "videos/" : kind === "image" ? "images/" : "";
    if (!key.startsWith(requiredPrefix)) return null;
    return {
      key,
      contentType,
      size,
      originalName: parsed.originalName,
    };
  } catch {
    return null;
  }
}

export async function storedAssetExists(asset: StorageAsset) {
  if (hasFilesystemStorage()) {
    const local = await localAssetStatus(asset.key);
    if (local.exists) return local.size === asset.size;
  }
  if (!hasBackblazeConfiguration()) return false;
  try {
    const env = getBackblazeEnv();
    const result = await getStorageClient().send(new HeadObjectCommand({ Bucket: env.bucketName, Key: asset.key }));
    return result.ContentLength === asset.size && (!result.ContentType || result.ContentType === asset.contentType);
  } catch {
    return false;
  }
}

export async function storedAssetIsLocal(asset: StorageAsset) {
  if (!hasFilesystemStorage()) return false;
  const local = await localAssetStatus(asset.key);
  return local.exists && local.size === asset.size;
}

export async function migrateStoredAsset(asset: StorageAsset) {
  if (!hasFilesystemStorage()) throw new Error("STORAGE_ROOT is not configured");
  if (!hasBackblazeConfiguration()) throw new Error("Backblaze fallback is not configured");
  return copyRemoteAssetToLocal(asset, backblazeUrl(asset.key));
}
