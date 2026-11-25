import { describe, expect, it } from "vitest";
import { ESTADOS_PEDIDO } from "@/features/catalogo/pedido-envio";
import {
  accionesDe,
  codigoDeErrorPedido,
  diferenciaDePrecio,
  siguientePaso,
} from "@/features/pedidos/transiciones";
import { enlaceWhatsAppCliente, mensajeAlCliente } from "@/features/pedidos/mensaje-estado";

describe("acciones según el estado", () => {
  it("nuevo: confirmar o cancelar", () => {
    expect(accionesDe("nuevo", "recoger")).toEqual(["confirmar", "cancelar"]);
  });
  it("confirmado: avanzar o cancelar; recoger nunca ofrece «en camino»", () => {
    expect(accionesDe("confirmado", "domicilio")).toContain("en_camino");
    expect(accionesDe("confirmado", "recoger")).not.toContain("en_camino");
    expect(accionesDe("confirmado", "recoger")).toContain("cancelar");
    expect(accionesDe("confirmado", "recoger")).not.toContain("confirmar");
  });
  it("no ofrece el estado en el que ya está", () => {
    expect(accionesDe("listo", "domicilio")).not.toContain("listo");
  });
  it("entregado y cancelado son finales", () => {
    expect(accionesDe("entregado", "recoger")).toEqual([]);
    expect(accionesDe("cancelado", "domicilio")).toEqual([]);
  });
  it("todo estado tiene una respuesta (sin truenos)", () => {
    for (const e of ESTADOS_PEDIDO) expect(Array.isArray(accionesDe(e, "domicilio"))).toBe(true);
  });
});

describe("siguiente paso", () => {
  it("de confirmado se propone el pago y se avanza en orden", () => {
    expect(siguientePaso("confirmado", "domicilio")).toBe("pago");
    expect(siguientePaso("pago", "domicilio")).toBe("en_produccion");
    expect(siguientePaso("listo", "domicilio")).toBe("en_camino");
    expect(siguientePaso("en_camino", "domicilio")).toBe("entregado");
  });
  it("recoger se salta «en camino»", () => {
    expect(siguientePaso("listo", "recoger")).toBe("entregado");
  });
  it("sin paso en nuevo ni en estados finales", () => {
    expect(siguientePaso("nuevo", "recoger")).toBeNull();
    expect(siguientePaso("entregado", "recoger")).toBeNull();
    expect(siguientePaso("cancelado", "recoger")).toBeNull();
  });
});

describe("errores de la base", () => {
  it("lee los dos totales de la diferencia de precio", () => {
    expect(diferenciaDePrecio("diferencia_de_precio:152.00:160.5")).toEqual({ pedido: 152, venta: 160.5 });
    expect(diferenciaDePrecio("otro error")).toBeNull();
    expect(diferenciaDePrecio(null)).toBeNull();
  });
  it("clasifica sin dejar salir el texto crudo", () => {
    expect(codigoDeErrorPedido("plan_sin_pedidos")).toBe("plan");
    expect(codigoDeErrorPedido("Tu cuenta esta en solo lectura. Reactiva tu plan")).toBe("readOnly");
    expect(codigoDeErrorPedido("No tienes permiso para gestionar pedidos")).toBe("noPermission");
    expect(codigoDeErrorPedido("Stock insuficiente para Leche")).toBe("noStock");
    expect(codigoDeErrorPedido("Este pedido ya no se puede cancelar")).toBe("final");
    expect(codigoDeErrorPedido("boom")).toBe("generic");
  });
});

describe("avisar por WhatsApp", () => {
  const base = { negocio: "Tienda", folio: 7, nombre: "Ana López", entrega: "recoger" as const, urlSeguimiento: "https://x.test/s" };
  it("cada estado tiene mensaje con el folio y el enlace", () => {
    for (const e of ESTADOS_PEDIDO) {
      const m = mensajeAlCliente(e, base);
      expect(m).toContain("#7");
      expect(m).toContain("https://x.test/s");
      expect(m.startsWith("Hola, Ana.")).toBe(true);
    }
  });
  it("distingue recoger de domicilio y no inventa enlace", () => {
    expect(mensajeAlCliente("listo", base)).toContain("pasar por él");
    expect(mensajeAlCliente("listo", { ...base, entrega: "domicilio" })).toContain("domicilio");
    expect(mensajeAlCliente("listo", { ...base, urlSeguimiento: null })).not.toContain("Sigue tu pedido");
  });
  it("el envío a domicilio aparece mientras el pedido sigue en curso y nunca en recoger", () => {
    const dom = { ...base, entrega: "domicilio" as const, envio: "$30.00" };
    for (const e of ["nuevo", "confirmado", "pago", "en_produccion", "listo", "en_camino"] as const) {
      expect(mensajeAlCliente(e, dom)).toContain("Envío a domicilio: $30.00.");
    }
    for (const e of ["entregado", "cancelado"] as const) expect(mensajeAlCliente(e, dom)).not.toContain("Envío a domicilio");
    expect(mensajeAlCliente("nuevo", { ...base, envio: "$30.00" })).not.toContain("Envío a domicilio");
    expect(mensajeAlCliente("nuevo", { ...dom, envio: null })).not.toContain("Envío a domicilio");
  });
  it("arma el enlace wa.me solo con un número válido", () => {
    expect(enlaceWhatsAppCliente("+525512345678", "hola")).toBe("https://wa.me/525512345678?text=hola");
    expect(enlaceWhatsAppCliente("123", "hola")).toBeNull();
    expect(enlaceWhatsAppCliente(null, "hola")).toBeNull();
  });
});
