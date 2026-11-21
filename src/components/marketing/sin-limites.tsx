"use client";

import { useTranslations } from "next-intl";
import * as m from "motion/react-m";
import { CirclePercent, Package, Users } from "lucide-react";

/**
 * "Usuarios ilimitados · Productos ilimitados · Sin comisiones por venta":
 * los tres argumentos que el dueño quiere al frente, en el hero y en precios.
 *
 * Son CIERTOS hoy y hay que mantenerlos asi: el sistema no limita usuarios
 * (solo frena abusos con 20 invitaciones por hora, `api/users/invite`) ni
 * productos, y la suscripcion es una cuota fija. Si algun dia se pone un tope,
 * este componente es lo primero que hay que cambiar.
 */
const ITEMS = [
  {
    clave: "usuarios",
    icono: Users,
    acento: "bg-[#EDF3EC] text-[#346538] dark:bg-[rgba(52,101,56,0.22)] dark:text-[#9CC5A1]",
  },
  {
    clave: "productos",
    icono: Package,
    acento: "bg-[#E1F3FE] text-[#1F6C9F] dark:bg-[rgba(31,108,159,0.24)] dark:text-[#8CC4EA]",
  },
  {
    clave: "comisiones",
    icono: CirclePercent,
    acento: "bg-[#FBF3DB] text-[#956400] dark:bg-[rgba(149,100,0,0.26)] dark:text-[#E2BD6B]",
  },
] as const;

/**
 * Estilo minimalista (skill `minimalist-ui`): en vez de chips azules, una fila
 * separada por lineas finas, cada punto con un acento pastel y una frase corta.
 * En celular pasa a una lista vertical con divisores.
 */
export function SinLimites({
  alineacion = "inicio",
  retraso = 0,
  visibleDesdeInicio = false,
  compactoMovil = false,
}: {
  alineacion?: "inicio" | "centro";
  retraso?: number;
  /** En el hero se ve sin desplazar: no debe llegar oculto (`opacity: 0`) y
   *  esperar al JS para aparecer. */
  visibleDesdeInicio?: boolean;
  /** En celular, tres columnas con el icono arriba y sin el detalle (ocupa una
   *  tercera parte del alto de la lista vertical). Desde `sm` es igual. */
  compactoMovil?: boolean;
}) {
  const t = useTranslations();
  const centro = alineacion === "centro";

  return (
    <m.ul
      className={`${
        compactoMovil ? "grid grid-cols-3 sm:flex" : "flex flex-col"
      } sm:flex-row sm:flex-wrap border-t border-[#EAEAEA] dark:border-white/[0.08] sm:pt-[22px] ${
        centro ? "w-full max-w-sm sm:max-w-none mx-auto sm:justify-center" : ""
      }`}
      initial={visibleDesdeInicio ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ delay: retraso, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {ITEMS.map(({ clave, icono: Icono, acento }) => (
        <li
          key={clave}
          className={`flex items-center border-[#EAEAEA] dark:border-white/[0.08] sm:px-[22px] sm:first:pl-0 sm:last:pr-0 sm:border-l sm:first:border-l-0 sm:border-b-0 sm:py-0 sm:gap-2.5 sm:text-left ${
            compactoMovil
              ? "flex-col sm:flex-row gap-1.5 px-1 py-3 text-center"
              : "gap-3 py-3 border-b last:border-b-0 text-left"
          }`}
        >
          <span className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center shrink-0 ${acento}`} aria-hidden="true">
            <Icono className="w-4 h-4" strokeWidth={2} />
          </span>
          <span className={`flex items-center sm:flex-col sm:items-start gap-2 sm:gap-px min-w-0 ${compactoMovil ? "" : "flex-1 sm:flex-none"}`}>
            <span className={`font-semibold text-[#111111] dark:text-[#F5F4F0] ${compactoMovil ? "text-xs leading-tight sm:text-sm" : "text-sm flex-1 sm:flex-none"}`}>
              {t(`landing.sinLimites.${clave}`)}
            </span>
            <span className={`text-xs text-right sm:text-left text-[#787774] dark:text-[#9A9791] ${compactoMovil ? "hidden sm:inline" : ""}`}>
              {t(`landing.sinLimites.${clave}Detalle`)}
            </span>
          </span>
        </li>
      ))}
    </m.ul>
  );
}
