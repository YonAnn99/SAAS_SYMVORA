import { CFDI, Concepto, Emisor, Impuestos, Receptor } from "@cfdi/xml";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { Factura, FacturaDetalle } from "@/lib/types/database";
import { CLAVE_UNIDAD_SAT } from "./catalogs";

const XSLT_CFDI_PATH = join(
  process.cwd(),
  "resources/cfdi/4.0/cadenaoriginal.xslt"
);

export interface SealInputs {
  certificadoCer: string;
  certificadoKey: string;
  certificadoPassword: string;
}

export interface SealResult {
  xml: string;
  cadenaOriginal: string;
  sello: string;
  noCertificado: string;
  certificado: string;
}

export function generateCFDIXML(factura: Factura, detalle: FacturaDetalle[]): string {
  const cfdi = buildCFDI(factura, detalle);
  return cfdi.getXmlCdfi();
}

export async function generateSealedCFDIXML(
  factura: Factura,
  detalle: FacturaDetalle[],
  inputs: SealInputs
): Promise<SealResult> {
  const dir = await mkdtemp(join(tmpdir(), "cfdi-symvora-"));

  try {
    const cerPath = join(dir, "certificado.cer");
    const keyPath = join(dir, "llave.key");
    await writeFile(cerPath, Buffer.from(inputs.certificadoCer, "base64"));
    await writeFile(keyPath, Buffer.from(inputs.certificadoKey, "base64"));

    const cfdi = buildCFDI(factura, detalle);
    cfdi.certificar(cerPath);
    await cfdi.sellar(keyPath, inputs.certificadoPassword);

    const attrs = cfdi.getJsonCdfi()["cfdi:Comprobante"]._attributes;
    const sello = cfdi.sello;
    const cadenaOriginal = cfdi.cadenaOriginal;
    const xml = cfdi.getXmlCdfi();

    return {
      xml,
      cadenaOriginal,
      sello,
      noCertificado: attrs.NoCertificado ?? "",
      certificado: attrs.Certificado ?? "",
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function buildCFDI(factura: Factura, detalle: FacturaDetalle[]): CFDI {
  const cfdi = new CFDI({ xslt: { path: XSLT_CFDI_PATH } });

  cfdi.comprobante({
    Serie: escapeXml(factura.serie),
    Folio: String(factura.folio),
    Fecha: formatCFDFecha(factura.fecha_emision),
    FormaPago: factura.forma_pago,
    SubTotal: formatDecimal(factura.subtotal),
    Descuento: factura.descuento > 0 ? formatDecimal(factura.descuento) : undefined,
    Moneda: "MXN",
    Total: formatDecimal(factura.total),
    TipoDeComprobante: "I",
    Exportacion: "01",
    MetodoPago: factura.metodo_pago,
    LugarExpedicion: factura.emisor_codigo_postal,
  });

  cfdi.emisor(
    new Emisor({
      Rfc: factura.emisor_rfc,
      Nombre: escapeXml(factura.emisor_razon_social),
      RegimenFiscal: factura.emisor_regimen_fiscal,
    })
  );

  cfdi.receptor(
    new Receptor({
      Rfc: factura.receptor_rfc,
      Nombre: escapeXml(factura.receptor_razon_social),
      UsoCFDI: factura.receptor_uso_cfdi,
      DomicilioFiscalReceptor: factura.receptor_codigo_postal,
      RegimenFiscalReceptor: factura.receptor_regimen_fiscal,
    })
  );

  const lineas = [...detalle].sort((a, b) => a.orden - b.orden);
  for (const d of lineas) {
    const concepto = new Concepto({
      ClaveProdServ: d.clave_prod_serv,
      NoIdentificacion: d.no_identificacion ? escapeXml(d.no_identificacion) : undefined,
      Cantidad: formatDecimal(d.cantidad),
      ClaveUnidad: resolveClaveUnidad(d),
      Unidad: escapeXml(d.unidad),
      Descripcion: escapeXml(d.descripcion),
      ValorUnitario: formatDecimal(d.precio_unitario),
      Importe: formatDecimal(d.subtotal),
      Descuento: d.descuento > 0 ? formatDecimal(d.descuento) : undefined,
      ObjetoImp: "02",
    });

    if (d.importe_impuesto > 0) {
      concepto.traslado({
        Base: formatDecimal(d.base_impuesto),
        Impuesto: "002",
        TipoFactor: "Tasa",
        TasaOCuota: formatDecimal(d.tasa_impuesto),
        Importe: formatDecimal(d.importe_impuesto),
      });
    }

    cfdi.concepto(concepto);
  }

  if (factura.impuesto > 0) {
    cfdi.impuesto(
      new Impuestos({
        TotalImpuestosTrasladados: formatDecimal(factura.impuesto),
        TotalImpuestosRetenidos: "0.00",
      }).traslados({
        Base: formatDecimal(factura.subtotal - factura.descuento),
        Impuesto: "002",
        TipoFactor: "Tasa",
        TasaOCuota: "0.160000",
        Importe: formatDecimal(factura.impuesto),
      })
    );
  }

  return cfdi;
}

function resolveClaveUnidad(detalle: FacturaDetalle): string {
  return CLAVE_UNIDAD_SAT[detalle.clave_unidad] ? detalle.clave_unidad : "H87";
}

function formatDecimal(num: number): string {
  return num.toFixed(2);
}

function formatCFDFecha(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function parseCFDIXML(xml: string): {
  uuid: string;
  fechaTimbrado: string;
  rfcProvCertif: string;
} | null {
  const uuid = xml.match(/UUID="([^"]+)"/)?.[1] ?? "";
  const fechaTimbrado = xml.match(/FechaTimbrado="([^"]+)"/)?.[1] ?? "";
  const rfcProvCertif = xml.match(/RfcProvCertif="([^"]+)"/)?.[1] ?? "";

  if (!uuid) return null;

  return { uuid, fechaTimbrado, rfcProvCertif };
}