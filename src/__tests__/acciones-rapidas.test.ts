import { describe, expect, it } from "vitest";
import {
  ACCIONES_RAPIDAS,
  PALABRAS_CLAVE_MODULOS,
  accionesDisponibles,
  coincideBusqueda,
  normalizar,
} from "@/lib/acciones-rapidas";
import { permissionForPath } from "@/lib/modules";

/** Etiquetas de las acciones que encuentra una busqueda. */
const buscar = (texto: string) =>
  ACCIONES_RAPIDAS.filter((a) => coincideBusqueda(a.etiqueta, texto, a.palabrasClave)).map(
    (a) => a.id
  );

describe("busqueda rapida", () => {
  it("ignora acentos y mayusculas", () => {
    expect(normalizar("Catálogo ÚNICO")).toBe("catalogo unico");
    expect(buscar("CATALOGO")).toContain("importar-catalogo");
    expect(buscar("depósito")).toContain("movimiento-caja");
  });

  it("'caja' encuentra abrir, cerrar y movimientos", () => {
    expect(buscar("caja")).toEqual(
      expect.arrayContaining(["abrir-caja", "cerrar-caja", "movimiento-caja"])
    );
  });

  it("busca por palabras clave y en cualquier orden", () => {
    expect(buscar("corte")).toEqual(["cerrar-caja"]);
    expect(buscar("caja cerrar")).toEqual(["cerrar-caja"]);
    expect(buscar("talla")).toEqual(["agregar-variante"]);
    expect(buscar("caducidad")).toEqual(["agregar-lote"]);
    expect(buscar("agregar producto")).toContain("agregar-producto");
  });

  it("sin texto muestra todo; sin coincidencias, nada", () => {
    expect(coincideBusqueda("Abrir caja", "")).toBe(1);
    expect(buscar("zzzz")).toEqual([]);
  });

  it("los modulos tambien se encuentran por sinonimos", () => {
    expect(coincideBusqueda("Finanzas", "caja", PALABRAS_CLAVE_MODULOS["/finances"])).toBe(1);
    expect(coincideBusqueda("Bitácora", "historial", PALABRAS_CLAVE_MODULOS["/activity"])).toBe(1);
  });
});

describe("catalogo de acciones", () => {
  it("ids unicos y rutas internas", () => {
    const ids = ACCIONES_RAPIDAS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACCIONES_RAPIDAS) expect(a.href.startsWith("/")).toBe(true);
  });

  it("el permiso de cada accion alcanza para entrar a su ruta", () => {
    for (const a of ACCIONES_RAPIDAS) {
      const ruta = a.href.split("?")[0];
      const requerido = permissionForPath(ruta);
      // Quien tiene el permiso de la accion debe poder abrir la pagina: o la
      // ruta no pide nada, o pide lo mismo (o la accion es mas estricta en el
      // mismo modulo, como invitar dentro de Usuarios).
      if (requerido && a.permiso !== requerido) {
        expect(a.permiso.split(".")[0]).toBe(requerido.split(".")[0]);
      }
    }
  });

  it("filtra por permiso y por modulo encendido", () => {
    const soloCaja = accionesDisponibles((p) => p === "cash.manage", {});
    expect(soloCaja.map((a) => a.id)).toEqual(
      expect.arrayContaining(["abrir-caja", "cerrar-caja", "enviar-sugerencia"])
    );
    expect(soloCaja.some((a) => a.id === "agregar-producto")).toBe(false);

    const inventario = (mods: Record<string, boolean>) =>
      accionesDisponibles((p) => p === "inventory.manage", mods).map((a) => a.id);
    expect(inventario({})).not.toContain("agregar-variante");
    expect(inventario({ permite_variantes: true })).toContain("agregar-variante");
    expect(inventario({ permite_lotes_caducidad: true })).toContain("agregar-lote");
  });
});
