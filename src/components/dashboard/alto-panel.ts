/**
 * Alto exacto del area de contenido del panel, para pantallas que deben
 * ocupar la pantalla entera SIN desplazar la pagina (el Punto de Venta, con su
 * propio scroll interno en productos y carrito).
 *
 *   100vh
 *   − 64 px  encabezado del panel (`h-16`, src/components/layout/header.tsx)
 *   − 16 px  relleno superior de <main> en celular (`pt-4`) | 24 px desde md (`md:pt-6`)
 *   − 57 px  pie legal en celular | 65 px desde md (src/components/dashboard/legal-footer.tsx):
 *            `mt-6` (24) + borde (1) + `py-2` (16) | `md:py-3` (24) + una linea `leading-4` (16)
 *   ─────────
 *   = 100vh − 137 px (celular) | 100vh − 153 px (md en adelante)
 *
 * <main> ya no tiene relleno inferior (dashboard-shell.tsx): el pie queda
 * pegado al fondo. Antes el POS usaba `100vh − 3.5rem` y medía ~120 px de
 * más, asi que la pagina se desplazaba y el pie quedaba fuera de la pantalla.
 *
 * ⚠️ Si cambia el alto del encabezado, el relleno de <main> o el pie, hay que
 * rehacer esta cuenta. `legal-footer.test.ts` vigila que esas tres piezas
 * sigan como aqui se asume.
 *
 * Es una cadena literal a proposito: Tailwind escanea este archivo y genera
 * las dos clases. Armada con variables, no las encontraria.
 */
export const ALTO_PANEL_COMPLETO = "h-[calc(100vh-137px)] md:h-[calc(100vh-153px)]";
