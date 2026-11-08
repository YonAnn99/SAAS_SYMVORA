import { generateKeyPairSync, createVerify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { firmarJwtGoogleWallet } from "@/features/lealtad/google-wallet/jwt";
import {
  construirClaseLealtad,
  construirObjetoLealtad,
  generarEnlaceGoogleWallet,
  idClaseWallet,
  textoProgreso,
} from "@/features/lealtad/google-wallet/pass-builder";
import type { TarjetaPublica } from "@/features/lealtad/types";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const ISSUER = "3388000000012345678";
const ORIGEN = "https://app.symvora.com.mx";

const tarjeta: TarjetaPublica = {
  codigo: "ABCDEFGH2345",
  negocio: "Abarrotes Lupita",
  logo_url: null,
  paleta: "clara",
  color_acento: null,
  color_fondo: null,
  programa: "Clientes frecuentes",
  sellos_meta: 10,
  premio_descripcion: "Un refresco gratis",
  sellos: 4,
  premios_canjeados: 1,
  cliente: "Ana",
  activa: true,
};

function decodificar(parte: string) {
  return JSON.parse(Buffer.from(parte.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
}

describe("JWT de Google Wallet", () => {
  it("firma con RS256 y la firma se verifica con la llave publica", () => {
    const jwt = firmarJwtGoogleWallet(
      { iss: "svc@x.iam.gserviceaccount.com", aud: "google", typ: "savetowallet", iat: 1, payload: { loyaltyObjects: [] } },
      privateKey,
    );
    const [h, p, firma] = jwt.split(".");
    expect(decodificar(h)).toEqual({ alg: "RS256", typ: "JWT" });
    expect(decodificar(p).typ).toBe("savetowallet");
    const verificador = createVerify("RSA-SHA256");
    verificador.update(`${h}.${p}`);
    expect(verificador.verify(publicKey, Buffer.from(firma.replace(/-/g, "+").replace(/_/g, "/"), "base64"))).toBe(true);
  });
});

describe("clase y objeto del pase", () => {
  it("la clase sale del PROGRAMA, no del nombre: dos «Abarrotes» no la comparten", () => {
    const a = idClaseWallet(ISSUER, "11111111-1111-1111-1111-111111111111");
    const b = idClaseWallet(ISSUER, "22222222-2222-2222-2222-222222222222");
    expect(a).not.toBe(b);
    expect(a).toBe(idClaseWallet(ISSUER, "11111111-1111-1111-1111-111111111111"));
    expect(a.startsWith(`${ISSUER}.`)).toBe(true);
    // Solo caracteres validos en un id de Wallet y sin el uuid a la vista.
    expect(a).toMatch(/^[0-9]+\.[a-z0-9_]+$/);
    expect(a).not.toContain("1111-1111");
  });

  it("el objeto usa el codigo de la tarjeta, el primer nombre y el QR con el codigo", () => {
    const clase = construirClaseLealtad(ISSUER, "p1", tarjeta, ORIGEN);
    const objeto = construirObjetoLealtad(ISSUER, clase.id, tarjeta, ORIGEN);
    expect(objeto.id).toBe(`${ISSUER}.ABCDEFGH2345`);
    expect(objeto.accountName).toBe("Ana");
    expect(objeto.barcode).toMatchObject({ type: "QR_CODE", value: "ABCDEFGH2345" });
    expect(objeto.loyaltyPoints.balance.string).toBe("4 / 10");
    expect(objeto.linksModuleData?.uris[0].uri).toBe(`${ORIGEN}/es/tarjeta/ABCDEFGH2345`);
  });

  it("sin logo propio usa un PNG publico que si existe", () => {
    const clase = construirClaseLealtad(ISSUER, "p1", tarjeta, ORIGEN);
    expect(clase.programLogo?.sourceUri.uri).toBe(`${ORIGEN}/icons/icon-512.png`);
  });

  it("el saldo avisa cuando el premio esta listo", () => {
    expect(textoProgreso(10, 10)).toBe("¡Premio listo para canjear!");
    expect(textoProgreso(3, 10)).toBe("3 / 10");
  });

  it("el enlace de guardar lleva clase, objeto y origen firmados", () => {
    const url = generarEnlaceGoogleWallet(
      tarjeta,
      "p1",
      { issuerId: ISSUER, clientEmail: "svc@x.iam.gserviceaccount.com", privateKey },
      ORIGEN,
    );
    expect(url.startsWith("https://pay.google.com/gp/v/save/")).toBe(true);
    const payload = decodificar(url.split("/save/")[1].split(".")[1]);
    expect(payload.origins).toEqual([ORIGEN]);
    expect(payload.payload.loyaltyClasses[0].id).toBe(idClaseWallet(ISSUER, "p1"));
    expect(payload.payload.loyaltyObjects[0].classId).toBe(idClaseWallet(ISSUER, "p1"));
  });
});
