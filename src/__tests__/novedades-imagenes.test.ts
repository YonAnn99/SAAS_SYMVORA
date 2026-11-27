import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NOVEDADES, novedadesPara, portadaDeNovedad, type Novedad } from "@/lib/novedades";

const ahora = new Date("2026-11-28T15:00:00Z");
const todo = () => true;
const enPublico = (ruta: string) => join(process.cwd(), "public", ruta);

describe("novedades con imágenes", () => {
  it("toda novedad desde 2026-11-27 tiene portada y el archivo existe en public/", () => {
    for (const n of NOVEDADES.filter((x) => x.desde >= "2026-11-27")) {
      expect(n.portada, n.id).toBeTruthy();
      expect(existsSync(enPublico(n.portada as string)), n.id).toBe(true);
    }
  });

  it("la imagen de detalle, si existe, también está en public/", () => {
    for (const n of NOVEDADES.filter((x) => x.detalle)) {
      expect(existsSync(enPublico(n.detalle as string)), n.id).toBe(true);
    }
  });

  it("las novedades nuevas están y tienen sus textos en es y en", () => {
    const es = JSON.parse(readFileSync(join(process.cwd(), "src/messages/es.json"), "utf8")).news;
    const en = JSON.parse(readFileSync(join(process.cwd(), "src/messages/en.json"), "utf8")).news;
    for (const id of ["pedidos-v2", "ticket-personalizable"]) {
      expect(NOVEDADES.some((n) => n.id === id), id).toBe(true);
      for (const idioma of [es, en]) {
        expect(idioma[id].title, id).toBeTruthy();
        expect(idioma[id].button, id).toBeTruthy();
        expect(idioma[id].points["2"], id).toBeTruthy();
      }
    }
    expect(es.panel.title).toBeTruthy();
    expect(en.panel.title).toBeTruthy();
    expect(es.kind.feature).toBeTruthy();
    expect(en.kind.feature).toBeTruthy();
  });

  it("pedidos-v2 no la ve quien no tiene el permiso ni el plan de pedidos", () => {
    const soloPermiso = novedadesPara(ahora, todo, () => false).map((n) => n.id);
    expect(soloPermiso).not.toContain("pedidos-v2");
    const conPlan = novedadesPara(ahora, todo, (f) => f === "pedidos").map((n) => n.id);
    expect(conPlan).toContain("pedidos-v2");
  });

  it("sin permiso de configuración no ve el ticket", () => {
    const sinConfig = novedadesPara(ahora, (p) => p !== "org.manage_settings", todo).map((n) => n.id);
    expect(sinConfig).not.toContain("ticket-personalizable");
  });

  it("la campana encuentra la portada por el id de la novedad", () => {
    expect(portadaDeNovedad("pedidos-v2")).toBe("/novedades/pedidos-v2-portada.webp");
    expect(portadaDeNovedad("no-existe")).toBeNull();
  });

  it("una novedad sin plan sigue visible para todos los niveles", () => {
    const sin: Novedad = NOVEDADES.find((n) => n.plan === undefined) as Novedad;
    expect(novedadesPara(ahora, todo, () => false).map((n) => n.id)).toContain(sin.id);
  });
});
