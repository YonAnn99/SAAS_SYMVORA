import soap from "soap";
import type { TenantConfiguracionFiscal } from "@/lib/types/database";

export interface PACStampResult {
  uuid: string;
  xml: string;
  rawResponse: unknown;
}

export interface PACCancelResult {
  accepted: boolean;
  rawResponse: unknown;
}

export interface CancelParams {
  uuid: string;
  rfcEmisor: string;
  rfcReceptor: string;
  total: string;
  motivo: string;
  folioSustitucion?: string;
}

export interface ResolvedFiscalSecrets {
  pac_password: string;
  certificado_cer: string;
  certificado_key: string;
  certificado_password: string;
}

export interface PACClient {
  stamp(xml: string): Promise<PACStampResult>;
  cancel(params: CancelParams): Promise<PACCancelResult>;
}

export function isPACTestsEnabled(): boolean {
  return process.env.PAC_TEST_MODE === "true";
}

function resolveIsTest(isTest?: boolean): boolean {
  if (isTest !== undefined) return isTest;
  return isPACTestsEnabled();
}

const FINKOK_STAMP_WSDL = {
  test: "https://demo-facturacion.finkok.com/servicios/soap/stamp.wsdl",
  prod: "https://facturacion.finkok.com/servicios/soap/stamp.wsdl",
};

const FINKOK_CANCEL_WSDL = {
  test: "https://demo-facturacion.finkok.com/servicios/soap/cancel.wsdl",
  prod: "https://facturacion.finkok.com/servicios/soap/cancel.wsdl",
};

function finkokEndpoint(base: { test: string; prod: string }, isTest: boolean) {
  return isTest ? base.test : base.prod;
}

interface FinkokAcuse {
  xml?: string;
  UUID?: string;
  faultstring?: string;
  Fecha?: string;
  CodEstatus?: string;
  Incidencias?: {
    Incidencia?: Array<{
      CodigoError?: string;
      MensajeIncidencia?: string;
      ExtraInfo?: string;
    }>;
  };
}

export class FinkokClient implements PACClient {
  private username: string;
  private password: string;
  private secrets: ResolvedFiscalSecrets;
  private isTest: boolean;

  constructor(
    config: TenantConfiguracionFiscal,
    secrets: ResolvedFiscalSecrets,
    isTest?: boolean
  ) {
    this.username = config.pac_usuario;
    this.password = secrets.pac_password;
    this.secrets = secrets;
    this.isTest = resolveIsTest(isTest);
  }

  async stamp(xml: string): Promise<PACStampResult> {
    const wsdl = finkokEndpoint(FINKOK_STAMP_WSDL, this.isTest);
    const client = await soap.createClientAsync(wsdl);
    const xmlBase64 = Buffer.from(xml, "utf8").toString("base64");

    const [result] = await client.sign_stampAsync({
      xml: xmlBase64,
      username: this.username,
      password: this.password,
    });

    const acuse = (result as { sign_stampResult?: FinkokAcuse })
      .sign_stampResult as FinkokAcuse | undefined;

    if (!acuse) {
      throw new Error("Finkok no devolvió un acuse de timbrado");
    }

    if (acuse.Incidencias?.Incidencia?.length) {
      const incidencia = acuse.Incidencias.Incidencia[0];
      throw new Error(
        `Finkok: ${incidencia.MensajeIncidencia || incidencia.CodigoError || "incidencia de timbrado"}`
      );
    }

    if (acuse.faultstring) {
      throw new Error(`Finkok: ${acuse.faultstring}`);
    }

    if (!acuse.xml && !acuse.UUID) {
      throw new Error(`Finkok: ${acuse.CodEstatus || "respuesta sin XML timbrado"}`);
    }

    return {
      uuid: acuse.UUID || "",
      xml: acuse.xml ? Buffer.from(acuse.xml, "base64").toString("utf8") : "",
      rawResponse: result,
    };
  }

  async cancel(params: CancelParams): Promise<PACCancelResult> {
    const wsdl = finkokEndpoint(FINKOK_CANCEL_WSDL, this.isTest);
    const client = await soap.createClientAsync(wsdl);

    const [result] = await client.cancelAsync({
      UUIDS: {
        UUID: [
          {
            _attributes: {
              UUID: params.uuid,
              FolioSustitucion: params.folioSustitucion || undefined,
              Motivo: params.motivo,
            },
          },
        ],
      },
      username: this.username,
      password: this.password,
      taxpayer_id: params.rfcEmisor,
      cer: this.secrets.certificado_cer,
      key: this.secrets.certificado_key,
      store_pending: false,
    });

    const cancelResult = (result as {
      cancelResult?: {
        Folios?: { Folio?: Array<{ UUID?: string; EstatusUUID?: string }> };
        CodEstatus?: string;
        Acuse?: string;
      };
    }).cancelResult;

    if (!cancelResult) {
      throw new Error("Finkok no devolvió un resultado de cancelación");
    }

    const folios = cancelResult.Folios?.Folio ?? [];
    const accepted = folios.some(
      (folio) => folio.EstatusUUID === "Cancelado" || folio.EstatusUUID === "Cancelado sin aceptación"
    );

    return { accepted, rawResponse: result };
  }
}

export class SWSapienClient implements PACClient {
  private username: string;
  private password: string;
  private isTest: boolean;

  constructor(
    config: TenantConfiguracionFiscal,
    secrets: ResolvedFiscalSecrets,
    isTest?: boolean
  ) {
    this.username = config.pac_usuario;
    this.password = secrets.pac_password;
    this.isTest = resolveIsTest(isTest);
  }

  async stamp(xml: string): Promise<PACStampResult> {
    const endpoint = this.isTest
      ? "https://testing.facturaonline.mx/ws/timbrado"
      : "https://facturaonline.mx/ws/timbrado";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        xml,
        username: this.username,
        password: this.password,
      }),
    });

    if (!response.ok) {
      throw new Error(`PAC error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`PAC error: ${data.error}`);
    }

    return {
      uuid: data.uuid || "",
      xml: data.xml || "",
      rawResponse: data,
    };
  }

  async cancel(params: CancelParams): Promise<PACCancelResult> {
    const endpoint = this.isTest
      ? "https://testing.facturaonline.mx/ws/cancelacion"
      : "https://facturaonline.mx/ws/cancelacion";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uuid: params.uuid,
        rfc_emisor: params.rfcEmisor,
        rfc_receptor: params.rfcReceptor,
        total: params.total,
        motivo: params.motivo,
        folio_sustitucion: params.folioSustitucion,
        username: this.username,
        password: this.password,
      }),
    });

    if (!response.ok) {
      throw new Error(`PAC cancel error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      accepted: data.acuse || data.success || false,
      rawResponse: data,
    };
  }
}

export function createPACClient(
  config: TenantConfiguracionFiscal,
  secrets: ResolvedFiscalSecrets,
  isTest?: boolean
): PACClient {
  const test = resolveIsTest(isTest);
  switch (config.pac_proveedor) {
    case "finkok":
      return new FinkokClient(config, secrets, test);
    case "swsapien":
      return new SWSapienClient(config, secrets, test);
    default:
      return new FinkokClient(config, secrets, test);
  }
}