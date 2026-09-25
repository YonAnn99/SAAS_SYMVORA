import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { CookieConsent } from "@/components/compliance/cookie-consent";
import { IdiomaHtml } from "@/components/idioma-html";
import { Movimiento } from "@/components/marketing/movimiento";

const ESPACIOS_CLIENTE = ["landing", "cookies", "notFound", "common"] as const;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
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

  // Sin esto next-intl lee el idioma de las cabeceras y la ruta deja de ser
  // estatica: la landing se prerenderiza y sale del CDN gracias a esta linea.
  // (Cada pagina que use next-intl en el servidor tiene que llamarla tambien.)
  setRequestLocale(locale);

  // Al navegador solo van los textos que usan los componentes cliente de las
  // paginas de marketing. Antes viajaban TODOS los del sistema (auth,
  // tutorial, billing, productos...: ~30 KB de 43) dentro del HTML de la
  // landing. Las paginas de servidor (`getTranslations`) siguen leyendo todo.
  // Si un componente cliente nuevo usa otro espacio de nombres, agregalo aqui.
  const todos = await getMessages();
  const messages = Object.fromEntries(
    ESPACIOS_CLIENTE.filter((clave) => clave in todos).map((clave) => [clave, todos[clave]])
  );

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <IdiomaHtml locale={locale} />
      <Movimiento>{children}</Movimiento>
      <CookieConsent />
    </NextIntlClientProvider>
  );
}
