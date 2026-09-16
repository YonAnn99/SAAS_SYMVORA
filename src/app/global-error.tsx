"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Ultima red de seguridad del App Router.
 *
 * POR QUE HACE FALTA AUNQUE YA ESTE SENTRY: un error lanzado durante el
 * renderizado de React lo atrapa React, no el `window.onerror` que instala el
 * SDK. Sin este componente, la pantalla se queda en blanco y en Sentry no
 * aparece nada — el peor de los dos mundos.
 *
 * Reemplaza al `layout` raiz cuando se dispara, asi que tiene que traer sus
 * propios `<html>` y `<body>`. No hereda estilos del layout, por eso va con
 * estilos en linea y no con clases de Tailwind.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0a0a0a",
          color: "#fafafa",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "420px", textAlign: "center" }}>
          <h1 style={{ fontSize: "18px", margin: "0 0 8px" }}>
            Algo salió mal
          </h1>
          <p style={{ fontSize: "14px", opacity: 0.7, margin: "0 0 20px" }}>
            Ya recibimos el aviso y lo estamos revisando. Intenta de nuevo en un
            momento.
          </p>
          {/*
            El `digest` es lo que permite encontrar ESTE error concreto en
            Sentry. Sin el, un reporte del cliente ("me salió un error") es
            imposible de casar con nada.
          */}
          {error.digest && (
            <p
              style={{
                fontSize: "11px",
                opacity: 0.45,
                fontFamily: "ui-monospace, monospace",
                margin: "0 0 20px",
              }}
            >
              Referencia: {error.digest}
            </p>
          )}
          {/*
            `<a>` y no `<Link>` A PROPOSITO: aquí el árbol de React ya reventó.
            Una navegación de cliente reutilizaría la misma aplicación rota;
            hace falta una recarga completa para partir de cero.
          */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              display: "inline-block",
              padding: "8px 16px",
              borderRadius: "8px",
              background: "#fafafa",
              color: "#0a0a0a",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            Volver al inicio
          </a>
        </div>
      </body>
    </html>
  );
}
