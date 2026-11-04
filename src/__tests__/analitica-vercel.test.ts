import { describe, expect, it } from "vitest";
import { limpiarEvento, limpiarUrl } from "@/components/analitica-vercel";

const APP = "https://app.symvora.com.mx";
const WWW = "https://www.symvora.com.mx";

describe("limpieza de URLs para Vercel Analytics", () => {
  it("quita el query string y el hash", () => {
    expect(limpiarUrl(`${APP}/es/reset-password?code=abc123&type=recovery`)).toBe(`${APP}/es/reset-password`);
    expect(limpiarUrl(`${APP}/es/login#access_token=xyz`)).toBe(`${APP}/es/login`);
    expect(limpiarUrl(`${APP}/es/dashboard?app=android`)).toBe(`${APP}/es/dashboard`);
  });

  it("oculta el código de la tarjeta de lealtad", () => {
    expect(limpiarUrl(`${APP}/es/tarjeta/K7P2M9QX4RTA`)).toBe(`${APP}/es/tarjeta/[codigo]`);
    expect(limpiarUrl(`${WWW}/en/tarjeta/K7P2M9QX4RTA?ref=qr`)).toBe(`${WWW}/en/tarjeta/[codigo]`);
  });

  it("oculta el código del cartel de registro", () => {
    expect(limpiarUrl(`${APP}/es/tarjeta/unirse/ABCD1234`)).toBe(`${APP}/es/tarjeta/unirse/[codigo]`);
  });

  it("deja intactas las páginas sin secretos", () => {
    for (const url of [`${WWW}/es`, `${WWW}/es/precios`, `${WWW}/es/catalogo/mi-tienda`, `${APP}/es/pos`]) {
      expect(limpiarUrl(url)).toBe(url);
    }
  });

  it("no truena con una URL relativa", () => {
    expect(limpiarUrl("/es/tarjeta/K7P2M9QX4RTA?x=1")).toBe("/es/tarjeta/[codigo]");
  });

  it("conserva el tipo del evento", () => {
    expect(limpiarEvento({ type: "pageview", url: `${APP}/es/tarjeta/K7P2M9QX4RTA` })).toEqual({
      type: "pageview",
      url: `${APP}/es/tarjeta/[codigo]`,
    });
  });
});
