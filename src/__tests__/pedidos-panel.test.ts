import { describe, expect, it } from "vitest";
import {
  codigoDeErrorPedido,
  diferenciaDePrecio,
  estaCerrado,
  estadosDisponibles,
  puedeAceptar,
  puedeCambiarEstado,
  puedeCancelar,
  puedeEditar,
  puedePagar,
} from "@/features/pedidos/transiciones";
import { enlaceWhatsAppCliente, mensajeAlCliente } from "@/features/pedidos/mensaje-estado";
import type { EstadoPropio } from "@/features/pedidos/types";

const estado = (over: Partial<EstadoPropio>): EstadoPropio => ({
  id: "x", nombre: "X", color: "#000000", base: "en_curso", aplica_a: "ambos", orden: 10, activo: true, es_sistema: false, ...over,
});

describe("qué se puede hacer según el estado y el pago", () => {
  it("nuevo: solo aceptar o cancelar; no se paga ni se edita sin aceptar", () => {
    const nuevo = { estado: "nuevo" as const, pagado: false, venta_id: null };
    expect(puedeAceptar(nuevo)).toBe(true);
    expect(puedePagar(nuevo)).toBe(false);
    expect(puedeCambiarEstado(nuevo)).toBe(false);
    expect(puedeCancelar(nuevo)).toBe(true);
  });
  it("aceptado y sin pagar: se paga, se edita, se cambia el estado", () => {
    const p = { estado: "confirmado" as const, pagado: false, venta_id: null };
    expect(puedePagar(p)).toBe(true);
    expect(puedeEditar(p)).toBe(true);
    expect(puedeCambiarEstado(p)).toBe(true);
  });
  it("pagado: ya no se edita ni se vuelve a cobrar, aunque cambie de estado", () => {
    const p = { estado: "en_curso" as const, pagado: true, venta_id: "v1" };
    expect(puedePagar(p)).toBe(false);
    expect(puedeEditar(p)).toBe(false);
    expect(puedeCambiarEstado(p)).toBe(true);
  });
  it("entregado y cancelado son cerrados: no se editan ni se cancelan de nuevo", () => {
    expect(estaCerrado("entregado")).toBe(true);
    expect(estaCerrado("cancelado")).toBe(true);
    expect(puedeEditar({ estado: "entregado", pagado: false, venta_id: null })).toBe(false);
    expect(puedeCancelar({ estado: "cancelado" })).toBe(false);
  });
});

describe("estados propios que se le pueden poner a un pedido", () => {
  const todos = [
    estado({ id: "a", nombre: "Preparando", orden: 20 }),
    estado({ id: "b", nombre: "Listo para retirar", aplica_a: "recoger", orden: 30 }),
    estado({ id: "c", nombre: "En camino", aplica_a: "domicilio", orden: 40 }),
    estado({ id: "d", nombre: "Inactivo", activo: false, orden: 50 }),
    estado({ id: "e", nombre: "Cancelado", base: "cancelado", orden: 60, es_sistema: true }),
    estado({ id: "f", nombre: "Entregado", base: "entregado", orden: 70, es_sistema: true }),
  ];
  it("filtra por tipo de entrega, quita inactivos y los de cancelación, y ordena", () => {
    expect(estadosDisponibles({ entrega: "recoger" }, todos).map((e) => e.nombre)).toEqual(["Preparando", "Listo para retirar", "Entregado"]);
    expect(estadosDisponibles({ entrega: "domicilio" }, todos).map((e) => e.nombre)).toEqual(["Preparando", "En camino", "Entregado"]);
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
    expect(codigoDeErrorPedido("Hay productos que ya no están disponibles")).toBe("noStock");
    expect(codigoDeErrorPedido("Este pedido ya está pagado: no se puede editar")).toBe("yaPagado");
    expect(codigoDeErrorPedido("El módulo de pedidos cambió: recarga la página para seguir.")).toBe("recarga");
    expect(codigoDeErrorPedido("Este pedido ya no se puede cancelar")).toBe("final");
    expect(codigoDeErrorPedido("boom")).toBe("generic");
  });
});

describe("avisar por WhatsApp", () => {
  const base = { negocio: "Tienda", folio: 7, nombre: "Ana López", entrega: "recoger" as const, urlSeguimiento: "https://x.test/s", estadoNombre: "Preparando" };
  it("el estado en curso nombra el estado propio del negocio", () => {
    const m = mensajeAlCliente("en_curso", base);
    expect(m).toContain("Preparando");
    expect(m).toContain("#7");
    expect(m).toContain("https://x.test/s");
    expect(m.startsWith("Hola, Ana.")).toBe(true);
  });
  it("cada estado base tiene mensaje con el folio y el enlace", () => {
    for (const b of ["nuevo", "confirmado", "en_curso", "entregado", "cancelado"] as const) {
      const m = mensajeAlCliente(b, base);
      expect(m).toContain("#7");
      expect(m).toContain("https://x.test/s");
    }
  });
  it("sin enlace no lo inventa; la nota del negocio sale si existe", () => {
    expect(mensajeAlCliente("en_curso", { ...base, urlSeguimiento: null })).not.toContain("Sigue tu pedido");
    expect(mensajeAlCliente("en_curso", { ...base, mensajeCliente: "Pasa después de las 5" })).toContain("Nota: Pasa después de las 5");
  });
  it("el envío a domicilio aparece mientras el pedido sigue abierto y nunca en recoger", () => {
    const dom = { ...base, entrega: "domicilio" as const, envio: "$30.00" };
    for (const b of ["nuevo", "confirmado", "en_curso"] as const) {
      expect(mensajeAlCliente(b, dom)).toContain("Envío a domicilio: $30.00.");
    }
    for (const b of ["entregado", "cancelado"] as const) expect(mensajeAlCliente(b, dom)).not.toContain("Envío a domicilio");
    expect(mensajeAlCliente("nuevo", { ...base, envio: "$30.00" })).not.toContain("Envío a domicilio");
    expect(mensajeAlCliente("nuevo", { ...dom, envio: null })).not.toContain("Envío a domicilio");
  });
  it("arma el enlace wa.me solo con un número válido", () => {
    expect(enlaceWhatsAppCliente("+525512345678", "hola")).toBe("https://wa.me/525512345678?text=hola");
    expect(enlaceWhatsAppCliente("123", "hola")).toBeNull();
    expect(enlaceWhatsAppCliente(null, "hola")).toBeNull();
  });
});
