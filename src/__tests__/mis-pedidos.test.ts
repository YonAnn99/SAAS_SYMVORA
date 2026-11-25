import { describe, expect, it } from "vitest";
import {
  MAX_PEDIDOS_GUARDADOS,
  clavePedidosGuardados,
  guardarPedido,
  leerPedidosGuardados,
} from "@/features/catalogo/mis-pedidos";

function almacenFalso(inicial: Record<string, string> = {}) {
  const datos = { ...inicial };
  return {
    datos,
    getItem: (k: string) => (k in datos ? datos[k] : null),
    setItem: (k: string, v: string) => {
      datos[k] = v;
    },
  };
}

const A = "54EN5FKB8CZX";
const B = "AB23CD45EF67";

describe("Mis pedidos del catálogo", () => {
  it("guarda un pedido y lo lee por negocio", () => {
    const a = almacenFalso();
    guardarPedido(a, "tienda", { codigo: A, folio: 1, creado: "2026-11-25T10:00:00Z" });
    expect(leerPedidosGuardados(a, "tienda")).toEqual([{ codigo: A, folio: 1, creado: "2026-11-25T10:00:00.000Z" }]);
    expect(leerPedidosGuardados(a, "otra-tienda")).toEqual([]);
    expect(Object.keys(a.datos)).toEqual([clavePedidosGuardados("tienda")]);
  });

  it("lo más reciente primero y sin duplicados (conserva la fecha original y completa el folio)", () => {
    const a = almacenFalso();
    guardarPedido(a, "t", { codigo: A, folio: null, creado: "2026-11-24T10:00:00Z" });
    guardarPedido(a, "t", { codigo: B, folio: 2, creado: "2026-11-25T10:00:00Z" });
    const lista = guardarPedido(a, "t", { codigo: A, folio: 1, creado: "2026-11-26T10:00:00Z" });
    expect(lista.map((p) => p.codigo)).toEqual([B, A]);
    expect(lista.find((p) => p.codigo === A)).toMatchObject({ folio: 1, creado: "2026-11-24T10:00:00.000Z" });
  });

  it("rechaza códigos inválidos y basura guardada (nunca revienta)", () => {
    const a = almacenFalso({ [clavePedidosGuardados("t")]: JSON.stringify([{ codigo: "corto" }, 5, null, { codigo: A, folio: 3, creado: "x" }]) });
    expect(leerPedidosGuardados(a, "t").map((p) => p.codigo)).toEqual([A]);
    expect(guardarPedido(a, "t", { codigo: "MALO", folio: 1, creado: "2026-11-25T10:00:00Z" })).toHaveLength(1);
    expect(leerPedidosGuardados(almacenFalso({ [clavePedidosGuardados("t")]: "{no es json" }), "t")).toEqual([]);
  });

  it("tope de pedidos guardados", () => {
    const a = almacenFalso();
    const letras = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
    for (let i = 0; i < MAX_PEDIDOS_GUARDADOS + 5; i++) {
      const codigo = `${letras[i % letras.length]}${letras[(i * 7) % letras.length]}${"2".repeat(8)}${letras[i % 5]}${letras[(i + 3) % 9]}`;
      guardarPedido(a, "t", { codigo, folio: i + 1, creado: new Date(2026, 10, 1, 0, i).toISOString() });
    }
    expect(leerPedidosGuardados(a, "t").length).toBeLessThanOrEqual(MAX_PEDIDOS_GUARDADOS);
  });

  it("sin almacenamiento (navegación privada) o con error al escribir, no falla", () => {
    expect(leerPedidosGuardados(null, "t")).toEqual([]);
    expect(guardarPedido(null, "t", { codigo: A, folio: 1, creado: "2026-11-25T10:00:00Z" })).toEqual([]);
    const lleno = { getItem: () => null, setItem: () => { throw new Error("cuota"); } };
    expect(guardarPedido(lleno, "t", { codigo: A, folio: 1, creado: "2026-11-25T10:00:00Z" })).toEqual([]);
  });
});
