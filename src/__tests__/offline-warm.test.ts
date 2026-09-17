import { describe, expect, it } from "vitest";
import {
  APP_PAGE_PATH,
  esRespuestaUtilizable,
  rutasAPrecalentar,
  rutasPorPrecalentar,
} from "@/lib/offline/route-cache";

/**
 * El fallo que previenen estos test: en Android, con la PWA instalada, abrir en
 * modo avion mostraba una pantalla de "Sin conexion" sin salida. La causa era
 * que la cache del panel estaba vacia y el precalentado no la volvia a
 * intentar.
 */

const HORA = 60 * 60 * 1000;
const MINUTO = 60 * 1000;
const AHORA = 1_700_000_000_000;

describe("rutasAPrecalentar", () => {
  it("antepone el idioma a cada ruta", () => {
    expect(rutasAPrecalentar("es")).toEqual(["/es/dashboard", "/es/pos"]);
    expect(rutasAPrecalentar("en")).toEqual(["/en/dashboard", "/en/pos"]);
  });

  it("el dashboard va primero, porque es el start_url de la PWA", () => {
    // Si el arranque en frio no encuentra el dashboard, da igual lo demas.
    expect(rutasAPrecalentar("es")[0]).toBe("/es/dashboard");
  });
});

describe("rutasPorPrecalentar", () => {
  const TODAS = new Set(["/es/dashboard", "/es/pos"]);

  it("pide una ruta AUSENTE aunque el candado siga vigente", () => {
    // Este es el test que habria cazado el fallo. Antes, la marca de tiempo
    // bloqueaba el reintento seis horas SIN mirar si la cache tenia algo, asi
    // que un dispositivo que perdia la cache se quedaba sin Punto de Venta.
    const recienIntentado = { at: AHORA - MINUTO, ok: true };
    expect(
      rutasPorPrecalentar("es", new Set(), recienIntentado, AHORA)
    ).toEqual(["/es/dashboard", "/es/pos"]);
  });

  it("no repite una ruta ya guardada antes de seis horas", () => {
    const hace1h = { at: AHORA - HORA, ok: true };
    expect(rutasPorPrecalentar("es", TODAS, hace1h, AHORA)).toEqual([]);
  });

  it("refresca lo guardado pasadas seis horas", () => {
    const hace7h = { at: AHORA - 7 * HORA, ok: true };
    expect(rutasPorPrecalentar("es", TODAS, hace7h, AHORA)).toEqual([
      "/es/dashboard",
      "/es/pos",
    ]);
  });

  it("si el ultimo intento fallo, reintenta a los cinco minutos", () => {
    const fallo = { at: AHORA - 6 * MINUTO, ok: false };
    expect(rutasPorPrecalentar("es", TODAS, fallo, AHORA)).toHaveLength(2);
  });

  it("tras un fallo muy reciente espera un poco antes de insistir", () => {
    const fallo = { at: AHORA - MINUTO, ok: false };
    expect(rutasPorPrecalentar("es", TODAS, fallo, AHORA)).toEqual([]);
  });

  it("pide solo la que falta cuando la otra ya esta", () => {
    const soloDashboard = new Set(["/es/dashboard"]);
    const recien = { at: AHORA - MINUTO, ok: true };
    expect(rutasPorPrecalentar("es", soloDashboard, recien, AHORA)).toEqual([
      "/es/pos",
    ]);
  });

  it("sin marca previa pide todo", () => {
    expect(rutasPorPrecalentar("es", new Set(), null, AHORA)).toHaveLength(2);
  });

  it("con force pide todo aunque este guardado y recien intentado", () => {
    const recien = { at: AHORA - MINUTO, ok: true };
    expect(
      rutasPorPrecalentar("es", TODAS, recien, AHORA, true)
    ).toHaveLength(2);
  });
});

describe("esRespuestaUtilizable", () => {
  const ORIGEN = "https://app.symvora.com.mx";

  it("acepta un 200 cuya URL final es la pedida", () => {
    expect(
      esRespuestaUtilizable(
        "/es/pos",
        { ok: true, status: 200, redirected: false, url: `${ORIGEN}/es/pos` },
        ORIGEN
      )
    ).toBe("guardada");
  });

  it("rechaza el login devuelto como 200 tras seguir el redirect", () => {
    // Con la sesion caducada el servidor manda 307 a /login y `fetch` lo SIGUE.
    // Guardarlo bajo la URL del panel dejaria una pantalla de inicio de sesion
    // sin conexion, incapaz de validar nada: peor que la pagina de "sin
    // conexion", que al menos lo explica.
    expect(
      esRespuestaUtilizable(
        "/es/dashboard",
        { ok: true, status: 200, redirected: true, url: `${ORIGEN}/es/login` },
        ORIGEN
      )
    ).toBe("redirigida");
  });

  it("rechaza aunque `redirected` venga en false pero la URL cambie", () => {
    // `redirected` no siempre sobrevive al paso por el service worker.
    expect(
      esRespuestaUtilizable(
        "/es/dashboard",
        {
          ok: true,
          status: 200,
          redirected: false,
          url: `${ORIGEN}/es/billing`,
        },
        ORIGEN
      )
    ).toBe("redirigida");
  });

  it("rechaza offline.html, que es lo que devuelve el respaldo sin red", () => {
    // `NetworkOnly` tambien recibe el plugin de respaldo de serwist, asi que
    // sin red contesta 200 con la pagina de "sin conexion" dentro.
    expect(
      esRespuestaUtilizable(
        "/es/pos",
        {
          ok: true,
          status: 200,
          redirected: false,
          url: `${ORIGEN}/offline.html`,
        },
        ORIGEN
      )
    ).toBe("redirigida");
  });

  it("rechaza cualquier cosa que no sea 200", () => {
    expect(
      esRespuestaUtilizable(
        "/es/pos",
        { ok: false, status: 500, redirected: false, url: `${ORIGEN}/es/pos` },
        ORIGEN
      )
    ).toBe("http-error");
  });
});

describe("APP_PAGE_PATH", () => {
  it.each(["/es/dashboard", "/es/pos", "/en/pos", "/es/pos/", "/es/dashboard/x"])(
    "acepta %s",
    (path) => {
      expect(APP_PAGE_PATH.test(path)).toBe(true);
    }
  );

  it.each(["/es/products", "/pos", "/es/posts", "/es/positions", "/dashboard"])(
    "rechaza %s",
    (path) => {
      expect(APP_PAGE_PATH.test(path)).toBe(false);
    }
  );
});
