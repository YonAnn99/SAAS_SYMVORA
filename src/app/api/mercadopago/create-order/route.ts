import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { requireTenantAccess, tienePermisoEfectivo } from "@/lib/supabase/auth";
import { TOPE_DESCUENTO_CAJERO_PCT } from "@/features/pos/descuento-ticket";
import { assertNotDemo } from "@/lib/supabase/demo-guard";
import { createOrder } from "@/features/payments/services/mercadopago/orders";
import {
  getMercadoPagoPointConfig,
  readMercadoPagoSecrets,
  isMercadoPagoReady,
} from "@/features/payments/services/mercadopago/secrets";
import {
  computeTerminalOrderTotal,
  type TerminalOrderItem,
} from "@/features/payments/services/mercadopago/order-amount";

// Presupuesto de ejecucion explicito. Sin el, una llamada lenta a un tercero
// deja la funcion ocupada hasta el tope por defecto de la plataforma.
export const maxDuration = 30;

export const dynamic = "force-dynamic";

interface CreateOrderRequest {
  tenant_id: string;
  cliente_id?: string | null;
  items: TerminalOrderItem[];
  lista_precio_id?: string | null;
  /**
   * El "Incluir IVA" del carrito. Una pestaña con el codigo anterior no lo
   * manda: se cobra con IVA, como se hacia antes.
   */
  include_iva?: boolean;
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

    const demo = await assertNotDemo();
    if (!demo.ok) return demo.response;

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

    const includeIva = body.include_iva ?? true;

    // Tope del descuento manual (migracion 094). En el cobro con terminal se
    // valida AQUI, al cotizar, y no al confirmar el pago:
    // `confirm_terminal_payment` corre sin sesion, y rechazar ahi dejaria
    // cobrado en la terminal algo sin venta.
    const sinTope = await tienePermisoEfectivo(
      auth.userId,
      auth.role,
      "sales.discount_unlimited",
      body.tenant_id
    );

    // Cotiza con la misma funcion que registra la venta (migracion 127): el
    // monto de la terminal es el total del carrito, con variantes, sucursal
    // e IVA. Un error (stock insuficiente, tope de descuento) se le muestra al
    // cajero tal cual y no se crea la orden en Mercado Pago.
    let computed;
    try {
      computed = await computeTerminalOrderTotal({
        tenantId: body.tenant_id,
        usuarioId: auth.userId,
        clienteId: body.cliente_id ?? null,
        items: body.items,
        includeIva,
        listaPrecioId: body.lista_precio_id ?? null,
        topeDescuentoPct: sinTope ? null : TOPE_DESCUENTO_CAJERO_PCT,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "No se pudo calcular el cobro" },
        { status: 400 }
      );
    }

    if (!(computed.total > 0)) {
      return NextResponse.json(
        { error: "El total a cobrar debe ser mayor a $0" },
        { status: 400 }
      );
    }

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
        // Viaja con el pago para que `confirm_terminal_payment` cree la
        // venta con la MISMA lista con la que se calculo el monto cobrado.
        lista_precio_id: body.lista_precio_id ?? null,
        // Con el que se cotizo: la venta se registra igual (migracion 127).
        include_iva: includeIva,
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