import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Factura, FacturaDetalle } from "@/lib/types/database";
import { formatCurrency } from "./catalogs";

export function generateFacturaPDF(factura: Factura, detalle: FacturaDetalle[]): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "letter" });

  doc.setFontSize(16);
  doc.text("SYMVORA", 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text("Comprobante Fiscal Digital por Internet", 14, 25);

  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(
    `Factura ${factura.serie}-${factura.folio}`,
    196,
    18,
    { align: "right" }
  );
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(`Estado: ${estadoLabel(factura.estado)}`, 196, 24, { align: "right" });
  doc.text(
    `Fecha emisión: ${formatDate(factura.fecha_emision)}`,
    196,
    29,
    { align: "right" }
  );

  doc.setDrawColor(200);
  doc.line(14, 32, 196, 32);

  doc.setFontSize(9);
  doc.setTextColor(0);

  // Emisor / Receptor
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Emisor", 14, 40);
  doc.text("Receptor", 105, 40);
  doc.setFont("helvetica", "normal");

  doc.setFontSize(8);
  doc.setTextColor(60);
  const emisorLines = [
    factura.emisor_razon_social,
    `RFC: ${factura.emisor_rfc}`,
    `Régimen fiscal: ${factura.emisor_regimen_fiscal}`,
    `CP: ${factura.emisor_codigo_postal}`,
  ];
  const receptorLines = [
    factura.receptor_razon_social,
    `RFC: ${factura.receptor_rfc}`,
    `Régimen fiscal: ${factura.receptor_regimen_fiscal}`,
    `Uso CFDI: ${factura.receptor_uso_cfdi} · CP: ${factura.receptor_codigo_postal}`,
  ];
  emisorLines.forEach((line, i) => doc.text(line, 14, 46 + i * 4.5));
  receptorLines.forEach((line, i) => doc.text(line, 105, 46 + i * 4.5));

  const bodyStartY = 68;

  autoTable(doc, {
    startY: bodyStartY,
    head: [["Concepto", "Cant.", "Unidad", "P. Unitario", "Descuento", "Importe"]],
    body: detalle
      .sort((a, b) => a.orden - b.orden)
      .map((d) => [
        d.descripcion,
        formatDecimal(d.cantidad),
        d.unidad,
        formatCurrency(d.precio_unitario),
        formatCurrency(d.descuento),
        formatCurrency(d.subtotal),
      ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [17, 17, 17], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 246, 243] },
    margin: { left: 14, right: 14 },
  });

  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text("Totales", 196, y, { align: "right" });
  doc.text(`Subtotal: ${formatCurrency(factura.subtotal)}`, 196, y + 6, { align: "right" });
  doc.text(`Descuento: ${formatCurrency(factura.descuento)}`, 196, y + 11, { align: "right" });
  doc.text(`IVA (16%): ${formatCurrency(factura.impuesto)}`, 196, y + 16, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Total: ${formatCurrency(factura.total)}`, 196, y + 23, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  y += 30;
  doc.setDrawColor(200);
  doc.line(14, y, 196, y);

  if (factura.estado === "TIMBRADA" && factura.uuid_cfdi) {
    y += 8;
    doc.setFontSize(8);
    doc.setTextColor(60);
    doc.text(`UUID: ${factura.uuid_cfdi}`, 14, y);
    if (factura.fecha_timbrado) {
      doc.text(`Fecha de timbrado: ${formatDate(factura.fecha_timbrado)}`, 14, y + 5);
    }
    if (factura.pac_nombre) {
      doc.text(`PAC: ${factura.pac_nombre}`, 14, y + 10);
    }
  } else if (factura.estado === "CANCELADA") {
    y += 8;
    doc.setFontSize(8);
    doc.setTextColor(200, 0, 0);
    doc.text(`CANCELADA ${factura.fecha_cancelacion ? formatDate(factura.fecha_cancelacion) : ""}`, 14, y);
    if (factura.motivo_cancelacion) {
      doc.text(`Motivo: ${factura.motivo_cancelacion}`, 14, y + 5);
    }
  }

  return doc.output("arraybuffer") as unknown as Uint8Array;
}

function estadoLabel(estado: Factura["estado"]): string {
  switch (estado) {
    case "BORRADOR":
      return "Borrador";
    case "TIMBRADA":
      return "Timbrada";
    case "CANCELADA":
      return "Cancelada";
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatDecimal(num: number): string {
  return num.toFixed(2);
}