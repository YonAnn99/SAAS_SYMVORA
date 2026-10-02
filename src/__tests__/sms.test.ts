import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aGSM7, MAX_SMS, textoCorteCajaSMS } from "@/lib/sms-texto";
import { enviarSMS, smsActivo } from "@/lib/sms-api";

const SOLO_GSM7 = /^[@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà]*$/;

describe("aGSM7", () => {
  it("quita acentos pero conserva la ñ", () => {
    expect(aGSM7("Cerró su caja: Peña Ñandú, cuadró")).toBe("Cerro su caja: Peña Ñandu, cuadro");
  });

  it("quita emojis, cambia comillas tipográficas y compacta espacios", () => {
    expect(aGSM7("Hola 👋  “Ana”\n—Centro…")).toBe('Hola "Ana" -Centro...');
  });
});

describe("textoCorteCajaSMS", () => {
  const valores = {
    negocio: "Abarrotes Ana",
    sucursal: "Centro",
    quien: "Juan cerró su caja",
    ventas: "$12,340.00",
    diferencia: "cuadró exacto",
  };

  it("arma el aviso en un solo SMS sin acentos", () => {
    const texto = textoCorteCajaSMS(valores);
    expect(texto).toBe(
      "SYMVORA: Corte de caja en Abarrotes Ana (Centro): Juan cerro su caja. Ventas $12,340.00. Diferencia: cuadro exacto. Detalle en tu correo."
    );
    expect(texto.length).toBeLessThanOrEqual(MAX_SMS);
    expect(texto).toMatch(SOLO_GSM7);
  });

  it("recorta negocio y sucursal muy largos para no pasar de 160", () => {
    const texto = textoCorteCajaSMS({
      ...valores,
      negocio: "Abarrotes y Misceláneas La Gran Señora del Barrio de Santa Úrsula Coapa",
      sucursal: "Sucursal Avenida Insurgentes Sur esquina con Periférico",
      quien: "la caja de María Fernanda se cerró automáticamente",
      diferencia: "sin conteo (cierre automático)",
    });
    expect(texto.length).toBeLessThanOrEqual(MAX_SMS);
    expect(texto).toMatch(SOLO_GSM7);
    expect(texto).toContain("...");
    expect(texto).toContain("Ventas $12,340.00");
  });
});

describe("enviarSMS", () => {
  const ENV = { ...process.env };
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "secreto";
    process.env.TWILIO_FROM = "+15005550006";
    delete process.env.TWILIO_MESSAGING_SERVICE_SID;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    process.env = { ...ENV };
    vi.unstubAllGlobals();
  });

  it("está apagado sin las variables de Twilio", async () => {
    delete process.env.TWILIO_FROM;
    expect(smsActivo()).toBe(false);
    expect(await enviarSMS("+525512345678", "hola")).toEqual({ enviado: false, motivo: "desactivado" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("llama a la API de Twilio con auth y formulario", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ sid: "SM1" }), { status: 201 }));
    expect(await enviarSMS("+525512345678", "Corte de caja")).toEqual({ enviado: true, id: "SM1" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("AC123:secreto").toString("base64")}`);
    const cuerpo = new URLSearchParams(init.body);
    expect(cuerpo.get("To")).toBe("+525512345678");
    expect(cuerpo.get("From")).toBe("+15005550006");
    expect(cuerpo.get("Body")).toBe("Corte de caja");
  });

  it("devuelve el error de Twilio sin lanzar", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "The number is unverified" }), { status: 400 })
    );
    expect(await enviarSMS("+525512345678", "x")).toEqual({
      enviado: false,
      motivo: "error",
      error: "The number is unverified",
    });
  });
});
