import "server-only";

import { getDb } from "@/lib/db";
import { hasBackblazeConfiguration } from "@/lib/env";
import { hasFilesystemStorage } from "@/lib/filesystem-storage";
import { migrateStoredAsset, storedAssetIsLocal } from "@/lib/storage";
import type { SiteSettingsDocument, StorageAsset, VideoDocument } from "@/lib/types";

async function referencedAssets() {
  const db = await getDb();
  const [videos, settings] = await Promise.all([
    db.collection<VideoDocument>("videos").find({}).project<Pick<VideoDocument, "videoAsset" | "poster">>({ videoAsset: 1, poster: 1 }).toArray(),
    db.collection<SiteSettingsDocument>("siteSettings").findOne({ key: "main" }, { projection: { heroImage: 1 } }),
  ]);
  const assets = videos.flatMap((video) => [video.videoAsset, video.poster]);
  assets.push(settings?.heroImage);
  return [...new Map(
    assets
      .filter((asset): asset is StorageAsset => Boolean(asset?.key))
      .map((asset) => [asset.key, asset]),
  ).values()];
}

export async function getStorageMigrationSummary() {
  try {
    const assets = await referencedAssets();
    const local = hasFilesystemStorage()
      ? (await Promise.all(assets.map((asset) => storedAssetIsLocal(asset)))).filter(Boolean).length
      : 0;
    return {
      available: true,
      referenced: assets.length,
      local,
      fallbackConfigured: hasBackblazeConfiguration(),
    };
  } catch (error) {
    return {
      available: false,
      referenced: 0,
      local: 0,
      fallbackConfigured: hasBackblazeConfiguration(),
      error: error instanceof Error ? error.message : "Storage migration status is unavailable.",
    };
  }
}

export async function migrateReferencedAssets() {
  const assets = await referencedAssets();
  let migrated = 0;
  let alreadyLocal = 0;
  for (const asset of assets) {
    const result = await migrateStoredAsset(asset);
    if (result === "migrated") migrated += 1;
    else alreadyLocal += 1;
  }
  return { migrated, alreadyLocal, total: assets.length };
}
