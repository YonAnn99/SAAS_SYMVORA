import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Certificate } from "@cfdi/csd";
import {
  generateCFDIXML,
  generateSealedCFDIXML,
  parseCFDIXML,
} from "@/lib/cfdi/xml-generator";
import { createPACClient, isPACTestsEnabled } from "@/lib/cfdi/pac-client";
import type { Factura, FacturaDetalle, TenantConfiguracionFiscal } from "@/lib/types/database";

const baseFactura: Factura = {
  id: "11111111-1111-4111-8111-111111111111",
  tenant_id: "22222222-2222-4222-8222-222222222222",
  serie: "A",
  folio: 1,
  emisor_rfc: "XAXX010101000",
  emisor_razon_social: "Mi Empresa S.A. de C.V.",
  emisor_regimen_fiscal: "601",
  emisor_codigo_postal: "06600",
  receptor_rfc: "XAXX010101001",
  receptor_razon_social: "Cliente Final",
  receptor_regimen_fiscal: "612",
  receptor_uso_cfdi: "G03",
  receptor_codigo_postal: "06600",
  subtotal: 1000,
  impuesto: 160,
  descuento: 0,
  total: 1160,
  metodo_pago: "PUE",
  forma_pago: "01",
  estado: "TIMBRADA",
  uuid_cfdi: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  fecha_timbrado: "2024-01-15T10:30:00.000Z",
  fecha_emision: "2024-01-15T10:00:00.000Z",
  xml_url: "/api/facturas/11111111-1111-4111-8111-111111111111/xml",
  pdf_url: "/api/facturas/11111111-1111-4111-8111-111111111111/pdf",
  pac_nombre: "finkok",
  pac_response: null,
  fecha_cancelacion: null,
  motivo_cancelacion: null,
  folio_sustitucion: null,
  venta_id: null,
  xml_timbrado: null,
  created_at: "2024-01-15T10:00:00.000Z",
  updated_at: "2024-01-15T10:30:00.000Z",
};

const baseDetalle: FacturaDetalle = {
  id: "33333333-3333-4333-8333-333333333333",
  factura_id: baseFactura.id,
  producto_id: null,
  descripcion: 'Producto & "especial" <test>',
  clave_prod_serv: "84111506",
  clave_unidad: "H87",
  no_identificacion: null,
  cantidad: 2,
  unidad: "Pieza",
  precio_unitario: 500,
  descuento: 0,
  subtotal: 1000,
  base_impuesto: 1000,
  tasa_impuesto: 0.16,
  importe_impuesto: 160,
  orden: 1,
  created_at: "2024-01-15T10:00:00.000Z",
};

describe("generateCFDIXML", () => {
  it("should generate a well-formed CFDI 4.0 XML with expected attributes", () => {
    const xml = generateCFDIXML(baseFactura, [baseDetalle]);

    expect(xml).toContain('Version="4.0"');
    expect(xml).toContain('Serie="A"');
    expect(xml).toContain('Folio="1"');
    expect(xml).toContain('SubTotal="1000.00"');
    expect(xml).toContain('Total="1160.00"');
    expect(xml).toContain('MetodoPago="PUE"');
    expect(xml).toContain('Rfc="XAXX010101000"');
    expect(xml).toContain('Rfc="XAXX010101001"');
  });

  it("should not include the TFD or UUID before stamping", () => {
    const xml = generateCFDIXML(baseFactura, [baseDetalle]);

    expect(xml).not.toContain("UUID=");
    expect(xml).not.toContain("TimbreFiscalDigital");
    expect(xml).not.toContain("RfcProvCertif=");
  });

  it("should escape XML special characters in descriptions", () => {
    const xml = generateCFDIXML(baseFactura, [baseDetalle]);

    expect(xml).toContain("Producto &amp; &quot;especial&quot; &lt;test&gt;");
    expect(xml).not.toContain("& ");

    const conceptoStart = xml.indexOf("Descripcion=");
    const concepto = xml.slice(conceptoStart);
    expect(concepto).toContain("&amp;");
    expect(concepto).toContain("&lt;test&gt;");
  });

  it("should include every concept sorted by orden", () => {
    const detalle: FacturaDetalle[] = [
      { ...baseDetalle, orden: 2, descripcion: "Segundo" },
      { ...baseDetalle, orden: 1, descripcion: "Primero" },
    ];

    const xml = generateCFDIXML(baseFactura, detalle);
    const primerIdx = xml.indexOf("Primero");
    const segundoIdx = xml.indexOf("Segundo");

    expect(primerIdx).toBeGreaterThan(-1);
    expect(segundoIdx).toBeGreaterThan(primerIdx);
  });

  it("should emit empty seal attributes for drafts", () => {
    const draft: Factura = { ...baseFactura, estado: "BORRADOR", uuid_cfdi: null, fecha_timbrado: null };
    const xml = generateCFDIXML(draft, [baseDetalle]);

    expect(xml).toContain('Sello=""');
    expect(xml).toContain('NoCertificado=""');
  });
});

describe("parseCFDIXML", () => {
  it("should extract UUID from a stamped CFDI", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante Version="4.0" Sello="abc" NoCertificado="30001000000500003416">
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital Version="1.1" UUID="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" FechaTimbrado="2024-01-15T10:30:00" RfcProvCertif="FINK850815EP6" SelloCFD="def" SelloSAT="ghi" NoCertificadoSAT="30001000000500003416"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const parsed = parseCFDIXML(xml);

    expect(parsed).not.toBeNull();
    expect(parsed?.uuid).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(parsed?.fechaTimbrado).toBe("2024-01-15T10:30:00");
    expect(parsed?.rfcProvCertif).toBe("FINK850815EP6");
  });

  it("should return null for drafts without UUID", () => {
    const xml = generateCFDIXML(baseFactura, [baseDetalle]);
    expect(parseCFDIXML(xml)).toBeNull();
  });

  it("should return null for invalid XML", () => {
    expect(parseCFDIXML("not xml")).toBeNull();
  });
});

describe("generateSealedCFDIXML", () => {
  let dir: string;
  let cerPath: string;
  let keyPath: string;
  let certificadoCer: string;
  let certificadoKey: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "cfdi-csd-"));
    keyPath = join(dir, "llave.pem");
    cerPath = join(dir, "cert.cer");
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-keyout",
        keyPath,
        "-out",
        cerPath,
        "-outform",
        "der",
        "-days",
        "2",
        "-nodes",
        "-subj",
        "/CN=Mi Empresa S.A. de C.V./O=Mi Empresa S.A. de C.V.",
        "-set_serial",
        "20001000000300005712",
      ],
      { stdio: "ignore" }
    );
    certificadoCer = (await readFile(cerPath)).toString("base64");
    certificadoKey = (await readFile(keyPath)).toString("base64");
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("should sign the CFDI with a real CSD and compute the cadena original", async () => {
    const result = await generateSealedCFDIXML(baseFactura, [baseDetalle], {
      certificadoCer,
      certificadoKey,
      certificadoPassword: "",
    });

    expect(result.cadenaOriginal).toContain("XAXX010101000");
    expect(result.cadenaOriginal.startsWith("||")).toBe(true);
    expect(result.sello).not.toBe("");
    expect(result.noCertificado).not.toBe("");
    expect(result.certificado).not.toBe("");

    expect(result.xml).toContain(`Sello="${result.sello}"`);
    expect(result.xml).toContain(`NoCertificado="${result.noCertificado}"`);
    expect(result.xml).toContain('Producto &amp; &quot;especial&quot; &lt;test&gt;');

    const certificate = Certificate.fromFileSync(cerPath);
    expect(certificate.verify(result.cadenaOriginal, result.sello)).toBe(true);
  });

  it("should reject an invalid certificate", async () => {
    await expect(
      generateSealedCFDIXML(baseFactura, [baseDetalle], {
        certificadoCer: "not-a-base64-cert",
        certificadoKey,
        certificadoPassword: "",
      })
    ).rejects.toThrow();
  });
});

describe("createPACClient", () => {
  const fiscalConfig: TenantConfiguracionFiscal = {
    cfdi_serie: "A",
    cfdi_metodo_pago: "PUE",
    cfdi_forma_pago_default: "01",
    pac_proveedor: "finkok",
    pac_usuario: "user@test.com",
    pac_password_id: "secret-id",
    certificado_cer_id: "cer-id",
    certificado_key_id: "key-id",
    certificado_password_id: "password-id",
    email_envio_facturas: "",
  };

  const secrets = {
    pac_password: "secret",
    certificado_cer: "cer",
    certificado_key: "key",
    certificado_password: "",
  };

  it("should create a Finkok client by default", () => {
    const client = createPACClient(fiscalConfig, secrets);
    expect(client).toBeInstanceOf(Object);
    expect(typeof client.stamp).toBe("function");
    expect(typeof client.cancel).toBe("function");
  });

  it("should resolve test mode from environment", () => {
    const original = process.env.PAC_TEST_MODE;
    process.env.PAC_TEST_MODE = "true";
    expect(isPACTestsEnabled()).toBe(true);

    process.env.PAC_TEST_MODE = original;
  });

  it("should default to production mode (test disabled)", () => {
    const original = process.env.PAC_TEST_MODE;
    delete process.env.PAC_TEST_MODE;
    expect(isPACTestsEnabled()).toBe(false);
    process.env.PAC_TEST_MODE = original;
  });
});