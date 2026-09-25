"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
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
}: {
  alineacion?: "inicio" | "centro";
  retraso?: number;
}) {
  const t = useTranslations();
  const centro = alineacion === "centro";

  return (
    <motion.ul
      className={`flex flex-col sm:flex-row sm:flex-wrap border-t border-[#EAEAEA] dark:border-white/[0.08] sm:pt-[22px] ${
        centro ? "w-full max-w-sm sm:max-w-none mx-auto sm:justify-center" : ""
      }`}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ delay: retraso, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {ITEMS.map(({ clave, icono: Icono, acento }) => (
        <li
          key={clave}
          className="flex items-center gap-3 sm:gap-2.5 py-3 sm:py-0 border-b last:border-b-0 sm:border-b-0 border-[#EAEAEA] dark:border-white/[0.08] sm:px-[22px] sm:first:pl-0 sm:last:pr-0 sm:border-l sm:first:border-l-0 text-left"
        >
          <span className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center shrink-0 ${acento}`} aria-hidden="true">
            <Icono className="w-4 h-4" strokeWidth={2} />
          </span>
          <span className="flex flex-1 sm:flex-none items-center sm:flex-col sm:items-start gap-2 sm:gap-px min-w-0">
            <span className="flex-1 sm:flex-none text-sm font-semibold text-[#111111] dark:text-[#F5F4F0]">
              {t(`landing.sinLimites.${clave}`)}
            </span>
            <span className="text-xs text-right sm:text-left text-[#787774] dark:text-[#9A9791]">
              {t(`landing.sinLimites.${clave}Detalle`)}
            </span>
          </span>
        </li>
      ))}
    </motion.ul>
  );
}
