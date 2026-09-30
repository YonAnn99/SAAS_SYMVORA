import { describe, expect, it } from "vitest";
import { palabrasDelHero } from "@/components/marketing/giro-giratorio-palabras";
import { GIROS } from "@/features/marketing/giros";

describe("palabras del hero", () => {
  it("una por giro, en los dos idiomas", () => {
    expect(palabrasDelHero("es")).toHaveLength(GIROS.length);
    expect(palabrasDelHero("en")).toHaveLength(GIROS.length);
  });

  it("en español caben despues de 'tu' (sin repetirlo)", () => {
    for (const g of GIROS) expect(g.tu.startsWith("tu ")).toBe(true);
    const es = palabrasDelHero("es");
    expect(es).toContain("farmacia");
    expect(es).toContain("tienda de abarrotes");
    expect(es.every((p) => p.length > 0 && !p.startsWith("tu "))).toBe(true);
  });

  it("en ingles, el nombre del giro en minusculas", () => {
    expect(palabrasDelHero("en")).toContain("pharmacy");
  });
});
