import { describe, expect, it } from "vitest";
import { detectarPlataforma, pasosParaInstalar, urlInstalar } from "@/features/instalar-app/plataforma";

const UA = {
  chromeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  firefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
};

describe("instalar SYMVORA como app", () => {
  it("reconoce el navegador para dar los pasos correctos", () => {
    expect(detectarPlataforma(UA.chromeWin)).toBe("chromium-escritorio");
    expect(detectarPlataforma(UA.edge)).toBe("chromium-escritorio");
    expect(detectarPlataforma(UA.safariMac)).toBe("safari-mac");
    expect(detectarPlataforma(UA.firefox)).toBe("firefox");
    expect(detectarPlataforma(UA.iphone)).toBe("ios");
    expect(detectarPlataforma(UA.android)).toBe("android");
  });

  it("cada plataforma tiene pasos", () => {
    for (const p of ["chromium-escritorio", "safari-mac", "firefox", "ios", "android", "otro"] as const) {
      expect(pasosParaInstalar(p).pasos.length, p).toBeGreaterThan(0);
    }
  });

  it("la instalación siempre ocurre en el host de la app, nunca en www", () => {
    expect(urlInstalar("www.symvora.com.mx")).toBe("https://app.symvora.com.mx/es/instalar");
    expect(urlInstalar("localhost")).toBe("/es/instalar");
  });
});
