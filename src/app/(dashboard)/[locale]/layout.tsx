import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { IdiomaHtml } from "@/components/idioma-html";
import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SplashEntrada } from "@/components/marketing/splash-entrada";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(["es", "en"], locale)) notFound();

  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {/* Splash animado al abrir la app instalada (PWA / APK); en el navegador no sale. */}
      <SplashEntrada variante="app" />
      <IdiomaHtml locale={locale} />
      <DashboardShell>{children}</DashboardShell>
    </NextIntlClientProvider>
  );
}
