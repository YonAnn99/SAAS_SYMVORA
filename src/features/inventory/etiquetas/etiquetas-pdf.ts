/**
 * PDF de etiquetas de producto. jsPDF se carga con `import()` al generar
 * (como los demas PDF). Las barras van como rectangulos vectoriales: quedan
 * nitidas en cualquier impresora, siempre que se imprima al 100 %.
 */
import type { Moneda } from "@/lib/money";
import type { jsPDF as JsPDF } from "jspdf";
import { ZONA_SILENCIO, dibujarCodigo } from "@/lib/codigo-barras";
import {
  HOJA_CARTA,
  paginarEtiquetas,
  textoPrecio,
  type FormatoEtiqueta,
  type ItemEtiqueta,
} from "./formatos-etiqueta";

export interface OpcionesEtiqueta {
  mostrarPrecio: boolean;
  mostrarSku: boolean;
  /** Nombre del negocio arriba de cada etiqueta (null = no se muestra). */
  negocio: string | null;
  /** Moneda del negocio (`tenants.moneda`). Sin ella, pesos. */
  moneda?: Moneda;
}

const PT = 0.3528; // mm por punto tipografico
/** Modulo maximo: en etiquetas grandes el codigo no se estira de mas. */
const MODULO_MAXIMO = 0.5;

/** Tamanos de letra (pt) segun el alto de la etiqueta. */
function tipografia(f: FormatoEtiqueta) {
  if (f.alto >= 35) return { negocio: 6, nombre: 9, detalle: 7.5, precio: 13, digitos: 7 };
  if (f.alto >= 24) return { negocio: 5.5, nombre: 7.5, detalle: 6.5, precio: 10.5, digitos: 6.5 };
  return { negocio: 5, nombre: 6, detalle: 5.5, precio: 7.5, digitos: 5.5 };
}

/** Recorta a `max` renglones; el ultimo lleva "..." si sobraba texto. */
function renglones(doc: JsPDF, texto: string, ancho: number, max: number): string[] {
  if (max <= 0 || !texto.trim()) return [];
  const todos = doc.splitTextToSize(texto.trim(), ancho) as string[];
  if (todos.length <= max) return todos;
  const visibles = todos.slice(0, max);
  let ultimo = visibles[max - 1];
  while (ultimo.length > 1 && doc.getTextWidth(`${ultimo}…`) > ancho) ultimo = ultimo.slice(0, -1);
  visibles[max - 1] = `${ultimo.trimEnd()}…`;
  return visibles;
}

function dibujarEtiqueta(
  doc: JsPDF,
  f: FormatoEtiqueta,
  x: number,
  y: number,
  item: ItemEtiqueta,
  op: OpcionesEtiqueta
) {
  const t = tipografia(f);
  const pad = f.alto >= 20 ? 1.6 : 0.9;
  const ancho = f.ancho - pad * 2;
  const izq = x + pad;
  let cursor = y + pad;
  const fondo = y + f.alto - pad;

  doc.setTextColor(0, 0, 0);

  if (op.negocio && f.renglonesNombre > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(t.negocio);
    const [linea] = renglones(doc, op.negocio.toUpperCase(), ancho, 1);
    if (linea) doc.text(linea, x + f.ancho / 2, cursor, { align: "center", baseline: "top" });
    cursor += t.negocio * PT * 1.15;
  }

  if (f.renglonesNombre > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(t.nombre);
    for (const linea of renglones(doc, item.nombre, ancho, f.renglonesNombre)) {
      doc.text(linea, izq, cursor, { baseline: "top" });
      cursor += t.nombre * PT * 1.12;
    }
    if (item.detalle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(t.detalle);
      const [linea] = renglones(doc, item.detalle, ancho, 1);
      doc.text(linea, izq, cursor, { baseline: "top" });
      cursor += t.detalle * PT * 1.12;
    }
  }

  // Renglon de precio (izquierda) y SKU (derecha).
  const altoPrecio = op.mostrarPrecio || (op.mostrarSku && item.sku) ? t.precio * PT * 1.05 : 0;
  if (op.mostrarPrecio) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(t.precio);
    doc.text(textoPrecio(item.precio, item.unidad, op.moneda), izq, cursor, { baseline: "top" });
  }
  if (op.mostrarSku && item.sku) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(t.detalle);
    const [sku] = renglones(doc, item.sku, ancho * 0.45, 1);
    doc.text(sku, izq + ancho, cursor + (t.precio - t.detalle) * PT * 0.5, { align: "right", baseline: "top" });
  }
  cursor += altoPrecio + 0.6;

  // Codigo de barras: ocupa lo que queda, con los digitos abajo.
  const codigo = dibujarCodigo(item.codigo);
  if (!codigo) return;
  const altoDigitos = t.digitos * PT * 1.1;
  const altoBarras = fondo - cursor - altoDigitos;
  if (altoBarras < 3) return;
  const q = ZONA_SILENCIO[codigo.simbologia];
  const modulo = Math.min(MODULO_MAXIMO, ancho / (codigo.modulos + 2 * q));
  const inicio = x + (f.ancho - codigo.modulos * modulo) / 2;
  doc.setFillColor(0, 0, 0);
  for (const b of codigo.barras) {
    const extra = b.guarda ? altoDigitos * 0.55 : 0;
    doc.rect(inicio + b.x * modulo, cursor, b.w * modulo, altoBarras + extra, "F");
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(t.digitos);
  const yTexto = cursor + altoBarras + 0.2;
  if (codigo.simbologia === "EAN13") {
    // Como en los empaques: el primer digito afuera, a la izquierda, y dos
    // grupos de 6 entre las guardas (que bajan entre ellos).
    const c = codigo.texto;
    doc.text(c[0], inicio - modulo * 1.5, yTexto, { align: "right", baseline: "top" });
    doc.text(c.slice(1, 7), inicio + 24 * modulo, yTexto, { align: "center", baseline: "top" });
    doc.text(c.slice(7), inicio + 71 * modulo, yTexto, { align: "center", baseline: "top" });
  } else {
    doc.text(codigo.texto, x + f.ancho / 2, yTexto, { align: "center", baseline: "top" });
  }
}

/** Genera el PDF. `inicio` (solo hojas) = primera etiqueta libre de la hoja. */
export async function generarPdfEtiquetas(
  items: ItemEtiqueta[],
  formato: FormatoEtiqueta,
  opciones: OpcionesEtiqueta,
  inicio = 1
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const hoja = formato.tipo === "hoja";
  const ancho = hoja ? HOJA_CARTA.ancho : formato.ancho;
  const alto = hoja ? HOJA_CARTA.alto : formato.alto;
  const doc = new jsPDF({
    unit: "mm",
    format: hoja ? "letter" : [ancho, alto],
    orientation: ancho > alto ? "landscape" : "portrait",
  });

  let pagina = 0;
  for (const pos of paginarEtiquetas(items, formato, inicio)) {
    while (pagina < pos.pagina) {
      doc.addPage(hoja ? "letter" : [ancho, alto], ancho > alto ? "landscape" : "portrait");
      pagina++;
    }
    dibujarEtiqueta(doc, formato, pos.x, pos.y, pos.item, opciones);
  }
  return doc.output("blob");
}
