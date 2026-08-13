"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";

const CONSENT_COOKIE = "symvora_consent";
const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function hasConsentCookie(): boolean {
  if (typeof document === "undefined") return true;
  return document.cookie
    .split("; ")
    .some((entry) => entry.startsWith(`${CONSENT_COOKIE}=`));
}

const consentListeners = new Set<() => void>();

function subscribeConsent(listener: () => void) {
  consentListeners.add(listener);
  return () => {
    consentListeners.delete(listener);
  };
}

function getConsentSnapshot(): boolean {
  return hasConsentCookie();
}

export function CookieConsent() {
  const t = useTranslations("cookies");
  const locale = useLocale();
  const hasConsent = useSyncExternalStore(
    subscribeConsent,
    getConsentSnapshot,
    () => true
  );

  const handleAccept = () => {
    document.cookie = `${CONSENT_COOKIE}=accepted; path=/; max-age=${CONSENT_MAX_AGE_SECONDS}; samesite=lax`;
    consentListeners.forEach((listener) => listener());
  };

  if (hasConsent) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t("title")}
      className="fixed bottom-0 inset-x-0 z-[999] px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="max-w-3xl mx-auto bg-white border border-neutral-200 rounded-xl shadow-lg ring-1 ring-black/5 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="flex-1 text-sm text-neutral-600 leading-relaxed">
          {t("message")}{" "}
          <Link
            href={`/${locale}/politica-cookies`}
            className="text-neutral-900 underline underline-offset-2 hover:text-black"
          >
            {t("learnMore")}
          </Link>
        </p>
        <button
          onClick={handleAccept}
          className="shrink-0 bg-black text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2"
        >
          {t("accept")}
        </button>
      </div>
    </div>
  );
}