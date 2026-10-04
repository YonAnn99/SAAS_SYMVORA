import { describe, expect, it } from "vitest";
import { pasosParaUsuario } from "@/components/tutorial/pasos-por-usuario";
import { tutorialSteps } from "@/components/tutorial/steps-data";
import esMessages from "@/messages/es.json";
import enMessages from "@/messages/en.json";

/** Permisos por defecto de cada rol (`role_permissions` en la base). */
const PERMISOS = {
  SUPER_ADMIN: [
    "activity.view", "billing.cancel", "billing.config", "billing.create", "billing.stamp",
    "billing.view", "cash.manage", "finances.manage", "inventory.manage", "inventory.view",
    "org.delete", "org.manage_branches", "org.manage_members", "org.manage_members_write",
    "org.manage_settings", "purchases.manage", "sales.create", "sales.discount_unlimited",
    "sales.view_all", "sales.view_reports", "sales.void", "subscription.manage",
  ],
  ORG_ADMIN: [
    "activity.view", "billing.cancel", "billing.config", "billing.create", "billing.stamp",
    "billing.view", "cash.manage", "finances.manage", "inventory.manage", "inventory.view",
    "org.manage_members", "org.manage_settings", "purchases.manage", "sales.create",
    "sales.discount_unlimited", "sales.view_all", "sales.view_reports", "sales.void",
  ],
  CAJERO: ["billing.view", "cash.manage", "inventory.view", "purchases.manage", "sales.create"],
} as const;

const can = (lista: readonly string[]) => (p: string) => lista.includes(p);

function leer(clave: string, mensajes: object): unknown {
  return clave
    .split(".")
    .reduce<unknown>((n, parte) => (n && typeof n === "object" ? (n as Record<string, unknown>)[parte] : undefined), mensajes);
}

describe("pasosParaUsuario", () => {
  it("el SUPER_ADMIN ve los 16 pasos sin cambios", () => {
    const pasos = pasosParaUsuario(tutorialSteps, "SUPER_ADMIN", can(PERMISOS.SUPER_ADMIN));
    expect(pasos).toEqual(tutorialSteps);
  });

  it("el ORG_ADMIN ve todo menos Suscripción", () => {
    const ids = pasosParaUsuario(tutorialSteps, "ORG_ADMIN", can(PERMISOS.ORG_ADMIN)).map((p) => p.id);
    expect(ids).toEqual(tutorialSteps.map((p) => p.id).filter((id) => id !== 13));
  });

  it("el cajero solo ve caja, venta, catálogo, compras y los pasos generales", () => {
    const pasos = pasosParaUsuario(tutorialSteps, "CAJERO", can(PERMISOS.CAJERO));
    expect(pasos.map((p) => p.id)).toEqual([1, 2, 5, 6, 8, 9, 10, 15, 16]);

    // Ninguno lo lleva a un modulo sin acceso.
    for (const ruta of ["/settings", "/users", "/dashboard", "/activity", "/billing"]) {
      expect(pasos.filter((p) => p.navigates && p.route === ruta)).toEqual([]);
    }
  });

  it("al cajero le toca el texto de su turno en bienvenida, compras, catálogo y final", () => {
    const pasos = pasosParaUsuario(tutorialSteps, "CAJERO", can(PERMISOS.CAJERO));
    const porId = new Map(pasos.map((p) => [p.id, p]));
    for (const id of [2, 5, 6, 16]) {
      expect(porId.get(id)?.titleKey).toMatch(/\.equipo\.title$/);
      expect(porId.get(id)?.descriptionKey).toMatch(/\.equipo\.description$/);
    }
    // Los demas conservan su texto.
    expect(porId.get(8)?.titleKey).toBe("tutorial.steps.openCash.title");
  });

  it("si el dueño le concede inventario, ve crear producto y el texto normal del catálogo", () => {
    const pasos = pasosParaUsuario(
      tutorialSteps,
      "CAJERO",
      can([...PERMISOS.CAJERO, "inventory.manage"])
    );
    expect(pasos.map((p) => p.id)).toContain(7);
    expect(pasos.find((p) => p.id === 6)?.titleKey).toBe("tutorial.steps.products.title");
  });

  it("los textos alternos existen en español e inglés", () => {
    for (const paso of tutorialSteps) {
      if (!paso.textoSin) continue;
      for (const mensajes of [esMessages, enMessages]) {
        expect(typeof leer(paso.textoSin.titleKey, mensajes)).toBe("string");
        expect(typeof leer(paso.textoSin.descriptionKey, mensajes)).toBe("string");
      }
    }
  });
});
