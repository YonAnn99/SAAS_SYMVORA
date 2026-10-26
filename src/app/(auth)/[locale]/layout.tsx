import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { IdiomaHtml } from "@/components/idioma-html";
import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

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
      <IdiomaHtml locale={locale} />
      <div className="auth-page-wrapper">
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
          /* El mismo oscuro del celular: en escritorio el login lo tapa todo;
             en celular es el margen de la tarjeta, y en "completar registro"
             o "restablecer contrasena" el fondo de la suya. */
          background: #0c0c0c;
        }
        /* El login/registro ocupa toda la pantalla, en escritorio y en
           celular: sin margen. */
        .auth-page-wrapper:has(.auth-container:not(.auth-completar)) {
          padding: 0;
        }
        /* Celular: el alto VISIBLE (dvh) y estirado. Con 100vh (que en Chrome
           de Android cuenta la barra de direcciones) y centrado quedaban
           bandas negras arriba o abajo del login (misma consulta que
           auth-toggle.css). */
        @media (max-width: 768px), (max-width: 1024px) and (pointer: coarse) {
          .auth-page-wrapper:has(.auth-container:not(.auth-completar)) {
            min-height: 100dvh;
            align-items: stretch;
            background: #1e3a8a;
          }
        }
        .auth-page-wrapper > * {
          position: relative;
          z-index: 2;
        }
      `}</style>
    </NextIntlClientProvider>
  );
}
