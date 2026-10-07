/**
 * Alto exacto del area de contenido del panel, para pantallas que deben
 * ocupar la pantalla entera SIN desplazar la pagina (el Punto de Venta, con su
 * propio scroll interno en productos y carrito).
 *
 *   100dvh
 *   − 64 px  encabezado del panel (`h-16`, src/components/layout/header.tsx)
 *   − 16 px  relleno superior de <main> en celular (`pt-4`) | 24 px desde md (`md:pt-6`)
 *   − 56 px  pie legal en celular | 64 px desde md (src/components/dashboard/legal-footer.tsx):
 *            `mt-6` (24) + `py-2` (16) | `md:py-3` (24) + una linea `leading-4` (16).
 *            Ya sin borde superior (se quito para un panel mas limpio).
 *   − 64 px  + safe area: SOLO por debajo de lg, el hueco del dock pegado al
 *            borde inferior (`dock-movil.tsx`), que es el relleno inferior de
 *            <main> (`pb-[calc(4rem+env(safe-area-inset-bottom))]`)
 *   ─────────
 *   = 100dvh − 200 px − safe area (celular)
 *   = 100dvh − 216 px − safe area (md, tablet: aun con dock)
 *   = 100dvh − 152 px (lg en adelante: menu lateral, sin dock)
 *
 * En escritorio <main> no tiene relleno inferior (dashboard-shell.tsx): el pie
 * queda pegado al fondo. Antes el POS usaba `100vh − 3.5rem` y medía ~120 px
 * de más, asi que la pagina se desplazaba y el pie quedaba fuera de la pantalla.
 *
 * `dvh` y no `vh` (2026-10-06): en Chrome de Android `100vh` mide la pantalla
 * con la barra del navegador ESCONDIDA. Con la barra visible, el panel medía
 * de más, la pagina entera se desplazaba y "Ver carrito" quedaba detras del
 * dock. El contenedor del panel (`dashboard-shell.tsx`) usa `h-dvh` por lo mismo.
 *
 * Los AVISOS de arriba (franja de la demo, fin de prueba o pago vencido) van
 * en el flujo, encima del panel: el shell mide su alto y lo publica en
 * `--alto-avisos` (`dashboard-shell.tsx`); cada cuenta lo resta. Sin eso, con
 * un aviso visible la pagina media mas que la pantalla y en el POS "Ver
 * carrito" quedaba debajo del dock (demo en celular, 2026-10-07).
 *
 * ⚠️ Si cambia el alto del encabezado, el relleno de <main>, el pie o el dock,
 * hay que rehacer esta cuenta. `legal-footer.test.ts` vigila que esas piezas
 * sigan como aqui se asume.
 *
 * Es una cadena literal a proposito: Tailwind escanea este archivo y genera
 * las clases. Armada con variables, no las encontraria.
 */
export const ALTO_PANEL_COMPLETO =
  "h-[calc(100dvh-var(--alto-avisos,0px)-200px-env(safe-area-inset-bottom))] md:h-[calc(100dvh-var(--alto-avisos,0px)-216px-env(safe-area-inset-bottom))] lg:h-[calc(100dvh-var(--alto-avisos,0px)-152px)]";

/**
 * El mismo cálculo para el Punto de Venta, que por debajo de `lg` NO lleva el
 * pie legal (`legal-footer.tsx` lo oculta en `/pos`): se le suman sus 56 px en
 * celular y 64 px en md.
 *
 *   celular: 100dvh − 200 + 56 = 100dvh − 144 px − safe area
 *   md:      100dvh − 216 + 64 = 100dvh − 152 px − safe area
 *   lg:      igual que `ALTO_PANEL_COMPLETO` (el pie sí se ve)
 */
export const ALTO_PANEL_POS =
  "h-[calc(100dvh-var(--alto-avisos,0px)-144px-env(safe-area-inset-bottom))] md:h-[calc(100dvh-var(--alto-avisos,0px)-152px-env(safe-area-inset-bottom))] lg:h-[calc(100dvh-var(--alto-avisos,0px)-152px)]";
