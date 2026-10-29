import type { AjusteProductoCatalogo } from "./types";

/**
 * Lógica pura de la pestaña «Productos» del módulo Catálogo en línea: qué
 * filas se ven con cada filtro, los conteos y el precio especial capturado.
 *
 * Sin fila en `catalogo_productos` = publicado, sin destacar y a precio normal
 * (decisión del usuario: el catálogo arranca con todos los productos).
 */

export interface FilaCatalogo extends AjusteProductoCatalogo {
  id: string;
  nombre: string;
  categoria: string | null;
  imagen_url: string | null;
  precio_venta: number;
  unidad_medida: string;
  tieneVariantes: boolean;
}

export type FiltroCatalogo = "todos" | "publicados" | "ocultos" | "destacados";

export const AJUSTE_POR_DEFECTO: AjusteProductoCatalogo = {
  oculto: false,
  destacado: false,
  precio_especial: null,
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function cumpleFiltro(fila: FilaCatalogo, filtro: FiltroCatalogo): boolean {
  switch (filtro) {
    case "publicados":
      return !fila.oculto;
    case "ocultos":
      return fila.oculto;
    case "destacados":
      return fila.destacado && !fila.oculto;
    default:
      return true;
  }
}

export function filtrarFilas(
  filas: FilaCatalogo[],
  { busqueda, categoria, filtro }: { busqueda: string; categoria: string | null; filtro: FiltroCatalogo }
): FilaCatalogo[] {
  const q = normalizar(busqueda);
  return filas.filter(
    (f) =>
      cumpleFiltro(f, filtro) &&
      (!categoria || f.categoria === categoria) &&
      (!q || normalizar(`${f.nombre} ${f.categoria ?? ""}`).includes(q))
  );
}

export function conteosCatalogo(filas: FilaCatalogo[]): Record<FiltroCatalogo, number> {
  return {
    todos: filas.length,
    publicados: filas.filter((f) => !f.oculto).length,
    ocultos: filas.filter((f) => f.oculto).length,
    destacados: filas.filter((f) => f.destacado && !f.oculto).length,
  };
}

/**
 * Lo tecleado en «Precio catálogo» → lo que se guarda. Vacío = sin precio
 * especial (null). Debe ser mayor a 0 (CHECK de la 125), con 2 decimales. Si es
 * igual al normal no tiene caso: se guarda null.
 */
export function precioEspecialCapturado(
  texto: string,
  precioNormal: number
): { ok: true; valor: number | null } | { ok: false; error: string } {
  const limpio = texto.trim().replace(",", ".").replace(/^\$/, "");
  if (limpio === "") return { ok: true, valor: null };
  if (!/^\d+(\.\d+)?$/.test(limpio)) return { ok: false, error: "Escribe un precio válido" };
  const valor = Math.round(Number(limpio) * 100) / 100;
  if (!(valor > 0)) return { ok: false, error: "El precio debe ser mayor a $0" };
  if (valor === Math.round(precioNormal * 100) / 100) return { ok: true, valor: null };
  return { ok: true, valor };
}

/** El ajuste que resulta de aplicar una acción en grupo a una fila. */
export function aplicarAccion(
  ajuste: AjusteProductoCatalogo,
  accion: "publicar" | "ocultar" | "destacar" | "quitarDestacado"
): AjusteProductoCatalogo {
  switch (accion) {
    case "publicar":
      return { ...ajuste, oculto: false };
    case "ocultar":
      return { ...ajuste, oculto: true };
    case "destacar":
      // Destacar algo oculto no tendría efecto: también se publica.
      return { ...ajuste, destacado: true, oculto: false };
    case "quitarDestacado":
      return { ...ajuste, destacado: false };
  }
}
