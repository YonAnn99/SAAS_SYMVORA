import { NextResponse, after } from "next/server";
import crypto from "crypto";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { precioCobroCents, precioNivelCobroCents, trasCobrar } from "@/features/payments/promocion";
import { esNivel, type Nivel } from "@/lib/niveles";
import { metodoDePagoConekta } from "@/features/payments/metodo-pago-conekta";
import { PROMO_META_99 } from "@/lib/pricing";

// Presupuesto de ejecucion explicito. Sin el, una llamada lenta a un tercero
// deja la funcion ocupada hasta el tope por defecto de la plataforma.
// `after()` tambien se rige por este tope.
export const maxDuration = 30;

/**
 * Marca en `payment_history.reference` cuando se consumio un mes gratis pero el
 * reembolso en Conekta fallo: el cliente quedo cobrado y sin credito. Es la
 * unica forma de saber a quien hay que devolverle el dinero a mano.
 *
 *   SELECT * FROM payment_history WHERE reference = 'referido:reembolso_pendiente';
 */
const REFERENCIA_REEMBOLSO_PENDIENTE = "referido:reembolso_pendiente";

// Reconstruye el PEM desde cero sin importar cómo haya quedado pegado el
// valor en Vercel (saltos de línea reales, "\n" literales, o todo en una
// sola línea) — cualquiera de esos formatos rompe crypto.verify() con
// "DECODER routines::unsupported" si no se normaliza primero.
function normalizePemPublicKey(raw: string): string {
  const unescaped = raw.replace(/\\r\\n|\\n/g, "\n").replace(/\r\n/g, "\n");
  const match = unescaped.match(
    /-----BEGIN PUBLIC KEY-----([\s\S]*?)-----END PUBLIC KEY-----/
  );
  const body = (match ? match[1] : unescaped).replace(/\s+/g, "");
  const wrapped = body.match(/.{1,64}/g)?.join("\n") ?? body;
  return `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----\n`;
}

const rawConektaWebhookPublicKey = process.env.CONEKTA_WEBHOOK_PUBLIC_KEY;
const conektaWebhookPublicKey = rawConektaWebhookPublicKey
  ? normalizePemPublicKey(rawConektaWebhookPublicKey)
  : undefined;
const legacyWebhookSecret = process.env.CONEKTA_WEBHOOK_SECRET;

function extractDigestBase64(digestHeader: string | null): Buffer | null {
  if (!digestHeader) return null;

  let value = digestHeader.trim();
  for (const marker of ["sha-256=:", "sha-256=", "sha256=:", "sha256="]) {
    if (value.startsWith(marker)) {
      value = value.slice(marker.length);
      break;
    }
  }

  value = value.trim();
  if (value.startsWith(":")) value = value.slice(1);
  if (value.endsWith(":")) value = value.slice(0, -1);

  try {
    return Buffer.from(value, "base64");
  } catch {
    return null;
  }
}

async function verifyConektaSignature(rawBody: string, digestHeader: string | null): Promise<boolean> {
  if (!conektaWebhookPublicKey) {
    console.error(
      "[conekta-webhook] CONEKTA_WEBHOOK_PUBLIC_KEY not configured; rejecting webhook. " +
        "Generate keys via POST https://api.conekta.io/webhook_keys"
    );
    return false;
  }

  if (legacyWebhookSecret) {
    console.warn(
      "[conekta-webhook] CONEKTA_WEBHOOK_SECRET (HMAC) is obsolete; Conekta signs webhooks " +
        "with RSA using the DIGEST header. Set CONEKTA_WEBHOOK_PUBLIC_KEY instead."
    );
  }

  const signature = extractDigestBase64(digestHeader);
  if (!signature || signature.length === 0) {
    console.error("[conekta-webhook] Missing or malformed DIGEST header");
    return false;
  }

  try {
    return crypto.verify(
      "sha256",
      Buffer.from(rawBody, "utf8"),
      conektaWebhookPublicKey,
      signature
    );
  } catch (verifyError) {
    console.error("[conekta-webhook] RSA verification failed:", verifyError);
    return false;
  }
}

// ============================================================
// Programa de referidos — helpers
// ============================================================

// Otorga la recompensa solo cuando el referido llega a su PRIMER pago real.
// - Estado REGISTRADO => CONVERTIDO (idempotente: solo una vez).
// - Anti-fraude server-side: el referidor debe tener (o haber tenido) una
//   suscripcion active legitima antes de recibir el credito. La UI que oculta
//   el codigo en trial es cosmética, esta validacion es la proteccion real.
async function convertReferralOnFirstPayment(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  tenantId: string
): Promise<{ converted: boolean; reason?: string }> {
  const { data: referral } = await supabase
    .from("referidos")
    .select("id, tenant_referidor_id")
    .eq("tenant_referido_id", tenantId)
    .eq("estado", "REGISTRADO")
    .maybeSingle();

  if (!referral) {
    return { converted: false, reason: "no_referral" };
  }

  // Anti-fraude: el referidor debe tener o haber tenido suscripcion activa.
  const { data: referrerSub } = await supabase
    .from("subscriptions")
    .select("id, status")
    .eq("tenant_id", referral.tenant_referidor_id)
    .maybeSingle();

  let referrerEligible = referrerSub?.status === "active";

  if (!referrerEligible && referrerSub?.id) {
    const { data: paidRow } = await supabase
      .from("payment_history")
      .select("id")
      .eq("subscription_id", referrerSub.id)
      .eq("status", "completed")
      .limit(1)
      .maybeSingle();
    referrerEligible = Boolean(paidRow);
  }

  if (!referrerEligible) {
    return { converted: false, reason: "referrer_not_eligible" };
  }

  // Marca CONVERTIDO y otorga +1 mes gratis a ambos lados (atómico via RPC).
  await supabase
    .from("referidos")
    .update({ estado: "CONVERTIDO", convertido_en: new Date().toISOString() })
    .eq("id", referral.id);

  await supabase.rpc("incrementar_credito_referido", {
    p_tenant_id: tenantId,
  });
  await supabase.rpc("incrementar_credito_referido", {
    p_tenant_id: referral.tenant_referidor_id,
  });

  return { converted: true };
}

// Consume un mes gratis acumulado sobre un cobro recurrente real:
// decrementa el credito, registra el mes 'credited' y reembolsa la orden en
// Conekta. Idempotente via conekta_order_id + status 'credited'.
async function consumeFreeMonthCredit(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  params: {
    subscriptionId: string;
    tenantId: string;
    conektaOrderId: string;
    amountCents: number;
  }
): Promise<{ consumed: boolean; reason?: string }> {
  const { subscriptionId, tenantId, conektaOrderId, amountCents } = params;

  const { data: existing } = await supabase
    .from("payment_history")
    .select("id")
    .eq("conekta_order_id", conektaOrderId)
    .eq("status", "credited")
    .maybeSingle();

  if (existing) {
    return { consumed: false, reason: "already_processed" };
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("creditos_mes_gratis")
    .eq("id", subscriptionId)
    .single();

  const credits = sub?.creditos_mes_gratis ?? 0;
  if (credits <= 0) {
    return { consumed: false, reason: "no_credit" };
  }

  // 1. Decrementa el credito.
  await supabase
    .from("subscriptions")
    .update({ creditos_mes_gratis: credits - 1 })
    .eq("id", subscriptionId);

  // 2. Registra el mes como 'credited' (trazable en el historial).
  const { data: creditRow } = await supabase
    .from("payment_history")
    .insert({
      subscription_id: subscriptionId,
      amount: 0,
      payment_method: "card",
      status: "credited",
      reference: "referido",
      conekta_order_id: conektaOrderId,
      paid_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  // 3. Reembolsa el cobro en Conekta.
  try {
    const { refundOrder } = await import("@/features/payments/services/conekta/orders");
    await refundOrder({
      orderId: conektaOrderId,
      amountCents,
      reason: "Mes gratis programa de referidos",
    });
  } catch (refundError) {
    // Aqui el cliente YA fue cobrado y YA perdio el credito, pero el dinero no
    // ha vuelto. Antes esto solo hacia console.error: el fallo desaparecia con
    // los logs y nadie podia saber a quien habia que devolverle el dinero.
    // Se deja marca en la propia fila para que sea consultable:
    //   SELECT * FROM payment_history WHERE reference = 'referido:reembolso_pendiente';
    console.error(
      `[conekta-webhook] Refund failed for order ${conektaOrderId} (tenant ${tenantId}):`,
      refundError
    );
    if (creditRow?.id) {
      await supabase
        .from("payment_history")
        .update({ reference: REFERENCIA_REEMBOLSO_PENDIENTE })
        .eq("id", creditRow.id);
    }
  }

  return { consumed: true };
}

// Conekta siempre manda `amount` en estos eventos; esto solo cubre el caso raro
// de un evento sin monto. Depende del periodo a propósito: un fallback mensual
// sobre un cobro anual registraría (y en el flujo de referidos reembolsaría) una
// cantidad equivocada.
function fallbackAmountCents(
  billingPeriod: string | null | undefined,
  cobrosPromoRestantes: number = 0,
  // Nivel con el que se cobra (migracion 140): el confirmado o, en el primer pago, el pendiente.
  nivel: string | null | undefined = null
): number {
  // El contador entra aqui porque este fallback alimenta `payment_history` Y el
  // reembolso del credito de referido: con una promocion en curso, dar por
  // hecho $399 haria que un mes regalado devolviera $200 de mas.
  const periodo = billingPeriod === "yearly" ? "yearly" : "monthly";
  if (esNivel(nivel)) return precioNivelCobroCents(nivel, periodo, cobrosPromoRestantes);
  return precioCobroCents(periodo, cobrosPromoRestantes);
}

/** Nivel con el que se esta cobrando una suscripcion: el ya confirmado o el que espera su primer pago. */
function nivelDeCobro(sub: { nivel?: string | null; nivel_pendiente?: string | null } | null | undefined): Nivel | null {
  const n = sub?.nivel ?? sub?.nivel_pendiente ?? null;
  return esNivel(n) ? n : null;
}

/**
 * Confirma el nivel que el cliente eligio en el checkout, SOLO tras un cobro real (`subscription.paid` /
 * `order.paid`). `asignar_nivel` (solo service_role) limpia `nivel_pendiente` y rechaza, sin cambiar nada,
 * si el negocio tiene mas sucursales activas de las que el nivel incluye.
 *
 * Nunca lanza: Conekta reintenta el evento entero mientras no reciba un 200, y un fallo aqui no puede
 * hacer que se reprocese un cobro. Si falla, `nivel_pendiente` se queda y el siguiente cobro lo reintenta;
 * mientras tanto el negocio conserva lo que tenia.
 */
async function confirmarNivelPagado(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  tenantId: string | null | undefined,
  nivelPendiente: string | null | undefined
): Promise<void> {
  if (!tenantId || !esNivel(nivelPendiente)) return;
  try {
    const { error } = await supabase.rpc("asignar_nivel", {
      p_tenant_id: tenantId,
      p_nivel: nivelPendiente,
    });
    if (error) console.error("[conekta/webhook] asignar_nivel fallo:", error.message);
  } catch (err) {
    console.error("[conekta/webhook] asignar_nivel fallo:", err);
  }
}

/**
 * Avanza la promocion de lanzamiento tras un cobro y, cuando se agota, pasa la
 * suscripcion al plan normal de Conekta.
 *
 * SE AUTORREPARA A PROPOSITO. La condicion para pedir el cambio de plan no es
 * "acabo de llegar a cero" sino "estoy en cero y sigo en el plan promocional".
 * Si la llamada a Conekta falla (su API caida, un timeout), `promo_plan` se
 * queda puesto y el siguiente cobro vuelve a intentarlo. Con la otra condicion,
 * un unico fallo dejaria al cliente pagando $199 de por vida sin que nadie se
 * enterara. Y una vez hecho el cambio, `promo_plan` queda en NULL y esto no
 * vuelve a tocar nada: es idempotente frente a reenvios del webhook.
 *
 * Nunca lanza: Conekta reintenta el evento entero mientras no reciba un 200, y
 * un fallo cerrando la promocion no puede hacer que se reprocese un cobro.
 */
async function avanzarPromocion(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  params: {
    subscriptionId: string;
    customerId: string | null | undefined;
    /** Suscripcion recurrente de Conekta, o null si se paga en efectivo. */
    conektaSubscriptionId: string | null | undefined;
    cobrosRestantes: number;
    promoPlan: string | null;
    huboCobroReal: boolean;
  }
): Promise<void> {
  const {
    subscriptionId,
    customerId,
    conektaSubscriptionId,
    cobrosRestantes,
    promoPlan,
    huboCobroReal,
  } = params;
  if (!promoPlan) return;

  const { restantes } = trasCobrar(cobrosRestantes, huboCobroReal);

  if (restantes !== cobrosRestantes) {
    await supabase
      .from("subscriptions")
      .update({ promo_cobros_restantes: restantes, updated_at: new Date().toISOString() })
      .eq("id", subscriptionId);
  }

  if (restantes > 0) return;

  // Efectivo/transferencia no tiene suscripcion en Conekta: cada pago es una
  // orden suelta y el precio se calcula en `create-checkout`. No hay plan que
  // cambiar, solo hay que cerrar la promocion para que la siguiente ficha salga
  // a precio normal. Llamar a Conekta aqui daria 404 en bucle.
  if (!conektaSubscriptionId) {
    await supabase
      .from("subscriptions")
      .update({ promo_plan: null, updated_at: new Date().toISOString() })
      .eq("id", subscriptionId);
    return;
  }

  if (!customerId) {
    console.error(
      `[conekta/webhook] Promocion agotada en la suscripcion ${subscriptionId} pero no hay ` +
        `conekta_customer_id: no se puede devolver al plan normal y seguira cobrando el precio promocional.`
    );
    return;
  }

  try {
    const { cambiarPlan } = await import("@/features/payments/services/conekta/subscriptions");
    const { CONEKTA_PLAN_IDS } = await import("@/features/payments/services/conekta/config");
    // Al plan NORMAL de lo que se contrato: la promo de un nivel vuelve al mensual de ese nivel (Pro o
    // Premium), no al plan unico de siempre. Se decide por el id del plan promocional guardado.
    const clavePlanNormal =
      promoPlan === CONEKTA_PLAN_IDS.proMonthlyPromo
        ? "proMonthly"
        : promoPlan === CONEKTA_PLAN_IDS.premiumMonthlyPromo
          ? "premiumMonthly"
          : "monthly";
    // Los planes de Conekta se crean al primer uso: el normal de un nivel puede no existir todavia (con la
    // promo activa nadie lo ha pedido). Sin esto el cambio fallaria y el cliente seguiria pagando el precio
    // promocional. `ensurePlanExists` tolera que ya exista.
    const { ensurePlanExists } = await import("@/features/payments/services/conekta/plans");
    await ensurePlanExists(clavePlanNormal);
    await cambiarPlan(customerId, CONEKTA_PLAN_IDS[clavePlanNormal]);

    await supabase
      .from("subscriptions")
      .update({ promo_plan: null, updated_at: new Date().toISOString() })
      .eq("id", subscriptionId);
  } catch (error) {
    // Se deja `promo_plan` puesto para que el proximo cobro lo reintente.
    console.error(
      `[conekta/webhook] No se pudo devolver la suscripcion ${subscriptionId} al plan normal ` +
        `tras agotar la promocion; se reintentara en el proximo cobro:`,
      error
    );
  }
}

// Email de bienvenida al dueño del tenant que acaba de pagar su membresia.
/**
 * Al pagar, el ciclo de cobro vuelve a empezar (migracion 096): se borra el
 * inicio de la gracia, la oferta de regreso y las marcas de los avisos de
 * cobro, para que el proximo vencimiento vuelva a avisar desde cero.
 *
 * Va en un update APARTE y sin comprobar el error a proposito: si la migracion
 * 096 aun no esta aplicada, estas columnas no existen y el update falla solo,
 * sin tumbar la activacion de la cuenta.
 */
const REINICIO_CICLO_COBRO = {
  past_due_desde: null,
  oferta_regreso_hasta: null,
  aviso_renovacion_en: null,
  aviso_gracia_en: null,
  aviso_solo_lectura_en: null,
  aviso_regreso_en: null,
  aviso_ultimo_en: null,
} as const;

async function sendWelcomeEmailToOwner(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  tenantId: string,
  billingPeriod: "monthly" | "yearly",
  amountCents: number
): Promise<void> {
  try {
    const { data: owner } = await supabase
      .from("tenant_memberships")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("role", "SUPER_ADMIN")
      .limit(1)
      .maybeSingle();

    if (!owner) return;

    const { data: user } = await supabase.auth.admin.getUserById(owner.user_id);
    const email = user?.user?.email;
    if (!email) return;

    const { data: tenant } = await supabase
      .from("tenants")
      .select("nombre_comercial, codigo_referido")
      .eq("id", tenantId)
      .maybeSingle();

    if (!tenant) return;

    const { sendWelcomeEmail } = await import("@/lib/email");
    await sendWelcomeEmail({
      to: email,
      businessName: tenant.nombre_comercial || "tu negocio",
      referralCode: tenant.codigo_referido,
      type: "first_payment",
      billingPeriod,
      amountCents,
    });
  } catch (emailError) {
    console.error("[conekta-webhook] Failed to send welcome email:", emailError);
  }
}

// ============================================================
// POST handler
// ============================================================

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const digestHeader = request.headers.get("digest");

    if (!(await verifyConektaSignature(rawBody, digestHeader))) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    const body = JSON.parse(rawBody);
    const eventType = body.type;
    const data = body.data?.object;

    if (!data) {
      return NextResponse.json({ received: true });
    }

    const supabase = createSupabaseServiceRoleClient();

    switch (eventType) {
      case "subscription.created": {
        const customerId = data.customer_id;
        const subscriptionId = data.id;

        // Nota: NO se fija last_payment_at aqui — solo lo hace un pago real
        // (order.paid / subscription.paid). La conversion del referido se
        // dispara con la guardia "last_payment_at IS NULL".
        //
        // Conekta reenvía/reintenta este evento, y no todos los reenvíos
        // traen billing_cycle_start/end — solo se incluyen en el update
        // cuando el evento sí los trae, para no borrar con null fechas que
        // ya se habían guardado bien desde un evento anterior.
        const createdUpdate: Record<string, unknown> = {
          status: "active",
          conekta_subscription_id: subscriptionId,
          updated_at: new Date().toISOString(),
        };
        if (data.billing_cycle_start) {
          createdUpdate.current_period_start = new Date(data.billing_cycle_start * 1000).toISOString();
        }
        if (data.billing_cycle_end) {
          createdUpdate.current_period_end = new Date(data.billing_cycle_end * 1000).toISOString();
        }

        await supabase
          .from("subscriptions")
          .update(createdUpdate)
          .eq("conekta_customer_id", customerId);

        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id, billing_period, nivel, nivel_pendiente")
          .eq("conekta_customer_id", customerId)
          .single();

        if (sub && data.last_billing_cycle_order_id) {
          // Conekta reintenta la entrega del webhook mientras no reciba un
          // 200 (ej. durante la firma rota que depurramos hoy) — sin este
          // chequeo, cada reintento duplicaba la fila del mismo cargo.
          const { data: existingPayment } = await supabase
            .from("payment_history")
            .select("id")
            .eq("conekta_order_id", data.last_billing_cycle_order_id)
            .eq("status", "completed")
            .maybeSingle();

          if (!existingPayment) {
            await supabase.from("payment_history").insert({
              subscription_id: sub.id,
              amount: (data.amount || fallbackAmountCents(sub.billing_period, 0, nivelDeCobro(sub))) / 100,
              payment_method: "card",
              status: "completed",
              conekta_order_id: data.last_billing_cycle_order_id,
              paid_at: new Date().toISOString(),
            });
          }
        }

        const { data: tenantSub } = await supabase
          .from("subscriptions")
          .select("tenant_id")
          .eq("conekta_customer_id", customerId)
          .single();

        if (tenantSub?.tenant_id) {
          await supabase
            .from("tenants")
            .update({ subscription_status: "active" })
            .eq("id", tenantSub.tenant_id);
        }

        break;
      }

      case "subscription.paid": {
        const customerId = data.customer_id;
        const subscriptionId = data.id;

        // Lee el estado ANTES de actualizar para saber si es el primer pago.
        const { data: preSub } = await supabase
          .from("subscriptions")
          .select(
            "id, tenant_id, last_payment_at, billing_period, promo_cobros_restantes, promo_plan, conekta_customer_id, nivel, nivel_pendiente"
          )
          .eq("conekta_customer_id", customerId)
          .maybeSingle();

        const isFirstPayment = !preSub?.last_payment_at;
        const promoRestantes = preSub?.promo_cobros_restantes ?? 0;

        // Mismo cuidado que en subscription.created: solo se incluyen las
        // fechas de periodo cuando el evento las trae, para no borrarlas con
        // null si algún reenvío llega sin esos datos.
        const paidUpdate: Record<string, unknown> = {
          status: "active",
          conekta_subscription_id: subscriptionId,
          last_payment_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (data.billing_cycle_start) {
          paidUpdate.current_period_start = new Date(data.billing_cycle_start * 1000).toISOString();
        }
        if (data.billing_cycle_end) {
          paidUpdate.current_period_end = new Date(data.billing_cycle_end * 1000).toISOString();
        }

        await supabase
          .from("subscriptions")
          .update(paidUpdate)
          .eq("conekta_customer_id", customerId);
        await supabase
          .from("subscriptions")
          .update(REINICIO_CICLO_COBRO)
          .eq("conekta_customer_id", customerId);

        // Conekta reintenta la entrega mientras no reciba 200 — sin este
        // chequeo, cada reintento del mismo cargo duplicaba el registro Y
        // repetía el correo de bienvenida / la conversión de referido.
        let alreadyProcessed = false;
        if (data.last_billing_cycle_order_id) {
          const { data: existingPayment } = await supabase
            .from("payment_history")
            .select("id")
            .eq("conekta_order_id", data.last_billing_cycle_order_id)
            .eq("status", "completed")
            .maybeSingle();
          alreadyProcessed = Boolean(existingPayment);
        }

        // El registro del cobro y la activacion del tenant no dependen entre
        // si: en secuencia solo suman latencia a la respuesta que Conekta esta
        // esperando para dejar de reintentar.
        await Promise.all([
          preSub && !alreadyProcessed
            ? supabase.from("payment_history").insert({
                subscription_id: preSub.id,
                amount:
                  (data.amount || fallbackAmountCents(preSub.billing_period, promoRestantes, nivelDeCobro(preSub))) /
                  100,
                payment_method: "card",
                status: "completed",
                conekta_order_id: data.last_billing_cycle_order_id,
                paid_at: new Date().toISOString(),
              })
            : Promise.resolve(),
          preSub?.tenant_id
            ? supabase
                .from("tenants")
                .update({ subscription_status: "active" })
                .eq("id", preSub.tenant_id)
            : Promise.resolve(),
        ]);

        // El nivel elegido en el checkout se confirma con el cobro real. Fuera de la guarda de
        // `alreadyProcessed` a proposito: si `asignar_nivel` fallo la primera vez, el reenvio del mismo
        // evento lo reintenta (es idempotente: tras confirmarse, `nivel_pendiente` queda en NULL).
        if (preSub) await confirmarNivelPagado(supabase, preSub.tenant_id, preSub.nivel_pendiente);

        let creditoConsumido = false;
        if (preSub && !alreadyProcessed) {
          if (isFirstPayment) {
            // Primer pago real de la cuenta => conversion del referido (si aplica).
            await convertReferralOnFirstPayment(supabase, preSub.tenant_id);
          } else if (data.last_billing_cycle_order_id) {
            // Cobro recurrente real => aplicar mes gratis acumulado.
            creditoConsumido = (
              await consumeFreeMonthCredit(supabase, {
                subscriptionId: preSub.id,
                tenantId: preSub.tenant_id,
                conektaOrderId: data.last_billing_cycle_order_id,
                amountCents:
                  data.amount || fallbackAmountCents(preSub.billing_period, promoRestantes, nivelDeCobro(preSub)),
              })
            ).consumed;
          }

          // Un mes regalado por referido se reembolsa entero: el cliente no
          // pago, asi que no gasta cobro promocional. Gastarselo seria cobrarle
          // dos veces el mismo beneficio.
          await avanzarPromocion(supabase, {
            subscriptionId: preSub.id,
            customerId: preSub.conekta_customer_id,
            conektaSubscriptionId: subscriptionId,
            cobrosRestantes: promoRestantes,
            promoPlan: preSub.promo_plan,
            huboCobroReal: !creditoConsumido,
          });

          // Correo de "Pago confirmado" en cada cobro (primero o recurrente),
          // no solo en el primer pago de la cuenta — así un cambio de plan
          // (ej. mensual a anual) también manda un recibo con el monto real
          // que se acaba de cobrar, en vez de quedarse en silencio.
          //
          // Va en `after()`: el correo no debe retrasar el 200. Antes se
          // esperaba a Resend (3 consultas + getUserById + el envio) antes de
          // responder, asi que un Resend lento hacia que Conekta no recibiera
          // confirmacion y reintentara el evento entero. El envio sigue
          // ocurriendo, solo que despues de contestar.
          const periodo = preSub.billing_period === "yearly" ? "yearly" : "monthly";
          const montoCents =
            data.amount || fallbackAmountCents(preSub.billing_period, promoRestantes, nivelDeCobro(preSub));
          const tenantId = preSub.tenant_id;
          after(async () => {
            await sendWelcomeEmailToOwner(supabase, tenantId, periodo, montoCents);
          });
        }

        break;
      }

      case "subscription.payment_failed": {
        const customerId = data.customer_id;

        await supabase
          .from("subscriptions")
          .update({
            status: "past_due",
            updated_at: new Date().toISOString(),
          })
          .eq("conekta_customer_id", customerId);

        // Desde cuando corren los 3 dias de gracia (migracion 096). Solo el
        // PRIMER fallo del ciclo: Conekta reintenta el cobro y cada reintento
        // fallido reenvia este evento. Aparte y sin comprobar el error, por la
        // misma razon que REINICIO_CICLO_COBRO.
        await supabase
          .from("subscriptions")
          .update({ past_due_desde: new Date().toISOString() })
          .eq("conekta_customer_id", customerId)
          .is("past_due_desde", null);

        const { data: subData } = await supabase
          .from("subscriptions")
          .select("tenant_id")
          .eq("conekta_customer_id", customerId)
          .single();

        if (subData) {
          await supabase
            .from("tenants")
            .update({ subscription_status: "past_due" })
            .eq("id", subData.tenant_id);
        }

        break;
      }

      case "subscription.canceled": {
        const customerId = data.customer_id;

        await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("conekta_customer_id", customerId);

        const { data: cancelData } = await supabase
          .from("subscriptions")
          .select("tenant_id")
          .eq("conekta_customer_id", customerId)
          .single();

        if (cancelData) {
          await supabase
            .from("tenants")
            .update({ subscription_status: "canceled" })
            .eq("id", cancelData.tenant_id);
        }

        break;
      }

      case "order.expired":
      case "order.canceled": {
        // Referencia de pago en efectivo (OXXO/Efectivo Conekta) que venció
        // o se canceló sin pagarse: la fila "pending" creada en
        // create-checkout debe dejar de mostrarse como "pago en proceso".
        await supabase
          .from("payment_history")
          .update({ status: "expired" })
          .eq("conekta_order_id", data.id)
          .eq("status", "pending");

        break;
      }

      case "order.paid": {
        const customerId = data.customer?.id;
        if (!customerId) break;

        const { data: subData } = await supabase
          .from("subscriptions")
          .select(
            "id, tenant_id, last_payment_at, billing_period, promo_cobros_restantes, promo_plan, conekta_subscription_id, promo_codigo_campana, nivel, nivel_pendiente"
          )
          .eq("conekta_customer_id", customerId)
          .single();

        if (subData) {
          // Al enum de la base: con tarjeta Conekta manda "credit"/"debit", y un
          // tipo desconocido haria fallar el registro del pago.
          const paidMethod = metodoDePagoConekta(
            data.charges?.data?.[0]?.payment_method?.type
          );

          // create-checkout ya insertó una fila "pending" con este mismo
          // conekta_order_id al generar la orden; se actualiza en vez de
          // duplicar. Si no existe (p.ej. suscripción recurrente sin paso
          // por create-checkout), se inserta.
          const { data: updatedPayment } = await supabase
            .from("payment_history")
            .update({
              status: "completed",
              payment_method: paidMethod,
              amount: (data.amount || 0) / 100,
              paid_at: new Date().toISOString(),
            })
            .eq("conekta_order_id", data.id)
            .select("id");

          if (!updatedPayment || updatedPayment.length === 0) {
            await supabase.from("payment_history").insert({
              subscription_id: subData.id,
              amount: (data.amount || 0) / 100,
              payment_method: paidMethod,
              status: "completed",
              conekta_order_id: data.id,
              paid_at: new Date().toISOString(),
            });
          }

          const metadata = (data.metadata || {}) as Record<string, unknown>;
          const isPromoMeta99 =
            metadata.promo_campana === PROMO_META_99.codigo ||
            subData.promo_codigo_campana === PROMO_META_99.codigo;

          const now = new Date();
          let periodEnd = new Date(now);
          if (isPromoMeta99) {
            periodEnd = new Date(PROMO_META_99.finPeriodoAcceso);
          } else if (subData.billing_period === "yearly") {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          } else {
            periodEnd.setMonth(periodEnd.getMonth() + 1);
          }

          const subscriptionUpdates: Record<string, unknown> = {
            status: "active",
            last_payment_at: now.toISOString(),
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            updated_at: now.toISOString(),
          };
          if (isPromoMeta99) {
            subscriptionUpdates.promo_codigo_campana = PROMO_META_99.codigo;
          }

          // Dos tablas distintas, sin dependencia entre ellas: en paralelo.
          await Promise.all([
            supabase
              .from("subscriptions")
              .update(subscriptionUpdates)
              .eq("id", subData.id),
            supabase
              .from("tenants")
              .update({ subscription_status: "active" })
              .eq("id", subData.tenant_id),
          ]);
          await supabase
            .from("subscriptions")
            .update(REINICIO_CICLO_COBRO)
            .eq("id", subData.id);

          // El checkout hosted es el pago real del flujo: el primer pago
          // dispara la conversion del referido y el email de bienvenida;
          // los pagos siguientes consumen un mes gratis acumulado (si aplica).
          let creditoOrden = false;
          if (!subData.last_payment_at) {
            await convertReferralOnFirstPayment(supabase, subData.tenant_id);
            // Fuera de la ruta critica: ver la nota en subscription.paid.
            const periodoOrden =
              subData.billing_period === "yearly" ? "yearly" : "monthly";
            const montoOrden =
              data.amount ||
              fallbackAmountCents(
                subData.billing_period,
                subData.promo_cobros_restantes ?? 0,
                nivelDeCobro(subData)
              );
            const tenantOrden = subData.tenant_id;
            after(async () => {
              await sendWelcomeEmailToOwner(
                supabase,
                tenantOrden,
                periodoOrden,
                montoOrden
              );
            });
            creditoOrden = false;
          } else {
            creditoOrden = (
              await consumeFreeMonthCredit(supabase, {
                subscriptionId: subData.id,
                tenantId: subData.tenant_id,
                conektaOrderId: data.id,
                amountCents:
                  data.amount ||
                  fallbackAmountCents(
                    subData.billing_period,
                    subData.promo_cobros_restantes ?? 0,
                    nivelDeCobro(subData)
                  ),
              })
            ).consumed;
          }

          // El nivel elegido en el checkout se confirma con el cobro real (tambien en efectivo/SPEI).
          await confirmarNivelPagado(supabase, subData.tenant_id, subData.nivel_pendiente);

          // Efectivo tambien consume promocion: son tres fichas de $199 y la
          // cuarta ya sale a $399. Sin esto, quien paga en OXXO se quedaria con
          // el precio promocional indefinidamente.
          await avanzarPromocion(supabase, {
            subscriptionId: subData.id,
            customerId,
            conektaSubscriptionId: subData.conekta_subscription_id,
            cobrosRestantes: subData.promo_cobros_restantes ?? 0,
            promoPlan: subData.promo_plan,
            huboCobroReal: !creditoOrden,
          });
        }

        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}