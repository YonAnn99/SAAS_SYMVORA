import { describe, expect, it, vi } from "vitest";
import { FILAS_POR_TRAMO, leerPorTramos } from "@/lib/leer-por-tramos";

/** Una tabla falsa que responde como PostgREST: nunca más de `tope` filas por petición. */
function tablaFalsa(total: number, tope = FILAS_POR_TRAMO) {
  const filas = Array.from({ length: total }, (_, i) => ({ id: i + 1 }));
  const pedir = vi.fn(async (desde: number, hasta: number) => ({
    data: filas.slice(desde, Math.min(hasta, desde + tope - 1) + 1),
    error: null,
  }));
  return { filas, pedir };
}

describe("leerPorTramos", () => {
  it.each([0, 1, 999])("con %i filas hace UNA sola petición", async (total) => {
    const { pedir } = tablaFalsa(total);
    const filas = await leerPorTramos(pedir);
    expect(filas).toHaveLength(total);
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it("con exactamente 1,000 filas pide un segundo tramo (vacío) y no pierde nada", async () => {
    const { pedir } = tablaFalsa(1000);
    const filas = await leerPorTramos(pedir);
    expect(filas).toHaveLength(1000);
    expect(pedir.mock.calls.map((c) => c[0])).toEqual([0, 1000, 2000, 3000]);
  });

  it("con 1,001 filas trae la que PostgREST cortaba", async () => {
    const { pedir } = tablaFalsa(1001);
    const filas = await leerPorTramos(pedir);
    expect(filas).toHaveLength(1001);
    expect(filas[1000]).toEqual({ id: 1001 });
  });

  it("con 20,500 filas las trae todas, en orden y sin repetir", async () => {
    const { pedir, filas: tabla } = tablaFalsa(20500);
    const filas = await leerPorTramos(pedir);
    expect(filas).toHaveLength(20500);
    expect(filas).toEqual(tabla);
    expect(new Set(filas.map((f) => f.id)).size).toBe(20500);
  });

  it("pide los tramos pedidos con el rango correcto (desde, hasta)", async () => {
    const { pedir } = tablaFalsa(2500);
    await leerPorTramos(pedir);
    const rangos = pedir.mock.calls.map(([d, h]) => [d, h]);
    expect(rangos).toContainEqual([0, 999]);
    expect(rangos).toContainEqual([1000, 1999]);
    expect(rangos).toContainEqual([2000, 2999]);
  });

  it("usa oleadas: las peticiones de los tramos 2+ no pasan de `paralelas` a la vez", async () => {
    let enVuelo = 0;
    let maximo = 0;
    const filas = Array.from({ length: 9000 }, (_, i) => ({ id: i }));
    const pedir = async (desde: number, hasta: number) => {
      enVuelo++;
      maximo = Math.max(maximo, enVuelo);
      await new Promise((r) => setTimeout(r, 1));
      enVuelo--;
      return { data: filas.slice(desde, hasta + 1), error: null };
    };
    const todas = await leerPorTramos(pedir, { paralelas: 2 });
    expect(todas).toHaveLength(9000);
    expect(maximo).toBeLessThanOrEqual(2);
  });

  it("si un tramo falla, lanza el error y NO devuelve una lista a medias", async () => {
    const filas = Array.from({ length: 3000 }, (_, i) => ({ id: i }));
    const pedir = async (desde: number, hasta: number) =>
      desde === 1000
        ? { data: null, error: { message: "timeout" } }
        : { data: filas.slice(desde, hasta + 1), error: null };
    await expect(leerPorTramos(pedir)).rejects.toMatchObject({ message: "timeout" });
  });

  it("si falla el primer tramo, lanza el error", async () => {
    await expect(
      leerPorTramos(async () => ({ data: null, error: { message: "sin permiso" } }))
    ).rejects.toMatchObject({ message: "sin permiso" });
  });

  it("un tramo menor al tope de PostgREST (500) también se respeta", async () => {
    const { pedir, filas: tabla } = tablaFalsa(1300);
    const filas = await leerPorTramos(pedir, { tramo: 500 });
    expect(filas).toEqual(tabla);
  });

  it("no se pasa de los 1,000 que permite PostgREST aunque se pida más", async () => {
    const { pedir } = tablaFalsa(1500);
    const filas = await leerPorTramos(pedir, { tramo: 5000 });
    expect(filas).toHaveLength(1500);
    expect(pedir.mock.calls[0]).toEqual([0, 999]);
  });

  it("con `maximo` corta ahí, conserva las primeras filas y deja avisar el truncado", async () => {
    const { pedir, filas: tabla } = tablaFalsa(12000);
    const filas = await leerPorTramos(pedir, { maximo: 5000 });
    expect(filas).toHaveLength(5000);
    expect(filas).toEqual(tabla.slice(0, 5000));
    // No se siguió leyendo hasta el final.
    expect(pedir.mock.calls.length).toBeLessThan(10);
  });

  it("con `maximo` y menos filas que el tope, devuelve todas", async () => {
    const { pedir } = tablaFalsa(2300);
    expect(await leerPorTramos(pedir, { maximo: 5000 })).toHaveLength(2300);
  });

  it("con `maximo` menor al tramo y una sola respuesta corta, también recorta", async () => {
    const { pedir } = tablaFalsa(700);
    expect(await leerPorTramos(pedir, { maximo: 400 })).toHaveLength(400);
  });

  it("con `maximo` menor al tramo recorta la primera respuesta", async () => {
    const { pedir } = tablaFalsa(5000);
    expect(await leerPorTramos(pedir, { maximo: 400 })).toHaveLength(400);
  });

  it("se detiene si la consulta nunca termina (freno de seguridad)", async () => {
    const siempreLlena = async (desde: number, hasta: number) => ({
      data: Array.from({ length: hasta - desde + 1 }, (_, i) => ({ id: desde + i })),
      error: null,
    });
    await expect(leerPorTramos(siempreLlena, { paralelas: 50 })).rejects.toThrow(/más tramos/);
  });
});
