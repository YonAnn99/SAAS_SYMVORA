import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  getDefaultClaveUnidad,
  getMetodoPagoByVenta,
  getMetodoPagoCFDI,
} from "@/lib/cfdi/catalogs";

interface CreateFacturaRequest {
  tenant_id: string;
  cliente_id: string;
  venta_id?: string;
  forma_pago?: string;
  metodo_pago?: "PUE" | "PPD";
  notas?: string;
  lineas: Array<{
    producto_id?: string;
    descripcion: string;
    clave_prod_serv: string;
    clave_unidad?: string;
    unidad?: string;
    cantidad: number;
    precio_unitario: number;
    descuento?: number;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateFacturaRequest = await request.json();
    const supabase = createSupabaseServiceRoleClient();

    // Get tenant fiscal config
    const { data: settings } = await supabase
      .from("tenant_settings")
      .select("configuracion_fiscal, configuracion_json")
      .eq("tenant_id", body.tenant_id)
      .single();

    const fiscalConfig = settings?.configuracion_fiscal as Record<string, string> | null;
    if (!fiscalConfig?.pac_usuario) {
      return NextResponse.json(
        { error: "Configuración fiscal no completada. Configura tu RFC y datos fiscales." },
        { status: 400 }
      );
    }

    // Get tenant data (emisor)
    const { data: tenant } = await supabase
      .from("tenants")
      .select("rfc, razon_social, regimen_fiscal, codigo_postal")
      .eq("id", body.tenant_id)
      .single();

    if (!tenant?.rfc) {
      return NextResponse.json(
        { error: "El tenant no tiene RFC registrado. Configura los datos fiscales." },
        { status: 400 }
      );
    }

    // Get client data (receptor)
    const { data: cliente } = await supabase
      .from("clientes")
      .select("rfc, razon_social, regimen_fiscal_receptor, uso_cfdi, codigo_postal")
      .eq("id", body.cliente_id)
      .single();

    if (!cliente?.rfc) {
      return NextResponse.json(
        { error: "El cliente no tiene RFC registrado. Es necesario para facturar." },
        { status: 400 }
      );
    }

    // Get next folio
    const { data: folioData } = await supabase.rpc("get_next_folio", {
      p_tenant_id: body.tenant_id,
      p_serie: fiscalConfig.cfdi_serie || "A",
    });

    const folio = folioData as number;
    if (!folio) {
      return NextResponse.json(
        { error: "Error al generar folio" },
        { status: 500 }
      );
    }

    // Calculate totals
    let subtotal = 0;
    let descuentoTotal = 0;
    let impuestoTotal = 0;

    const lineasConImpuesto = body.lineas.map((linea, index) => {
      const descuento = linea.descuento || 0;
      const subtotalLinea = linea.cantidad * linea.precio_unitario;
      const baseImpuesto = subtotalLinea - descuento;
      const impuestoLinea = baseImpuesto * 0.16;

      subtotal += subtotalLinea;
      descuentoTotal += descuento;
      impuestoTotal += impuestoLinea;

      return {
        ...linea,
        orden: index + 1,
        subtotal: subtotalLinea,
        descuento,
        base_impuesto: baseImpuesto,
        tasa_impuesto: 0.16,
        importe_impuesto: impuestoLinea,
        unidad: linea.unidad || "Servicio",
        clave_unidad: linea.clave_unidad || "E48",
      };
    });

    const total = subtotal - descuentoTotal + impuestoTotal;

    // Determine payment method
    let formaPago = body.forma_pago || fiscalConfig.cfdi_forma_pago_default || "01";
    let metodoPagoCFDI = body.metodo_pago || "PUE";

    if (body.venta_id) {
      const { data: venta } = await supabase
        .from("ventas")
        .select("metodo_pago")
        .eq("id", body.venta_id)
        .single();

      if (venta) {
        formaPago = getMetodoPagoByVenta(venta.metodo_pago);
        metodoPagoCFDI = getMetodoPagoCFDI(venta.metodo_pago);
      }
    }

    // Insert factura
    const { data: factura, error: facturaError } = await supabase
      .from("facturas")
      .insert({
        tenant_id: body.tenant_id,
        serie: fiscalConfig.cfdi_serie || "A",
        folio,
        emisor_rfc: tenant.rfc,
        emisor_razon_social: tenant.razon_social || tenant.rfc,
        emisor_regimen_fiscal: tenant.regimen_fiscal || "601",
        emisor_codigo_postal: tenant.codigo_postal || "00000",
        receptor_rfc: cliente.rfc,
        receptor_razon_social: cliente.razon_social || cliente.rfc,
        receptor_regimen_fiscal: cliente.regimen_fiscal_receptor || "612",
        receptor_uso_cfdi: cliente.uso_cfdi || "G03",
        receptor_codigo_postal: cliente.codigo_postal || "00000",
        subtotal,
        impuesto: impuestoTotal,
        descuento: descuentoTotal,
        total,
        metodo_pago: metodoPagoCFDI,
        forma_pago: formaPago,
        estado: "BORRADOR",
        venta_id: body.venta_id || null,
      })
      .select()
      .single();

    if (facturaError) {
      console.error("Error creating factura:", facturaError);
      return NextResponse.json(
        { error: "Error al crear la factura" },
        { status: 500 }
      );
    }

    // Insert detail lines
    const detalleInsert = lineasConImpuesto.map((linea) => ({
      factura_id: factura.id,
      producto_id: linea.producto_id || null,
      descripcion: linea.descripcion,
      clave_prod_serv: linea.clave_prod_serv,
      clave_unidad: linea.clave_unidad,
      no_identificacion: linea.producto_id || null,
      cantidad: linea.cantidad,
      unidad: linea.unidad,
      precio_unitario: linea.precio_unitario,
      descuento: linea.descuento,
      subtotal: linea.subtotal,
      base_impuesto: linea.base_impuesto,
      tasa_impuesto: linea.tasa_impuesto,
      importe_impuesto: linea.importe_impuesto,
      orden: linea.orden,
    }));

    const { error: detalleError } = await supabase
      .from("factura_detalle")
      .insert(detalleInsert);

    if (detalleError) {
      console.error("Error creating factura detalle:", detalleError);
      // Try to cleanup the factura
      await supabase.from("facturas").delete().eq("id", factura.id);
      return NextResponse.json(
        { error: "Error al crear el detalle de la factura" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      factura: {
        ...factura,
        linea_count: lineasConImpuesto.length,
      },
    });
  } catch (error) {
    console.error("Create factura error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
