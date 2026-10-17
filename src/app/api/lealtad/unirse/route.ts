import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { cabecerasRateLimit, consumirRateLimit, obtenerIpCliente } from "@/lib/rate-limit";
import { verificarTurnstile } from "@/lib/turnstile.server";
import { aE164 } from "@/lib/telefono";
import { codigoAltaValido, limpiarNombre, nombreAltaValido } from "@/features/lealtad/lealtad";
import type { ResultadoAlta } from "@/features/lealtad/types";

export const maxDuration = 15;

/** 10 altas cada 10 min por IP: los clientes en el wifi del local comparten IP. */
const LIMITE_POR_IP = 10;
const VENTANA_SEGUNDOS = 600;

const esquema = z.object({
  codigoAlta: z.string().max(20),
  nombre: z.string().max(120),
  pais: z.string().max(4),
  numero: z.string().max(30),
  acepto: z.literal(true),
  token: z.string().max(4096).nullable().optional(),
  /** Campo trampa: invisible para una persona; un bot lo llena. */
  sitio: z.string().max(200).optional(),
});

/** Mensajes del RPC (sin acentos, de la base) → lo que lee el cliente. */
const MENSAJES: [RegExp, string, number][] = [
  [/registro no esta disponible por ahora/i, "El registro no está disponible por ahora. Pide tu tarjeta en caja.", 409],
  [/registro no esta disponible/i, "Este registro ya no está disponible. Pide tu tarjeta en caja.", 404],
  [/ya no se pueden registrar/i, "Hoy ya no se pueden registrar más tarjetas aquí. Pídela en caja.", 429],
  [/tu nombre/i, "Escribe tu nombre (de 2 a 60 letras).", 400],
  [/celular/i, "Revisa tu número de celular.", 400],
];

/**
 * El cliente final se registra solo a la tarjeta de lealtad con el QR del
 * local (migracion 121). Sin sesion: esta ruta es la UNICA puerta a
 * `alta_publica_lealtad` (solo service_role), y antes de llamarla valida el
 * rate limit por IP y Turnstile en el servidor. Sin `TURNSTILE_SECRET_KEY` no
 * hay altas (503): falla cerrado.
 *
 * Nunca devuelve la tarjeta de un celular que ya existe en el negocio
 * (`ya_registrado`): quien tecleara el celular de otro se quedaria con su
 * codigo y su premio.
 */
export async function POST(request: Request) {
  const ip = obtenerIpCliente(request);
  const limite = await consumirRateLimit(`lealtad-alta:${ip}`, LIMITE_POR_IP, VENTANA_SEGUNDOS);
  if (!limite.permitido) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos o pide tu tarjeta en caja." },
      { status: 429, headers: cabecerasRateLimit(limite) }
    );
  }

  const parsed = esquema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisa tus datos y acepta el aviso de privacidad." }, { status: 400 });
  }
  const datos = parsed.data;

  // Un bot llena todo: se le responde como a un celular repetido, sin escribir nada.
  if (datos.sitio) {
    return NextResponse.json({ estado: "ya_registrado" } satisfies ResultadoAlta);
  }

  const codigoAlta = codigoAltaValido(datos.codigoAlta);
  const telefono = aE164(datos.pais, datos.numero);
  if (!codigoAlta) {
    return NextResponse.json({ error: "Este registro ya no está disponible." }, { status: 404 });
  }
  if (!nombreAltaValido(datos.nombre)) {
    return NextResponse.json({ error: "Escribe tu nombre (de 2 a 60 letras)." }, { status: 400 });
  }
  if (!telefono) {
    return NextResponse.json({ error: "Revisa tu número de celular." }, { status: 400 });
  }

  const captcha = await verificarTurnstile(datos.token, ip);
  if (!captcha.ok) {
    if (captcha.motivo === "sin-llave") {
      console.error("[lealtad/unirse] falta TURNSTILE_SECRET_KEY: el registro con QR esta apagado");
    }
    return captcha.motivo === "sin-llave" || captcha.motivo === "sin-respuesta"
      ? NextResponse.json({ error: "No pudimos verificar el registro. Intenta en un momento." }, { status: 503 })
      : NextResponse.json({ error: "Confirma que no eres un robot e intenta de nuevo." }, { status: 403 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("alta_publica_lealtad", {
    p_codigo_alta: codigoAlta,
    p_nombre: limpiarNombre(datos.nombre),
    p_telefono: telefono,
  });
  if (error) {
    const conocido = MENSAJES.find(([patron]) => patron.test(error.message));
    if (!conocido) console.error("[lealtad/unirse] fallo el alta:", error.message);
    return NextResponse.json(
      { error: conocido?.[1] ?? "No se pudo crear tu tarjeta. Intenta de nuevo." },
      { status: conocido?.[2] ?? 500 }
    );
  }

  const resultado = data as ResultadoAlta | null;
  if (!resultado || (resultado.estado !== "creada" && resultado.estado !== "ya_registrado")) {
    return NextResponse.json({ error: "No se pudo crear tu tarjeta. Intenta de nuevo." }, { status: 500 });
  }
  return NextResponse.json(resultado);
}
