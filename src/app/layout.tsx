import type { Metadata, Viewport } from "next";
import { Outfit, Geist_Mono } from "next/font/google";
import { getLocale } from "next-intl/server";
import { Providers } from "./providers";
import { JsonLd } from "@/components/marketing/json-ld";
import { getSiteUrl } from "@/lib/site";
import { organizationSchema, websiteSchema } from "@/lib/seo/structured-data";
import "./globals.css";
import "sonner/dist/styles.css";

const outfitSans = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "SYMVORA",
  description:
    "Punto de venta, inventario y finanzas para PyMEs mexicanas.",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SYMVORA",
    startupImage: [
      {
        url: "/splash/iphone-se-750x1334.png",
        media:
          "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        url: "/splash/iphone-mini-1125x2436.png",
        media:
          "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/iphone-standard-1170x2532.png",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/iphone-pro-1179x2556.png",
        media:
          "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/iphone-plus-max-1284x2778.png",
        media:
          "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/iphone-pro-max-1290x2796.png",
        media:
          "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/ipad-10-1620x2160.png",
        media:
          "(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        url: "/splash/ipad-pro-11-1668x2388.png",
        media:
          "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        url: "/splash/ipad-pro-12-2048x2732.png",
        media:
          "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
    ],
  },
  openGraph: {
    title: "SYMVORA",
    description:
      "Punto de venta, inventario y finanzas para PyMEs mexicanas.",
    url: `${getSiteUrl()}/es`,
    siteName: "SYMVORA",
    locale: "es_MX",
    type: "website",
    images: [
      {
        url: "/og-symvora-v3.jpg",
        width: 1200,
        height: 630,
        alt: "SYMVORA — Punto de venta e inventario para PyMEs",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SYMVORA",
    description:
      "Punto de venta, inventario y finanzas para PyMEs mexicanas.",
    images: ["/og-symvora-v3.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0A0A0A",
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
      "Sistema de punto de venta, inventarios y finanzas para PyMEs mexicanas.",
  });
  const site = websiteSchema(siteUrl);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${outfitSans.variable} ${geistMono.variable} min-h-screen font-sans antialiased`}
      >
        {/* Noise overlay - fixed, pointer-events-none */}
        <div className="noise-overlay" aria-hidden="true" />
        <Providers>{children}</Providers>
        <script
          type="application/ld+json"
          id="ld-organization"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }}
        />
        <script
          type="application/ld+json"
          id="ld-website"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(site) }}
        />
      </body>
    </html>
  );
}