import { createHash } from "node:crypto";
import type { TarjetaPublica } from "../types";
import type {
  GoogleWalletLoyaltyClass,
  GoogleWalletLoyaltyObject,
  GoogleWalletJwtPayload,
  GoogleWalletConfig,
} from "./types";
import { firmarJwtGoogleWallet, generarUrlGuardarGoogleWallet } from "./jwt";

/**
 * SYMVORA es el UNICO emisor en Google Wallet: cada programa de lealtad (un
 * negocio) es una `LoyaltyClass` y cada tarjeta de cliente un `LoyaltyObject`.
 *
 * Ids:
 * - Clase: hash corto del id del PROGRAMA, no el nombre del negocio. Con el
 *   nombre, dos «Abarrotes» compartian clase (y el logo y color de uno), y al
 *   renombrar el negocio la clase quedaba huerfana. El hash no deja ver el uuid
 *   en el JWT, que viaja en la URL.
 * - Objeto: el codigo de la tarjeta (12 caracteres de [2-9A-Z], validos en Wallet).
 *
 * Un JWT de «guardar» INSERTA la clase si no existe; si ya existe no la
 * actualiza (cambios de logo o color de un negocio no llegan a pases viejos).
 */

/** Logo de respaldo: PNG publico (Wallet no acepta WebP). */
const LOGO_RESPALDO = "/icons/icon-512.png";

export function idClaseWallet(issuerId: string, programaId: string): string {
  const hash = createHash("sha256").update(programaId).digest("hex").slice(0, 20);
  return `${issuerId}.symvora_programa_${hash}`;
}

export function idObjetoWallet(issuerId: string, codigo: string): string {
  return `${issuerId}.${codigo}`;
}

/** Lo que muestra el pase como saldo: «4 / 10» o el premio listo. */
export function textoProgreso(sellos: number, meta: number): string {
  return sellos >= meta ? "¡Premio listo para canjear!" : `${sellos} / ${meta}`;
}

export function construirClaseLealtad(
  issuerId: string,
  programaId: string,
  tarjeta: TarjetaPublica,
  origenWeb: string,
): GoogleWalletLoyaltyClass {
  const hexColor = tarjeta.color_fondo || (tarjeta.paleta === "oscura" ? "#0F172A" : "#1E3A8A");
  const logoUri = tarjeta.logo_url?.startsWith("https://") ? tarjeta.logo_url : `${origenWeb}${LOGO_RESPALDO}`;

  return {
    id: idClaseWallet(issuerId, programaId),
    issuerName: tarjeta.negocio,
    programName: tarjeta.programa || "Tarjeta de lealtad",
    programLogo: {
      sourceUri: { uri: logoUri },
      contentDescription: {
        defaultValue: { language: "es", value: `Logotipo de ${tarjeta.negocio}` },
      },
    },
    hexBackgroundColor: hexColor,
    reviewStatus: "UNDER_REVIEW",
    allowMultipleUsersPerObject: false,
  };
}

export function construirObjetoLealtad(
  issuerId: string,
  classId: string,
  tarjeta: TarjetaPublica,
  origenWeb: string,
): GoogleWalletLoyaltyObject {
  return {
    id: idObjetoWallet(issuerId, tarjeta.codigo),
    classId,
    state: tarjeta.activa ? "ACTIVE" : "INACTIVE",
    accountId: tarjeta.codigo,
    // `tarjeta_publica` solo da el PRIMER nombre del cliente.
    accountName: tarjeta.cliente,
    barcode: { type: "QR_CODE", value: tarjeta.codigo, alternateText: tarjeta.codigo },
    loyaltyPoints: {
      label: "Sellos",
      balance: { string: textoProgreso(tarjeta.sellos, tarjeta.sellos_meta) },
    },
    secondaryLoyaltyPoints: {
      label: "Meta",
      balance: { string: `${tarjeta.sellos_meta} sellos` },
    },
    textModulesData: [
      { id: "premio", header: "Premio", body: tarjeta.premio_descripcion },
      { id: "canjes", header: "Premios canjeados", body: String(tarjeta.premios_canjeados) },
    ],
    linksModuleData: {
      uris: [{ uri: `${origenWeb}/es/tarjeta/${tarjeta.codigo}`, description: "Ver mi tarjeta" }],
    },
  };
}

/** Enlace «Guardar en Google Wallet» (`pay.google.com/gp/v/save/<jwt>`). */
export function generarEnlaceGoogleWallet(
  tarjeta: TarjetaPublica,
  programaId: string,
  config: GoogleWalletConfig,
  origenWeb: string,
): string {
  const clase = construirClaseLealtad(config.issuerId, programaId, tarjeta, origenWeb);
  const objeto = construirObjetoLealtad(config.issuerId, clase.id, tarjeta, origenWeb);

  const payload: GoogleWalletJwtPayload = {
    iss: config.clientEmail,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [origenWeb],
    payload: { loyaltyClasses: [clase], loyaltyObjects: [objeto] },
  };

  return generarUrlGuardarGoogleWallet(firmarJwtGoogleWallet(payload, config.privateKey));
}
