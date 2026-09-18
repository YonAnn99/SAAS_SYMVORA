import { describe, expect, it } from "vitest";
import {
  CLIENTE_GENERAL,
  construirReceiptDesdeVenta,
  etiquetaVariante,
  type VentaGuardada,
} from "@/features/sales/sale-receipt-builder";
import { variantLabel } from "@/features/pos/components/variant-picker-dialog";

/**
 * Toda la fidelidad del ticket reimpreso depende de este mapeo. Un fallo aquí
 * no rompe la pantalla: imprime un papel que no coincide con lo que se cobró,
 * y eso llega al cliente antes que a nosotros.
 */

const VENTA: VentaGuardada = {
  id: "a1b2c3d4-0000-4000-8000-000000000001",
  fecha_venta: "2026-09-10T19:45:00.000Z",
  usuario_id: "u-1",
  cajero_email: "cajero@symvora.com.mx",
  cliente_nombre: "Diego",
  cliente_telefono: "5551234567",
  metodo_pago: "EFECTIVO",
  estado: "COMPLETADA",
  subtotal: "100.00",
  impuesto: "16.00",
  descuento: "0.00",
  total: "116.00",
  monto_recibido: "200.00",
  cambio: "84.00",
  notas: null,
  origen: "online",
  requiere_revision: false,
  renglones: [
    {
      producto_id: "p-1",
      variante_id: null,
      nombre: "Café molido",
      unidad_medida: "PIEZA",
      talla: null,
      color: null,
      cantidad: "2.000",
      precio_unitario: "50.00",
      descuento: "0.00",
      subtotal: "100.00",
    },
  ],
};

describe("construirReceiptDesdeVenta", () => {
  it("usa la fecha de la VENTA, no la de hoy", () => {
    // Es el motivo de todo esto: sin la fecha, el ticket de una venta de la
    // semana pasada saldría fechado hoy y no serviría como comprobante.
    const r = construirReceiptDesdeVenta(VENTA);
    expect(r.fecha).toBeInstanceOf(Date);
    expect(r.fecha!.toISOString()).toBe("2026-09-10T19:45:00.000Z");
  });

  it("se marca siempre como reimpresión", () => {
    // Esta función solo se usa para volver a sacar una venta ya cobrada.
    expect(construirReceiptDesdeVenta(VENTA).esReimpresion).toBe(true);
  });

  it("lleva el cajero que cobró", () => {
    expect(construirReceiptDesdeVenta(VENTA).cajero).toBe(
      "cajero@symvora.com.mx"
    );
  });

  it("convierte a número los importes que PostgREST entrega como texto", () => {
    // Las columnas son DECIMAL y llegan como "116.00". Sin convertir, el
    // `toFixed` del ticket revienta y las sumas concatenan texto.
    const r = construirReceiptDesdeVenta(VENTA);
    expect(r.total).toBe(116);
    expect(r.montoRecibido).toBe(200);
    expect(r.cambio).toBe(84);
    expect(r.items[0].cantidad).toBe(2);
    expect(r.items[0].precioUnitario).toBe(50);
  });

  it("conserva monto recibido y cambio de una venta en efectivo", () => {
    const r = construirReceiptDesdeVenta(VENTA);
    expect(r.paymentMethod).toBe("EFECTIVO");
    expect(r.montoRecibido).toBe(200);
    expect(r.cambio).toBe(84);
  });

  it("una venta con tarjeta no inventa monto recibido", () => {
    const r = construirReceiptDesdeVenta({
      ...VENTA,
      metodo_pago: "TARJETA",
      monto_recibido: null,
      cambio: null,
    });
    expect(r.montoRecibido).toBeNull();
    expect(r.cambio).toBeNull();
  });

  it("sin cliente pone «Cliente general», no una línea vacía", () => {
    const r = construirReceiptDesdeVenta({
      ...VENTA,
      cliente_nombre: null,
      cliente_telefono: null,
    });
    expect(r.customerName).toBe(CLIENTE_GENERAL);
  });

  it("la variante sale con talla y color", () => {
    const r = construirReceiptDesdeVenta({
      ...VENTA,
      renglones: [
        {
          ...VENTA.renglones[0],
          variante_id: "v-1",
          nombre: "sueter",
          talla: "M",
          color: "ROJO",
        },
      ],
    });
    expect(r.items[0].varianteId).toBe("v-1");
    expect(r.items[0].varianteLabel).toBe("M · ROJO");
  });

  it("un producto borrado del catálogo no deja la línea en blanco", () => {
    // El RPC devuelve "Producto eliminado" porque `detalle_ventas` no guarda
    // copia del nombre. Aquí solo se comprueba que ese texto llega al ticket.
    const r = construirReceiptDesdeVenta({
      ...VENTA,
      renglones: [{ ...VENTA.renglones[0], nombre: "Producto eliminado" }],
    });
    expect(r.items[0].nombre).toBe("Producto eliminado");
  });

  it("una venta sin renglones no revienta", () => {
    const r = construirReceiptDesdeVenta({ ...VENTA, renglones: [] });
    expect(r.items).toEqual([]);
    expect(r.total).toBe(116);
  });

  it("la referencia del ticket es el id de la venta", () => {
    expect(construirReceiptDesdeVenta(VENTA).reference).toBe(VENTA.id);
  });
});

describe("etiquetaVariante", () => {
  it("junta talla y color como en el Punto de Venta", () => {
    expect(etiquetaVariante("M", "ROJO")).toBe("M · ROJO");
  });

  it("con solo uno de los dos, no deja separador suelto", () => {
    expect(etiquetaVariante("M", null)).toBe("M");
    expect(etiquetaVariante(null, "ROJO")).toBe("ROJO");
  });

  it("sin talla ni color devuelve null", () => {
    expect(etiquetaVariante(null, null)).toBeNull();
  });

  it("coincide con `variantLabel` del Punto de Venta", () => {
    // La etiqueta está escrita dos veces a propósito: `variantLabel` vive en un
    // componente cliente y arrastraría React al módulo puro. Este test es lo
    // que impide que las dos se separen y que el ticket reimpreso lea la
    // variante distinto al original.
    for (const [talla, color] of [
      ["M", "ROJO"],
      ["XL", null],
      [null, "AZUL"],
    ] as [string | null, string | null][]) {
      const delPos = variantLabel({ talla, color } as never);
      expect(etiquetaVariante(talla, color)).toBe(delPos);
    }
  });
});
