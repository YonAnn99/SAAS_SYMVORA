/**
 * Textos de los avisos por SMS. Puro (sin red ni base) para poder probarlo.
 *
 * POR QUE GSM-7: un SMS mide 160 caracteres solo si TODO el texto cabe en el
 * alfabeto GSM-7. Con un solo caracter fuera (una "á", un emoji, una comilla
 * tipografica) el operador lo manda en UCS-2: trozos de 70 y se cobra 2 o 3
 * veces. Por eso se quitan los acentos (la ñ si esta en GSM-7) y el aviso se
 * acota a 160.
 */

import type { ValoresPlantilla } from "@/lib/whatsapp-plantillas";

export const MAX_SMS = 160;

// Alfabeto basico GSM 03.38 (sin la tabla extendida: `{}[]~\|^€` cuentan doble).
const GSM7 =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const EN_GSM7 = new Set(GSM7);

const EQUIVALENTES: Record<string, string> = {
  "…": "...",
  "“": '"',
  "”": '"',
  "‘": "'",
  "’": "'",
  "–": "-",
  "—": "-",
  " ": " ",
};

/** Texto apto para un SMS de un solo alfabeto (GSM-7), en una linea. */
export function aGSM7(texto: string): string {
  let salida = "";
  for (const c of texto.replace(/[\r\n\t]+/g, " ")) {
    if (c === "ñ" || c === "Ñ") {
      salida += c;
      continue;
    }
    if (EQUIVALENTES[c]) {
      salida += EQUIVALENTES[c];
      continue;
    }
    // "á" -> "a" + acento combinado; el acento se descarta.
    const base = c.normalize("NFD").replace(/[̀-ͯ]/g, "");
    for (const b of base) if (EN_GSM7.has(b)) salida += b;
  }
  return salida.replace(/ {2,}/g, " ").trim();
}

function recortar(texto: string, sobra: number, minimo = 8): string {
  if (sobra <= 0) return texto;
  const largo = Math.max(minimo, texto.length - sobra - 3);
  return largo >= texto.length ? texto : `${texto.slice(0, largo).trimEnd()}...`;
}

/**
 * Aviso de corte de caja por SMS, con los mismos valores que la plantilla
 * `corte_caja` de WhatsApp. Siempre cabe en un SMS: si no, se recorta primero
 * el negocio y luego la sucursal.
 */
export function textoCorteCajaSMS(valores: ValoresPlantilla<"corte_caja">): string {
  let negocio = aGSM7(valores.negocio) || "tu negocio";
  let sucursal = aGSM7(valores.sucursal) || "caja principal";
  const quien = aGSM7(valores.quien);
  const ventas = aGSM7(valores.ventas);
  const diferencia = aGSM7(valores.diferencia);

  const armar = () =>
    `SYMVORA: Corte de caja en ${negocio} (${sucursal}): ${quien}. Ventas ${ventas}. Diferencia: ${diferencia}. Detalle en tu correo.`;

  negocio = recortar(negocio, armar().length - MAX_SMS);
  sucursal = recortar(sucursal, armar().length - MAX_SMS);
  return armar().slice(0, MAX_SMS);
}
