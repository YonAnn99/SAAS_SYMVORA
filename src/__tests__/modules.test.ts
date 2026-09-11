import { describe, expect, it } from "vitest";
import {
  GRANTABLE_MODULES,
  GRANTABLE_PERMISSIONS,
  MODULES,
  permissionForPath,
} from "@/lib/modules";

describe("catálogo de módulos", () => {
  it("Usuarios y Facturación NO son concedibles", () => {
    // Conceder Usuarios permitiría a esa persona ascender a otros y a sí
    // misma; Facturación permite cancelar la suscripción del negocio.
    // Decisión del usuario (2026-09-11), respaldada además por el CHECK de la
    // migración 055.
    for (const key of ["users", "billing"]) {
      const mod = MODULES.find((m) => m.key === key)!;
      expect(mod.grantable, `${key} no debe ser concedible`).toBe(false);
      expect(mod.notGrantableReason, `${key} debe explicar por qué`).toBeTruthy();
    }
  });

  it("ningún permiso que reparta poder es concedible", () => {
    for (const p of [
      "org.manage_members",
      "org.manage_members_write",
      "org.delete",
      "subscription.manage",
    ]) {
      expect(GRANTABLE_PERMISSIONS.has(p), `${p} no debe ser concedible`).toBe(false);
    }
  });

  it("todo módulo no concedible explica el motivo", () => {
    // Sin motivo, la restricción parece arbitraria y alguien la quitará.
    for (const mod of MODULES.filter((m) => !m.grantable)) {
      expect(mod.notGrantableReason, `${mod.key} sin motivo`).toBeTruthy();
    }
  });

  it("las claves de módulo son únicas", () => {
    const keys = MODULES.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("ningún permiso aparece en dos módulos concedibles", () => {
    // ESTE es el invariante que faltaba y que causó el error 500:
    // `purchases` y `purchaseOrders` compartían `purchases.manage`, así que al
    // activar ambos switches el diálogo mandaba el permiso duplicado y el
    // INSERT chocaba con UNIQUE (tenant_id, user_id, permission).
    //
    // Dos switches que controlan el mismo permiso son además engañosos: si
    // activas uno y desactivas el otro, el resultado es indefinido. Si dos
    // pantallas comparten permiso, deben ser UN módulo con varias rutas.
    const permisos = GRANTABLE_MODULES.map((m) => m.permission);
    const duplicados = permisos.filter((p, i) => permisos.indexOf(p) !== i);
    expect(duplicados, `permisos duplicados: ${duplicados.join(", ")}`).toEqual([]);
  });

  it("las rutas no se solapan entre módulos distintos", () => {
    // Una misma ruta en dos módulos haría que permissionForPath dependiera del
    // orden del array, que es justo el tipo de fragilidad que causó el bug.
    const rutas = MODULES.flatMap((m) => m.paths);
    expect(new Set(rutas).size).toBe(rutas.length);
  });
});

describe("permissionForPath", () => {
  it("deja abiertas las rutas que hoy ve todo el equipo", () => {
    // Prueba de NO REGRESIÓN: estas rutas no tienen `minRole` en el sidebar,
    // así que deben seguir sin exigir permiso. Si alguna empezara a pedirlo,
    // los cajeros perderían acceso de golpe.
    for (const ruta of ["/dashboard", "/customers", "/activity", "/suggestions"]) {
      expect(permissionForPath(ruta), `${ruta} debe seguir abierta`).toBeNull();
    }
  });

  it("el CATÁLOGO de productos sigue abierto a todo el equipo", () => {
    // /products es lo que el cajero consulta para vender. El módulo
    // "inventory" (variantes/lotes/ajustes) sí exige permiso, pero vive como
    // pestañas DENTRO de esa página, no como ruta propia. Mapear /products a
    // inventory.manage dejaría a los cajeros sin catálogo.
    expect(permissionForPath("/products")).toBeNull();
    expect(MODULES.find((m) => m.key === "inventory")!.permission).toBe("inventory.manage");
    expect(MODULES.find((m) => m.key === "inventory")!.paths).toEqual([]);
  });

  it("protege las rutas de administración con su permiso", () => {
    expect(permissionForPath("/finances")).toBe("finances.manage");
    expect(permissionForPath("/purchases")).toBe("purchases.manage");
    expect(permissionForPath("/settings")).toBe("org.manage_settings");
    expect(permissionForPath("/users")).toBe("org.manage_members");
    expect(permissionForPath("/billing")).toBe("subscription.manage");
  });

  it("/purchases y /purchase-orders comparten módulo pero ambas quedan protegidas", () => {
    // Son UN módulo con dos rutas. "/purchase-orders" no coincide por prefijo
    // con "/purchases", así que sin su ruta explícita quedaría abierta.
    expect(permissionForPath("/purchases")).toBe("purchases.manage");
    expect(permissionForPath("/purchase-orders")).toBe("purchases.manage");

    const compras = MODULES.filter((m) => m.permission === "purchases.manage");
    expect(compras, "debe haber un solo módulo de compras").toHaveLength(1);
    expect(compras[0].paths).toEqual(["/purchases", "/purchase-orders"]);
  });

  it("CFDI y Cancelar ventas ya no figuran como módulos", () => {
    // CFDI está descartado por ahora; sales.void no lo usa ninguna pantalla
    // (el permiso sigue en role_permissions gobernando la RLS de ventas).
    expect(MODULES.find((m) => m.key === "facturas")).toBeUndefined();
    expect(MODULES.find((m) => m.key === "salesVoid")).toBeUndefined();
    // /facturas cae al chequeo por rol del middleware, como antes.
    expect(permissionForPath("/facturas")).toBeNull();
  });

  it("resuelve subrutas por el prefijo más específico", () => {
    expect(permissionForPath("/settings/payments")).toBe("org.manage_settings");
    expect(permissionForPath("/finances/algo/mas")).toBe("finances.manage");
  });

  it("una ruta desconocida queda abierta, no bloqueada", () => {
    // Fallar hacia "abierto" es lo correcto aquí: las escrituras están
    // protegidas por RLS de todos modos, y bloquear por defecto dejaría
    // inaccesible cualquier página nueva hasta que alguien la mapee.
    expect(permissionForPath("/ruta-que-no-existe")).toBeNull();
  });
});

describe("GRANTABLE_MODULES", () => {
  it("incluye los módulos operativos que el dueño querría repartir", () => {
    const keys = GRANTABLE_MODULES.map((m) => m.key);
    for (const esperado of ["inventory", "purchases", "finances", "reports", "settings"]) {
      expect(keys, `falta ${esperado}`).toContain(esperado);
    }
  });

  it("todo módulo concedible tiene un permiso asociado", () => {
    // Un módulo concedible sin permiso no se podría enforcar en la base de
    // datos: el switch no haría nada.
    for (const mod of GRANTABLE_MODULES) {
      expect(mod.permission, `${mod.key} concedible sin permiso`).toBeTruthy();
    }
  });
});
