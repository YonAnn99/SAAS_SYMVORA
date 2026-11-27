import { NextResponse, after } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { cabecerasRateLimit, consumirRateLimit, obtenerIpCliente } from "@/lib/rate-limit";
import { verificarTurnstile } from "@/lib/turnstile.server";
import { construirCorreoPedidoNuevo, sendCorreoNovedad } from "@/lib/email";
import { aE164 } from "@/lib/telefono";
import { nombreAltaValido, limpiarNombre } from "@/features/lealtad/lealtad";
import { slugValido } from "@/features/catalogo/slug";
import {
  direccionValida,
  esquemaPedidoPublico,
  limpiarTexto,
  mensajeDeErrorPedido,
  type ResultadoPedido,
} from "@/features/catalogo/pedido-envio";

export const maxDuration = 20;

/** 5 pedidos cada 10 min por IP: los clientes en un mismo wifi comparten IP. */
const LIMITE_POR_IP = 5;
const VENTANA_SEGUNDOS = 600;

/**
 * El cliente final manda su pedido desde el catálogo en línea (migración 141). Sin sesión: esta ruta es la ÚNICA
 * puerta a `crear_pedido_publico` (solo service_role) y, antes de llamarla, valida rate limit por IP, honeypot y
 * Turnstile en el servidor. Sin `TURNSTILE_SECRET_KEY` no hay pedidos (503): falla cerrado.
 *
 * Nunca se confía en lo que manda el cliente: los precios los recalcula la base con el catálogo público, y solo
 * se mandan ids y cantidades. Los mensajes de la base (sin acentos) se traducen; un error desconocido sale genérico.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const ip = obtenerIpCliente(request);
  const limite = await consumirRateLimit(`pedido-catalogo:${ip}`, LIMITE_POR_IP, VENTANA_SEGUNDOS);
  if (!limite.permitido) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos o escríbele al negocio por WhatsApp." },
      { status: 429, headers: cabecerasRateLimit(limite) }
    );
  }

  const { slug: slugCrudo } = await params;
  const slug = decodeURIComponent(slugCrudo).trim().toLowerCase();
  if (!slugValido(slug)) {
    return NextResponse.json({ error: "Este catálogo no existe." }, { status: 404 });
  }

  const parsed = esquemaPedidoPublico.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisa tu pedido y acepta el aviso de privacidad." }, { status: 400 });
  }
  const datos = parsed.data;

  // Un bot llena todo: se responde como un fallo comun, sin escribir nada.
  if (datos.sitio) {
    return NextResponse.json({ error: "No se pudo enviar el pedido. Intenta de nuevo." }, { status: 400 });
  }

  if (!nombreAltaValido(datos.nombre)) {
    return NextResponse.json({ error: "Escribe tu nombre (de 2 a 60 letras)." }, { status: 400 });
  }
  const telefono = aE164(datos.pais, datos.numero);
  if (!telefono) {
    return NextResponse.json({ error: "Revisa tu número de celular." }, { status: 400 });
  }
  const direccion = limpiarTexto(datos.direccion);
  if (datos.entrega === "domicilio" && !direccionValida(direccion)) {
    return NextResponse.json({ error: "Escribe tu dirección de entrega." }, { status: 400 });
  }
  const nota = limpiarTexto(datos.nota);
  if (nota.length > 300) {
    return NextResponse.json({ error: "La nota es demasiado larga." }, { status: 400 });
  }

  const captcha = await verificarTurnstile(datos.token, ip);
  if (!captcha.ok) {
    if (captcha.motivo === "sin-llave") {
      console.error("[catalogo/pedido] falta TURNSTILE_SECRET_KEY: los pedidos estan apagados");
    }
    return captcha.motivo === "sin-llave" || captcha.motivo === "sin-respuesta"
      ? NextResponse.json({ error: "No pudimos verificar tu pedido. Intenta en un momento." }, { status: 503 })
      : NextResponse.json({ error: "Confirma que no eres un robot e intenta de nuevo." }, { status: 403 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("crear_pedido_publico", {
    p_slug: slug,
    p_nombre: limpiarNombre(datos.nombre),
    p_telefono: telefono,
    p_entrega: datos.entrega,
    p_direccion: datos.entrega === "domicilio" ? direccion : null,
    p_nota: nota || null,
    p_items: datos.items.map((i) => ({
      producto_id: i.productoId,
      variante_id: i.varianteId ?? null,
      cantidad: i.cantidad,
    })),
  });
  if (error) {
    const conocido = mensajeDeErrorPedido(error.message);
    if (!conocido) console.error("[catalogo/pedido] fallo crear_pedido_publico:", error.message);
    return NextResponse.json(
      { error: conocido?.mensaje ?? "No se pudo enviar el pedido. Intenta de nuevo." },
      { status: conocido?.status ?? 500 }
    );
  }

  const r = data as { folio?: number; codigo_seguimiento?: string; total?: number } | null;
  if (!r || typeof r.folio !== "number" || typeof r.codigo_seguimiento !== "string") {
    return NextResponse.json({ error: "No se pudo enviar el pedido. Intenta de nuevo." }, { status: 500 });
  }
  const resultado: ResultadoPedido = { folio: r.folio, codigo: r.codigo_seguimiento, total: Number(r.total ?? 0) };
  // Aviso al dueño por correo (mejor esfuerzo, fuera de la respuesta; un fallo nunca tumba el pedido).
  after(() => avisarDuenosDePedido(supabase, slug, resultado, datos.entrega, limpiarNombre(datos.nombre)));
  return NextResponse.json(resultado);
}

/**
 * Correo a los dueños y administradores por cada pedido nuevo. Tope de 20 correos por hora y negocio: más allá, el
 * aviso queda en la campana. No se envía a demos (la base ya no admite pedidos ahí).
 */
async function avisarDuenosDePedido(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  slug: string,
  pedido: ResultadoPedido,
  entrega: "recoger" | "domicilio",
  cliente: string
): Promise<void> {
  try {
    const { data: cat } = await supabase
      .from("catalogos_en_linea")
      .select("tenant_id")
      .eq("slug", slug)
      .maybeSingle();
    const tenantId = cat?.tenant_id as string | undefined;
    if (!tenantId) return;

    const limite = await consumirRateLimit(`correo-pedido:${tenantId}`, 20, 60 * 60);
    if (!limite.permitido) return;

    const [{ data: tenant }, { data: miembros }] = await Promise.all([
      supabase.from("tenants").select("nombre_comercial, moneda").eq("id", tenantId).maybeSingle(),
      supabase.from("tenant_memberships").select("user_id").eq("tenant_id", tenantId).in("role", ["SUPER_ADMIN", "ORG_ADMIN"]),
    ]);
    const correos = await Promise.all(
      (miembros ?? []).map(async (m) => {
        const { data } = await supabase.auth.admin.getUserById(m.user_id as string);
        return data.user?.email ?? null;
      })
    );
    const destinatarios = [...new Set(correos.filter((c): c is string => Boolean(c)))];
    if (destinatarios.length === 0) return;

    const { subject, html } = construirCorreoPedidoNuevo({
      folio: pedido.folio,
      negocio: (tenant?.nombre_comercial as string | undefined) ?? "tu negocio",
      cliente,
      entrega,
      total: pedido.total,
      moneda: (tenant?.moneda as "MXN" | "USD" | "EUR" | undefined) ?? "MXN",
    });
    for (const to of destinatarios) {
      await sendCorreoNovedad({ to, nombre: "", negocio: "" }, () => ({ subject, html }));
    }
  } catch (error) {
    console.error("[catalogo/pedido] no se pudo avisar al dueño:", error);
  }
}
