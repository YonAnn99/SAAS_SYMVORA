/**
 * A quién le llega el correo de una novedad (`/api/cron/anuncio-novedad`).
 * Puro: la ruta junta los datos y aquí se decide, para poder probarlo.
 *
 * Reglas:
 * - solo el dueño (SUPER_ADMIN) de un negocio real;
 * - nada de demos (negocio con `demo_expira_en` o usuario `is_demo`);
 * - nada de cuentas en solo lectura: no podrían activarlo;
 * - quien ya creó su catálogo no lo necesita;
 * - un correo por persona aunque sea dueña de varios negocios.
 */

import type { Acceso } from "@/lib/acceso-suscripcion";
import { nombreCompleto, primerNombre } from "@/lib/nombre-usuario";

export interface CandidatoNovedad {
  tenantId: string;
  negocio: string;
  esDemo: boolean;
  acceso: Acceso | null;
  tieneCatalogo: boolean;
  userId: string;
  email: string | null;
  meta: Record<string, unknown> | null;
  appMeta: Record<string, unknown> | null;
}

export interface DestinatarioNovedad {
  tenantId: string;
  userId: string;
  to: string;
  nombre: string;
  negocio: string;
}

export type MotivoExclusion = "demo" | "solo_lectura" | "ya_tiene_catalogo" | "sin_correo" | "repetido";

export interface ResultadoDestinatarios {
  destinatarios: DestinatarioNovedad[];
  excluidos: { negocio: string; motivo: MotivoExclusion }[];
}

export function elegirDestinatarios(candidatos: readonly CandidatoNovedad[]): ResultadoDestinatarios {
  const destinatarios: DestinatarioNovedad[] = [];
  const excluidos: ResultadoDestinatarios["excluidos"] = [];
  const vistos = new Set<string>();

  // Orden estable: el mismo dueño siempre recibe el correo con el mismo negocio.
  const ordenados = [...candidatos].sort((a, b) => a.negocio.localeCompare(b.negocio, "es"));

  for (const c of ordenados) {
    const excluir = (motivo: MotivoExclusion) => excluidos.push({ negocio: c.negocio, motivo });
    if (c.esDemo || c.appMeta?.is_demo === true) excluir("demo");
    else if (c.acceso === "solo_lectura" || c.acceso === null) excluir("solo_lectura");
    else if (c.tieneCatalogo) excluir("ya_tiene_catalogo");
    else if (!c.email) excluir("sin_correo");
    else if (vistos.has(c.userId)) excluir("repetido");
    else {
      vistos.add(c.userId);
      destinatarios.push({
        tenantId: c.tenantId,
        userId: c.userId,
        to: c.email,
        nombre: primerNombre(nombreCompleto(c.meta ?? {})),
        negocio: c.negocio,
      });
    }
  }

  return { destinatarios, excluidos };
}

/** Clave de `consumirRateLimit`: un correo por persona y novedad, aunque se corra dos veces. */
export function claveCorreoNovedad(novedadId: string, userId: string): string {
  return `novedad-correo:${novedadId}:${userId}`;
}
