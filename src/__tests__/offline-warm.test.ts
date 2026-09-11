import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { warmOfflineRoutes } from "@/lib/offline/route-cache";

const MARCA = "symvora_offline_warm_at";

/** Respuesta como la que devuelve `fetch` tras seguir un redirect a /login. */
function redirigida(destino: string): Response {
  return {
    ok: true,
    status: 200,
    redirected: true,
    url: `http://localhost${destino}`,
  } as Response;
}

function correcta(path: string): Response {
  return {
    ok: true,
    status: 200,
    redirected: false,
    url: `http://localhost${path}`,
  } as Response;
}

describe("precalentado de rutas offline", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Sin service worker controlando, `fetch` gastaría datos sin guardar nada.
    Object.defineProperty(navigator, "serviceWorker", {
      value: { controller: {} },
      configurable: true,
    });
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("guarda las rutas y deja marca cuando todo va bien", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((path: string) => Promise.resolve(correcta(path)));
    vi.stubGlobal("fetch", fetchMock);

    await warmOfflineRoutes("es");

    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "/es/dashboard",
      "/es/pos",
    ]);
    expect(window.localStorage.getItem(MARCA)).not.toBeNull();
  });

  it("con la sesión caducada NO deja marca, para reintentar en la próxima carga", async () => {
    // El fallo real: el servidor responde 307 a /login, `fetch` lo sigue y
    // devuelve un 200 impecable con el login dentro. Si eso contara como éxito,
    // el dispositivo se quedaría sin Punto de Venta y sin reintentar en 6 h.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(redirigida("/es/login")));

    await warmOfflineRoutes("es");

    expect(window.localStorage.getItem(MARCA)).toBeNull();
  });

  it("detecta el redirect aunque `redirected` se pierda: mira la URL final", async () => {
    // `redirected` no siempre sobrevive al paso por el service worker.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        redirected: false,
        url: "http://localhost/es/login",
      } as Response)
    );

    await warmOfflineRoutes("es");

    expect(window.localStorage.getItem(MARCA)).toBeNull();
  });

  it("se detiene en la primera ruta que falla", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      redirected: false,
      url: "http://localhost/es/dashboard",
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await warmOfflineRoutes("es");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(MARCA)).toBeNull();
  });

  it("si se corta la red a mitad no deja marca ni lanza", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("sin red")));

    await expect(warmOfflineRoutes("es")).resolves.toBeUndefined();
    expect(window.localStorage.getItem(MARCA)).toBeNull();
  });

  it("no hace nada sin un service worker controlando la página", async () => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: { controller: null },
      configurable: true,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await warmOfflineRoutes("es");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no repite el precalentado antes de que pasen 6 horas", async () => {
    window.localStorage.setItem(MARCA, String(Date.now()));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await warmOfflineRoutes("es");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("al volver la conexión se fuerza el precalentado aunque sea reciente", async () => {
    // Es justo el momento en que conviene refrescar: si se cayó la red, lo
    // guardado empieza a envejecer.
    window.localStorage.setItem(MARCA, String(Date.now()));
    const fetchMock = vi
      .fn()
      .mockImplementation((path: string) => Promise.resolve(correcta(path)));
    vi.stubGlobal("fetch", fetchMock);

    await warmOfflineRoutes("es", { force: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("respeta el idioma activo", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((path: string) => Promise.resolve(correcta(path)));
    vi.stubGlobal("fetch", fetchMock);

    await warmOfflineRoutes("en");

    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "/en/dashboard",
      "/en/pos",
    ]);
  });
});
