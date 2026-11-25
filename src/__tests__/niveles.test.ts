import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FUNCIONES_HEREDADO,
  FUNCIONES_POR_NIVEL,
  INFO_PLAN_HEREDADO,
  NIVELES_ORDEN,
  PRECIOS_NIVEL_CENTS,
  esNivel,
  funcionesDe,
  leerInfoPlan,
  permiteFuncion,
  precioMensualEquivalenteMXN,
  puedeAgregarSucursal,
  rutaPermitidaPorPlan,
  type FuncionesPlan,
  type Nivel,
} from "@/lib/niveles";
import { SUBSCRIPTION_PRICE_CENTS } from "@/lib/pricing";

const MIGRACION = readFileSync(
  join(process.cwd(), "supabase/migrations/140_niveles_de_suscripcion.sql"),
  "utf8"
);

/** El bloque `jsonb_build_object(...)` de `plan_funciones` para un nivel (o ELSE = heredado). */
function deLaMigracion(etiqueta: "basico" | "pro" | "premium" | "heredado"): FuncionesPlan {
  const patron =
    etiqueta === "heredado"
      ? /ELSE jsonb_build_object\(([\s\S]*?)\)\s*END/
      : new RegExp(`WHEN '${etiqueta}' THEN jsonb_build_object\\(([\\s\\S]*?)\\)\\s*(?:WHEN|ELSE)`);
  const bloque = MIGRACION.match(patron)?.[1];
  if (!bloque) throw new Error(`No encontré el bloque de ${etiqueta} en la migración 140`);
  const valor = (clave: string): string => {
    const m = bloque.match(new RegExp(`'${clave}',\\s*(NULL|true|false|\\d+|'[a-z]+')`));
    if (!m) throw new Error(`Falta ${clave} en ${etiqueta}`);
    return m[1];
  };
  const nivel = valor("nivel");
  const max = valor("sucursales_max");
  return {
    nivel: nivel === "NULL" ? null : (nivel.replace(/'/g, "") as Nivel),
    sucursalesMax: max === "NULL" ? null : Number(max),
    lealtad: valor("lealtad") === "true",
    catalogo: valor("catalogo") === "true",
    pedidos: valor("pedidos") === "true",
  };
}

describe("niveles: el código y la base dicen lo mismo", () => {
  it.each(NIVELES_ORDEN)("%s coincide con plan_funciones de la migración 140", (nivel) => {
    expect(FUNCIONES_POR_NIVEL[nivel]).toEqual(deLaMigracion(nivel));
  });

  it("el heredado (nivel NULL) coincide con el ELSE de la migración", () => {
    expect(FUNCIONES_HEREDADO).toEqual(deLaMigracion("heredado"));
  });

  it("los niveles que acepta el CHECK de la base son los del código", () => {
    const check = MIGRACION.match(/subscriptions_nivel_check\s+CHECK \(nivel IS NULL OR nivel IN \(([^)]*)\)\)/)?.[1];
    const enBase = [...(check ?? "").matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(enBase).toEqual([...NIVELES_ORDEN]);
  });
});

describe("funciones por nivel", () => {
  it("Básico: una sucursal, sin lealtad, sin catálogo, sin pedidos", () => {
    const f = funcionesDe("basico");
    expect(f).toMatchObject({ sucursalesMax: 1, lealtad: false, catalogo: false, pedidos: false });
    expect(permiteFuncion(f, "sucursales")).toBe(false);
  });

  it("Pro: hasta 3 sucursales y todo lo demás", () => {
    const f = funcionesDe("pro");
    expect(f).toMatchObject({ sucursalesMax: 3, lealtad: true, catalogo: true, pedidos: true });
    expect(permiteFuncion(f, "sucursales")).toBe(true);
  });

  it("Premium: sin tope de sucursales", () => {
    expect(funcionesDe("premium").sucursalesMax).toBeNull();
  });

  it("sin nivel (heredado, prueba, demo) lo tiene todo y sin tope", () => {
    for (const f of [funcionesDe(null), funcionesDe(undefined)]) {
      expect(f).toEqual(FUNCIONES_HEREDADO);
      expect(f.sucursalesMax).toBeNull();
      expect(["sucursales", "lealtad", "catalogo", "pedidos"].every((x) => permiteFuncion(f, x as never))).toBe(true);
    }
  });

  it("cada nivel superior incluye todo lo del anterior (nada se pierde al subir)", () => {
    for (let i = 1; i < NIVELES_ORDEN.length; i++) {
      const menor = FUNCIONES_POR_NIVEL[NIVELES_ORDEN[i - 1]];
      const mayor = FUNCIONES_POR_NIVEL[NIVELES_ORDEN[i]];
      for (const k of ["lealtad", "catalogo", "pedidos"] as const) expect(!menor[k] || mayor[k]).toBe(true);
      expect(mayor.sucursalesMax === null || (menor.sucursalesMax !== null && mayor.sucursalesMax >= menor.sucursalesMax)).toBe(true);
    }
  });
});

describe("tope de sucursales", () => {
  it("Básico: con 1 sucursal ya no puede agregar otra", () => {
    expect(puedeAgregarSucursal(funcionesDe("basico"), 0)).toBe(true);
    expect(puedeAgregarSucursal(funcionesDe("basico"), 1)).toBe(false);
  });
  it("Pro: hasta 3", () => {
    expect(puedeAgregarSucursal(funcionesDe("pro"), 2)).toBe(true);
    expect(puedeAgregarSucursal(funcionesDe("pro"), 3)).toBe(false);
  });
  it("Premium y heredado: siempre", () => {
    expect(puedeAgregarSucursal(funcionesDe("premium"), 50)).toBe(true);
    expect(puedeAgregarSucursal(funcionesDe(null), 50)).toBe(true);
  });
});

describe("menú según el nivel", () => {
  it("Básico no ve Sucursales ni Catálogo en línea", () => {
    const f = funcionesDe("basico");
    expect(rutaPermitidaPorPlan("/branches", f)).toBe(false);
    expect(rutaPermitidaPorPlan("/online-catalog", f)).toBe(false);
    expect(rutaPermitidaPorPlan("/online-catalog/algo", f)).toBe(false);
    expect(rutaPermitidaPorPlan("/orders", f)).toBe(false);
  });
  it("Básico sí ve todo lo demás", () => {
    const f = funcionesDe("basico");
    for (const ruta of ["/pos", "/products", "/customers", "/reports", "/finances", "/purchases", "/users", "/settings"]) {
      expect(rutaPermitidaPorPlan(ruta, f)).toBe(true);
    }
  });
  it("Pro, Premium y heredado ven todo", () => {
    for (const f of [funcionesDe("pro"), funcionesDe("premium"), funcionesDe(null)]) {
      expect(rutaPermitidaPorPlan("/branches", f)).toBe(true);
      expect(rutaPermitidaPorPlan("/online-catalog", f)).toBe(true);
      expect(rutaPermitidaPorPlan("/orders", f)).toBe(true);
    }
  });
});

describe("leerInfoPlan (lo que responde info_plan)", () => {
  it("convierte la respuesta de la base", () => {
    expect(
      leerInfoPlan({ nivel: "pro", sucursales_max: 3, lealtad: true, catalogo: true, pedidos: true, sucursales_usadas: 2 })
    ).toEqual({ funciones: FUNCIONES_POR_NIVEL.pro, sucursalesUsadas: 2 });
  });
  it("sin nivel: heredado", () => {
    expect(leerInfoPlan({ nivel: null, sucursales_usadas: 4 })).toEqual({
      funciones: FUNCIONES_HEREDADO,
      sucursalesUsadas: 4,
    });
  });
  it("una respuesta rara (null, texto, nivel desconocido) nunca restringe: heredado", () => {
    expect(leerInfoPlan(null)).toEqual(INFO_PLAN_HEREDADO);
    expect(leerInfoPlan("x")).toEqual(INFO_PLAN_HEREDADO);
    expect(leerInfoPlan({ nivel: "oro" }).funciones).toEqual(FUNCIONES_HEREDADO);
  });
  it("esNivel solo acepta los tres", () => {
    expect(["basico", "pro", "premium"].every(esNivel)).toBe(true);
    expect([null, undefined, "Pro", "heredado", 1].some(esNivel)).toBe(false);
  });
});

describe("precios de los niveles", () => {
  it("son $249 / $449 / $599 al mes", () => {
    expect(NIVELES_ORDEN.map((n) => PRECIOS_NIVEL_CENTS[n].monthly / 100)).toEqual([249, 449, 599]);
  });
  it("el anual es (mensual × 0.75 redondeado al peso) × 12", () => {
    for (const n of NIVELES_ORDEN) {
      const esperado = Math.round((PRECIOS_NIVEL_CENTS[n].monthly / 100) * 0.75) * 12 * 100;
      expect(PRECIOS_NIVEL_CENTS[n].yearly).toBe(esperado);
    }
    expect(NIVELES_ORDEN.map((n) => PRECIOS_NIVEL_CENTS[n].yearly / 100)).toEqual([2244, 4044, 5388]);
  });
  it("ordenados: cada nivel cuesta más que el anterior, en los dos periodos", () => {
    for (let i = 1; i < NIVELES_ORDEN.length; i++) {
      for (const p of ["monthly", "yearly"] as const) {
        expect(PRECIOS_NIVEL_CENTS[NIVELES_ORDEN[i]][p]).toBeGreaterThan(PRECIOS_NIVEL_CENTS[NIVELES_ORDEN[i - 1]][p]);
      }
    }
  });
  it("pagar al año siempre sale más barato que 12 meses", () => {
    for (const n of NIVELES_ORDEN) {
      expect(PRECIOS_NIVEL_CENTS[n].yearly).toBeLessThan(PRECIOS_NIVEL_CENTS[n].monthly * 12);
    }
    expect(precioMensualEquivalenteMXN("pro", "yearly")).toBeCloseTo(337, 5);
  });
  it("el plan único de siempre ($399 / $3,588) no se toca", () => {
    expect(SUBSCRIPTION_PRICE_CENTS).toEqual({ monthly: 39900, yearly: 358800 });
  });
});
