import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";

/**
 * Rate limit compartido entre instancias.
 *
 * POR QUE NO UN Map EN MEMORIA: en serverless cada instancia tiene su propia
 * memoria y cada arranque en frio la vacia, asi que un contador local no limita
 * nada — N instancias concurrentes permiten N veces el limite. El estado tiene
 * que vivir donde todas las instancias lo ven igual, y aqui eso es Postgres.
 *
 * El conteo y el incremento ocurren en un unico enunciado SQL dentro del RPC
 * `consumir_rate_limit` (migracion 058), que es lo que evita la carrera bajo
 * concurrencia — justo el escenario en el que el limite tiene que servir.
 */

export interface RateLimitResult {
  permitido: boolean;
  contador: number;
  /** Cuando se vacia la ventana. Alimenta la cabecera `Retry-After`. */
  reiniciaEn: Date;
}

/**
 * Consume una unidad de cuota.
 *
 * `identificador` debe estar namespaceado por endpoint (p.ej. `demo-start:IP`)
 * para que dos rutas distintas no compartan contador.
 *
 * Si la base falla, **se permite la peticion** (fail-open). Es deliberado: un
 * rate limit es una proteccion secundaria, y caerse cerrado convertiria una
 * incidencia de base de datos en una caida total del endpoint. El fallo se
 * registra para que no pase inadvertido.
 */
export async function consumirRateLimit(
  identificador: string,
  limite: number,
  ventanaSegundos: number
): Promise<RateLimitResult> {
  try {
    const supabase = createSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .rpc("consumir_rate_limit", {
        p_clave: identificador,
        p_limite: limite,
        p_ventana_segundos: ventanaSegundos,
      })
      .single<{
        permitido: boolean;
        contador_actual: number;
        reinicia_en: string;
      }>();

    if (error || !data) {
      console.error("[rate-limit] fallo el RPC, se deja pasar:", error?.message);
      return {
        permitido: true,
        contador: 0,
        reiniciaEn: new Date(Date.now() + ventanaSegundos * 1000),
      };
    }

    return {
      permitido: data.permitido,
      contador: data.contador_actual,
      reiniciaEn: new Date(data.reinicia_en),
    };
  } catch (err) {
    console.error("[rate-limit] error inesperado, se deja pasar:", err);
    return {
      permitido: true,
      contador: 0,
      reiniciaEn: new Date(Date.now() + ventanaSegundos * 1000),
    };
  }
}

/**
 * IP del cliente a partir de las cabeceras del proxy.
 *
 * En Vercel `x-forwarded-for` lo fija la plataforma, asi que el primer valor es
 * fiable. Fuera de un proxy de confianza esta cabecera es falsificable y no
 * debe usarse para nada mas que un rate limit best-effort.
 */
export function obtenerIpCliente(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "desconocida";
}

/** Cabeceras estandar para una respuesta 429. */
export function cabecerasRateLimit(resultado: RateLimitResult): HeadersInit {
  const segundos = Math.max(
    1,
    Math.ceil((resultado.reiniciaEn.getTime() - Date.now()) / 1000)
  );
  return {
    "Retry-After": String(segundos),
    "X-RateLimit-Reset": resultado.reiniciaEn.toISOString(),
  };
}
