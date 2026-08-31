import "server-only";

import { ObjectId, type Filter } from "mongodb";
import { DEFAULT_SETTINGS } from "@/lib/default-settings";
import { getDb } from "@/lib/db";
import { isLocalDemoMode } from "@/lib/env";
import { escapeRegex } from "@/lib/security";
import type { CategoryDocument, SiteSettingsDocument, VideoDocument } from "@/lib/types";

export { DEFAULT_SETTINGS } from "@/lib/default-settings";

export async function getSettings() {
  if (isLocalDemoMode()) return DEFAULT_SETTINGS;
  const db = await getDb();
  const saved = await db.collection<SiteSettingsDocument>("siteSettings").findOne({ key: "main" });
  if (!saved) return DEFAULT_SETTINGS;
  const legacy = saved as SiteSettingsDocument & { legalNoticeLabel?: string; legalNoticeContent?: string };
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    aboutPageLabel: saved.aboutPageLabel ?? legacy.legalNoticeLabel ?? DEFAULT_SETTINGS.aboutPageLabel,
    aboutPageContent: saved.aboutPageContent ?? legacy.legalNoticeContent ?? DEFAULT_SETTINGS.aboutPageContent,
  };
}

export async function getCategories(includeInactive = false) {
  if (isLocalDemoMode()) return [];
  const db = await getDb();
  const filter = includeInactive ? {} : { isActive: true };
  return db.collection<CategoryDocument>("categories").find(filter).sort({ sortOrder: 1, name: 1 }).toArray();
}

export async function getPublishedVideos(options: { query?: string; categorySlug?: string; limit?: number; page?: number; offset?: number } = {}) {
  if (isLocalDemoMode()) return [];
  const db = await getDb();
  const filter: Filter<VideoDocument> = { status: "published" };
  if (options.query?.trim()) {
    const term = new RegExp(escapeRegex(options.query.trim().slice(0, 80)), "i");
    filter.$or = [{ title: term }, { description: term }, { tags: term }];
  }
  if (options.categorySlug) {
    const category = await db.collection<CategoryDocument>("categories").findOne({ slug: options.categorySlug, isActive: true });
    if (!category?._id) return [];
    filter.categoryId = category._id;
  }
  return db
    .collection<VideoDocument>("videos")
    .find(filter)
    .sort({ featured: -1, sortOrder: 1, publishedAt: -1 })
    .skip(options.offset ?? Math.max(0, (options.page ?? 1) - 1) * Math.min(options.limit ?? 24, 48))
    .limit(Math.min(options.limit ?? 24, 48))
    .toArray();
}

export async function getVideoBySlug(slug: string) {
  if (isLocalDemoMode()) return null;
  const db = await getDb();
  return db.collection<VideoDocument>("videos").findOne({ slug, status: "published" });
}

export async function getVideoById(id: string) {
  if (isLocalDemoMode()) return null;
  if (!ObjectId.isValid(id)) return null;
  const db = await getDb();
  return db.collection<VideoDocument>("videos").findOne({ _id: new ObjectId(id) });
}

export async function getAllVideos() {
  const db = await getDb();
  return db.collection<VideoDocument>("videos").find().sort({ updatedAt: -1 }).toArray();
}

export async function getPublishedVideoIndex() {
  if (isLocalDemoMode()) return [];
  const db = await getDb();
  return db.collection<VideoDocument>("videos").find(
    { status: "published" },
    { projection: { slug: 1, updatedAt: 1 } },
  ).sort({ publishedAt: -1 }).limit(5_000).toArray();
}

export async function uniqueSlug(title: string, preferred: string, excludeId?: string) {
  const { slugify } = await import("@/lib/validation");
  const db = await getDb();
  const base = slugify(preferred || title) || `video-${Date.now()}`;
  let slug = base;
  let suffix = 2;
  while (
    await db.collection<VideoDocument>("videos").findOne({
      slug,
      ...(excludeId && ObjectId.isValid(excludeId) ? { _id: { $ne: new ObjectId(excludeId) } } : {}),
    })
  ) {
    slug = `${base}-${suffix++}`;
  }
  return slug;
}

export function categoryMap(categories: CategoryDocument[]) {
  return new Map(categories.filter((item) => item._id).map((item) => [item._id!.toHexString(), item]));
}
