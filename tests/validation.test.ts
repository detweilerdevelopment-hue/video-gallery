import { describe, expect, it } from "vitest";
import { categoryInputSchema, siteSettingsInputSchema, slugify, storageAssetInputSchema, videoInputSchema } from "@/lib/validation";

describe("slugify", () => {
  it("creates safe stable URL segments", () => {
    expect(slugify("  Behind thé Lens!  ")).toBe("behind-the-lens");
  });

  it("removes separators at the edges", () => {
    expect(slugify("--- Coastal Study ---")).toBe("coastal-study");
  });
});

describe("Backblaze asset validation", () => {
  it("accepts stored media metadata", () => {
    expect(storageAssetInputSchema.safeParse({ key: "videos/example.mp4", contentType: "video/mp4", size: 1024 }).success).toBe(true);
  });

  it("accepts legacy media with a null original name", () => {
    const result = storageAssetInputSchema.parse({ key: "images/banner.jpg", contentType: "image/jpeg", size: 2048, originalName: null });
    expect(result.originalName).toBeUndefined();
  });

  it("rejects unsafe storage keys", () => {
    expect(storageAssetInputSchema.safeParse({ key: "videos/../secret", contentType: "video/mp4", size: 1024 }).success).toBe(false);
  });
});

describe("content validation", () => {
  it("preserves entry-screen line breaks and editable rejection labels", () => {
    const result = siteSettingsInputSchema.parse({
      siteName: "FrameVault", heroEyebrow: "Curated films", heroTitle: "Watch remarkable stories",
      heroDescription: "A complete homepage description.", heroImageAlt: "A production set",
      ageGateDescription: "Adult audience only.\nAre you at least 18?",
      deniedGateTitle: "Kein Zugang",
      deniedGateDescription: "Zugang nicht erlaubt.\nBitte Antworten pruefen.",
      deniedGateRetryLabel: "Antworten pruefen",
      entryGateBadge: "",
    });
    expect(result.ageGateDescription).toContain("\n");
    expect(result.deniedGateDescription).toContain("\n");
    expect(result.deniedGateTitle).toBe("Kein Zugang");
    expect(result.deniedGateRetryLabel).toBe("Antworten pruefen");
    expect(result.entryGateBadge).toBe("");
  });

  it("accepts a complete video draft", () => {
    expect(videoInputSchema.safeParse({ title: "Morning Light", description: "A quiet observational film with a complete description.", tags: "nature, morning", sortOrder: "2" }).success).toBe(true);
  });

  it("rejects incomplete hero descriptions", () => {
    const result = siteSettingsInputSchema.safeParse({ siteName: "FrameVault", heroEyebrow: "Curated films", heroTitle: "Watch remarkable stories", heroDescription: "Short", heroImageAlt: "A production set" });
    expect(result.success).toBe(false);
  });

  it("parses the featured banner text checkbox", () => {
    const settings = { siteName: "FrameVault", heroEyebrow: "Curated films", heroTitle: "Watch remarkable stories", heroDescription: "A complete homepage description.", heroImageAlt: "A production set" };
    expect(siteSettingsInputSchema.parse({ ...settings, showFeaturedOverlay: "on" }).showFeaturedOverlay).toBe(true);
    expect(siteSettingsInputSchema.parse(settings).showFeaturedOverlay).toBe(false);
  });

  it("accepts editable About and Privacy Policy page content", () => {
    const settings = {
      siteName: "FrameVault",
      heroEyebrow: "Curated films",
      heroTitle: "Watch remarkable stories",
      heroDescription: "A complete homepage description.",
      heroImageAlt: "A production set",
      aboutPageLabel: "About the owner",
      aboutPageContent: "Information about the person responsible for this website.",
      privacyPolicyLabel: "Data protection",
      privacyPolicyContent: "This page explains how personal data is handled.",
    };
    const result = siteSettingsInputSchema.parse(settings);
    expect(result.aboutPageLabel).toBe("About the owner");
    expect(result.privacyPolicyContent).toContain("personal data");
  });

  it("limits information page content length", () => {
    const settings = { siteName: "FrameVault", heroEyebrow: "Curated films", heroTitle: "Watch remarkable stories", heroDescription: "A complete homepage description.", heroImageAlt: "A production set", aboutPageContent: "x".repeat(50_001) };
    expect(siteSettingsInputSchema.safeParse(settings).success).toBe(false);
  });

  it("accepts editable visitor entry questions", () => {
    const result = siteSettingsInputSchema.parse({
      siteName: "FrameVault",
      heroEyebrow: "Curated films",
      heroTitle: "Watch remarkable stories",
      heroDescription: "A complete homepage description.",
      heroImageAlt: "A production set",
      ageGateTitle: "Have you reached the legal age of 18?",
      ageGateDescription: "Please confirm that you are legally permitted to view adult-themed podcast content.",
      ageGateAcceptLabel: "Yes, continue",
      ageGateDeclineLabel: "No, leave this site",
      cookieGateTitle: "Do you consent to cookies?",
      cookieGateDescription: "We store your consent choice in a cookie on this device.",
      cookieGateAcceptLabel: "Accept cookies",
      cookieGateDeclineLabel: "Decline cookies",
    });
    expect(result.ageGateTitle).toContain("legal age");
    expect(result.cookieGateAcceptLabel).toBe("Accept cookies");
  });

  it("requires useful category names", () => {
    expect(categoryInputSchema.safeParse({ name: "A", sortOrder: 0 }).success).toBe(false);
  });
});
