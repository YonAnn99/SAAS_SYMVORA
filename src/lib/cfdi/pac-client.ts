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

export interface PACClient {
  stamp(xml: string): Promise<PACStampResult>;
  cancel(params: {
    uuid: string;
    rfcEmisor: string;
    rfcReceptor: string;
    total: string;
    motivo: string;
    folioSustitucion?: string;
  }): Promise<PACCancelResult>;
}

export class FinkokClient implements PACClient {
  private username: string;
  private password: string;
  private isTest: boolean;

  constructor(config: TenantConfiguracionFiscal, isTest = true) {
    this.username = config.pac_usuario;
    this.password = config.pac_password;
    this.isTest = isTest;
  }

  private getEndpoint(): string {
    if (this.isTest) {
      return "https://demo-finkok.33mail.com/stamp";
    }
    return "https://demo-finkok.33mail.com/stamp";
  }

  async stamp(xml: string): Promise<PACStampResult> {
    const endpoint = this.isTest
      ? "https://demo-finkok.33mail.com/stamp"
      : "https://app.finkok.com/sessions/sign";

    const formData = new FormData();
    formData.append("xml", xml);
    formData.append("username", this.username);
    formData.append("password", this.password);

    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`PAC error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.Error) {
      throw new Error(`PAC error: ${data.Error}`);
    }

    return {
      uuid: data.uuid || data.UUID || "",
      xml: data.xml || data.Xml || "",
      rawResponse: data,
    };
  }

  async cancel(params: {
    uuid: string;
    rfcEmisor: string;
    rfcReceptor: string;
    total: string;
    motivo: string;
    folioSustitucion?: string;
  }): Promise<PACCancelResult> {
    const endpoint = this.isTest
      ? "https://demo-finkok.33mail.com/cancel"
      : "https://app.finkok.com/cancel/cancel";

    const formData = new FormData();
    formData.append("uuid", params.uuid);
    formData.append("rfc_emisor", params.rfcEmisor);
    formData.append("rfc_receptor", params.rfcReceptor);
    formData.append("total", params.total);
    formData.append("motivo", params.motivo);
    if (params.folioSustitucion) {
      formData.append("folio_sustitucion", params.folioSustitucion);
    }
    formData.append("username", this.username);
    formData.append("password", this.password);

    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
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

export class SWSapienClient implements PACClient {
  private username: string;
  private password: string;
  private isTest: boolean;

  constructor(config: TenantConfiguracionFiscal, isTest = true) {
    this.username = config.pac_usuario;
    this.password = config.pac_password;
    this.isTest = isTest;
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

  async cancel(params: {
    uuid: string;
    rfcEmisor: string;
    rfcReceptor: string;
    total: string;
    motivo: string;
    folioSustitucion?: string;
  }): Promise<PACCancelResult> {
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
  isTest = true
): PACClient {
  switch (config.pac_proveedor) {
    case "finkok":
      return new FinkokClient(config, isTest);
    case "swsapien":
      return new SWSapienClient(config, isTest);
    default:
      return new FinkokClient(config, isTest);
  }
}
