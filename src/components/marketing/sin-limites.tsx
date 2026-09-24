"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { BadgePercent, Package, Users } from "lucide-react";

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
  { clave: "usuarios", icono: Users },
  { clave: "productos", icono: Package },
  { clave: "comisiones", icono: BadgePercent },
] as const;

export function SinLimites({
  alineacion = "inicio",
  retraso = 0,
}: {
  alineacion?: "inicio" | "centro";
  retraso?: number;
}) {
  const t = useTranslations();

  return (
    <motion.ul
      className={`flex flex-wrap gap-2 ${alineacion === "centro" ? "justify-center" : ""}`}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ delay: retraso, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {ITEMS.map(({ clave, icono: Icono }) => (
        <li
          key={clave}
          className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300"
        >
          <Icono className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
          {t(`landing.sinLimites.${clave}`)}
        </li>
      ))}
    </motion.ul>
  );
}
