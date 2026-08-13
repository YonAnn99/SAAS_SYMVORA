import type { Factura, FacturaDetalle } from "@/lib/types/database";
import { CLAVE_UNIDAD_SAT } from "./catalogs";

export function generateCFDIXML(factura: Factura, detalle: FacturaDetalle[]): string {
  const conceptos = detalle
    .sort((a, b) => a.orden - b.orden)
    .map((d) => generateConcepto(d))
    .join("\n      ");

  const fecha = formatCFDFecha(factura.fecha_emision);
  const fechaTimbrado = factura.fecha_timbrado
    ? formatCFDFecha(factura.fecha_timbrado)
    : "";
  const uuid = factura.uuid_cfdi || "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante
    xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd"
    Version="4.0"
    Serie="${escapeXml(factura.serie)}"
    Folio="${factura.folio}"
    Fecha="${fecha}"
    FormaPago="${factura.forma_pago}"
    NoCertificado="30001000000500003416"
    Certificado="MIIFuzCCA6OgAwIBAgIUMzAwMDEwMDAwMDA1MDAwMDM0MTYwDQYJKoZIhvcNAQELBQA..."
    SubTotal="${formatDecimal(factura.subtotal)}"
    Descuento="${formatDecimal(factura.descuento)}"
    Moneda="MXN"
    Total="${formatDecimal(factura.total)}"
    TipoDeComprobante="I"
    Exportacion="01"
    MetodoPago="${factura.metodo_pago}"
    LugarExpedicion="${factura.emisor_codigo_postal}"
    Sello="...">
  <cfdi:Emisor
      Rfc="${escapeXml(factura.emisor_rfc)}"
      Nombre="${escapeXml(factura.emisor_razon_social)}"
      RegimenFiscal="${factura.emisor_regimen_fiscal}" />
  <cfdi:Receptor
      Rfc="${escapeXml(factura.receptor_rfc)}"
      Nombre="${escapeXml(factura.receptor_razon_social)}"
      RegimenFiscalReceptor="${factura.receptor_regimen_fiscal}"
      UsoCFDI="${factura.receptor_uso_cfdi}"
      DomicilioFiscalReceptor="${factura.receptor_codigo_postal}" />
  <cfdi:Conceptos>
      ${conceptos}
  </cfdi:Conceptos>
  <cfdi:Impuestos
      TotalImpuestosTrasladados="${formatDecimal(factura.impuesto)}"
      TotalImpuestosRetenidos="0.00">
    <cfdi:Traslados>
      <cfdi:Traslado
          Base="${formatDecimal(factura.subtotal - factura.descuento)}"
          Impuesto="002"
          TipoFactor="Tasa"
          TasaOCuota="0.160000"
          Importe="${formatDecimal(factura.impuesto)}" />
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital
        xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
        Version="1.1"
        UUID="${uuid}"
        FechaTimbrado="${fechaTimbrado}"
        RfcProvCertif="${escapeXml(factura.pac_nombre || "")}"
        SelloCFD=""
        NoCertificadoSAT=""
        SelloSAT="" />
  </cfdi:Complemento>
</cfdi:Comprobante>`;

  return xml;
}

function generateConcepto(detalle: FacturaDetalle): string {
  const claveUnidad = CLAVE_UNIDAD_SAT[detalle.clave_unidad] ? detalle.clave_unidad : "H87";

  return `<cfdi:Concepto
          ClaveProdServ="${escapeXml(detalle.clave_prod_serv)}"
          NoIdentificacion="${escapeXml(detalle.no_identificacion || "")}"
          Cantidad="${formatDecimal(detalle.cantidad)}"
          ClaveUnidad="${claveUnidad}"
          Unidad="${escapeXml(detalle.unidad)}"
          Descripcion="${escapeXml(detalle.descripcion)}"
          ValorUnitario="${formatDecimal(detalle.precio_unitario)}"
          Importe="${formatDecimal(detalle.subtotal)}"
          Descuento="${formatDecimal(detalle.descuento)}"
          ObjetoImp="002">
        <cfdi:Impuestos>
          <cfdi:Traslados>
            <cfdi:Traslado
                Base="${formatDecimal(detalle.base_impuesto)}"
                Impuesto="002"
                TipoFactor="Tasa"
                TasaOCuota="${formatDecimal(detalle.tasa_impuesto)}"
                Importe="${formatDecimal(detalle.importe_impuesto)}" />
          </cfdi:Traslados>
        </cfdi:Impuestos>
      </cfdi:Concepto>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

export function parseCFDIXML(xml: string): {
  uuid: string;
  fechaTimbrado: string;
  rfcProvCertif: string;
} | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    const complemento = doc.querySelector("Complemento TimbreFiscalDigital");
    if (!complemento) return null;

    return {
      uuid: complemento.getAttribute("UUID") || "",
      fechaTimbrado: complemento.getAttribute("FechaTimbrado") || "",
      rfcProvCertif: complemento.getAttribute("RfcProvCertif") || "",
    };
  } catch {
    return null;
  }
}
