/**
 * Reglas de la edicion express del catalogo: dar clic sobre una celda y
 * cambiarla sin abrir el dialogo.
 *
 * Vive aparte del componente, como `stock-status.ts` y `profit.ts`, porque es
 * lo unico con logica (que unidades ofrecer, como parsear el texto, si hubo
 * cambio) y lo unico que merece test. El JSX solo pinta lo que sale de aqui.
 */

import { productSchema } from "@/lib/validations/schemas";
import type { Producto } from "./types/inventory.types";
import type { UnidadMedida } from "@/lib/types/database";

/**
 * Los cuatro campos que se pueden tocar desde la tabla.
 *
 * Codigo de barras queda fuera a proposito: identifica el producto y un clic
 * accidental lo dejaria sin escanear. Margen y Estado tampoco estan aqui
 * porque NO SON COLUMNAS: se calculan en el cliente a partir del precio, el
 * costo y el stock minimo, asi que se recalculan solos al editar los demas.
 */
export type CampoInline =
  | "nombre"
  | "unidad_medida"
  | "precio_venta"
  | "stock_actual";

export type ValorInline = string | number;

const UNIDADES_FISICAS: UnidadMedida[] = ["PIEZA", "KG", "GRAMO", "LITRO"];

/**
 * Las unidades que tiene sentido ofrecer para ESTE producto.
 *
 * Un servicio no se mide en kilos y un refresco no se mide en "servicio". El
 * enum de la base tiene los cinco valores para todo el catalogo; aqui se acota
 * al que corresponde segun `es_servicio`.
 */
export function unidadesPermitidas(
  producto: Pick<Producto, "es_servicio" | "unidad_medida">
): UnidadMedida[] {
  const base: UnidadMedida[] = producto.es_servicio
    ? ["SERVICIO"]
    : UNIDADES_FISICAS;

  // La unidad actual SIEMPRE entra, aunque contradiga `es_servicio`. Hay
  // productos con datos inconsistentes (marcados como servicio pero en PIEZA,
  // o al reves tras cambiar el switch en el dialogo). Sin esta linea el
  // desplegable abriria en blanco y el primer clic le cambiaria la unidad al
  // producto sin que nadie lo pidiera.
  return base.includes(producto.unidad_medida)
    ? base
    : [producto.unidad_medida, ...base];
}

export type Parseo =
  | { ok: true; valor: ValorInline }
  | { ok: false; error: string };

/**
 * Convierte lo que se escribio en la celda al valor que espera la base.
 *
 * Las reglas no se reescriben: se piden campo a campo a `productSchema`, el
 * mismo esquema que valida el dialogo. Si algun dia cambia el minimo de un
 * precio, cambia en los dos sitios a la vez.
 */
export function parsearCampo(campo: CampoInline, texto: string): Parseo {
  if (campo === "nombre" || campo === "unidad_medida") {
    const r = productSchema.shape[campo].safeParse(texto.trim());
    return r.success
      ? { ok: true, valor: r.data }
      : { ok: false, error: r.error.issues[0].message };
  }

  const limpio = texto.trim();
  if (limpio === "") {
    return { ok: false, error: "Escribe un número" };
  }

  // `Number("")` es 0 y `Number("12 pesos")` es NaN: sin esta guarda, "abc"
  // llegaria al esquema como NaN y `z.number().min(0)` lo dejaria pasar
  // (NaN >= 0 es false, pero el mensaje resultante no diria nada util).
  const numero = Number(limpio);
  if (!Number.isFinite(numero)) {
    return { ok: false, error: "Escribe un número válido" };
  }

  const r = productSchema.shape[campo].safeParse(numero);
  return r.success
    ? { ok: true, valor: r.data }
    : { ok: false, error: r.error.issues[0].message };
}

/** Si el valor es el que ya tenia, no hay nada que mandar al servidor. */
export function hayCambio(
  producto: Producto,
  campo: CampoInline,
  valor: ValorInline
): boolean {
  return producto[campo] !== valor;
}

/**
 * La diferencia que espera `ajustar_inventario`.
 *
 * El RPC recibe un AJUSTE, no un total: quien escribe "42" sobre un stock de
 * 50 esta pidiendo un -8. Mandar el total sumaria 42 a los 50 existentes.
 */
export function deltaStock(actual: number, nuevo: number): number {
  // Los stocks son DECIMAL(10,3) y la resta en coma flotante deja colas
  // (50.1 - 50 = 0.09999999999999432). Se redondea a los 3 decimales que
  // admite la columna para que el ajuste registrado sea el que se ve.
  return Math.round((nuevo - actual) * 1000) / 1000;
}

/** El texto con el que se abre el campo al entrar en edicion. */
export function valorParaEditar(
  producto: Producto,
  campo: CampoInline
): string {
  return String(producto[campo]);
}
