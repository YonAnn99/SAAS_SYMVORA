import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { sendCierreCajaToSuperAdminEmail } from "@/lib/email";
import { debeAvisarCierreManual } from "@/features/cash-register/avisos-cierre";
import { fetchSucursalParaAviso } from "@/features/cash-register/services/cash-register-server-service";

export const maxDuration = 30;

/** Solo se avisa de cierres recientes: no de cajas viejas de antes del aviso. */
const VENTANA_AVISO_MS = 24 * 60 * 60 * 1000;

/**
 * Aviso al SUPER_ADMIN cuando alguien de su equipo cierra su caja.
 *
 * Lo llama Finanzas justo despues de cerrar (`handleCloseRegister`), sin
 * esperar la respuesta: si el correo falla, la caja ya esta cerrada.
 *
 * NO SE FIA DEL NAVEGADOR. Solo recibe `cajaId`; las cifras salen de la caja ya
 * cerrada en la base. Asi nadie puede mandarle al dueño un corte inventado ni
 * un aviso sobre la caja de otro.
 *
 * UN AVISO POR CAJA: solo envia quien logra marcar `aviso_cierre_enviado_en`
 * (migracion 089). Reintentos, recargas o dos pestañas no lo duplican.
 */
export async function POST(request: Request) {
  const auth = await requireTenantAccess(request);
  if (!auth.ok) return auth.response;
  if (auth.isDemo) return NextResponse.json({ ok: true, enviado: false, motivo: "demo" });

  const body = (await request.json().catch(() => null)) as { cajaId?: unknown } | null;
  const cajaId = typeof body?.cajaId === "string" ? body.cajaId : null;
  if (!cajaId) {
    return NextResponse.json({ error: "cajaId es requerido" }, { status: 400 });
  }

  const supabase = createSupabaseServiceRoleClient();

  const { data: caja } = await supabase
    .from("cajas")
    .select("*")
    .eq("id", cajaId)
    .maybeSingle();

  // Solo SU caja, y ya cerrada.
  if (!caja || caja.usuario_id !== auth.userId) {
    return NextResponse.json({ error: "Caja no encontrada" }, { status: 404 });
  }
  if (caja.estado !== "CERRADA" || !caja.fecha_cierre) {
    return NextResponse.json({ error: "La caja no está cerrada" }, { status: 409 });
  }
  if (Date.now() - new Date(caja.fecha_cierre).getTime() > VENTANA_AVISO_MS) {
    return NextResponse.json({ ok: true, enviado: false, motivo: "cierre antiguo" });
  }

  const { data: membresia } = await supabase
    .from("tenant_memberships")
    .select("role")
    .eq("tenant_id", caja.tenant_id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  // Si cierra el propio dueño, no hay a quien avisar: es el quien conto.
  if (!membresia || !debeAvisarCierreManual(membresia.role)) {
    return NextResponse.json({ ok: true, enviado: false, motivo: "cierra el dueño" });
  }

  const { data: marcada } = await supabase
    .from("cajas")
    .update({ aviso_cierre_enviado_en: new Date().toISOString() })
    .eq("id", cajaId)
    .is("aviso_cierre_enviado_en", null)
    .select("id");
  if (!marcada || marcada.length === 0) {
    return NextResponse.json({ ok: true, enviado: false, motivo: "ya avisado" });
  }

  const [{ data: owner }, { data: tenant }, { data: quien }, sucursalNombre] = await Promise.all([
    supabase
      .from("tenant_memberships")
      .select("user_id")
      .eq("tenant_id", caja.tenant_id)
      .eq("role", "SUPER_ADMIN")
      .limit(1)
      .maybeSingle(),
    supabase.from("tenants").select("nombre_comercial").eq("id", caja.tenant_id).maybeSingle(),
    supabase.auth.admin.getUserById(auth.userId),
    fetchSucursalParaAviso(supabase, caja.tenant_id, caja.sucursal_id ?? null),
  ]);

  const ownerEmail = owner?.user_id
    ? (await supabase.auth.admin.getUserById(owner.user_id)).data.user?.email ?? null
    : null;
  const userEmail = quien.user?.email ?? "";

  const desmarcar = () =>
    supabase.from("cajas").update({ aviso_cierre_enviado_en: null }).eq("id", cajaId);

  if (!ownerEmail || ownerEmail === userEmail) {
    await desmarcar();
    return NextResponse.json({ ok: true, enviado: false, motivo: "sin dueño con correo" });
  }

  const resultado = await sendCierreCajaToSuperAdminEmail({
    to: ownerEmail,
    businessName: tenant?.nombre_comercial || "tu negocio",
    sucursalNombre,
    userName:
      (quien.user?.user_metadata?.nombre as string | undefined) ||
      userEmail.split("@")[0] ||
      "Usuario",
    userRole: membresia.role,
    userEmail,
    fechaApertura: caja.fecha_apertura,
    fechaCierre: caja.fecha_cierre,
    fondoInicial: Number(caja.fondo_inicial),
    totalVentas: Number(caja.total_ventas),
    totalEntradas: Number(caja.total_entradas),
    totalSalidas: Number(caja.total_salidas),
    saldoEsperado: Number(caja.saldo_esperado),
    saldoReal: Number(caja.saldo_real),
    diferencia: Number(caja.diferencia),
    notasCierre: caja.notas_cierre,
  });

  // Si Resend fallo se quita la marca: el siguiente intento puede enviarlo.
  if (!resultado.ok) {
    await desmarcar();
    return NextResponse.json({ ok: false, error: resultado.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, enviado: true });
}
