import { describe, expect, it } from "vitest";
import {
  avisosCancelacion,
  avisosPrevios,
  bloqueoCancelar,
  bloqueoCorregir,
  motivoParaGuardar,
  MOTIVO_MAXIMO,
} from "@/features/sales/cancelar-venta";

const efectivo = { estado: "COMPLETADA", metodo_pago: "EFECTIVO" };

describe("cancelar venta: motivo", () => {
  it("los motivos de la lista se guardan en español, con detalle opcional", () => {
    expect(motivoParaGuardar("captura", "")).toBe("Error de captura");
    expect(motivoParaGuardar("duplicado", "  se cobró   dos veces ")).toBe("Cobro duplicado: se cobró dos veces");
  });

  it("«otro» exige escribir el motivo", () => {
    expect(motivoParaGuardar("otro", "   ")).toBeNull();
    expect(motivoParaGuardar("otro", "Cliente se arrepintió")).toBe("Cliente se arrepintió");
  });

  it("sin motivo elegido no hay nada que guardar; el texto se recorta al tope", () => {
    expect(motivoParaGuardar(null, "algo")).toBeNull();
    expect(motivoParaGuardar("otro", "x".repeat(500))).toHaveLength(MOTIVO_MAXIMO);
  });
});

describe("cancelar venta: qué se permite", () => {
  it("solo con permiso y sobre una venta completada sin factura", () => {
    expect(bloqueoCancelar(efectivo, true)).toBeNull();
    expect(bloqueoCancelar(efectivo, false)).toBe("sin-permiso");
    expect(bloqueoCancelar({ ...efectivo, estado: "CANCELADA" }, true)).toBe("cancelada");
    expect(bloqueoCancelar({ ...efectivo, estado: "PENDIENTE" }, true)).toBe("no-completada");
    expect(bloqueoCancelar({ ...efectivo, facturada: true }, true)).toBe("facturada");
  });

  it("una venta con terminal se cancela pero no se corrige", () => {
    const terminal = { estado: "COMPLETADA", metodo_pago: "TARJETA_TERMINAL" };
    expect(bloqueoCancelar(terminal, true)).toBeNull();
    expect(bloqueoCorregir(terminal, true)).toBe("terminal");
    expect(bloqueoCorregir({ ...efectivo, pagada_con_terminal: true }, true)).toBe("terminal");
    expect(bloqueoCorregir(efectivo, true)).toBeNull();
  });
});

describe("cancelar venta: avisos", () => {
  it("antes de confirmar, según cómo se pagó", () => {
    expect(avisosPrevios(efectivo)).toEqual(["stock", "efectivo", "lealtad-y-caja"]);
    expect(avisosPrevios({ ...efectivo, metodo_pago: "CREDITO" })).toContain("credito");
    expect(avisosPrevios({ ...efectivo, metodo_pago: "TRANSFERENCIA" })).toContain("otro-medio");
    expect(avisosPrevios({ ...efectivo, metodo_pago: "TARJETA_TERMINAL" })).toContain("terminal");
  });

  it("caja aún abierta: solo se informa que sale del corte", () => {
    expect(avisosCancelacion({ caja_abierta: true, devuelto_a_caja: 0 })).toEqual([
      { codigo: "caja-abierta", tono: "info" },
    ]);
  });

  it("caja cerrada en efectivo: salida en la caja de hoy, o aviso si no hay caja", () => {
    expect(avisosCancelacion({ devuelto_a_caja: "46.00" })).toEqual([
      { codigo: "devuelto-caja", monto: 46, tono: "info" },
    ]);
    expect(avisosCancelacion({ sin_caja_para_devolucion: true, total: "46.00" })).toEqual([
      { codigo: "sin-caja", monto: 46, tono: "aviso" },
    ]);
  });

  it("terminal: se devuelve en Mercado Pago (sin repetir el aviso de otro medio)", () => {
    const avisos = avisosCancelacion({ reembolso_en_terminal: true, devolucion_fuera_de_caja: true, total: 100 });
    expect(avisos.map((a) => a.codigo)).toEqual(["terminal"]);
  });

  it("crédito ya abonado: avisa el excedente a devolver", () => {
    const avisos = avisosCancelacion({ credito_rebajado: "30", credito_excedente: "16", lealtad_revertida: true });
    expect(avisos).toEqual([
      { codigo: "credito", monto: 30, tono: "info" },
      { codigo: "credito-excedente", monto: 16, tono: "aviso" },
      { codigo: "lealtad", tono: "info" },
    ]);
  });
});
