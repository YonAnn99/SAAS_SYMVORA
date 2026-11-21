import Image from "next/image";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";

/**
 * Mockups del hero: el panel de SYMVORA en laptop, tablet y celular, uno a la vez, en bucle.
 *
 * - El MODO (claro/oscuro) se resuelve por CSS (`dark:hidden` / `hidden dark:block`), nunca leyendo el tema
 *   en JS: así no hay parpadeo ni desajuste de hidratación al cargar o al cambiar el tema.
 * - La ALTERNANCIA es CSS puro (`.hero-mockup` en globals.css): sin JS, sin reloj en la página. El primero
 *   está visible desde el primer pintado. Con `prefers-reduced-motion` se queda solo el primero.
 * - Las imágenes salen de `scripts/mockups-hero.mjs` (el modo oscuro se compone con los MISMOS marcos que
 *   el claro). Si cambias un tamaño aquí, cámbialo allí: `ancho`/`alto` son los de los WebP.
 */
export const MOCKUPS_HERO = [
  { clave: "laptop", ancho: 1080, alto: 630 },
  { clave: "tablet", ancho: 1042, alto: 577 },
  { clave: "movil", ancho: 442, alto: 890 },
] as const;

export type ModoMockup = "claro" | "oscuro";

/** Ruta pública del WebP de un dispositivo en un modo. */
export function rutaMockup(modo: ModoMockup, clave: (typeof MOCKUPS_HERO)[number]["clave"]): string {
  return `/landing/hero/${modo}-${clave}.webp`;
}

export function HeroMockups() {
  const t = useTranslations("landing.hero.mockups");

  return (
    <div
      role="group"
      aria-label={t("grupo")}
      className="relative w-full max-w-[560px] aspect-square"
    >
      {MOCKUPS_HERO.map((m, i) => (
        <div
          key={m.clave}
          className="hero-mockup absolute inset-0"
          style={{ "--i": i } as CSSProperties}
        >
          {(["claro", "oscuro"] as const).map((modo) => (
            <Image
              key={modo}
              src={rutaMockup(modo, m.clave)}
              alt={t(m.clave)}
              width={m.ancho}
              height={m.alto}
              // Solo el primero se pide al cargar; los otros, al acercarse (y el juego del modo que no está
              // activo, `display: none`, el navegador ni lo descarga).
              loading={i === 0 ? "eager" : "lazy"}
              // Ya vienen optimizadas (WebP recortado): el optimizador de Next no aporta nada.
              unoptimized
              draggable={false}
              className={`absolute inset-0 m-auto h-full w-full object-contain drop-shadow-xl select-none ${
                modo === "claro" ? "dark:hidden" : "hidden dark:block"
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
