"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type GateStep = "age" | "cookies" | "denied" | "open";

const CONSENT_COOKIE = "framevault_cookie_consent";

export interface EntryGateContent {
  entryGateBadge: string;
  ageGateEyebrow: string;
  cookieGateEyebrow: string;
  deniedGateEyebrow: string;
  deniedGateTitle: string;
  deniedGateDescription: string;
  deniedGateRetryLabel: string;
  ageGateTitle: string;
  ageGateDescription: string;
  ageGateAcceptLabel: string;
  ageGateDeclineLabel: string;
  cookieGateTitle: string;
  cookieGateDescription: string;
  cookieGateAcceptLabel: string;
  cookieGateDeclineLabel: string;
  cookieConsentVersion: string;
}

function hasCookieConsent(version: string) {
  return document.cookie
    .split(";")
    .some((cookie) => cookie.trim() === `${CONSENT_COOKIE}=${version}`);
}

export function EntryGate({ content }: { content: EntryGateContent }) {
  const [step, setStep] = useState<GateStep>("age");
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  useEffect(() => {
    if (step === "open" || isAdmin) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isAdmin, step]);

  function acceptAge() {
    setStep(hasCookieConsent(content.cookieConsentVersion) ? "open" : "cookies");
  }

  function acceptCookies() {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${CONSENT_COOKIE}=${content.cookieConsentVersion}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
    setStep("open");
  }

  if (step === "open" || isAdmin) return null;

  return (
    <div className="entry-gate" role="presentation">
      <section
        className="entry-gate-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-gate-title"
        aria-describedby="entry-gate-description"
      >
        {content.entryGateBadge && <div className="entry-gate-mark" aria-hidden="true">{content.entryGateBadge}</div>}

        {step === "age" && (
          <>
            <div className="eyebrow">{content.ageGateEyebrow}</div>
            <h1 id="entry-gate-title">{content.ageGateTitle}</h1>
            <p id="entry-gate-description">{content.ageGateDescription}</p>
            <div className="entry-gate-actions">
              <button className="btn" type="button" onClick={acceptAge} autoFocus>{content.ageGateAcceptLabel}</button>
              <button className="ghost" type="button" onClick={() => setStep("denied")}>{content.ageGateDeclineLabel}</button>
            </div>
          </>
        )}

        {step === "cookies" && (
          <>
            <div className="eyebrow">{content.cookieGateEyebrow}</div>
            <h1 id="entry-gate-title">{content.cookieGateTitle}</h1>
            <p id="entry-gate-description">{content.cookieGateDescription}</p>
            <div className="entry-gate-actions">
              <button className="btn" type="button" onClick={acceptCookies} autoFocus>{content.cookieGateAcceptLabel}</button>
              <button className="ghost" type="button" onClick={() => setStep("denied")}>{content.cookieGateDeclineLabel}</button>
            </div>
          </>
        )}

        {step === "denied" && (
          <>
            <div className="eyebrow">{content.deniedGateEyebrow}</div>
            <h1 id="entry-gate-title">{content.deniedGateTitle}</h1>
            <p id="entry-gate-description">
              {content.deniedGateDescription}
            </p>
            <button className="ghost" type="button" onClick={() => setStep("age")} autoFocus>{content.deniedGateRetryLabel}</button>
          </>
        )}
      </section>
    </div>
  );
}
