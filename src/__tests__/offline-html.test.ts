import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_PAGES_CACHE } from "@/lib/offline/route-cache";

/**
 * `public/offline.html` es un archivo estatico: no pasa por el bundler, asi que
 * no puede importar nada del proyecto y tiene que repetir el nombre de la cache
 * y el patron de la ruta. Estos test vigilan que esa copia no se separe del
 * original, que es como se produjo el fallo original.
 */

const HTML = readFileSync(
  join(process.cwd(), "public", "offline.html"),
  "utf8"
);

describe("pagina de respaldo sin conexion", () => {
  it("busca en la MISMA cache que usa el service worker", () => {
    expect(HTML).toContain(APP_PAGES_CACHE);
  });

  it("no recorre todas las caches para decidir si hay Punto de Venta", () => {
    // ESTE es el fallo que se corrigio. Al recorrer `caches.keys()` encontraba
    // los payloads RSC que serwist guarda en `pages-rsc` bajo
    // `/es/pos?_rsc=...`, cuyo pathname es `/es/pos`. Encendia el boton "Abrir
    // Punto de Venta" aunque el DOCUMENTO no estuviera guardado, y al pulsarlo
    // la navegacion volvia a caer en esta misma pagina: un bucle cerrado.
    const deteccion = HTML.slice(
      HTML.indexOf("var APP_PAGES_CACHE"),
      HTML.indexOf("// Diagnostico")
    );
    expect(deteccion).not.toContain("caches.keys()");
    expect(deteccion).toContain("caches.open(APP_PAGES_CACHE)");
  });

  it("descarta las entradas que llevan query, como los payloads RSC", () => {
    expect(HTML).toContain("url.search");
  });

  it("exige que la respuesta guardada sea HTML de verdad", () => {
    // Que la clave exista en la cache no garantiza que devuelva algo usable.
    expect(HTML).toContain("text/html");
  });

  it("su patron distingue /es/pos de rutas que solo empiezan igual", () => {
    const encontrado = HTML.match(/var POS_PATH = (\/.+\/);/);
    expect(encontrado).not.toBeNull();
    const patron = new RegExp(
      encontrado![1].slice(1, encontrado![1].lastIndexOf("/"))
    );
    expect(patron.test("/es/pos")).toBe(true);
    expect(patron.test("/en/pos")).toBe(true);
    expect(patron.test("/es/posts")).toBe(false);
    expect(patron.test("/es/positions")).toBe(false);
    expect(patron.test("/pos")).toBe(false);
  });

  it("tiene cerrojo para no entrar en bucle de redirecciones", () => {
    // Sin el, si la navegacion volviera a caer aqui el telefono se quedaria
    // redirigiendo en bucle: peor que el callejon sin salida que se arregla.
    expect(HTML).toContain("sessionStorage");
    expect(HTML).toContain("symvora_offline_redirect");
  });

  it("dice la verdad cuando el Punto de Venta no esta guardado", () => {
    expect(HTML).toContain("sin-guardar");
    expect(HTML).toContain("todavia no ha guardado el Punto de Venta");
  });
});
