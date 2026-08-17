import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { GradientWaves } from "@/components/auth/gradient-waves";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="auth-page-wrapper">
        <GradientWaves className="auth-gradient-waves" />
        <div className="auth-noise-overlay" />
        {children}
      </div>
      <style>{`
        .auth-page-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          position: relative;
          background: linear-gradient(135deg, #ffffff 0%, #e5e5e5 30%, #a3a3a3 60%, #1a1a1a 100%);
        }
        .auth-gradient-waves {
          position: fixed;
          inset: 0;
          z-index: 0;
        }
        .auth-noise-overlay {
          position: fixed;
          inset: 0;
          opacity: 0.035;
          pointer-events: none;
          z-index: 1;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 256px 256px;
        }
        .auth-page-wrapper > *:not(.auth-noise-overlay):not(.auth-gradient-waves) {
          position: relative;
          z-index: 2;
        }
      `}</style>
    </NextIntlClientProvider>
  );
}
