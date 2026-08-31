import { z } from "zod";

export const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier");

export const storageAssetInputSchema = z.object({
  key: z.string().min(1).max(500).regex(/^[a-zA-Z0-9/_\-.]+$/).refine((key) => !key.includes(".."), "Invalid storage key"),
  contentType: z.string().min(1).max(100),
  size: z.number().int().positive().max(1_000_000_000),
  originalName: z.string().max(255).nullish().transform((value) => value ?? undefined),
});

export const videoInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(5).max(5_000),
  categoryId: z.string().optional(),
  tags: z.string().max(500).default(""),
  sortOrder: z.coerce.number().int().min(0).max(100_000).default(0),
  featured: z.coerce.boolean().default(false),
  assetJson: z.string().max(10_000).optional(),
  posterJson: z.string().max(10_000).optional(),
});

export const categoryInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(60),
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const siteSettingsInputSchema = z.object({
  siteName: z.string().trim().min(2).max(60),
  heroEyebrow: z.string().trim().min(2).max(60),
  heroTitle: z.string().trim().min(2).max(120),
  heroDescription: z.string().trim().min(10).max(500),
  heroImageAlt: z.string().trim().min(2).max(180),
  featuredVideoId: z.string().optional(),
  showFeaturedOverlay: z.preprocess((value) => value === true || value === "true" || value === "on", z.boolean()),
  heroImageJson: z.string().max(10_000).optional(),
  aboutPageLabel: z.string().trim().min(2).max(80).default("About"),
  aboutPageContent: z.string().trim().max(50_000).default(""),
  privacyPolicyLabel: z.string().trim().min(2).max(80).default("Privacy policy"),
  privacyPolicyContent: z.string().trim().max(50_000).default(""),
  galleryEyebrow: z.string().trim().min(2).max(80).default("Neueste Uploads"),
  galleryTitle: z.string().trim().min(2).max(100).default("Die Galerie"),
  gallerySearchPlaceholder: z.string().trim().min(2).max(100).default("Videos suchen…"),
  gallerySearchButton: z.string().trim().min(2).max(60).default("Suchen"),
  galleryAllLabel: z.string().trim().min(2).max(60).default("Alle"),
  galleryEmptyTitle: z.string().trim().min(2).max(120).default("Keine Videos gefunden"),
  galleryEmptyDescription: z.string().trim().min(2).max(240).default("Versuchen Sie eine andere Suche oder Kategorie."),
  galleryClearFiltersLabel: z.string().trim().min(2).max(80).default("Filter löschen"),
  ageGateTitle: z.string().trim().min(5).max(200).default("Are you 18 years or older?"),
  ageGateDescription: z.string().trim().min(10).max(1_000).default("This website contains podcasts and conversations intended for an adult audience. You must confirm your age before continuing."),
  ageGateAcceptLabel: z.string().trim().min(2).max(100).default("Yes, I am 18 or older"),
  ageGateDeclineLabel: z.string().trim().min(2).max(100).default("No, I am under 18"),
  cookieGateTitle: z.string().trim().min(5).max(200).default("May we use cookies?"),
  cookieGateDescription: z.string().trim().min(10).max(1_000).default("We use a cookie to remember your consent and avoid asking this question on your next visit. Your age will still be confirmed every time you enter the website."),
  cookieGateAcceptLabel: z.string().trim().min(2).max(100).default("Yes, accept cookies"),
  cookieGateDeclineLabel: z.string().trim().min(2).max(100).default("No, do not accept"),
});

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

export function parseFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}
