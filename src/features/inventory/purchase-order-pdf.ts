import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { etiquetaVariante } from "./purchase-order-items";
import { ordenLlevaIva } from "./purchase-order-totals";

/**
 * El PDF de una orden de compra, el que recibe el proveedor por WhatsApp.
 *
 * Los importes salen de lo GUARDADO en la orden (`subtotal`, `impuesto`,
 * `total` y el subtotal de cada renglon), no se recalculan: el PDF es lo que
 * se le promete pagar al proveedor y no puede discrepar de la base.
 */

export interface RenglonPdf {
  /** Nombre ya resuelto, con la variante si la hay ("sueter · M / ROJO"). */
  nombre: string;
  cantidad: number;
  costoUnitario: number;
  importe: number;
}

export interface DatosPdfOrden {
  negocio: string;
  numeroOrden: string;
  /** ISO de `creado_en`. */
  fecha: string;
  proveedor: string;
  fechaEstimada?: string | null;
  renglones: RenglonPdf[];
  subtotal: number;
  impuesto: number;
  total: number;
  incluyeIva: boolean;
  notas?: string | null;
}

/** "sueter · M / ROJO", o solo el nombre si el renglon no es de una variante. */
export function nombreConVariante(
  nombre: string,
  variante: { talla: string | null; color: string | null } | null | undefined
): string {
  return variante ? `${nombre} · ${etiquetaVariante(variante)}` : nombre;
}

/**
 * Arma los datos del PDF a partir de una orden guardada. Lo usan el envio por
 * WhatsApp y el boton "Descargar PDF" del detalle: una sola funcion para que
 * los dos PDF sean identicos.
 */
export function datosPdfDeOrden(params: {
  negocio: string;
  proveedor: string;
  orden: {
    numero_orden: string;
    creado_en: string;
    fecha_estimada_recepcion: string | null;
    subtotal: number | string;
    impuesto: number | string;
    total: number | string;
    notas: string | null;
  };
  /** Renglones con el nombre ya resuelto (ver `nombreConVariante`). */
  renglones: {
    nombre: string;
    cantidad_solicitada: number | string;
    costo_unitario: number | string;
    subtotal: number | string;
  }[];
}): DatosPdfOrden {
  const { orden } = params;
  return {
    negocio: params.negocio,
    numeroOrden: orden.numero_orden,
    fecha: orden.creado_en,
    proveedor: params.proveedor,
    fechaEstimada: orden.fecha_estimada_recepcion,
    renglones: params.renglones.map((r) => ({
      nombre: r.nombre,
      cantidad: Number(r.cantidad_solicitada),
      costoUnitario: Number(r.costo_unitario),
      importe: Number(r.subtotal),
    })),
    subtotal: Number(orden.subtotal),
    impuesto: Number(orden.impuesto),
    total: Number(orden.total),
    // Se deduce de lo guardado: el PDF no puede contradecir a la orden.
    incluyeIva: ordenLlevaIva(orden),
    notas: orden.notas,
  };
}

/** Descarga un PDF en el equipo. */
export function descargarPdf(pdf: Blob, nombreArchivo: string) {
  const url = URL.createObjectURL(pdf);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  // Se libera despues: revocarlo en el acto cancela la descarga en Firefox.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { dateStyle: "long" });

/** `String` de un number ya quita los ceros finales: 2 sale "2" y 1.5 "1.5". */
const cantidad = (n: number) => String(Number(n));

// Carta, margenes de 14 mm: ancho util de 14 a 202.
const IZQ = 14;
const DER = 202;

export function generarPdfOrdenCompra(datos: DatosPdfOrden): Blob {
  const doc = new jsPDF({ unit: "mm", format: "letter" });

  // Encabezado: quien pide a la izquierda, que documento es a la derecha.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(17);
  doc.text(datos.negocio, IZQ, 20);

  doc.setFontSize(12);
  doc.text(`Orden de compra ${datos.numeroOrden}`, DER, 20, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(`Fecha: ${fechaCorta(datos.fecha)}`, DER, 26, { align: "right" });

  doc.setDrawColor(210);
  doc.line(IZQ, 31, DER, 31);

  // Datos del pedido.
  doc.setFontSize(9);
  doc.setTextColor(17);
  doc.setFont("helvetica", "bold");
  doc.text("Proveedor", IZQ, 39);
  doc.setFont("helvetica", "normal");
  doc.text(datos.proveedor || "—", IZQ, 44);

  if (datos.fechaEstimada) {
    doc.setFont("helvetica", "bold");
    doc.text("Entrega estimada", 110, 39);
    doc.setFont("helvetica", "normal");
    doc.text(fechaCorta(`${datos.fechaEstimada}T12:00:00`), 110, 44);
  }

  autoTable(doc, {
    startY: 52,
    head: [["Producto", "Cantidad", "Costo unitario", "Importe"]],
    body: datos.renglones.map((r) => [
      r.nombre,
      cantidad(r.cantidad),
      money(r.costoUnitario),
      money(r.importe),
    ]),
    styles: { fontSize: 9, cellPadding: 2.5 },
    // Azul SYMVORA en la cabecera de la tabla.
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 247, 250] },
    columnStyles: {
      1: { halign: "right", cellWidth: 24 },
      2: { halign: "right", cellWidth: 34 },
      3: { halign: "right", cellWidth: 34 },
    },
    margin: { left: IZQ, right: 216 - DER },
  });

  let y =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Totales alineados a la derecha, bajo la columna de importes.
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text("Subtotal", 160, y, { align: "right" });
  doc.text(money(datos.subtotal), DER, y, { align: "right" });
  y += 5.5;
  doc.text(datos.incluyeIva ? "IVA (16%)" : "IVA", 160, y, { align: "right" });
  doc.text(datos.incluyeIva ? money(datos.impuesto) : "Sin IVA", DER, y, { align: "right" });
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(17);
  doc.text("Total", 160, y, { align: "right" });
  doc.text(money(datos.total), DER, y, { align: "right" });
  doc.setFont("helvetica", "normal");

  if (datos.notas?.trim()) {
    y += 12;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Notas", IZQ, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60);
    const lineas = doc.splitTextToSize(datos.notas.trim(), DER - IZQ) as string[];
    doc.text(lineas, IZQ, y + 5);
  }

  // Pie en cada pagina: una orden larga ocupa varias.
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`${datos.numeroOrden} · Página ${i} de ${paginas}`, DER, 272, { align: "right" });
    doc.text("Generado con SYMVORA", IZQ, 272);
  }

  return doc.output("blob");
}
