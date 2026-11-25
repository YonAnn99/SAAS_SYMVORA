import { nivelesActivos } from "@/lib/niveles";

/**
 * Claves de las preguntas frecuentes de la landing con los niveles ENCENDIDOS (`NEXT_PUBLIC_NIVELES_ACTIVOS`).
 *
 * Con el plan unico se usa el `FAQ_KEYS` de siempre (vive en `faq.tsx` y en la pagina, iguales, porque la
 * pagina es Server Component y arma el JSON-LD). Con niveles cambian las respuestas que decian «$399»
 * (3 y 5), la de limites (9, ya no es «el mismo plan para todos») y suman «cambiar de plan» (10) y
 * «que plan me conviene» (11). Usuarios y productos siguen ilimitados en los tres niveles.
 */
export const FAQ_KEYS_NIVELES = ["1", "2", "3n", "4", "5n", "7", "8", "9n", "10", "11"] as const;

export function faqClaves<T extends string>(base: readonly T[]): readonly string[] {
  return nivelesActivos() ? FAQ_KEYS_NIVELES : base;
}
