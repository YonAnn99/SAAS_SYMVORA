import { describe, expect, it } from "vitest";
import es from "@/messages/es.json";
import en from "@/messages/en.json";

/** El eslogan del hero: texto fijo + una palabra que rota (`palabra-giratoria.tsx`). */
const CLAVES = ["celular", "tablet", "computadora", "dispositivo"];

describe("eslogan del hero", () => {
  it("las palabras que rotan están en los dos idiomas y en el orden pedido", () => {
    for (const hero of [es.landing.hero, en.landing.hero]) {
      expect(Object.keys(hero.dispositivos)).toEqual(CLAVES);
      for (const palabra of Object.values(hero.dispositivos)) expect(palabra.trim().length).toBeGreaterThan(0);
    }
    expect(Object.values(es.landing.hero.dispositivos)).toEqual(["celular", "tablet", "computadora", "dispositivo"]);
    expect(Object.values(en.landing.hero.dispositivos)).toEqual(["phone", "tablet", "computer", "device"]);
  });

  it("el título deja la última palabra a la pastilla (termina en «cualquier» / «any»)", () => {
    expect(es.landing.hero.title).toMatch(/desde cualquier$/);
    expect(en.landing.hero.title).toMatch(/from any$/);
    expect(es.landing.hero.title.startsWith("Controla tu inventario")).toBe(true);
    expect(en.landing.hero.title.startsWith("Control your inventory")).toBe(true);
  });

  it("ya no queda el «hecho para tu» del eslogan anterior", () => {
    expect("highlight" in es.landing.hero).toBe(false);
    expect("highlight" in en.landing.hero).toBe(false);
  });
});
