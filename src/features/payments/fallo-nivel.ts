/**
 * Alerta INTERNA (a hola@) cuando un cliente ya pagó un nivel pero `asignar_nivel` lo rechazó (p. ej. creó una sucursal
 * de más entre abrir el checkout y pagar). El cobro ya salió: el cliente se queda sin nivel hasta que alguien lo resuelva
 * (el siguiente cobro lo reintenta solo). Puro, para probar el texto sin base ni correo.
 */

export type MotivoFalloNivel = "limite_sucursales" | "otro";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function describirFalloNivel(p: {
  negocio: string;
  tenantId: string;
  nivel: string;
  mensaje: string;
}): { motivo: MotivoFalloNivel; subject: string; html: string; text: string } {
  const motivo: MotivoFalloNivel = /limite_sucursales/.test(p.mensaje) ? "limite_sucursales" : "otro";
  const causa =
    motivo === "limite_sucursales"
      ? "tiene más sucursales activas de las que incluye el nivel pagado"
      : "la base rechazó la asignación";
  const subject = `⚠️ Pago recibido pero no se asignó el nivel: ${p.negocio}`;
  const text = [
    `Negocio: ${p.negocio} (${p.tenantId})`,
    `Nivel pagado: ${p.nivel}`,
    `Motivo: ${causa}`,
    `Detalle: ${p.mensaje}`,
    "",
    "El cliente ya pagó. Pídele cerrar sucursales o cámbialo de nivel a mano; el siguiente cobro reintenta la asignación.",
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#111827;">
    <p><strong>El cliente ya pagó, pero no se pudo asignar su nivel.</strong></p>
    <p>Negocio: <strong>${esc(p.negocio)}</strong> (${esc(p.tenantId)})<br>
    Nivel pagado: <strong>${esc(p.nivel)}</strong><br>
    Motivo: ${esc(causa)}<br>
    Detalle: ${esc(p.mensaje)}</p>
    <p>Pídele cerrar sucursales o cámbialo de nivel a mano; el siguiente cobro reintenta la asignación.</p>
  </div>`;
  return { motivo, subject, html, text };
}
