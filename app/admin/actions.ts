"use server";

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { deleteStoredAsset, parseStorageAsset, storedAssetExists } from "@/lib/storage";
import type { SiteSettingsDocument, VideoDocument, VideoStatus } from "@/lib/types";
import { categoryInputSchema, objectIdString, parseFormData, siteSettingsInputSchema, slugify, videoInputSchema } from "@/lib/validation";
import { uniqueSlug } from "@/lib/repositories";

async function audit(actorId: string, action: string, entityType: string, entityId?: ObjectId) {
  const db = await getDb();
  await db.collection("auditLogs").insertOne({ actorId: new ObjectId(actorId), action, entityType, entityId, createdAt: new Date() });
}

function uploadedMedia(value?: string) {
  if (!value) return undefined;
  try {
    const item = JSON.parse(value) as Record<string, unknown>;
    return {
      durationSeconds: typeof item.duration === "number" ? item.duration : undefined,
      width: typeof item.width === "number" ? item.width : undefined,
      height: typeof item.height === "number" ? item.height : undefined,
      bytes: typeof item.bytes === "number" ? item.bytes : undefined,
      format: typeof item.format === "string" ? item.format : undefined,
    };
  } catch { return undefined; }
}

export async function saveVideoAction(formData: FormData) {
  const session = await requireAdmin();
  const intent = String(formData.get("intent") || "save");
  const parsed = videoInputSchema.safeParse(parseFormData(formData));
  if (!parsed.success) redirect(`/admin/videos${String(formData.get("id") || "") ? `/${formData.get("id")}/edit` : "/new"}?error=validation`);
  const input = parsed.data;
  const db = await getDb();
  const now = new Date();
  const id = input.id && ObjectId.isValid(input.id) ? new ObjectId(input.id) : undefined;
  const existing = id ? await db.collection<VideoDocument>("videos").findOne({ _id: id }) : null;
  const submittedVideo = parseStorageAsset(input.assetJson, "video");
  const submittedPoster = parseStorageAsset(input.posterJson, "image");
  if ((input.assetJson && !submittedVideo) || (input.posterJson && !submittedPoster)) redirect(`/admin/videos${input.id ? `/${input.id}/edit` : "/new"}?error=validation`);
  if ((submittedVideo && !(await storedAssetExists(submittedVideo))) || (submittedPoster && !(await storedAssetExists(submittedPoster)))) redirect(`/admin/videos${input.id ? `/${input.id}/edit` : "/new"}?error=storage-verification`);
  const videoAsset = submittedVideo ?? existing?.videoAsset ?? null;
  const poster = submittedPoster ?? existing?.poster ?? null;
  if (intent === "publish" && !videoAsset) redirect(`/admin/videos${input.id ? `/${input.id}/edit` : "/new"}?error=media-required`);
  const categoryId = input.categoryId && ObjectId.isValid(input.categoryId) ? new ObjectId(input.categoryId) : null;
  const slug = existing?.slug ?? await uniqueSlug(input.title, slugify(input.title), input.id);
  const status: VideoStatus = intent === "publish" ? "published" : existing?.status ?? "draft";
  const publishedAt = status === "published" ? existing?.publishedAt ?? now : existing?.publishedAt ?? null;
  const update = {
    title: input.title,
    slug,
    description: input.description,
    categoryId,
    tags: input.tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 20),
    sortOrder: input.sortOrder,
    featured: input.featured,
    videoAsset,
    poster,
    media: input.assetJson ? uploadedMedia(input.assetJson) : existing?.media,
    status,
    publishedAt,
    updatedAt: now,
    updatedBy: new ObjectId(session.userId),
  };

  let savedId: ObjectId;
  if (id && existing) {
    await db.collection<VideoDocument>("videos").updateOne({ _id: id }, { $set: update });
    savedId = id;
  } else {
    const result = await db.collection<VideoDocument>("videos").insertOne({
      ...update,
      viewCount: 0,
      createdAt: now,
      createdBy: new ObjectId(session.userId),
    });
    savedId = result.insertedId;
  }
  await audit(session.userId, existing ? "video.updated" : "video.created", "video", savedId);
  revalidatePath("/");
  revalidatePath("/admin/videos");
  redirect(`/admin/videos/${savedId.toHexString()}/edit?success=${intent === "publish" ? "published" : "saved"}`);
}

export async function deleteVideoAction(formData: FormData) {
  const session = await requireAdmin();
  const id = new ObjectId(objectIdString.parse(formData.get("id")));
  const db = await getDb();
  const video = await db.collection<VideoDocument>("videos").findOne({ _id: id });
  if (!video) redirect("/admin/videos");
  const keys = [...new Set([video.videoAsset?.key, video.poster?.key].filter((key): key is string => Boolean(key)))];
  for (const key of keys) {
    const sharedVideo = await db.collection<VideoDocument>("videos").findOne({ _id: { $ne: id }, $or: [{ "videoAsset.key": key }, { "poster.key": key }] });
    const sharedBanner = await db.collection<SiteSettingsDocument>("siteSettings").findOne({ "heroImage.key": key });
    if (sharedVideo || sharedBanner) redirect("/admin/videos?error=shared-media");
  }
  try {
    for (const key of keys) await deleteStoredAsset(key);
  } catch {
    redirect("/admin/videos?error=delete-storage");
  }
  await db.collection<SiteSettingsDocument>("siteSettings").updateOne(
    { key: "main", featuredVideoId: id },
    { $set: { featuredVideoId: null, updatedAt: new Date(), updatedBy: new ObjectId(session.userId) } },
  );
  await db.collection<VideoDocument>("videos").deleteOne({ _id: id });
  await audit(session.userId, "video.deleted", "video", id);
  revalidatePath("/");
  revalidatePath(`/videos/${video.slug}`);
  revalidatePath("/admin");
  revalidatePath("/admin/videos");
  revalidatePath("/admin/content");
  revalidatePath("/sitemap.xml");
  redirect("/admin/videos?success=deleted");
}

export async function setVideoStatusAction(formData: FormData) {
  const session = await requireAdmin();
  const idResult = objectIdString.safeParse(formData.get("id"));
  const status = String(formData.get("status") || "");
  if (!idResult.success || !["published", "draft", "archived"].includes(status)) throw new Error("Invalid video action");
  const nextStatus = status as VideoStatus;
  const db = await getDb();
  const id = new ObjectId(idResult.data);
  const video = await db.collection<VideoDocument>("videos").findOne({ _id: id });
  if (!video) throw new Error("Video not found");
  if (status === "published" && !video.videoAsset?.key) redirect(`/admin/videos/${idResult.data}/edit?error=media-required`);
  await db.collection<VideoDocument>("videos").updateOne({ _id: id }, { $set: { status: nextStatus, publishedAt: nextStatus === "published" ? video.publishedAt ?? new Date() : video.publishedAt, updatedAt: new Date(), updatedBy: new ObjectId(session.userId) } });
  await audit(session.userId, `video.${status}`, "video", id);
  revalidatePath("/");
  revalidatePath(`/videos/${video.slug}`);
  revalidatePath("/admin/videos");
  redirect("/admin/videos?success=status");
}

export async function saveSettingsAction(formData: FormData) {
  const session = await requireAdmin();
  const parsed = siteSettingsInputSchema.safeParse(parseFormData(formData));
  if (!parsed.success) redirect("/admin/content?error=fields");
  const db = await getDb();
  const existing = await db.collection<SiteSettingsDocument>("siteSettings").findOne({ key: "main" });
  const submittedHeroImage = parseStorageAsset(parsed.data.heroImageJson, "image");
  if (parsed.data.heroImageJson && !submittedHeroImage) redirect("/admin/content?error=hero-image");

  let heroImage = existing?.heroImage ?? null;
  if (submittedHeroImage && submittedHeroImage.key !== existing?.heroImage?.key) {
    if (!(await storedAssetExists(submittedHeroImage))) redirect("/admin/content?error=hero-image");
    heroImage = submittedHeroImage;
  }
  const featuredVideoId = parsed.data.featuredVideoId && ObjectId.isValid(parsed.data.featuredVideoId) ? new ObjectId(parsed.data.featuredVideoId) : null;
  const { heroImageJson: _heroImageJson, ...fields } = parsed.data;
  const cookiePromptChanged = !existing
    || existing.cookieGateTitle !== fields.cookieGateTitle
    || existing.cookieGateDescription !== fields.cookieGateDescription
    || existing.cookieGateAcceptLabel !== fields.cookieGateAcceptLabel
    || existing.cookieGateDeclineLabel !== fields.cookieGateDeclineLabel;
  const cookieConsentVersion = cookiePromptChanged ? String(Date.now()) : existing.cookieConsentVersion ?? "1";
  await db.collection<SiteSettingsDocument>("siteSettings").updateOne({ key: "main" }, { $set: { ...fields, heroImage, featuredVideoId, cookieConsentVersion, updatedAt: new Date(), updatedBy: new ObjectId(session.userId) } }, { upsert: true });
  await audit(session.userId, "settings.updated", "siteSettings");
  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/privacy-policy");
  redirect("/admin/content?success=saved");
}

export async function saveCategoryAction(formData: FormData) {
  const session = await requireAdmin();
  const parsed = categoryInputSchema.safeParse(parseFormData(formData));
  if (!parsed.success) redirect("/admin/categories?error=validation");
  const db = await getDb();
  const id = parsed.data.id && ObjectId.isValid(parsed.data.id) ? new ObjectId(parsed.data.id) : undefined;
  const now = new Date();
  const fields = { name: parsed.data.name, slug: slugify(parsed.data.name), sortOrder: parsed.data.sortOrder, updatedAt: now };
  if (id) await db.collection("categories").updateOne({ _id: id }, { $set: fields });
  else await db.collection("categories").insertOne({ ...fields, isActive: true, createdAt: now });
  await audit(session.userId, id ? "category.updated" : "category.created", "category", id);
  revalidatePath("/");
  redirect("/admin/categories?success=saved");
}

export async function toggleCategoryAction(formData: FormData) {
  const session = await requireAdmin();
  const id = objectIdString.parse(formData.get("id"));
  const active = String(formData.get("active")) === "true";
  const db = await getDb();
  await db.collection("categories").updateOne({ _id: new ObjectId(id) }, { $set: { isActive: active, updatedAt: new Date() } });
  await audit(session.userId, active ? "category.activated" : "category.deactivated", "category", new ObjectId(id));
  revalidatePath("/");
  redirect("/admin/categories?success=status");
}
