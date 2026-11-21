import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Un botón con `.btn-llenado` (las clases `CAPSULA`) NO lleva `whileHover`/`whileTap` de motion en el MISMO elemento.
 *
 * `.btn-llenado` pone `transition: transform 0.6s` (globals.css) y motion escribe el `transform` en línea cuadro a
 * cuadro: pelean, el botón se mueve con retraso y, al hacer scroll con el cursor encima, REBOTA (le pasó al WhatsApp
 * de preguntas frecuentes). Si hace falta animarlo, un `<m.div>` envoltorio; hover y apretado, por CSS.
 */
const RAICES = ["src/components/marketing", "src/app/[locale]"];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.tsx$/.test(ruta) ? [ruta] : [];
  });
}

/** Cada `<m.a …>` o `<m.button …>`: el texto de su etiqueta de apertura (hasta el `>` que la cierra). */
function aperturas(fuente: string): string[] {
  const resultado: string[] = [];
  const patron = /<m\.(?:a|button)\b/g;
  let m: RegExpExecArray | null;
  while ((m = patron.exec(fuente))) {
    let i = m.index;
    let llaves = 0;
    for (; i < fuente.length; i++) {
      const c = fuente[i];
      if (c === "{") llaves++;
      else if (c === "}") llaves--;
      else if (c === ">" && llaves === 0) break;
    }
    resultado.push(fuente.slice(m.index, i + 1));
  }
  return resultado;
}

describe("botones con llenado y motion", () => {
  const todas = RAICES.flatMap((r) => archivos(join(process.cwd(), r)));

  it("encuentra los archivos de la landing", () => {
    expect(todas.length).toBeGreaterThan(10);
  });

  it("ningún <m.a>/<m.button> lleva CAPSULA o btn-llenado en el mismo elemento", () => {
    const culpables: string[] = [];
    for (const archivo of todas) {
      for (const apertura of aperturas(readFileSync(archivo, "utf8"))) {
        if (/CAPSULA|btn-llenado/.test(apertura)) culpables.push(`${archivo}: ${apertura.slice(0, 80).replace(/\s+/g, " ")}…`);
      }
    }
    expect(culpables).toEqual([]);
  });

  it("el WhatsApp de preguntas frecuentes y el de precios ya son enlaces normales", () => {
    for (const archivo of ["src/components/marketing/faq.tsx", "src/components/marketing/cta.tsx"]) {
      const fuente = readFileSync(join(process.cwd(), archivo), "utf8");
      expect(fuente, archivo).toMatch(/<a\s+href=\{buildWhatsAppUrl\(\)\}/);
      expect(fuente, archivo).not.toMatch(/<m\.a\s+href=\{buildWhatsAppUrl\(\)\}/);
    }
  });
});
