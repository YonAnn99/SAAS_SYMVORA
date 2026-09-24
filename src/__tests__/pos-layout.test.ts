import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Distribucion del Punto de Venta en pantallas medianas.
 *
 * EL DEFECTO (2026-09-24): en una laptop con la escala de Windows al 125 %
 * (1280 px utiles) el carrito desaparecia. La barra de herramientas era una
 * sola fila de ~950 px y la columna de productos (`flex-1` sin `min-w-0`) no
 * podia ser mas angosta que ella, asi que empujaba el carrito fuera. Se lee el
 * fuente, como en `legal-footer.test.ts`: lo que se fija son clases.
 */
const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), "utf8");
const pos = leer("src/app/(dashboard)/[locale]/pos/page.tsx");
const barra = leer("src/features/pos/components/pos-search-bar.tsx");

describe("el carrito no se sale de la pantalla", () => {
  it("la columna de productos puede encogerse (min-w-0)", () => {
    expect(pos).toMatch(/<div className="flex-1 flex flex-col[^"]*\bmin-w-0\b/);
  });

  it("el carrito no se aplasta (shrink-0)", () => {
    expect(pos).toMatch(/<div className="hidden lg:flex lg:w-80 shrink-0/);
  });

  it("la barra de herramientas se parte en dos líneas cuando no cabe", () => {
    expect(barra).toContain("sm:flex-wrap");
    // Y el buscador nunca queda reducido a la lupa.
    expect(barra).toContain("min-w-[12rem]");
  });
});
