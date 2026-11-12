/**
 * Etiquetas de producto (codigo de barras, nombre y precio) en PDF: formatos,
 * paginacion y textos. Puro: el dibujo vive en `etiquetas-pdf.ts`.
 *
 * Dos familias:
 * - Hoja carta de etiquetas adhesivas (impresora de casa u oficina).
 * - Rollo: una etiqueta por pagina del tamano de la etiqueta (impresoras de
 *   etiquetas Zebra, Xprinter, Brother...). Se imprime al 100 %.
 */
import { formatMoneda, type Moneda } from "@/lib/money";
import { abreviatura, esFraccionable } from "@/lib/unidades";

export type IdFormato = "carta-3x10" | "carta-4x20" | "rollo-50x25" | "rollo-40x30" | "rollo-58x40";

export interface FormatoEtiqueta {
  id: IdFormato;
  nombre: string;
  descripcion: string;
  tipo: "hoja" | "rollo";
  /** Medidas de la etiqueta en mm. */
  ancho: number;
  alto: number;
  /** Solo hojas: rejilla y acomodo en la hoja carta (mm). */
  columnas: number;
  filas: number;
  margenSuperior: number;
  margenIzquierdo: number;
  separacionH: number;
  separacionV: number;
  /** Renglones de nombre que caben (0 = sin nombre: etiqueta muy chica). */
  renglonesNombre: number;
}

export const HOJA_CARTA = { ancho: 215.9, alto: 279.4 } as const;

export const FORMATOS: FormatoEtiqueta[] = [
  {
    id: "carta-3x10",
    nombre: "Hoja carta · 30 etiquetas",
    descripcion: "3 × 10 de 66.7 × 25.4 mm (tipo Avery 5160 / Pressit)",
    tipo: "hoja",
    ancho: 66.7,
    alto: 25.4,
    columnas: 3,
    filas: 10,
    margenSuperior: 12.7,
    margenIzquierdo: 4.8,
    separacionH: 3.2,
    separacionV: 0,
    renglonesNombre: 2,
  },
  {
    id: "carta-4x20",
    nombre: "Hoja carta · 80 etiquetas",
    descripcion: "4 × 20 de 44.5 × 12.7 mm (tipo Avery 5167): código y precio",
    tipo: "hoja",
    ancho: 44.5,
    alto: 12.7,
    columnas: 4,
    filas: 20,
    margenSuperior: 12.7,
    margenIzquierdo: 7.6,
    separacionH: 7.6,
    separacionV: 0,
    renglonesNombre: 0,
  },
  {
    id: "rollo-50x25",
    nombre: "Rollo 50 × 25 mm",
    descripcion: "Impresora de etiquetas, una por etiqueta",
    tipo: "rollo",
    ancho: 50,
    alto: 25,
    columnas: 1,
    filas: 1,
    margenSuperior: 0,
    margenIzquierdo: 0,
    separacionH: 0,
    separacionV: 0,
    renglonesNombre: 1,
  },
  {
    id: "rollo-40x30",
    nombre: "Rollo 40 × 30 mm",
    descripcion: "Impresora de etiquetas, una por etiqueta",
    tipo: "rollo",
    ancho: 40,
    alto: 30,
    columnas: 1,
    filas: 1,
    margenSuperior: 0,
    margenIzquierdo: 0,
    separacionH: 0,
    separacionV: 0,
    renglonesNombre: 2,
  },
  {
    id: "rollo-58x40",
    nombre: "Rollo 58 × 40 mm",
    descripcion: "Impresora de etiquetas, una por etiqueta",
    tipo: "rollo",
    ancho: 58,
    alto: 40,
    columnas: 1,
    filas: 1,
    margenSuperior: 0,
    margenIzquierdo: 0,
    separacionH: 0,
    separacionV: 0,
    renglonesNombre: 2,
  },
];

export function formatoPorId(id: IdFormato): FormatoEtiqueta {
  return FORMATOS.find((f) => f.id === id) ?? FORMATOS[0];
}

/** Etiquetas por pagina: la rejilla en hojas, una en rollo. */
export function porPagina(f: FormatoEtiqueta): number {
  return f.tipo === "hoja" ? f.columnas * f.filas : 1;
}

/** Lo que va impreso en una etiqueta. */
export interface ItemEtiqueta {
  /** `producto:<id>` o `variante:<id>`. */
  clave: string;
  nombre: string;
  /** Resumen de la variante ("M · Rojo"); null en productos sin variantes. */
  detalle: string | null;
  precio: number;
  unidad: string | null;
  codigo: string | null;
  sku: string | null;
  copias: number;
}

export interface PosicionEtiqueta {
  /** 0 = primera pagina. */
  pagina: number;
  /** Esquina superior izquierda en mm, dentro de la pagina. */
  x: number;
  y: number;
  item: ItemEtiqueta;
}

/**
 * Reparte las copias en paginas. En hoja, `inicio` (1 = primera etiqueta)
 * permite aprovechar una hoja ya usada: las primeras `inicio - 1` se saltan.
 */
export function paginarEtiquetas(items: ItemEtiqueta[], f: FormatoEtiqueta, inicio = 1): PosicionEtiqueta[] {
  const n = porPagina(f);
  let indice = f.tipo === "hoja" ? Math.min(Math.max(1, Math.floor(inicio)), n) - 1 : 0;
  const posiciones: PosicionEtiqueta[] = [];
  for (const item of items) {
    const copias = Math.max(0, Math.floor(item.copias));
    for (let c = 0; c < copias; c++) {
      const pagina = Math.floor(indice / n);
      const enPagina = indice % n;
      const col = enPagina % f.columnas;
      const fila = Math.floor(enPagina / f.columnas);
      posiciones.push({
        pagina,
        x: f.tipo === "hoja" ? f.margenIzquierdo + col * (f.ancho + f.separacionH) : 0,
        y: f.tipo === "hoja" ? f.margenSuperior + fila * (f.alto + f.separacionV) : 0,
        item,
      });
      indice++;
    }
  }
  return posiciones;
}

export function totalEtiquetas(items: ItemEtiqueta[]): number {
  return items.reduce((s, i) => s + Math.max(0, Math.floor(i.copias)), 0);
}

/** "$18.00" o, a granel, "$180.00 /kg" (el precio se captura por unidad). */
export function textoPrecio(precio: number, unidad: string | null, moneda: Moneda = "MXN"): string {
  const base = formatMoneda(precio, moneda);
  return esFraccionable(unidad) ? `${base} /${abreviatura(unidad, 1)}` : base;
}
