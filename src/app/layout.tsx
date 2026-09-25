import type { Metadata, Viewport } from "next";
import { Outfit, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import { JsonLd } from "@/components/marketing/json-ld";
import { getSiteUrl } from "@/lib/site";
import { organizationSchema, websiteSchema } from "@/lib/seo/structured-data";
import "./globals.css";
import "sonner/dist/styles.css";

// Sin `weight`: asi se descarga la version VARIABLE de Outfit, un solo archivo
// con todos los grosores. Con la lista de 6 pesos eran 6 archivos woff2.
const outfitSans = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

// Solo etiquetas pequeñas (las "PARA TU GIRO"): no merece precarga y competir
// con la fuente principal por el ancho de banda del primer pintado.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
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
        url: "/og-symvora.jpeg",
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "SYMVORA — Punto de venta e inventario para PyMEs",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SYMVORA",
    description:
      "Punto de venta, inventario y finanzas para PyMEs mexicanas.",
    images: ["/og-symvora.jpeg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0A0A0A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const siteUrl = getSiteUrl();
  const org = organizationSchema(siteUrl, {
    description:
      "Sistema de punto de venta, inventarios y finanzas para PyMEs mexicanas.",
  });
  const site = websiteSchema(siteUrl);

  return (
    // `lang` fijo y SIN `getLocale()`: leer el idioma aqui obligaba a mirar las
    // cabeceras de la peticion, y eso volvia dinamica TODA la app, incluida la
    // landing (se renderizaba en cada visita, sin CDN: TTFB de 300-750 ms).
    // El layout raiz no recibe el `[locale]`; lo corrige `<IdiomaHtml>` en los
    // layouts de cada idioma. Español por defecto: el mercado es Mexico.
    <html lang="es" suppressHydrationWarning>
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
