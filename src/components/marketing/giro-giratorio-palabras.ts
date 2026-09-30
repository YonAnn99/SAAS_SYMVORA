/**
 * Las palabras que rotan en el hero ("hecho para tu ___"), en el orden de los
 * giros. En español sale del `tu` de cada giro ("tu farmacia" -> "farmacia"),
 * que ya esta escrito para ir despues de "tu"; en ingles, del nombre del giro.
 * Asi un giro nuevo aparece solo en el hero.
 */

import { GIROS } from "@/features/marketing/giros";

export function palabrasDelHero(idioma: "es" | "en"): string[] {
  return GIROS.map((g) =>
    idioma === "en" ? g.nombre.en.toLowerCase() : g.tu.replace(/^tu\s+/i, "")
  );
}
