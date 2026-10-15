/**
 * «Exportar» de Reportes: el periodo y la sucursal que se ven en pantalla, en
 * Excel (una hoja por seccion) o PDF (una tabla por seccion).
 *
 * `armarSeccionesReporte` es puro: de los mismos datos salen el Excel y el PDF,
 * asi que no pueden decir cosas distintas. La lista de ventas sale del RPC
 * `listar_ventas` (via `fetchHistorialVentas`), que aplica la regla de
 * visibilidad: un cajero solo exporta las suyas, igual que en el historial.
 */

import { fetchHistorialVentas, type VentaEnHistorial } from "@/features/sales/services/sales-history-service";
import { numeroOperacion } from "@/features/pos/ticket-format";
import { cargarJsPdf } from "@/lib/export/pdf";
import { formatMXN } from "@/lib/money";

/** Lo del reporte que se exporta (estructural: `ReportData` de la pagina lo cumple). */
export interface DatosReporte {
  ventasPorPeriodo: { date: string; ventas: number }[];
  ventasAnterior: number[];
  ventasPorHora: { hora: string; total: number; ventas: number }[];
  ventasPorDiaSemana: { dia: string; total: number; ventas: number }[];
  topProductos: { nombre: string; cantidad: number; total: number }[];
  topCategorias: { name: string; value: number }[];
  metodosPago: { name: string; value: number }[];
  clientesFrecuentes: { nombre: string; compras: number; total: number }[];
  resumen: {
    totalVentas: number;
    totalTransacciones: number;
    ticketPromedio: number;
    productosVendidos: number;
  };
  ganancia: {
    ingresos: number;
    costoVendido: number;
    ganancia: number;
    margenPct: number;
    productosSinCosto: number;
    topPorGanancia: { nombre: string; ganancia: number; ingresos: number }[];
  };
}

export interface MetaReporte {
  negocio: string;
  /** Nombre de la sucursal; `null` = todas. */
  sucursal: string | null;
  /** Ej. "Este mes". */
  periodo: string;
  desde: Date;
  hasta: Date;
  generado: Date;
  /** Las cifras del resumen se calcularon sobre las 5,000 ventas mas recientes. */
  resumenTruncado: boolean;
  /** La hoja de ventas se corto en el tope. */
  ventasTruncadas: boolean;
  /** Con "dia" no hay grafica por dia de la semana: tampoco hoja. */
  esDia: boolean;
}

export type Celda = string | number | null;
export type Formato = "texto" | "dinero" | "numero" | "porcentaje";

export interface SeccionReporte {
  titulo: string;
  encabezados: string[];
  filas: Celda[][];
  /** Formato por columna. */
  formatos: Formato[];
  /**
   * Solo el Resumen: cada fila trae su formato en la columna "Valor" (mezcla
   * texto, dinero y porcentajes). Gana sobre `formatos` en esa columna.
   */
  formatoPorFila?: Formato[];
}

/** Tope de la lista de ventas: el mismo que el del reporte en pantalla. */
export const MAX_VENTAS_EXPORTAR = 5000;
const VENTAS_POR_PETICION = 1000;

const ETIQUETA_PAGO: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
  CREDITO: "Crédito / Fiado",
  TARJETA_TERMINAL: "Tarjeta (terminal)",
};

const ZONA = "America/Mexico_City";

function fechaCorta(fecha: Date): string {
  return fecha.toLocaleDateString("es-MX", { timeZone: ZONA, day: "2-digit", month: "2-digit", year: "numeric" });
}

function fechaHora(fecha: Date): string {
  return fecha.toLocaleString("es-MX", {
    timeZone: ZONA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** "COMPLETADA" → "Completada". */
function estadoLegible(estado: string): string {
  return estado.charAt(0) + estado.slice(1).toLowerCase();
}

export function armarSeccionesReporte(
  datos: DatosReporte,
  ventas: VentaEnHistorial[],
  meta: MetaReporte
): SeccionReporte[] {
  const resumen: [string, Celda, Formato][] = [
    ["Negocio", meta.negocio, "texto"],
    ["Sucursal", meta.sucursal ?? "Todas", "texto"],
    ["Periodo", `${meta.periodo} (${fechaCorta(meta.desde)} – ${fechaCorta(meta.hasta)})`, "texto"],
    ["Generado", fechaHora(meta.generado), "texto"],
    ["Total ventas", datos.resumen.totalVentas, "dinero"],
    ["Transacciones", datos.resumen.totalTransacciones, "numero"],
    ["Ticket promedio", datos.resumen.ticketPromedio, "dinero"],
    ["Productos vendidos", datos.resumen.productosVendidos, "numero"],
    ["Ingresos (sin IVA)", datos.ganancia.ingresos, "dinero"],
    ["Costo de lo vendido", datos.ganancia.costoVendido, "dinero"],
    ["Ganancia", datos.ganancia.ganancia, "dinero"],
    ["Margen", datos.ganancia.margenPct, "porcentaje"],
    ["Nota", "Margen bruto: no descuenta renta, sueldos ni otros gastos del negocio.", "texto"],
  ];
  if (datos.ganancia.productosSinCosto > 0) {
    resumen.push([
      "Productos sin costo",
      `${datos.ganancia.productosSinCosto} no entran en el cálculo de ganancia`,
      "texto",
    ]);
  }
  if (meta.resumenTruncado) {
    resumen.push([
      "Aviso",
      `El periodo tiene más de ${MAX_VENTAS_EXPORTAR.toLocaleString("es-MX")} ventas: las cifras cubren solo las más recientes.`,
      "texto",
    ]);
  }

  const secciones: SeccionReporte[] = [
    {
      titulo: "Resumen",
      encabezados: ["Concepto", "Valor"],
      filas: resumen.map(([concepto, valor]) => [concepto, valor]),
      formatos: ["texto", "texto"],
      formatoPorFila: resumen.map(([, , formato]) => formato),
    },
  ];

  const filasVentas: Celda[][] = ventas.map((v) => [
    numeroOperacion(v.id) ?? "",
    fechaHora(new Date(v.fecha_venta)),
    v.sucursal_nombre ?? "",
    v.cajero_nombre?.trim() || v.cajero_email || "",
    v.cliente_nombre ?? "Cliente general",
    ETIQUETA_PAGO[v.metodo_pago] ?? v.metodo_pago,
    estadoLegible(v.estado),
    v.total,
  ]);
  if (ventas.length > 0) {
    const completadas = ventas.filter((v) => v.estado === "COMPLETADA").reduce((s, v) => s + v.total, 0);
    filasVentas.push(["", "", "", "", "", "", "Total completadas", Math.round(completadas * 100) / 100]);
    if (meta.ventasTruncadas) {
      filasVentas.push([
        `Solo las ${MAX_VENTAS_EXPORTAR.toLocaleString("es-MX")} ventas más recientes del periodo.`,
        "", "", "", "", "", "", null,
      ]);
    }
  }
  secciones.push({
    titulo: "Ventas",
    encabezados: ["Folio", "Fecha y hora", "Sucursal", "Atendió", "Cliente", "Método de pago", "Estado", "Total"],
    filas: filasVentas,
    formatos: ["texto", "texto", "texto", "texto", "texto", "texto", "texto", "dinero"],
  });

  secciones.push({
    titulo: "Por periodo",
    encabezados: ["Fecha", "Ventas", "Periodo anterior"],
    filas: datos.ventasPorPeriodo.map((p, i) => [p.date, p.ventas, datos.ventasAnterior[i] ?? null]),
    formatos: ["texto", "dinero", "dinero"],
  });
  secciones.push({
    titulo: "Productos más vendidos",
    encabezados: ["Producto", "Cantidad", "Total"],
    filas: datos.topProductos.map((p) => [p.nombre, p.cantidad, p.total]),
    formatos: ["texto", "numero", "dinero"],
  });
  secciones.push({
    titulo: "Ganancia por producto",
    encabezados: ["Producto", "Ganancia", "Ingresos (sin IVA)"],
    filas: datos.ganancia.topPorGanancia.map((p) => [p.nombre, p.ganancia, p.ingresos]),
    formatos: ["texto", "dinero", "dinero"],
  });
  secciones.push({
    titulo: "Categorías",
    encabezados: ["Categoría", "Ventas (sin IVA)"],
    filas: datos.topCategorias.map((c) => [c.name, c.value]),
    formatos: ["texto", "dinero"],
  });
  secciones.push({
    titulo: "Métodos de pago",
    encabezados: ["Método", "Total"],
    filas: datos.metodosPago.map((m) => [m.name, m.value]),
    formatos: ["texto", "dinero"],
  });
  secciones.push({
    titulo: "Clientes frecuentes",
    encabezados: ["Cliente", "Compras", "Total"],
    filas: datos.clientesFrecuentes.map((c) => [c.nombre, c.compras, c.total]),
    formatos: ["texto", "numero", "dinero"],
  });
  secciones.push({
    titulo: "Por hora",
    encabezados: ["Hora", "Ventas", "Total"],
    filas: datos.ventasPorHora.filter((h) => h.ventas > 0).map((h) => [h.hora, h.ventas, h.total]),
    formatos: ["texto", "numero", "dinero"],
  });
  if (!meta.esDia) {
    secciones.push({
      titulo: "Por día de la semana",
      encabezados: ["Día", "Ventas", "Total"],
      filas: datos.ventasPorDiaSemana.map((d) => [d.dia, d.ventas, d.total]),
      formatos: ["texto", "numero", "dinero"],
    });
  }

  // El Resumen siempre va; una seccion sin filas solo agrega una hoja vacia.
  return secciones.filter((s, i) => i === 0 || s.filas.length > 0);
}

/** Sin acentos, espacios ni simbolos: "Sucursal Centro" → "sucursal-centro". */
function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** `reporte-ventas_este-mes_todas_2026-10-14` (sin extension). */
export function nombreArchivoReporte(meta: Pick<MetaReporte, "periodo" | "sucursal" | "generado">): string {
  const g = meta.generado;
  const fecha = `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, "0")}-${String(g.getDate()).padStart(2, "0")}`;
  return ["reporte-ventas", slug(meta.periodo), meta.sucursal ? slug(meta.sucursal) : "todas", fecha].join("_");
}

/** Excel limita el nombre de una hoja a 31 caracteres y prohibe `[]:*?/\`. */
export function nombreHoja(titulo: string): string {
  return titulo.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31);
}

function formatoDe(seccion: SeccionReporte, fila: number, columna: number): Formato {
  if (seccion.formatoPorFila && columna === 1) return seccion.formatoPorFila[fila] ?? "texto";
  return seccion.formatos[columna] ?? "texto";
}

/** Texto para el PDF. */
export function celdaComoTexto(valor: Celda, formato: Formato): string {
  if (valor === null) return "";
  if (typeof valor === "string") return valor;
  switch (formato) {
    case "dinero":
      return formatMXN(valor);
    case "porcentaje":
      return `${valor.toFixed(1)}%`;
    case "numero":
      return Number.isInteger(valor) ? valor.toLocaleString("es-MX") : valor.toLocaleString("es-MX", { maximumFractionDigits: 3 });
    default:
      return String(valor);
  }
}

/**
 * Las ventas del periodo, en paginas de 1,000 (el tope de filas de PostgREST)
 * hasta completar el total o llegar a `MAX_VENTAS_EXPORTAR`.
 */
export async function traerVentasParaExportar(filtros: {
  tenantId: string;
  desde: Date;
  hasta: Date;
  sucursalId: string | null;
}): Promise<{ ventas: VentaEnHistorial[]; truncado: boolean }> {
  const ventas: VentaEnHistorial[] = [];
  let total = Infinity;
  while (ventas.length < total && ventas.length < MAX_VENTAS_EXPORTAR) {
    const pagina = await fetchHistorialVentas({
      ...filtros,
      limite: Math.min(VENTAS_POR_PETICION, MAX_VENTAS_EXPORTAR - ventas.length),
      desplazamiento: ventas.length,
    });
    total = pagina.total;
    ventas.push(...pagina.ventas);
    if (pagina.ventas.length === 0) break;
  }
  return { ventas, truncado: total > ventas.length };
}

const FORMATO_EXCEL: Partial<Record<Formato, string>> = {
  dinero: '"$"#,##0.00',
  porcentaje: '0.0"%"',
};

/** Una hoja por seccion. `xlsx` (~400 kB) se descarga al exportar, no al abrir Reportes. */
export async function exportarReporteExcel(secciones: SeccionReporte[], archivo: string): Promise<void> {
  const XLSX = await import("xlsx");
  const libro = XLSX.utils.book_new();
  for (const seccion of secciones) {
    const hoja = XLSX.utils.aoa_to_sheet([seccion.encabezados, ...seccion.filas]);
    // Formato de numero en las celdas de dinero y porcentaje: siguen siendo
    // numeros (se pueden sumar), solo cambia como se ven.
    seccion.filas.forEach((fila, f) =>
      fila.forEach((valor, c) => {
        const z = FORMATO_EXCEL[formatoDe(seccion, f, c)];
        if (!z || typeof valor !== "number") return;
        const celda = hoja[XLSX.utils.encode_cell({ r: f + 1, c })];
        if (celda) celda.z = z;
      })
    );
    hoja["!cols"] = seccion.encabezados.map((encabezado, c) => {
      const largo = Math.max(
        encabezado.length,
        ...seccion.filas.map((fila) => celdaComoTexto(fila[c] ?? null, formatoDe(seccion, 0, c)).length)
      );
      return { wch: Math.min(Math.max(largo + 2, 10), 60) };
    });
    XLSX.utils.book_append_sheet(libro, hoja, nombreHoja(seccion.titulo));
  }
  XLSX.writeFile(libro, `${archivo}.xlsx`);
}

/** El reporte en PDF: encabezado con el negocio y el periodo, y una tabla por seccion. */
export async function exportarReportePdf(
  secciones: SeccionReporte[],
  meta: MetaReporte,
  archivo: string
): Promise<void> {
  const { jsPDF, autoTable } = await cargarJsPdf();
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("SYMVORA · Reporte de ventas", 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(
    `${meta.negocio} · ${meta.sucursal ?? "Todas las sucursales"} · ${meta.periodo} (${fechaCorta(meta.desde)} – ${fechaCorta(meta.hasta)})`,
    14,
    27
  );
  doc.text(`Generado: ${fechaHora(meta.generado)}`, 14, 32);
  doc.setTextColor(0);

  let y = 40;
  for (const seccion of secciones) {
    // El Resumen ya lleva negocio, sucursal, periodo y fecha arriba: sin repetir.
    const filas = seccion.titulo === "Resumen" ? seccion.filas.slice(4) : seccion.filas;
    const offset = seccion.titulo === "Resumen" ? 4 : 0;
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(12);
    doc.text(seccion.titulo, 14, y);
    autoTable(doc, {
      startY: y + 3,
      head: [seccion.encabezados],
      body: filas.map((fila, f) => fila.map((valor, c) => celdaComoTexto(valor, formatoDe(seccion, f + offset, c)))),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [17, 17, 17], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [247, 246, 243] },
      columnStyles: Object.fromEntries(
        seccion.formatos.map((formato, c) => [c, { halign: formato === "texto" ? "left" : "right" }])
      ),
      margin: { left: 14, right: 14 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(`Página ${p} de ${paginas}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 8, {
      align: "right",
    });
  }

  doc.save(`${archivo}.pdf`);
}
