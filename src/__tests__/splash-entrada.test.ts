import { describe, expect, it } from "vitest";
import {
  CLAVE_SESION,
  ESPERA_MAX_MS,
  PAUSA_MS,
  decidirSplash,
  instanteDeSalida,
  vectorDeVuelo,
  type EntornoSplash,
} from "@/components/marketing/splash-logica";
import { CLAVE_APP, VALOR_ANDROID } from "@/lib/app-android";

function entorno(opciones: {
  ua?: string;
  webdriver?: boolean;
  reducido?: boolean;
  visto?: boolean;
  storageRoto?: boolean;
  standalone?: boolean;
  iosStandalone?: boolean;
  search?: string;
  referrer?: string;
  marcaAndroid?: boolean;
}) {
  const clases: string[] = [];
  const guardado = new Map<string, string>();
  if (opciones.visto) guardado.set(CLAVE_SESION, "1");
  if (opciones.marcaAndroid) guardado.set(CLAVE_APP, VALOR_ANDROID);
  const e: EntornoSplash = {
    document: {
      documentElement: { classList: { add: (c) => void clases.push(c) } },
      referrer: opciones.referrer ?? "",
    },
    navigator: {
      userAgent: opciones.ua ?? "Mozilla/5.0 (iPhone) Safari",
      webdriver: opciones.webdriver,
      standalone: opciones.iosStandalone,
    },
    location: { search: opciones.search ?? "" },
    matchMedia: (consulta) => ({
      matches: consulta.includes("reduced-motion")
        ? !!opciones.reducido
        : consulta.includes("standalone") && !!opciones.standalone,
    }),
    sessionStorage: {
      getItem: (k) => {
        if (opciones.storageRoto) throw new Error("bloqueado");
        return guardado.get(k) ?? null;
      },
      setItem: (k, v) => void guardado.set(k, v),
    },
  };
  return { e, clases, guardado };
}

describe("decidirSplash", () => {
  it("se muestra la primera vez y marca la sesion", () => {
    const { e, clases, guardado } = entorno({});
    expect(decidirSplash(e)).toBe(true);
    expect(clases).toEqual(["splash-activo"]);
    expect(guardado.get(CLAVE_SESION)).toBe("1");
  });

  it("no se repite en la misma sesion", () => {
    const { e, clases } = entorno({ visto: true });
    expect(decidirSplash(e)).toBe(false);
    expect(clases).toEqual(["sin-splash"]);
  });

  it("no se muestra con prefers-reduced-motion", () => {
    const { e, guardado } = entorno({ reducido: true });
    expect(decidirSplash(e)).toBe(false);
    expect(guardado.size).toBe(0);
  });

  it("no se muestra a bots, Lighthouse ni navegadores automatizados", () => {
    for (const ua of ["Googlebot/2.1", "Mozilla/5.0 Chrome-Lighthouse", "HeadlessChrome/120", "bingbot"]) {
      expect(decidirSplash(entorno({ ua }).e)).toBe(false);
    }
    expect(decidirSplash(entorno({ webdriver: true }).e)).toBe(false);
  });

  it("con sessionStorage bloqueado se muestra igual", () => {
    expect(decidirSplash(entorno({ storageRoto: true }).e)).toBe(true);
  });

  it("se puede serializar al script en linea: no usa nada de fuera de su cuerpo", () => {
    const fuente = decidirSplash.toString();
    expect(fuente).toContain(`"${CLAVE_SESION}"`);
    // Reconstruida sin el modulo, como en el navegador, decide igual.
    const suelta = new Function(`return (${fuente})`)() as typeof decidirSplash;
    const { e, clases } = entorno({});
    expect(suelta(e)).toBe(true);
    expect(clases).toEqual(["splash-activo"]);
  });
});

describe("decidirSplash en la app instalada (PWA / APK)", () => {
  it("en una pestaña normal del navegador no sale ni gasta la sesion", () => {
    const { e, clases, guardado } = entorno({});
    expect(decidirSplash(e, "app")).toBe(false);
    expect(clases).toEqual(["sin-splash"]);
    expect(guardado.has(CLAVE_SESION)).toBe(false);
  });

  it("sale en la PWA instalada (display-mode standalone o iOS)", () => {
    expect(decidirSplash(entorno({ standalone: true }).e, "app")).toBe(true);
    expect(decidirSplash(entorno({ iosStandalone: true }).e, "app")).toBe(true);
  });

  it("NO sale en la app de Play (TWA), aunque sea standalone: ahi va solo el splash nativo", () => {
    for (const marca of [
      { search: "?app=android" },
      { referrer: "android-app://com.symvora.app/" },
      { marcaAndroid: true },
    ]) {
      const { e, guardado } = entorno({ standalone: true, ...marca });
      expect(decidirSplash(e, "app")).toBe(false);
      expect(guardado.has(CLAVE_SESION)).toBe(false);
    }
    // Un parametro parecido no es la marca de la TWA.
    expect(decidirSplash(entorno({ standalone: true, search: "?app=androidx" }).e, "app")).toBe(true);
  });

  it("una vez por arranque: con la sesion vista no se repite", () => {
    expect(decidirSplash(entorno({ standalone: true, visto: true }).e, "app")).toBe(false);
  });

  it("la marca de Android escrita a mano coincide con lib/app-android.ts", () => {
    const fuente = decidirSplash.toString();
    expect(fuente).toContain(`"${CLAVE_APP}"`);
    expect(fuente).toContain(`"${VALOR_ANDROID}"`);
  });
});

describe("instanteDeSalida", () => {
  // La entrada termino en el instante 5000 (el navegador pudo pintar tarde: da igual).
  const FIN = 5000;

  it("si la pagina ya cargo, sale tras la pausa con el logo completo", () => {
    expect(instanteDeSalida(FIN, 1200)).toBe(FIN + PAUSA_MS);
  });

  it("si la pagina carga despues, sale al cargar", () => {
    expect(instanteDeSalida(FIN, FIN + PAUSA_MS + 500)).toBe(FIN + PAUSA_MS + 500);
  });

  it("si la carga tarda demasiado o no llega, sale en el tope", () => {
    expect(instanteDeSalida(FIN, FIN + 60_000)).toBe(FIN + PAUSA_MS + ESPERA_MAX_MS);
    expect(instanteDeSalida(FIN, null)).toBe(FIN + PAUSA_MS + ESPERA_MAX_MS);
  });
});

describe("vectorDeVuelo", () => {
  const origen = { left: 150, top: 350, width: 100, height: 100 };

  it("lleva centro a centro y escala por la altura", () => {
    const destino = { left: 76, top: 34, width: 28, height: 28 };
    expect(vectorDeVuelo(origen, destino)).toEqual({ dx: -110, dy: -352, s: 0.28 });
  });

  it("respeta una escala dada (la palabra usa la razon de fuentes)", () => {
    expect(vectorDeVuelo(origen, { left: 0, top: 0, width: 10, height: 10 }, 0.18).s).toBe(0.18);
  });
});
