import crypto from "node:crypto";
import type { GoogleWalletConfig, GoogleWalletJwtPayload } from "./types";

/**
 * Obtiene la configuración de Google Wallet desde las variables de entorno.
 * Retorna null si no están configuradas todas las variables requeridas.
 */
export function obtenerConfigGoogleWallet(): GoogleWalletConfig | null {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const clientEmail = process.env.GOOGLE_WALLET_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_WALLET_PRIVATE_KEY;

  if (!issuerId || !clientEmail || !privateKey) {
    return null;
  }

  // Las variables de entorno suelen escapar los saltos de línea como "\n"
  if (privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  return {
    issuerId,
    clientEmail,
    privateKey,
  };
}

/**
 * Codifica un objeto o string en formato Base64URL (RFC 7515).
 */
function base64UrlEncode(input: string | Buffer): string {
  const base64 = Buffer.isBuffer(input)
    ? input.toString("base64")
    : Buffer.from(input, "utf8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Firma un payload de Google Wallet usando RS256 y la clave privada del Service Account.
 */
export function firmarJwtGoogleWallet(
  payload: GoogleWalletJwtPayload,
  privateKey: string
): string {
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${headerEncoded}.${payloadEncoded}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(dataToSign);
  signer.end();

  const signature = signer.sign(privateKey);
  const signatureEncoded = base64UrlEncode(signature);

  return `${dataToSign}.${signatureEncoded}`;
}

/**
 * Genera la URL oficial de Google Wallet para guardar el pase en un solo clic.
 */
export function generarUrlGuardarGoogleWallet(jwt: string): string {
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
