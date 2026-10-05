import type { Metadata } from "next";
import { EntryGate } from "@/components/public/entry-gate";
import { hasServerConfiguration } from "@/lib/env";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/repositories";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || process.env.URL || "http://localhost:3000"),
  title: { default: "FrameVault — Video Gallery", template: "%s — FrameVault" },
  description: "A curated, cloud-hosted video gallery.",
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = hasServerConfiguration() ? await getSettings() : DEFAULT_SETTINGS;
  const entryGateContent = {
    entryGateBadge: settings.entryGateBadge,
    ageGateEyebrow: settings.ageGateEyebrow,
    cookieGateEyebrow: settings.cookieGateEyebrow,
    deniedGateEyebrow: settings.deniedGateEyebrow,
    deniedGateTitle: settings.deniedGateTitle,
    deniedGateDescription: settings.deniedGateDescription,
    deniedGateRetryLabel: settings.deniedGateRetryLabel,
    ageGateTitle: settings.ageGateTitle,
    ageGateDescription: settings.ageGateDescription,
    ageGateAcceptLabel: settings.ageGateAcceptLabel,
    ageGateDeclineLabel: settings.ageGateDeclineLabel,
    cookieGateTitle: settings.cookieGateTitle,
    cookieGateDescription: settings.cookieGateDescription,
    cookieGateAcceptLabel: settings.cookieGateAcceptLabel,
    cookieGateDeclineLabel: settings.cookieGateDeclineLabel,
    cookieConsentVersion: settings.cookieConsentVersion,
  };
  return (
    <html lang="en">
      <body>
        <EntryGate content={entryGateContent} />
        {children}
      </body>
    </html>
  );
}
