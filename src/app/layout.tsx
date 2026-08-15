import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getLocale } from "next-intl/server";
import { Providers } from "./providers";
import { JsonLd } from "@/components/marketing/json-ld";
import { getSiteUrl } from "@/lib/site";
import { organizationSchema, websiteSchema } from "@/lib/seo/structured-data";
import "./globals.css";
import "sonner/dist/styles.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SYMVORA",
  description: "Plataforma SaaS Multi-Tenant basada en Mini-ERP modular",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBFBFA" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0C0C" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const siteUrl = getSiteUrl();
  const org = organizationSchema(siteUrl, {
    description:
      "Sistema de punto de venta, inventarios y facturación CFDI 4.0 para PyMEs mexicanas.",
  });
  const site = websiteSchema(siteUrl);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-sans antialiased`}
      >
        <Providers>{children}</Providers>
        <JsonLd id="ld-organization" data={org} />
        <JsonLd id="ld-website" data={site} />
      </body>
    </html>
  );
}
