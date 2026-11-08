import crypto from "node:crypto";
import { TIMEOUTS, timeoutSignal } from "@/lib/http/timeout";
import { obtenerConfigGoogleWallet } from "./jwt";
import { idObjetoWallet, textoProgreso } from "./pass-builder";

/**
 * Cliente de la REST API de Google Wallet (cuenta de servicio de SYMVORA).
 * Solo corre en el servidor. Toda llamada lleva timeout (`lib/http/timeout.ts`):
 * actualizar un pase nunca puede colgar una respuesta.
 */

const API = "https://walletobjects.googleapis.com/walletobjects/v1";

let tokenEnCache: { token: string; venceEn: number } | null = null;

function base64Url(datos: string | Buffer): string {
  return Buffer.from(datos).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Token OAuth2 de la cuenta de servicio (JWT bearer), en cache hasta 1 min antes de vencer. */
async function tokenDeAcceso(): Promise<string | null> {
  const config = obtenerConfigGoogleWallet();
  if (!config) return null;

  const ahora = Math.floor(Date.now() / 1000);
  if (tokenEnCache && tokenEnCache.venceEn > ahora + 60) return tokenEnCache.token;

  const encabezado = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const reclamos = base64Url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: "https://www.googleapis.com/auth/wallet_object.issuer",
      aud: "https://oauth2.googleapis.com/token",
      iat: ahora,
      exp: ahora + 3600,
    }),
  );
  const firma = crypto.createSign("RSA-SHA256").update(`${encabezado}.${reclamos}`).sign(config.privateKey);

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${encabezado}.${reclamos}.${base64Url(firma)}`,
      }),
      signal: timeoutSignal(TIMEOUTS.googleWallet),
    });
    if (!res.ok) {
      console.warn("[google-wallet] token OAuth2:", res.status, await res.text());
      return null;
    }
    const datos = (await res.json()) as { access_token: string; expires_in?: number };
    tokenEnCache = { token: datos.access_token, venceEn: ahora + (datos.expires_in ?? 3500) };
    return tokenEnCache.token;
  } catch (error) {
    console.error("[google-wallet] token OAuth2:", error);
    return null;
  }
}

export type ResultadoPase = "actualizado" | "sin-pase" | "sin-configurar" | "error";

/**
 * Actualiza el saldo de sellos de un pase y, con `aviso`, manda una
 * notificacion al telefono.
 *
 * - El saldo va por PATCH: cambiar `messages` en un PATCH NO notifica.
 * - El aviso va por `addMessage` con `TEXT_AND_NOTIFY`. Google limita las
 *   notificaciones a unas 3 por pase cada 24 h; las de mas se guardan sin sonar.
 * - 404 = el cliente aun no guardo su tarjeta en Wallet: es lo normal, no un error.
 */
export async function actualizarPaseGoogleWallet({
  codigo,
  sellos,
  sellosMeta,
  premio,
  premiosCanjeados,
  aviso,
}: {
  codigo: string;
  sellos: number;
  sellosMeta: number;
  premio: string;
  premiosCanjeados: number;
  aviso?: { titulo: string; texto: string } | null;
}): Promise<ResultadoPase> {
  const config = obtenerConfigGoogleWallet();
  if (!config) return "sin-configurar";
  const token = await tokenDeAcceso();
  if (!token) return "error";

  const url = `${API}/loyaltyObject/${encodeURIComponent(idObjetoWallet(config.issuerId, codigo))}`;
  const cabeceras = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: cabeceras,
      body: JSON.stringify({
        loyaltyPoints: { label: "Sellos", balance: { string: textoProgreso(sellos, sellosMeta) } },
        textModulesData: [
          { id: "premio", header: "Premio", body: premio },
          { id: "canjes", header: "Premios canjeados", body: String(premiosCanjeados) },
        ],
      }),
      signal: timeoutSignal(TIMEOUTS.googleWallet),
    });
    if (res.status === 404) return "sin-pase";
    if (!res.ok) {
      console.warn("[google-wallet] PATCH loyaltyObject:", res.status, await res.text());
      return "error";
    }

    if (aviso) {
      const resAviso = await fetch(`${url}/addMessage`, {
        method: "POST",
        headers: cabeceras,
        body: JSON.stringify({
          message: {
            id: `sello_${Date.now()}`,
            header: aviso.titulo,
            body: aviso.texto,
            messageType: "TEXT_AND_NOTIFY",
          },
        }),
        signal: timeoutSignal(TIMEOUTS.googleWallet),
      });
      // El saldo ya quedo: un aviso que no sale no es un fallo de la actualizacion.
      if (!resAviso.ok) console.warn("[google-wallet] addMessage:", resAviso.status, await resAviso.text());
    }
    return "actualizado";
  } catch (error) {
    console.error("[google-wallet] actualizar pase:", error);
    return "error";
  }
}
