import { beforeEach, describe, expect, it } from "vitest";
import { fijarAlcanceCache, guardarCache, leerCache, vaciarCache } from "@/lib/cache-datos";

describe("cache de datos entre modulos", () => {
  beforeEach(() => vaciarCache());

  it("sin alcance (contexto cargando) no guarda ni lee nada", () => {
    guardarCache(["productos", "t1"], [1, 2]);
    expect(leerCache(["productos", "t1"])).toBeUndefined();
  });

  it("guarda y lee por clave dentro del mismo usuario y negocio", () => {
    fijarAlcanceCache("u1", "t1");
    guardarCache(["productos", "t1", null], ["coca"]);
    expect(leerCache(["productos", "t1", null])).toEqual(["coca"]);
    // Otra sucursal es otra clave: el stock de Norte no es el de Principal.
    expect(leerCache(["productos", "t1", "norte"])).toBeUndefined();
  });

  it("al cambiar de usuario o de negocio se vacia: nadie ve datos del anterior", () => {
    fijarAlcanceCache("u1", "t1");
    guardarCache(["clientes", "t1"], ["Ana"]);
    fijarAlcanceCache("u2", "t1");
    expect(leerCache(["clientes", "t1"])).toBeUndefined();
    fijarAlcanceCache("u1", "t1");
    expect(leerCache(["clientes", "t1"])).toBeUndefined();
  });

  it("el mismo alcance no borra lo guardado", () => {
    fijarAlcanceCache("u1", "t1");
    guardarCache(["clientes", "t1"], ["Ana"]);
    fijarAlcanceCache("u1", "t1");
    expect(leerCache(["clientes", "t1"])).toEqual(["Ana"]);
  });

  it("cerrar sesion la vacia y deja de guardar hasta tener alcance otra vez", () => {
    fijarAlcanceCache("u1", "t1");
    guardarCache(["compras", "t1"], [1]);
    vaciarCache();
    expect(leerCache(["compras", "t1"])).toBeUndefined();
    guardarCache(["compras", "t1"], [2]);
    fijarAlcanceCache("u1", "t1");
    expect(leerCache(["compras", "t1"])).toBeUndefined();
  });
});
