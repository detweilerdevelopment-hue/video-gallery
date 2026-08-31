import type { ObjectId } from "mongodb";

export type VideoStatus = "draft" | "processing" | "published" | "failed" | "archived";

export interface StorageAsset {
  key: string;
  contentType: string;
  size: number;
  originalName?: string;
}

export interface VideoDocument {
  _id?: ObjectId;
  title: string;
  slug: string;
  description: string;
  categoryId?: ObjectId | null;
  tags: string[];
  status: VideoStatus;
  featured: boolean;
  sortOrder: number;
  videoAsset?: StorageAsset | null;
  poster?: StorageAsset | null;
  media?: {
    durationSeconds?: number;
    width?: number;
    height?: number;
    bytes?: number;
    format?: string;
  };
  viewCount: number;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: ObjectId;
  updatedBy?: ObjectId;
}

export interface CategoryDocument {
  _id?: ObjectId;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SiteSettingsDocument {
  key: "main";
  siteName: string;
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  heroImage?: StorageAsset | null;
  heroImageAlt: string;
  aboutHeading: string;
  aboutBody: string;
  featuredVideoId?: ObjectId | null;
  showFeaturedOverlay?: boolean;
  aboutPageLabel: string;
  aboutPageContent: string;
  privacyPolicyLabel: string;
  privacyPolicyContent: string;
  ageGateTitle: string;
  ageGateDescription: string;
  ageGateAcceptLabel: string;
  ageGateDeclineLabel: string;
  cookieGateTitle: string;
  cookieGateDescription: string;
  cookieGateAcceptLabel: string;
  cookieGateDeclineLabel: string;
  cookieConsentVersion: string;
  updatedAt: Date;
  updatedBy?: ObjectId;
}

export interface UserDocument {
  _id?: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  role: "owner" | "editor";
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: "owner" | "editor";
}
