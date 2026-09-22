import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultProductFormData } from "@/features/inventory/types/inventory.types";

/**
 * Los valores por defecto del formulario de producto viven en DOS sitios que no
 * pueden compartir una constante: el `DEFAULT` de la columna en SQL y el objeto
 * de TypeScript que rellena el formulario. Este test es lo unico que impide que
 * se separen.
 *
 * Y ya se separaron una vez: el formulario ponia `stock_minimo: "5"` mientras la
 * base ponia 0. Resultado, TODO producto creado desde la interfaz nacia con un
 * umbral de 5 que su dueño nunca eligio, y con alertas de "stock bajo"
 * inventadas. Nadie lo noto durante meses porque los dos valores son plausibles
 * por separado; solo se ve al compararlos.
 *
 * Mismo patron que `trial.test.ts`, que hace esto con `dias_de_prueba()`.
 */

const RAIZ = process.cwd();

function defaultDeLaColumna(columna: string): string {
  const sql = readFileSync(
    join(RAIZ, "supabase", "migrations", "001_initial_schema.sql"),
    "utf8"
  );

  // Se acota a la tabla `productos`: otras tablas tienen columnas con el mismo
  // nombre y la primera coincidencia del archivo no tiene por que ser la suya.
  const tabla = sql.match(/CREATE TABLE public\.productos \(([\s\S]*?)\n\);/);
  if (!tabla) throw new Error("No encontré la definición de la tabla productos");

  const linea = tabla[1]
    .split("\n")
    .find((l) => l.trim().startsWith(`${columna} `));
  if (!linea) throw new Error(`No encontré la columna ${columna} en productos`);

  const def = linea.match(/DEFAULT\s+([^\s,]+)/i);
  if (!def) throw new Error(`La columna ${columna} no declara DEFAULT`);
  return def[1];
}

describe("los valores por defecto del formulario coinciden con los de la base", () => {
  it("stock mínimo: el formulario no inventa un umbral que el cliente no pidió", () => {
    // ESTE es el que importa. Con "5" el sistema decidía por el comerciante a
    // qué nivel debía preocuparse por cada producto de su catálogo.
    expect(Number(defaultProductFormData.stock_minimo)).toBe(
      Number(defaultDeLaColumna("stock_minimo"))
    );
  });

  it("stock actual arranca igual en los dos lados", () => {
    expect(Number(defaultProductFormData.stock_actual)).toBe(
      Number(defaultDeLaColumna("stock_actual"))
    );
  });

  it("la lectura del SQL funciona de verdad y no devuelve cualquier cosa", () => {
    // Sin esto, un cambio en el formato de la migración haría que el regex
    // dejara de casar y los dos test de arriba pasarían comparando basura
    // contra basura — o peor, pasarían por accidente.
    expect(defaultDeLaColumna("stock_minimo")).toBe("0");
    expect(() => defaultDeLaColumna("columna_que_no_existe")).toThrow();
  });
});
