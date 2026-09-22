import { describe, expect, it } from "vitest";
import {
  errorDePhotoroom,
  SIN_LLAVE,
  SIN_RESPUESTA,
} from "@/features/inventory/photoroom-errores";

/**
 * Quitar el fondo es opcional: si falla, el producto se tiene que poder guardar
 * igual con la foto original. Estos test protegen que el mensaje lo diga y que
 * no se escape nada del servicio externo al navegador.
 */

const TODOS = [400, 401, 402, 403, 415, 429, 500, 502, 503, 504, 418];

describe("quién tiene que hacer algo con cada error", () => {
  it("un 400 culpa a la foto, que es lo único que el cajero puede cambiar", () => {
    const e = errorDePhotoroom(400);
    expect(e.status).toBe(400);
    expect(e.mensaje).toMatch(/otra|foto/i);
  });

  it("un 402 avisa de que se acabaron los créditos, que resuelve el dueño", () => {
    // El cajero no puede recargar créditos. Decirle "intenta con otra foto"
    // sería mandarlo a probar diez veces algo que nunca va a funcionar.
    const e = errorDePhotoroom(402);
    expect(e.status).toBe(402);
    expect(e.mensaje).toMatch(/crédit/i);
  });

  it("una llave inválida NO se le presenta al cajero como culpa suya", () => {
    // 401/403 significa que la llave caducó o está mal copiada: es un problema
    // de configuración. Pedirle al cajero que cambie la foto lo mandaría a
    // perseguir un fallo que no está en su mano.
    for (const status of [401, 403]) {
      const e = errorDePhotoroom(status);
      expect(e.status).toBe(503);
      expect(e.mensaje).toMatch(/soporte/i);
      expect(e.mensaje).not.toMatch(/foto|imagen original/i);
    }
  });

  it("falta de llave y fallo del servicio son cosas distintas", () => {
    // Los dos dan 503, pero uno lo arregla quien despliega añadiendo la
    // variable y el otro no lo arregla nadie desde aquí. Si dieran el mismo
    // mensaje, una configuración olvidada parecería una caída de PhotoRoom.
    expect(SIN_LLAVE.status).toBe(503);
    expect(errorDePhotoroom(503).status).toBe(502);
    expect(SIN_LLAVE.mensaje).not.toBe(errorDePhotoroom(503).mensaje);
  });
});

describe("siempre se puede seguir adelante", () => {
  it("los fallos que no son culpa de la foto ofrecen guardar con la original", () => {
    // Quitar el fondo es un lujo, no un requisito. Un error aquí no puede
    // dejar al comerciante sin poder dar de alta su producto.
    for (const status of [402, 500, 502, 504]) {
      expect(errorDePhotoroom(status).mensaje).toMatch(/original/i);
    }
    expect(SIN_RESPUESTA.mensaje).toMatch(/original/i);
  });
});

describe("no se filtra nada del servicio externo", () => {
  it("ningún mensaje menciona a PhotoRoom ni códigos técnicos", () => {
    // El cuerpo de la respuesta de PhotoRoom puede traer datos de la cuenta o
    // pistas sobre la llave. Nada de eso sale de nuestro servidor, y el nombre
    // del proveedor tampoco: es una decisión nuestra que puede cambiar.
    for (const status of TODOS) {
      const m = errorDePhotoroom(status).mensaje;
      expect(m).not.toMatch(/photoroom|sdk\.|api[_ -]?key|x-api/i);
      expect(m).not.toMatch(/\b[45]\d\d\b/);
    }
    expect(SIN_LLAVE.mensaje).not.toMatch(/photoroom/i);
  });

  it("todos los mensajes están en español y son frases completas", () => {
    for (const status of TODOS) {
      const m = errorDePhotoroom(status).mensaje;
      expect(m.length).toBeGreaterThan(20);
      expect(m.trim().endsWith(".")).toBe(true);
    }
  });
});

describe("cobertura de códigos", () => {
  it("cualquier código desconocido cae en un fallo genérico, no revienta", () => {
    // PhotoRoom puede añadir códigos mañana. Un `switch` sin `default` habría
    // devuelto `undefined` y roto la ruta.
    const e = errorDePhotoroom(418);
    expect(e.status).toBe(502);
    expect(e.mensaje).toBeTruthy();
  });

  it("nunca devuelve 200 disfrazado de error", () => {
    for (const status of TODOS) {
      expect(errorDePhotoroom(status).status).toBeGreaterThanOrEqual(400);
    }
  });
});
