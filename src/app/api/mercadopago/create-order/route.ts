import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { createOrder } from "@/lib/mercadopago/orders";
import {
  getMercadoPagoPointConfig,
  readMercadoPagoSecrets,
  isMercadoPagoReady,
} from "@/lib/mercadopago/secrets";
import {
  computeTerminalOrderTotal,
  type TerminalOrderItem,
} from "@/lib/mercadopago/order-amount";

export const dynamic = "force-dynamic";

interface CreateOrderRequest {
  tenant_id: string;
  cliente_id?: string | null;
  items: TerminalOrderItem[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateOrderRequest;

    if (!body.tenant_id) {
      return NextResponse.json(
        { error: "tenant_id requerido" },
        { status: 400 }
      );
    }

    const auth = await requireTenantAccess(request, {
      tenantId: body.tenant_id,
      permission: "sales.create",
    });
    if (!auth.ok) return auth.response;

    const config = await getMercadoPagoPointConfig(body.tenant_id);
    const secrets = await readMercadoPagoSecrets(body.tenant_id, config);

    if (!isMercadoPagoReady(config) || !secrets.accessToken) {
      return NextResponse.json(
        {
          error:
            "Mercado Pago Point no está configurado. Configúralo en Ajustes → Métodos de pago.",
        },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceRoleClient();

    if (body.cliente_id) {
      const { data: cliente } = await supabase
        .from("clientes")
        .select("id")
        .eq("id", body.cliente_id)
        .eq("tenant_id", body.tenant_id)
        .single();
      if (!cliente) {
        return NextResponse.json(
          { error: "Cliente inválido para este negocio" },
          { status: 400 }
        );
      }
    }

    const computed = await computeTerminalOrderTotal(
      body.tenant_id,
      body.items
    );

    const externalReference = crypto.randomUUID();

    const { data: pago, error: insertError } = await supabase
      .from("pagos_terminal")
      .insert({
        tenant_id: body.tenant_id,
        usuario_id: auth.userId,
        cliente_id: body.cliente_id ?? null,
        external_reference: externalReference,
        monto: computed.total,
        estado: "CREADA",
        payload_items: computed.payload,
      })
      .select()
      .single();

    if (insertError || !pago) {
      console.error("Error insertando pago_terminal:", insertError);
      return NextResponse.json(
        { error: "No se pudo iniciar el cobro" },
        { status: 500 }
      );
    }

    let order;
    try {
      order = await createOrder({
        accessToken: secrets.accessToken,
        terminalId: config.terminal_id,
        amount: computed.total,
        externalReference,
        description: `Venta SYMVORA ${pago.id.slice(0, 8)}`,
        idempotencyKey: pago.id,
      });
    } catch (error) {
      // Si falla la creacion en MP, limpiar el intento
      await supabase.from("pagos_terminal").delete().eq("id", pago.id);
      throw error;
    }

    await supabase
      .from("pagos_terminal")
      .update({
        mp_order_id: order.id,
        estado: "ESPERANDO_PAGO",
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", pago.id);

    return NextResponse.json({
      success: true,
      mp_order_id: order.id,
      monto: computed.total,
    });
  } catch (error) {
    console.error("Create Mercado Pago order error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Error al iniciar el cobro con terminal";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}