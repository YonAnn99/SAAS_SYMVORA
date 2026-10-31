import { describe, expect, it } from "vitest";
import {
  cookiesViejasParaBorrar,
  esPestanaDeApp,
  marcarSiVieneDeApp,
  vieneDeAppAndroid,
  type AlmacenSesion,
} from "@/lib/app-android";

function almacen(): AlmacenSesion & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return { datos, getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => void datos.set(k, v) };
}
import { GET } from "@/app/.well-known/assetlinks.json/route";

describe("app de Android (TWA)", () => {
  it("la reconoce por el parámetro de inicio o por el referrer de la TWA", () => {
    expect(vieneDeAppAndroid("https://app.symvora.com.mx/es/dashboard?app=android", "")).toBe(true);
    expect(vieneDeAppAndroid("https://app.symvora.com.mx/es/auth", "android-app://com.symvora.app/")).toBe(true);
    expect(vieneDeAppAndroid("https://app.symvora.com.mx/es/dashboard", "https://www.google.com/")).toBe(false);
  });

  it("marca SOLO la pestaña de la app (sessionStorage), nunca Chrome", () => {
    const app = almacen();
    expect(marcarSiVieneDeApp(app, "https://app.symvora.com.mx/es/dashboard?app=android", "")).toBe(true);
    // Ya marcada, sigue marcada al navegar sin el parametro.
    expect(marcarSiVieneDeApp(app, "https://app.symvora.com.mx/es/billing", "")).toBe(true);
    expect(esPestanaDeApp(app)).toBe(true);

    // Una pestaña de Chrome tiene su propio sessionStorage: sin marca, con cobro.
    const chrome = almacen();
    expect(marcarSiVieneDeApp(chrome, "https://app.symvora.com.mx/es/billing", "https://mail.google.com/")).toBe(false);
    expect(esPestanaDeApp(chrome)).toBe(false);
  });

  it("borra la cookie de la primera versión, con y sin dominio", () => {
    expect(cookiesViejasParaBorrar("app.symvora.com.mx")).toEqual([
      "symvora_app=; path=/; max-age=0",
      "symvora_app=; path=/; max-age=0; domain=.symvora.com.mx",
    ]);
    expect(cookiesViejasParaBorrar("localhost")).toEqual(["symvora_app=; path=/; max-age=0"]);
  });

  it("assetlinks.json: vacío sin huella; con huella, el paquete y la huella en mayúsculas", async () => {
    delete process.env.ANDROID_APP_SHA256;
    expect(await GET().json()).toEqual([]);

    const huella = Array.from({ length: 32 }, () => "ab").join(":");
    process.env.ANDROID_APP_SHA256 = `${huella}, no-es-huella`;
    const cuerpo = await GET().json();
    expect(cuerpo[0].target.package_name).toBe("com.symvora.app");
    expect(cuerpo[0].target.sha256_cert_fingerprints).toEqual([huella.toUpperCase()]);
    delete process.env.ANDROID_APP_SHA256;
  });
});
