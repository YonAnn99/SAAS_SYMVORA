import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Registro a la tarjeta de lealtad con el QR del local (migracion 121):
// helpers puros, contrato de la migracion y la ruta POST /api/lealtad/unirse.

const rpc = vi.fn();
const rateLimit = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  consumirRateLimit: (...args: unknown[]) => rateLimit(...args),
  cabecerasRateLimit: () => ({}),
  obtenerIpCliente: () => "1.2.3.4",
}));

vi.mock("@/lib/supabase/server.server", () => ({
  createSupabaseServiceRoleClient: () => ({ rpc: (...args: unknown[]) => rpc(...args) }),
}));

import { POST } from "@/app/api/lealtad/unirse/route";
import {
  agregarMiTarjeta,
  codigoAltaValido,
  codigoDesdeEscaneo,
  leerMisTarjetas,
  nombreAltaValido,
  textoPremioCartel,
  ultimos10,
  urlAlta,
} from "@/features/lealtad/lealtad";

const SQL = readFileSync(join(process.cwd(), "supabase/migrations/121_lealtad_alta_con_qr.sql"), "utf8");

function cuerpoDe(funcion: string): string {
  const desde = SQL.slice(SQL.indexOf(`FUNCTION public.${funcion}(`));
  return desde.slice(0, desde.indexOf("$$;", desde.indexOf("AS $$")));
}

describe("helpers del registro con QR", () => {
  it("el codigo del cartel: 10 caracteres del alfabeto de las tarjetas", () => {
    expect(codigoAltaValido(" 8d8cxjzay8 ")).toBe("8D8CXJZAY8");
    expect(codigoAltaValido("8D8CXJZAY")).toBeNull();
    expect(codigoAltaValido("0O1ILUAAAA")).toBeNull();
    expect(codigoAltaValido(undefined)).toBeNull();
  });

  it("arma el enlace del cartel con idioma, y el POS no lo confunde con una tarjeta", () => {
    const url = urlAlta("8D8CXJZAY8", "es", "https://app.symvora.com.mx/");
    expect(url).toBe("https://app.symvora.com.mx/es/tarjeta/unirse/8D8CXJZAY8");
    expect(urlAlta("8D8CXJZAY8", "fr", "https://x.mx")).toBe("https://x.mx/es/tarjeta/unirse/8D8CXJZAY8");
    expect(codigoDesdeEscaneo(url)).toBeNull();
  });

  it("nombre: misma regla que la base", () => {
    expect(nombreAltaValido("  Ana   López ")).toBe(true);
    expect(nombreAltaValido("A")).toBe(false);
    expect(nombreAltaValido("x".repeat(61))).toBe(false);
    for (const malo of ["http://spam.mx", "www.promo.com", "ana@correo.com", "<b>Ana</b>", "Ana/Luis"]) {
      expect(nombreAltaValido(malo), malo).toBe(false);
    }
    // El patron del SQL es el mismo que el del cliente.
    expect(cuerpoDe("alta_publica_lealtad")).toContain("v_nombre ~* '(https?:|www\\.|[<>/@])'");
  });

  it("celular: se comparan los ultimos 10 digitos, sin importar el formato", () => {
    expect(ultimos10("+52 (55) 1234-5678")).toBe("5512345678");
    expect(ultimos10("5512345678")).toBe("5512345678");
    expect(ultimos10(null)).toBe("");
    expect(cuerpoDe("alta_publica_lealtad")).toContain("right(regexp_replace(coalesce(c.telefono, ''), '\\D', '', 'g'), 10)");
  });

  it("mis tarjetas: lista tolerante y sin repetidos por cartel", () => {
    expect(leerMisTarjetas(null)).toEqual([]);
    expect(leerMisTarjetas("no es json")).toEqual([]);
    expect(leerMisTarjetas(JSON.stringify([{ codigoAlta: "A", codigo: "malo" }, { x: 1 }]))).toEqual([]);
    const una = { codigoAlta: "8D8CXJZAY8", codigo: "G36F5Q6379JA" };
    const lista = agregarMiTarjeta(agregarMiTarjeta([], una), { ...una, codigo: "BFFBFSXK9SWP" });
    expect(lista).toEqual([{ codigoAlta: "8D8CXJZAY8", codigo: "BFFBFSXK9SWP" }]);
    expect(leerMisTarjetas(JSON.stringify(lista))).toEqual(lista);
  });

  it("texto del premio en el cartel", () => {
    expect(textoPremioCartel(10, " Café grande gratis ")).toBe("Junta 10 sellos y llévate: Café grande gratis");
  });
});

describe("contrato de la migracion 121", () => {
  it("el alta solo la puede llamar service_role (la ruta valida Turnstile antes)", () => {
    expect(SQL).toMatch(
      /REVOKE ALL ON FUNCTION public\.alta_publica_lealtad\(text, text, text\) FROM PUBLIC, anon, authenticated;/
    );
    expect(SQL).toMatch(/GRANT EXECUTE ON FUNCTION public\.alta_publica_lealtad\(text, text, text\) TO service_role;/);
  });

  it("un celular repetido no recibe tarjeta ni la suya", () => {
    const cuerpo = cuerpoDe("alta_publica_lealtad");
    const repetido = cuerpo.slice(cuerpo.indexOf("IF EXISTS (\n    SELECT 1 FROM public.clientes c"));
    expect(repetido.slice(0, repetido.indexOf("END IF;"))).toMatch(/RETURN jsonb_build_object\('estado', 'ya_registrado'\);/);
    expect(repetido.slice(0, repetido.indexOf("END IF;"))).not.toMatch(/codigo/);
  });

  it("revisa acceso, demo, tope diario y bloquea el programa", () => {
    const cuerpo = cuerpoDe("alta_publica_lealtad");
    expect(cuerpo).toMatch(/FOR UPDATE;/);
    expect(cuerpo).toMatch(/acceso_tenant\(v_programa\.tenant_id\)/);
    expect(cuerpo).toMatch(/demo_expira_en IS NOT NULL/);
    expect(cuerpo).toMatch(/v_altas_hoy >= c_tope_diario/);
  });

  it("la pagina del cartel no expone clientes, contacto ni montos", () => {
    const cuerpo = cuerpoDe("programa_alta_publica");
    for (const campo of ["clientes", "telefono", "email", "saldo_pendiente", "sellos\\b", "total"]) {
      expect(cuerpo, campo).not.toMatch(new RegExp(`\\b${campo}`));
    }
    expect(SQL).toMatch(/GRANT EXECUTE ON FUNCTION public\.programa_alta_publica\(text\) TO anon, authenticated;/);
  });

  it("el codigo del cartel no se escribe a mano", () => {
    expect(cuerpoDe("_programas_lealtad_codigo_alta")).toMatch(/NEW\.codigo_alta := CASE WHEN TG_OP = 'UPDATE' THEN OLD\.codigo_alta/);
  });
});

describe("POST /api/lealtad/unirse", () => {
  const fetchOriginal = globalThis.fetch;
  const valido = {
    codigoAlta: "8D8CXJZAY8",
    nombre: "Ana López",
    pais: "MX",
    numero: "5512345678",
    acepto: true,
    token: "tok",
  };
  const pedir = (cuerpo: unknown) =>
    POST(new Request("http://localhost/api/lealtad/unirse", { method: "POST", body: JSON.stringify(cuerpo) }));
  const turnstile = (success: boolean) =>
    vi.fn(async () => new Response(JSON.stringify({ success }), { status: 200 })) as unknown as typeof fetch;

  beforeEach(() => {
    process.env.TURNSTILE_SECRET_KEY = "secreto";
    rpc.mockReset();
    rateLimit.mockReset().mockResolvedValue({ permitido: true });
    globalThis.fetch = turnstile(true);
  });
  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    delete process.env.TURNSTILE_SECRET_KEY;
  });

  it("alta valida: llama el RPC con el celular en E.164 y devuelve el codigo", async () => {
    rpc.mockResolvedValue({ data: { estado: "creada", codigo: "BFFBFSXK9SWP" }, error: null });
    const res = await pedir({ ...valido, nombre: "  Ana   López " });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ estado: "creada", codigo: "BFFBFSXK9SWP" });
    expect(rpc).toHaveBeenCalledWith("alta_publica_lealtad", {
      p_codigo_alta: "8D8CXJZAY8",
      p_nombre: "Ana López",
      p_telefono: "+525512345678",
    });
  });

  it("sin llave de Turnstile no hay altas (503)", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const res = await pedir(valido);
    expect(res.status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("Turnstile rechazado (403) o sin token: no escribe nada", async () => {
    globalThis.fetch = turnstile(false);
    expect((await pedir(valido)).status).toBe(403);
    expect((await pedir({ ...valido, token: null })).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("Cloudflare no responde: 503", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("timeout");
    }) as unknown as typeof fetch;
    expect((await pedir(valido)).status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sin aceptar el aviso, nombre o celular malos: 400", async () => {
    expect((await pedir({ ...valido, acepto: false })).status).toBe(400);
    expect((await pedir({ ...valido, nombre: "www.spam.com" })).status).toBe(400);
    expect((await pedir({ ...valido, numero: "123" })).status).toBe(400);
    expect((await pedir({ ...valido, codigoAlta: "corto" })).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("el campo trampa lleno responde como repetido y no escribe", async () => {
    const res = await pedir({ ...valido, sitio: "http://bot" });
    expect(await res.json()).toEqual({ estado: "ya_registrado" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("limite por IP: 429 antes de todo", async () => {
    rateLimit.mockResolvedValue({ permitido: false });
    expect((await pedir(valido)).status).toBe(429);
    expect(rpc).not.toHaveBeenCalled();
    expect(rateLimit).toHaveBeenCalledWith("lealtad-alta:1.2.3.4", 10, 600);
  });

  it("los errores del RPC salen legibles y con su estado", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Hoy ya no se pueden registrar mas tarjetas aqui. Pidela en caja" } });
    const tope = await pedir(valido);
    expect(tope.status).toBe(429);
    expect((await tope.json()).error).toMatch(/Pídela en caja/);

    rpc.mockResolvedValue({ data: null, error: { message: "Este registro no esta disponible" } });
    expect((await pedir(valido)).status).toBe(404);

    rpc.mockResolvedValue({ data: null, error: { message: "El registro no esta disponible por ahora" } });
    expect((await pedir(valido)).status).toBe(409);
  });

  it("celular repetido: lo dice sin devolver ninguna tarjeta", async () => {
    rpc.mockResolvedValue({ data: { estado: "ya_registrado" }, error: null });
    const res = await pedir(valido);
    expect(await res.json()).toEqual({ estado: "ya_registrado" });
  });
});
