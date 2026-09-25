"use client";

import { LazyMotion } from "motion/react";

// Import dinamico: el motor de animacion sale del JS inicial de la landing.
const cargarAnimaciones = () => import("./animaciones-motion").then((mod) => mod.default);

/**
 * `motion` en version ligera para las paginas de marketing.
 *
 * Los componentes de la landing usan `m.*` (de `motion/react-m`, la entrada que
 * permite descartar lo que no se usa) en lugar de `motion.*`: `m` no trae
 * consigo el motor de animacion, que aqui se carga UNA vez, en diferido, con
 * `LazyMotion`. Hasta que llega, los elementos se muestran en su estado inicial.
 * `domAnimation` (animate, variants, exit, hover/tap, whileInView): NO incluye
 * animaciones de layout (`layout`, `layoutId`), que pesan mucho mas. Si algun
 * componente las necesita, cambia a `domMax` sabiendo lo que cuesta.
 *
 * Todo componente con `m.*` debe renderizarse dentro de este proveedor (esta en
 * `app/[locale]/layout.tsx`); fuera de el no animaria.
 */
export function Movimiento({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={cargarAnimaciones}>{children}</LazyMotion>;
}
