import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  TenantConfiguracionFiscal,
} from "@/lib/types/database";
import { tenantFiscalConfigSchema } from "@/lib/validations/schemas";
import { saveFiscalSecret } from "@/lib/fiscal-secrets";
import {
  createPACClient,
  generateCFDIXML,
  generateFacturaPDF,
  generateSealedCFDIXML,
  getMetodoPagoByVenta,
  getMetodoPagoCFDI,
} from "../index";
import { readFiscalSecrets, requiresSecrets } from "@/lib/fiscal-secrets";

type Db = SupabaseClient;

export class FacturacionError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = "FacturacionError";
  }
}

export interface CreateFacturaInput {
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

export async function createFactura(db: Db, input: CreateFacturaInput) {
  if (!input.tenant_id) {
    throw new FacturacionError("tenant_id requerido");
  }

  const { data: settings } = await db
    .from("tenant_settings")
    .select("configuracion_fiscal, configuracion_json")
    .eq("tenant_id", input.tenant_id)
    .single();

  const fiscalConfig = settings?.configuracion_fiscal as
    | Record<string, string>
    | null;
  if (!fiscalConfig?.pac_usuario) {
    throw new FacturacionError(
      "Configuración fiscal no completada. Configura tu RFC y datos fiscales."
    );
  }

  const { data: tenant } = await db
    .from("tenants")
    .select("rfc, razon_social, regimen_fiscal, codigo_postal")
    .eq("id", input.tenant_id)
    .single();

  if (!tenant?.rfc) {
    throw new FacturacionError(
      "El tenant no tiene RFC registrado. Configura los datos fiscales."
    );
  }

  const { data: cliente } = await db
    .from("clientes")
    .select("rfc, razon_social, regimen_fiscal_receptor, uso_cfdi, codigo_postal")
    .eq("id", input.cliente_id)
    .eq("tenant_id", input.tenant_id)
    .single();

  if (!cliente?.rfc) {
    throw new FacturacionError(
      "El cliente no tiene RFC registrado. Es necesario para facturar."
    );
  }

  const { data: folioData } = await db.rpc("get_next_folio", {
    p_tenant_id: input.tenant_id,
    p_serie: fiscalConfig.cfdi_serie || "A",
  });

  const folio = folioData as number;
  if (!folio) {
    throw new FacturacionError("Error al generar folio", 500);
  }

  let subtotal = 0;
  let descuentoTotal = 0;
  let impuestoTotal = 0;

  const lineasConImpuesto = input.lineas.map((linea, index) => {
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

  let formaPago = input.forma_pago || fiscalConfig.cfdi_forma_pago_default || "01";
  let metodoPagoCFDI = input.metodo_pago || "PUE";

  if (input.venta_id) {
    const { data: venta } = await db
      .from("ventas")
      .select("metodo_pago")
      .eq("id", input.venta_id)
      .eq("tenant_id", input.tenant_id)
      .single();

    if (venta) {
      formaPago = getMetodoPagoByVenta(venta.metodo_pago);
      metodoPagoCFDI = getMetodoPagoCFDI(venta.metodo_pago);
    }
  }

  const { data: factura, error: facturaError } = await db
    .from("facturas")
    .insert({
      tenant_id: input.tenant_id,
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
      venta_id: input.venta_id || null,
    })
    .select()
    .single();

  if (facturaError) {
    console.error("Error creating factura:", facturaError);
    throw new FacturacionError("Error al crear la factura", 500);
  }

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

  const { error: detalleError } = await db
    .from("factura_detalle")
    .insert(detalleInsert);

  if (detalleError) {
    console.error("Error creating factura detalle:", detalleError);
    await db.from("facturas").delete().eq("id", factura.id);
    throw new FacturacionError("Error al crear el detalle de la factura", 500);
  }

  return {
    ...factura,
    linea_count: lineasConImpuesto.length,
  };
}

export async function stampFactura(db: Db, facturaId: string) {
  const { data: factura, error: facturaError } = await db
    .from("facturas")
    .select("*")
    .eq("id", facturaId)
    .single();

  if (facturaError || !factura) {
    throw new FacturacionError("Factura no encontrada", 404);
  }

  if (factura.estado !== "BORRADOR") {
    throw new FacturacionError(
      "Solo se pueden timbrar facturas en estado BORRADOR"
    );
  }

  const { data: detalle, error: detalleError } = await db
    .from("factura_detalle")
    .select("*")
    .eq("factura_id", facturaId)
    .order("orden");

  if (detalleError || !detalle || detalle.length === 0) {
    throw new FacturacionError("La factura no tiene conceptos");
  }

  const { data: settings } = await db
    .from("tenant_settings")
    .select("configuracion_fiscal")
    .eq("tenant_id", factura.tenant_id)
    .single();

  const fiscalConfig = settings?.configuracion_fiscal as
    | TenantConfiguracionFiscal
    | null;
  if (!fiscalConfig?.pac_usuario) {
    throw new FacturacionError("Configuración PAC no encontrada");
  }

  const secrets = await readFiscalSecrets(db, factura.tenant_id, fiscalConfig);
  requiresSecrets(
    secrets,
    ["pac_password", "certificado_cer", "certificado_key", "certificado_password"],
    "Configuración PAC incompleta"
  );

  const sealed = await generateSealedCFDIXML(factura, detalle, {
    certificadoCer: secrets.certificado_cer,
    certificadoKey: secrets.certificado_key,
    certificadoPassword: secrets.certificado_password,
  });

  const pacClient = createPACClient(fiscalConfig, secrets);

  let result;
  try {
    result = await pacClient.stamp(sealed.xml);
  } catch (pacError) {
    console.error("PAC stamp error:", pacError);
    throw new FacturacionError(
      `Error al timbrar: ${pacError instanceof Error ? pacError.message : "Error desconocido del PAC"}`,
      500
    );
  }

  const { error: updateError } = await db
    .from("facturas")
    .update({
      estado: "TIMBRADA",
      uuid_cfdi: result.uuid,
      fecha_timbrado: new Date().toISOString(),
      pac_nombre: fiscalConfig.pac_proveedor,
      pac_response: result.rawResponse as Record<string, unknown>,
      xml_timbrado: result.xml || sealed.xml,
      xml_url: `/api/facturas/${facturaId}/xml`,
      pdf_url: `/api/facturas/${facturaId}/pdf`,
    })
    .eq("id", facturaId);

  if (updateError) {
    console.error("Error updating factura:", updateError);
    throw new FacturacionError("Error al actualizar la factura", 500);
  }

  return {
    uuid: result.uuid,
    message: "Factura timbrada correctamente",
  };
}

export interface CancelFacturaInput {
  factura_id: string;
  motivo: string;
  folio_sustitucion?: string;
}

export async function cancelFactura(db: Db, input: CancelFacturaInput) {
  const { data: factura, error: facturaError } = await db
    .from("facturas")
    .select("*")
    .eq("id", input.factura_id)
    .single();

  if (facturaError || !factura) {
    throw new FacturacionError("Factura no encontrada", 404);
  }

  if (factura.estado !== "TIMBRADA") {
    throw new FacturacionError("Solo se pueden cancelar facturas timbradas");
  }

  if (!factura.uuid_cfdi) {
    throw new FacturacionError("La factura no tiene UUID de timbrado");
  }

  const { data: settings } = await db
    .from("tenant_settings")
    .select("configuracion_fiscal")
    .eq("tenant_id", factura.tenant_id)
    .single();

  const fiscalConfig = settings?.configuracion_fiscal as
    | TenantConfiguracionFiscal
    | null;
  if (!fiscalConfig?.pac_usuario) {
    throw new FacturacionError("Configuración PAC no encontrada");
  }

  const secrets = await readFiscalSecrets(db, factura.tenant_id, fiscalConfig);
  requiresSecrets(
    secrets,
    ["pac_password", "certificado_cer", "certificado_key"],
    "Configuración PAC incompleta para cancelación"
  );

  const pacClient = createPACClient(fiscalConfig, secrets);

  let result;
  try {
    result = await pacClient.cancel({
      uuid: factura.uuid_cfdi,
      rfcEmisor: factura.emisor_rfc,
      rfcReceptor: factura.receptor_rfc,
      total: factura.total.toFixed(2),
      motivo: input.motivo,
      folioSustitucion: input.folio_sustitucion,
    });
  } catch (pacError) {
    console.error("PAC cancel error:", pacError);
    throw new FacturacionError(
      `Error al cancelar: ${pacError instanceof Error ? pacError.message : "Error desconocido del PAC"}`,
      500
    );
  }

  const { error: updateError } = await db
    .from("facturas")
    .update({
      estado: "CANCELADA",
      fecha_cancelacion: new Date().toISOString(),
      motivo_cancelacion: input.motivo,
      folio_sustitucion: input.folio_sustitucion || null,
      pac_response: result.rawResponse as Record<string, unknown>,
    })
    .eq("id", input.factura_id);

  if (updateError) {
    console.error("Error updating factura:", updateError);
    throw new FacturacionError("Error al actualizar la factura", 500);
  }

  await db.from("facturas_cancelaciones").insert({
    factura_id: input.factura_id,
    motivo: input.motivo,
    folio_sustitucion: input.folio_sustitucion || null,
    fecha_respuesta: new Date().toISOString(),
    estado: result.accepted ? "ACEPTADA" : "RECHAZADA",
    pac_response: result.rawResponse as Record<string, unknown>,
  });

  return {
    accepted: result.accepted,
    message: result.accepted
      ? "Factura cancelada correctamente"
      : "Solicitud de cancelación enviada",
  };
}

export interface ListFacturasParams {
  tenant_id: string;
  estado?: string;
  page?: number;
  limit?: number;
}

export async function listFacturas(
  db: Db,
  params: ListFacturasParams
): Promise<{
  facturas: unknown[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  if (!params.tenant_id) {
    throw new FacturacionError("tenant_id requerido");
  }

  const page = params.page || 1;
  const limit = params.limit || 20;

  let query = db
    .from("facturas")
    .select("*, clientes(nombre, rfc)", { count: "exact" })
    .eq("tenant_id", params.tenant_id)
    .order("created_at", { ascending: false });

  if (params.estado) {
    query = query.eq("estado", params.estado);
  }

  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error listing facturas:", error);
    throw new FacturacionError("Error al listar facturas", 500);
  }

  return {
    facturas: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

export async function getFiscalConfig(
  db: Db,
  userId: string
): Promise<{
  tenant_id: string;
  emisor: {
    rfc: string;
    razon_social: string;
    regimen_fiscal: string;
    codigo_postal: string;
  };
  configuracion_fiscal: TenantConfiguracionFiscal | null;
  secrets_set: Record<string, boolean>;
}> {
  const { data: membership } = await db
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (!membership) {
    throw new FacturacionError(
      "No se encontró un tenant para el usuario",
      404
    );
  }

  const [{ data: tenant }, { data: settings }] = await Promise.all([
    db
      .from("tenants")
      .select("id, rfc, razon_social, regimen_fiscal, codigo_postal")
      .eq("id", membership.tenant_id)
      .single(),
    db
      .from("tenant_settings")
      .select("configuracion_fiscal")
      .eq("tenant_id", membership.tenant_id)
      .single(),
  ]);

  const fiscalConfig = settings?.configuracion_fiscal as
    | TenantConfiguracionFiscal
    | null;

  return {
    tenant_id: membership.tenant_id,
    emisor: {
      rfc: tenant?.rfc ?? "",
      razon_social: tenant?.razon_social ?? "",
      regimen_fiscal: tenant?.regimen_fiscal ?? "",
      codigo_postal: tenant?.codigo_postal ?? "",
    },
    configuracion_fiscal: sanitizeConfig(fiscalConfig),
    secrets_set: secretsSet(fiscalConfig),
  };
}

const PAC_PROVEEDORES = ["finkok", "swsapien", "mascarilla"] as const;

const NON_SECRET_FIELDS: (keyof TenantConfiguracionFiscal)[] = [
  "cfdi_serie",
  "cfdi_metodo_pago",
  "cfdi_forma_pago_default",
  "pac_proveedor",
  "pac_usuario",
  "email_envio_facturas",
];

const SECRET_FIELDS = {
  pac_password: "pac_password_id",
  certificado_cer: "certificado_cer_id",
  certificado_key: "certificado_key_id",
  certificado_password: "certificado_password_id",
} as const;

export interface SaveFiscalConfigInput {
  tenant_id: string;
  emisor?: {
    rfc?: string;
    razon_social?: string;
    regimen_fiscal?: string;
    codigo_postal?: string;
  };
  configuracion_fiscal?: {
    cfdi_serie?: string;
    cfdi_metodo_pago?: string;
    cfdi_forma_pago_default?: string;
    pac_proveedor?: string;
    pac_usuario?: string;
    email_envio_facturas?: string;
  };
  secrets?: {
    pac_password?: string;
    certificado_cer?: string;
    certificado_key?: string;
    certificado_password?: string;
  };
}

export async function saveFiscalConfig(db: Db, input: SaveFiscalConfigInput) {
  if (!input.tenant_id) {
    throw new FacturacionError("tenant_id requerido");
  }

  const emisor = input.emisor ?? {};

  const validation = tenantFiscalConfigSchema.safeParse(emisor);
  if (!validation.success) {
    const firstIssue = validation.error.issues[0];
    throw new FacturacionError(
      firstIssue?.message ?? "Configuración fiscal inválida"
    );
  }

  const pacProveedor = input.configuracion_fiscal?.pac_proveedor;
  if (
    pacProveedor &&
    !PAC_PROVEEDORES.includes(pacProveedor as (typeof PAC_PROVEEDORES)[number])
  ) {
    throw new FacturacionError("Proveedor PAC inválido");
  }

  const { data: currentSettings } = await db
    .from("tenant_settings")
    .select("configuracion_fiscal")
    .eq("tenant_id", input.tenant_id)
    .single();

  const currentConfig = sanitizeConfig(
    currentSettings?.configuracion_fiscal as TenantConfiguracionFiscal | null
  ) ?? {
    cfdi_serie: "A",
    cfdi_metodo_pago: "PUE",
    cfdi_forma_pago_default: "01",
    pac_proveedor: "finkok",
    pac_usuario: "",
    pac_password_id: "",
    certificado_cer_id: "",
    certificado_key_id: "",
    certificado_password_id: "",
    email_envio_facturas: "",
  };

  const incoming = input.configuracion_fiscal ?? {};
  const mergedConfig: TenantConfiguracionFiscal = {
    ...currentConfig,
    ...NON_SECRET_FIELDS.reduce((acc, field) => {
      if (field in incoming) {
        (acc as Record<string, unknown>)[field] = (incoming as Record<string, unknown>)[field];
      }
      return acc;
    }, {} as Partial<TenantConfiguracionFiscal>),
  };

  const secrets = input.secrets ?? {};
  for (const [field, idField] of Object.entries(SECRET_FIELDS)) {
    const valor = (secrets as Record<string, string>)[field];
    if (valor && valor.trim().length > 0) {
      const secretId = await saveFiscalSecret(
        db,
        input.tenant_id,
        field,
        valor
      );
      (mergedConfig as unknown as Record<string, string>)[idField] = secretId;
    }
  }

  const [tenantResult, settingsResult] = await Promise.all([
    db
      .from("tenants")
      .update({
        rfc: validation.data.rfc,
        razon_social: validation.data.razon_social,
        regimen_fiscal: validation.data.regimen_fiscal,
        codigo_postal: validation.data.codigo_postal,
      })
      .eq("id", input.tenant_id),
    db
      .from("tenant_settings")
      .update({ configuracion_fiscal: mergedConfig })
      .eq("tenant_id", input.tenant_id),
  ]);

  if (tenantResult.error) {
    console.error("Error updating tenant fiscal data:", tenantResult.error);
    throw new FacturacionError("Error al actualizar los datos fiscales", 500);
  }

  if (settingsResult.error) {
    console.error(
      "Error updating configuracion_fiscal:",
      settingsResult.error
    );
    throw new FacturacionError(
      "Error al actualizar la configuración PAC",
      500
    );
  }

  return { message: "Configuración fiscal guardada correctamente" };
}

export async function getFacturaXml(db: Db, id: string) {
  const { data: factura, error: facturaError } = await db
    .from("facturas")
    .select("*")
    .eq("id", id)
    .single();

  if (facturaError || !factura) {
    throw new FacturacionError("Factura no encontrada", 404);
  }

  let xml = factura.xml_timbrado;

  if (!xml) {
    const { data: detalle, error: detalleError } = await db
      .from("factura_detalle")
      .select("*")
      .eq("factura_id", id)
      .order("orden");

    if (detalleError || !detalle) {
      throw new FacturacionError(
        "No se encontraron los conceptos de la factura",
        404
      );
    }

    xml = generateCFDIXML(factura, detalle);
  }

  return { xml, factura };
}

export async function getFacturaPdf(db: Db, id: string) {
  const { data: factura, error: facturaError } = await db
    .from("facturas")
    .select("*")
    .eq("id", id)
    .single();

  if (facturaError || !factura) {
    throw new FacturacionError("Factura no encontrada", 404);
  }

  const { data: detalle, error: detalleError } = await db
    .from("factura_detalle")
    .select("*")
    .eq("factura_id", id)
    .order("orden");

  if (detalleError || !detalle) {
    throw new FacturacionError(
      "No se encontraron los conceptos de la factura",
      404
    );
  }

  const pdf = generateFacturaPDF(factura, detalle);

  return { pdf, factura };
}

function sanitizeConfig(
  config: TenantConfiguracionFiscal | null | undefined
): TenantConfiguracionFiscal | null {
  if (!config) return null;

  return {
    cfdi_serie: config.cfdi_serie ?? "A",
    cfdi_metodo_pago: config.cfdi_metodo_pago ?? "PUE",
    cfdi_forma_pago_default: config.cfdi_forma_pago_default ?? "01",
    pac_proveedor: config.pac_proveedor ?? "finkok",
    pac_usuario: config.pac_usuario ?? "",
    pac_password_id: config.pac_password_id ?? "",
    certificado_cer_id: config.certificado_cer_id ?? "",
    certificado_key_id: config.certificado_key_id ?? "",
    certificado_password_id: config.certificado_password_id ?? "",
    email_envio_facturas: config.email_envio_facturas ?? "",
  };
}

function secretsSet(config: TenantConfiguracionFiscal | null | undefined) {
  return {
    pac_password: Boolean(config?.pac_password_id),
    certificado_cer: Boolean(config?.certificado_cer_id),
    certificado_key: Boolean(config?.certificado_key_id),
    certificado_password: Boolean(config?.certificado_password_id),
  };
}