import { describe, expect, it } from "vitest";
import {
  armarSeccionesReporte,
  celdaComoTexto,
  nombreArchivoReporte,
  nombreHoja,
  type DatosReporte,
  type MetaReporte,
} from "@/features/reports/exportar-reporte";
import type { VentaEnHistorial } from "@/features/sales/services/sales-history-service";

/**
 * «Exportar» de Reportes: el Excel y el PDF salen de las mismas secciones. Aqui
 * se vigila que digan lo que dice la pantalla y que los numeros sigan siendo
 * numeros (en Excel se suman).
 */

const DATOS: DatosReporte = {
  ventasPorPeriodo: [
    { date: "lun 6", ventas: 1200 },
    { date: "mar 7", ventas: 800 },
  ],
  ventasAnterior: [900, 700],
  ventasPorHora: [
    { hora: "9:00", total: 500, ventas: 3 },
    { hora: "10:00", total: 0, ventas: 0 },
  ],
  ventasPorDiaSemana: [{ dia: "Lu", total: 1200, ventas: 8 }],
  topProductos: [{ nombre: "Leche Entera 1 L", cantidad: 12, total: 336 }],
  topCategorias: [],
  metodosPago: [{ name: "Efectivo", value: 2000 }],
  clientesFrecuentes: [],
  resumen: { totalVentas: 2000, totalTransacciones: 14, ticketPromedio: 142.86, productosVendidos: 40.5 },
  ganancia: {
    ingresos: 1724.14,
    costoVendido: 1300,
    ganancia: 424.14,
    margenPct: 24.6,
    productosSinCosto: 0,
    topPorGanancia: [{ nombre: "Leche Entera 1 L", ganancia: 78, ingresos: 289.66 }],
  },
};

const META: MetaReporte = {
  negocio: "Miscelánea Symvora",
  sucursal: null,
  periodo: "Este mes",
  desde: new Date("2026-10-01T06:00:00Z"),
  hasta: new Date("2026-10-14T05:59:59Z"),
  generado: new Date(2026, 9, 14, 10, 30),
  resumenTruncado: false,
  ventasTruncadas: false,
  esDia: false,
};

function venta(parcial: Partial<VentaEnHistorial>): VentaEnHistorial {
  return {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    fecha_venta: "2026-10-07T18:05:00Z",
    usuario_id: null,
    cajero_email: "cajero@ejemplo.com",
    cajero_nombre: "Ana",
    cliente_nombre: null,
    metodo_pago: "EFECTIVO",
    estado: "COMPLETADA",
    total: 159,
    origen: null,
    requiere_revision: null,
    sucursal_nombre: "Principal",
    ...parcial,
  };
}

describe("armarSeccionesReporte", () => {
  it("arma el resumen y las secciones con datos, y omite las vacías", () => {
    const secciones = armarSeccionesReporte(DATOS, [venta({})], META);
    const titulos = secciones.map((s) => s.titulo);
    expect(titulos[0]).toBe("Resumen");
    expect(titulos).toContain("Ventas");
    expect(titulos).toContain("Productos más vendidos");
    expect(titulos).toContain("Por día de la semana");
    // Sin datos: no hay hoja.
    expect(titulos).not.toContain("Categorías");
    expect(titulos).not.toContain("Clientes frecuentes");
  });

  it("el resumen lleva las cifras de la pantalla como números", () => {
    const [resumen] = armarSeccionesReporte(DATOS, [], META);
    const fila = (concepto: string) => resumen.filas.find((f) => f[0] === concepto)?.[1];
    expect(fila("Total ventas")).toBe(2000);
    expect(fila("Transacciones")).toBe(14);
    expect(fila("Margen")).toBe(24.6);
    expect(fila("Sucursal")).toBe("Todas");
    expect(resumen.formatoPorFila?.[resumen.filas.findIndex((f) => f[0] === "Margen")]).toBe("porcentaje");
  });

  it("la hoja de ventas trae folio de 8 caracteres y el total de las completadas", () => {
    const ventas = [
      venta({ total: 159 }),
      venta({ id: "ffffeeee-0000-0000-0000-000000000000", total: 41, estado: "CANCELADA", metodo_pago: "TARJETA" }),
    ];
    const hoja = armarSeccionesReporte(DATOS, ventas, META).find((s) => s.titulo === "Ventas")!;
    expect(hoja.filas[0][0]).toBe("A1B2C3D4");
    expect(hoja.filas[0][5]).toBe("Efectivo");
    expect(hoja.filas[1][6]).toBe("Cancelada");
    expect(hoja.filas[0][7]).toBe(159);
    const total = hoja.filas[hoja.filas.length - 1];
    expect(total[6]).toBe("Total completadas");
    expect(total[7]).toBe(159);
  });

  it("avisa cuando el reporte o la lista de ventas se truncaron", () => {
    const meta = { ...META, resumenTruncado: true, ventasTruncadas: true };
    const secciones = armarSeccionesReporte(DATOS, [venta({})], meta);
    expect(secciones[0].filas.some((f) => f[0] === "Aviso")).toBe(true);
    const ventas = secciones.find((s) => s.titulo === "Ventas")!;
    expect(String(ventas.filas[ventas.filas.length - 1][0])).toMatch(/más recientes/);
  });

  it("por hora omite las horas sin ventas; con «dia» no hay hoja por día de la semana", () => {
    const secciones = armarSeccionesReporte(DATOS, [], { ...META, esDia: true });
    expect(secciones.find((s) => s.titulo === "Por hora")?.filas).toHaveLength(1);
    expect(secciones.map((s) => s.titulo)).not.toContain("Por día de la semana");
  });
});

describe("nombres de archivo y de hoja", () => {
  it("el archivo va sin acentos ni espacios, y «todas» sin sucursal", () => {
    expect(nombreArchivoReporte(META)).toBe("reporte-ventas_este-mes_todas_2026-10-14");
    expect(nombreArchivoReporte({ ...META, sucursal: "Sucursal Pénjamo Centro" })).toBe(
      "reporte-ventas_este-mes_sucursal-penjamo-centro_2026-10-14"
    );
  });

  it("la hoja respeta el límite de Excel (31 caracteres, sin símbolos prohibidos)", () => {
    const nombre = nombreHoja("Ventas por día / semana [comparadas] con el periodo anterior");
    expect(nombre.length).toBeLessThanOrEqual(31);
    expect(nombre).not.toMatch(/[[\]:*?/\\]/);
  });
});

describe("celdaComoTexto (PDF)", () => {
  it("formatea dinero, porcentaje y cantidades", () => {
    expect(celdaComoTexto(1147.25, "dinero")).toBe("$1,147.25");
    expect(celdaComoTexto(24.6, "porcentaje")).toBe("24.6%");
    expect(celdaComoTexto(1500, "numero")).toBe("1,500");
    expect(celdaComoTexto(0.278, "numero")).toBe("0.278");
    expect(celdaComoTexto(null, "dinero")).toBe("");
  });
});
