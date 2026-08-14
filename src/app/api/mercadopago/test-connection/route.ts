import { NextRequest, NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";
import {
  getMercadoPagoPointConfig,
  readMercadoPagoSecrets,
} from "@/lib/mercadopago/secrets";
import {
  listTerminals,
  setTerminalOperatingMode,
  type MpTerminal,
} from "@/lib/mercadopago/orders";

export const dynamic = "force-dynamic";

interface TestConnectionRequest {
  tenant_id: string;
  terminal_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TestConnectionRequest;

    if (!body.tenant_id) {
      return NextResponse.json(
        { error: "tenant_id requerido" },
        { status: 400 }
      );
    }

    const auth = await requireTenantAccess(request, {
      tenantId: body.tenant_id,
      permission: "billing.config",
    });
    if (!auth.ok) return auth.response;

    const demo = await assertNotDemo();
    if (!demo.ok) return demo.response;

    const config = await getMercadoPagoPointConfig(body.tenant_id);
    const secrets = await readMercadoPagoSecrets(body.tenant_id, config);

    if (!secrets.accessToken) {
      return NextResponse.json(
        { error: "Primero guarda el Access Token" },
        { status: 400 }
      );
    }

    const terminals: MpTerminal[] = await listTerminals(secrets.accessToken);

    let activatedTerminalId = config.terminal_id;

    // Si el usuario manda un terminal_id, se valida que exista y se pone en modo PDV
    if (body.terminal_id) {
      const exists = terminals.some((terminal) => terminal.id === body.terminal_id);
      if (!exists) {
        return NextResponse.json(
          { error: "La terminal seleccionada no existe en tu cuenta de Mercado Pago" },
          { status: 400 }
        );
      }
      await setTerminalOperatingMode(secrets.accessToken, body.terminal_id, "PDV");
      activatedTerminalId = body.terminal_id;
    }

    return NextResponse.json({
      success: true,
      terminals: terminals.map((terminal) => ({
        id: terminal.id,
        operating_mode: terminal.operating_mode ?? "",
        description: terminal.description ?? terminal.model ?? "",
      })),
      terminal_id: activatedTerminalId,
    });
  } catch (error) {
    console.error("Test connection Mercado Pago error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo conectar con Mercado Pago";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}