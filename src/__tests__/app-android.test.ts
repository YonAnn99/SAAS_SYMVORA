import { describe, expect, it } from "vitest";
import { cookieAndroid, tieneCookieAndroid, vieneDeAppAndroid } from "@/lib/app-android";
import { GET } from "@/app/.well-known/assetlinks.json/route";

describe("app de Android (TWA)", () => {
  it("la reconoce por el parámetro de inicio o por el referrer de la TWA", () => {
    expect(vieneDeAppAndroid("https://app.symvora.com.mx/es/dashboard?app=android", "")).toBe(true);
    expect(vieneDeAppAndroid("https://app.symvora.com.mx/es/auth", "android-app://com.symvora.app/")).toBe(true);
    expect(vieneDeAppAndroid("https://app.symvora.com.mx/es/dashboard", "https://www.google.com/")).toBe(false);
  });

  it("lee la cookie exacta, no una parecida", () => {
    expect(tieneCookieAndroid("a=1; symvora_app=android; b=2")).toBe(true);
    expect(tieneCookieAndroid("symvora_app=androidx")).toBe(false);
    expect(tieneCookieAndroid("")).toBe(false);
  });

  it("la cookie vale para www. y app. en producción, y sin dominio en localhost", () => {
    expect(cookieAndroid("app.symvora.com.mx")).toContain("domain=.symvora.com.mx");
    expect(cookieAndroid("app.symvora.com.mx")).toContain("Secure");
    expect(cookieAndroid("localhost")).not.toContain("domain=");
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
