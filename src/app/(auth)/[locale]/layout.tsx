import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { ParticleCanvas } from "@/components/auth/particle-canvas";

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
      <div className="flex min-h-screen">
        <div className="flex w-1/2 items-center justify-center overflow-y-auto p-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
        <div className="relative hidden w-1/2 bg-muted/30 lg:block">
          <ParticleCanvas />
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
