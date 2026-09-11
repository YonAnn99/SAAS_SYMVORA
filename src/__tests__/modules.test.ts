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
    expect(MODULES.find((m) => m.key === "inventory")!.href).toBeNull();
  });

  it("protege las rutas de administración con su permiso", () => {
    expect(permissionForPath("/finances")).toBe("finances.manage");
    expect(permissionForPath("/purchases")).toBe("purchases.manage");
    expect(permissionForPath("/settings")).toBe("org.manage_settings");
    expect(permissionForPath("/users")).toBe("org.manage_members");
    expect(permissionForPath("/billing")).toBe("subscription.manage");
  });

  it("/purchase-orders tiene su propia entrada y no queda desprotegida", () => {
    // No coincide por prefijo con "/purchases": sin entrada propia, la ruta
    // habría quedado abierta a cualquiera.
    expect(permissionForPath("/purchase-orders")).toBe("purchases.manage");
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
