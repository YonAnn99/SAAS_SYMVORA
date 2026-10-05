import { describe, expect, it } from "vitest";
import {
  datosPdfDeOrden,
  generarPdfOrdenCompra,
  nombreConVariante,
} from "@/features/inventory/purchase-order-pdf";

const datos = {
  negocio: "Pruebas SYMVORA",
  numeroOrden: "OC-014",
  fecha: "2026-09-27T18:00:00Z",
  proveedor: "johana",
  fechaEstimada: "2026-10-01",
  renglones: [
    { nombre: "sueter · M / ROJO", cantidad: 5, costoUnitario: 60, importe: 300 },
    { nombre: "Café molido", cantidad: 1.5, costoUnitario: 250, importe: 375 },
  ],
  subtotal: 675,
  impuesto: 108,
  total: 783,
  incluyeIva: true,
  notas: "Entregar por la mañana",
};

/** El texto de un PDF de jsPDF sin comprimir es legible en el binario. */
async function texto(blob: Blob) {
  return new TextDecoder("latin1").decode(await blob.arrayBuffer());
}

describe("generarPdfOrdenCompra", () => {
  it("produce un PDF", async () => {
    const pdf = await generarPdfOrdenCompra(datos);
    expect(pdf.type).toBe("application/pdf");
    expect((await texto(pdf)).startsWith("%PDF-")).toBe(true);
  });

  it("lleva la orden, los renglones y el total guardado", async () => {
    const t = await texto(await generarPdfOrdenCompra(datos));
    expect(t).toContain("Orden de compra OC-014");
    expect(t).toContain("Café molido");
    expect(t).toContain("Entregar por la mañana");
    expect(t).toMatch(/783\.00/);
  });

  it("dice 'Sin IVA' cuando la orden no lo lleva", async () => {
    const t = await texto(
      await generarPdfOrdenCompra({ ...datos, incluyeIva: false, impuesto: 0, total: 675 })
    );
    expect(t).toContain("Sin IVA");
    expect(t).not.toContain("IVA (16%)");
  });
});

describe("datosPdfDeOrden", () => {
  const orden = {
    numero_orden: "OC-013",
    creado_en: "2026-09-21T18:00:00Z",
    fecha_estimada_recepcion: null,
    subtotal: "500.00",
    impuesto: "0.00",
    total: "500.00",
    notas: null,
  };

  it("toma los importes de lo guardado y deduce el IVA", () => {
    const d = datosPdfDeOrden({
      negocio: "Pruebas SYMVORA",
      proveedor: "johana",
      orden,
      renglones: [
        {
          nombre: nombreConVariante("sueter", { talla: "M", color: "ROJO" }),
          cantidad_solicitada: "5",
          costo_unitario: "100",
          subtotal: "500",
        },
      ],
    });
    expect(d.total).toBe(500);
    expect(d.incluyeIva).toBe(false);
    expect(d.renglones[0]).toEqual({
      nombre: "sueter · M / ROJO",
      cantidad: 5,
      costoUnitario: 100,
      importe: 500,
    });
  });

  it("un renglón sin variante lleva solo el nombre", () => {
    expect(nombreConVariante("Café molido", null)).toBe("Café molido");
  });
});
