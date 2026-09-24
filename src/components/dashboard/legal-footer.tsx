"use client";

import { useLocale } from "next-intl";

/**
 * Pie legal del panel.
 *
 * NO va clavado: `dashboard-shell` lo monta DENTRO de `<main>`, que es el
 * elemento que hace scroll. Antes era hermano de `main` dentro de un contenedor
 * `h-screen overflow-hidden`, asi que quedaba fijo abajo y en un telefono se
 * comia ~65px de forma permanente (con la cabecera, cerca del 17% de la
 * pantalla). Si alguien lo saca de `main`, vuelve el problema.
 *
 * Es el UNICO sitio del panel con enlaces legales — los demas estan en el
 * login, la landing y los banners de cookies, ninguno alcanzable en el uso
 * diario. Por eso se compacta en vez de quitarse.
 */
export function LegalFooter() {
  const locale = useLocale();

  const MARKETING = "https://www.symvora.com.mx";

  const links = [
    { href: `${MARKETING}/${locale}/terminos`, label: "Términos" },
    { href: `${MARKETING}/${locale}/aviso-privacidad`, label: "Privacidad" },
    { href: `${MARKETING}/${locale}/politica-cookies`, label: "Cookies" },
  ];

  return (
    // Colores por token del tema, nunca fijos: con `bg-neutral-50` el pie salia
    // como una franja BLANCA sobre el panel en modo oscuro.
    <footer className="mt-6 border-t border-border bg-muted/30 px-4 py-2 md:px-6 md:py-3">
      {/* `leading-4` fijo: con `text-[11px]` el interlineado heredado era
          16.5 px y el alto del pie no era exacto. `alto-panel.ts` cuenta con
          una linea de 16 px. */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] leading-4 text-muted-foreground sm:justify-between sm:text-xs sm:leading-4">
        <span>
          © 2026 SYMVORA.
          {/* La frase entera no cabe en 360px junto a los tres enlaces. */}
          <span className="hidden sm:inline"> Todos los derechos reservados.</span>
        </span>

        <nav
          aria-label="Enlaces legales"
          className="flex items-center gap-x-3 sm:gap-x-4"
        >
          {links.map((link) => (
            // `<a>` normal, NO el `Link` de `@/i18n/navigation`: estos son URLs
            // absolutas a otro dominio y ese componente es para rutas internas
            // — les antepondria el idioma. Pasarle algo que no es un pathname
            // interno ya provoco un 404 en este proyecto.
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
