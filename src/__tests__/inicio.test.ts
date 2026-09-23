import { describe, expect, it } from "vitest";
import { inicioPara } from "@/lib/inicio";
import { permissionForPath } from "@/lib/modules";

describe("pantalla de inicio según permisos", () => {
  it("quien ve las cifras del negocio, al dashboard", () => {
    expect(inicioPara(["sales.view_reports", "sales.create"])).toBe("/dashboard");
  });

  it("ESTE es el importante: el cajero de fábrica, al Punto de venta", () => {
    // Si el middleware lo mandara al dashboard al negarle una ruta, seria otra
    // ruta negada y otra redireccion: un bucle.
    expect(
      inicioPara(["billing.view", "cash.manage", "inventory.view", "purchases.manage", "sales.create"])
    ).toBe("/pos");
  });

  it("sin nada, al catálogo", () => {
    expect(inicioPara([])).toBe("/products");
  });

  it("cada inicio está permitido para quien lo recibe (no hay bucle posible)", () => {
    for (const permisos of [["sales.view_reports"], ["sales.create"], []]) {
      const inicio = inicioPara(permisos);
      const exige = permissionForPath(inicio);
      expect(exige === null || permisos.includes(exige), `${inicio} con [${permisos}]`).toBe(true);
    }
  });
});
