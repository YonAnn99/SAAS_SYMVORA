import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { HeroMockups, MOCKUPS_HERO, rutaMockup } from "@/components/marketing/hero-mockups";
import es from "@/messages/es.json";
import en from "@/messages/en.json";

/** Dimensiones de un WebP (VP8X, VP8L o VP8) sin depender de sharp. */
function dimensionesWebp(ruta: string): { ancho: number; alto: number } {
  const b = readFileSync(ruta);
  const tipo = b.toString("ascii", 12, 16);
  if (tipo === "VP8X") return { ancho: 1 + b.readUIntLE(24, 3), alto: 1 + b.readUIntLE(27, 3) };
  if (tipo === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { ancho: 1 + (bits & 0x3fff), alto: 1 + ((bits >> 14) & 0x3fff) };
  }
  return { ancho: b.readUInt16LE(26) & 0x3fff, alto: b.readUInt16LE(28) & 0x3fff };
}

function pintar(mensajes: typeof es, locale: string) {
  return render(
    <NextIntlClientProvider locale={locale} messages={mensajes}>
      <HeroMockups />
    </NextIntlClientProvider>
  );
}

describe("mockups del hero", () => {
  it("existen los seis WebP (claro y oscuro) con las dimensiones que declara el componente", () => {
    for (const modo of ["claro", "oscuro"] as const) {
      for (const m of MOCKUPS_HERO) {
        const ruta = join(process.cwd(), "public", rutaMockup(modo, m.clave));
        expect(existsSync(ruta), ruta).toBe(true);
        expect(dimensionesWebp(ruta), ruta).toEqual({ ancho: m.ancho, alto: m.alto });
      }
    }
  });

  it("pinta los tres dispositivos en los dos modos, con el mismo orden y su alt", () => {
    pintar(es, "es");
    const imgs = screen.getAllByRole("img", { hidden: true });
    expect(imgs).toHaveLength(6);
    const srcs = imgs.map((i) => i.getAttribute("src"));
    for (const modo of ["claro", "oscuro"] as const) {
      for (const m of MOCKUPS_HERO) expect(srcs).toContain(rutaMockup(modo, m.clave));
    }
    expect(screen.getAllByAltText(es.landing.hero.mockups.laptop)).toHaveLength(2);
    expect(screen.getAllByAltText(es.landing.hero.mockups.tablet)).toHaveLength(2);
    expect(screen.getAllByAltText(es.landing.hero.mockups.movil)).toHaveLength(2);
  });

  it("el modo se resuelve por CSS: el claro se oculta en dark y el oscuro solo se ve en dark", () => {
    pintar(es, "es");
    for (const img of screen.getAllByRole("img", { hidden: true })) {
      const src = img.getAttribute("src") ?? "";
      if (src.includes("/claro-")) expect(img.className).toContain("dark:hidden");
      else expect(img.className).toMatch(/hidden dark:block/);
    }
  });

  it("solo el primer dispositivo se pide al cargar y los demás esperan su turno", () => {
    pintar(es, "es");
    const porClave = (clave: string) =>
      screen.getAllByRole("img", { hidden: true }).filter((i) => i.getAttribute("src")?.includes(`-${clave}.`));
    for (const img of porClave("laptop")) expect(img.getAttribute("loading")).toBe("eager");
    for (const clave of ["tablet", "movil"]) {
      for (const img of porClave(clave)) expect(img.getAttribute("loading")).toBe("lazy");
    }
  });

  it("en inglés el texto alternativo también está traducido", () => {
    pintar(en as typeof es, "en");
    expect(screen.getAllByAltText(en.landing.hero.mockups.laptop)).toHaveLength(2);
  });
});
