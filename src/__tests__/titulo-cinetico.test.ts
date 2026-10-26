import { describe, expect, it } from "vitest";
import { DURACION_JUNTAR_MS, tiemposCineticos } from "@/components/auth/titulo-cinetico";

describe("tiemposCineticos", () => {
  const lineas = ["BIENVENIDO", "DE NUEVO", "INICIA SESIÓN", "EN TU CUENTA."];

  it("los renglones arrancan en orden y se traslapan con el anterior", () => {
    const { renglones } = tiemposCineticos(lineas);
    for (let k = 1; k < renglones.length; k++) {
      expect(renglones[k].inicio).toBeGreaterThan(renglones[k - 1].inicio);
      // Entra antes de que el anterior termine de juntarse, como en el video.
      expect(renglones[k].inicio).toBeLessThan(renglones[k - 1].junta + DURACION_JUNTAR_MS);
    }
  });

  it("cada renglon se junta despues de escribir su ultima letra", () => {
    const { renglones } = tiemposCineticos(lineas);
    renglones.forEach((r, k) => {
      expect(r.junta).toBeGreaterThan(r.inicio);
      // La "Ó" cuenta como una letra.
      expect(r.junta - r.inicio).toBe([...lineas[k]].length * 35);
    });
  });

  it("el retraso recorre todo, incluido el fin", () => {
    const sin = tiemposCineticos(lineas);
    const con = tiemposCineticos(lineas, 250);
    expect(con.renglones[0].inicio).toBe(250);
    expect(con.fin - sin.fin).toBe(250);
  });

  it("el fin llega despues de la ultima letra (la red de seguridad no corta la animacion)", () => {
    const { renglones, fin } = tiemposCineticos(lineas, 250);
    renglones.forEach((r, k) => {
      const ultimaLetra = r.inicio + ([...lineas[k]].length - 1) * 35;
      expect(fin).toBeGreaterThan(ultimaLetra);
      expect(fin).toBeGreaterThanOrEqual(r.junta + DURACION_JUNTAR_MS);
    });
  });

  it("sin renglones el fin es el retraso", () => {
    expect(tiemposCineticos([], 100).fin).toBe(100);
  });
});
