/**
 * Plantillas de WhatsApp que SYMVORA envia por la API oficial (Cloud API).
 *
 * UNICO lugar donde viven: cada plantilla se da de alta en Meta Business TAL
 * CUAL aparece aqui (nombre, idioma y el texto con sus {{n}} en el mismo
 * orden que `parametros`). Si Meta pide cambiar un texto al revisarla, se
 * cambia aqui y en Meta a la vez.
 *
 * Meta decide la categoria final. `categoria` es la que se pide: los avisos de
 * cuenta son UTILITY; los de seguimiento de abandono probablemente Meta los
 * clasifique como MARKETING (cuestan mas y piden aceptacion explicita).
 *
 * Puro (sin red ni base) para poder probarlo.
 */

import type { AvisoCobro } from "@/lib/avisos-cobro";
import { PRECIO_PROMO_MXN, precioListaMXN } from "@/features/payments/promocion";

export const IDIOMA_PLANTILLAS = "es_MX";

export const PLANTILLAS = {
  prueba_por_terminar: {
    categoria: "UTILITY",
    parametros: ["nombre", "negocio", "dias", "enlace"],
    texto:
      "Hola {{1}} 👋, la prueba gratis de {{2}} en SYMVORA termina en {{3}} días. Para seguir vendiendo sin interrupciones, activa tu plan aquí: {{4}}",
  },
  prueba_terminada: {
    categoria: "UTILITY",
    parametros: ["nombre", "negocio", "enlace"],
    texto:
      "Hola {{1}}, la prueba gratis de {{2}} en SYMVORA terminó. Tu información sigue guardada; activa tu plan para volver a vender: {{3}}",
  },
  aviso_cobro: {
    categoria: "UTILITY",
    parametros: ["nombre", "negocio", "detalle", "enlace"],
    texto:
      "Hola {{1}}, un aviso sobre la cuenta de {{2}} en SYMVORA: {{3}}. Revisa tu plan aquí: {{4}}",
  },
  corte_caja: {
    categoria: "UTILITY",
    parametros: ["negocio", "sucursal", "quien", "ventas", "diferencia"],
    texto:
      "Corte de caja en {{1}} ({{2}}): {{3}}. Ventas: {{4}}. Diferencia: {{5}}. El detalle completo está en tu correo.",
  },
  cambio_contrasena: {
    categoria: "UTILITY",
    parametros: ["negocio", "correo"],
    texto:
      "Aviso de seguridad de {{1}} en SYMVORA: se cambió la contraseña de la cuenta {{2}}. Si no fuiste tú, respóndenos este mensaje de inmediato.",
  },
  registro_incompleto: {
    categoria: "MARKETING",
    parametros: ["nombre", "negocio"],
    texto:
      "Hola {{1}} 👋, vimos que comenzaste a registrar tu negocio {{2}} en SYMVORA. ¿Tuviste algún problema al crear tu cuenta? Te ayudamos a dejar listo tu punto de venta en 2 minutos por este medio. 🚀",
  },
  onboarding_ayuda: {
    categoria: "MARKETING",
    parametros: ["nombre", "enlace"],
    texto:
      "Hola {{1}}, te saluda el equipo de SYMVORA. Notamos que aún no has cargado tus productos o tu primera venta. ¿Te ayudamos a importar tu inventario desde Excel? También tienes una guía de 3 minutos para empezar hoy: {{2}}",
  },
  pago_pendiente: {
    categoria: "MARKETING",
    parametros: ["nombre", "precio", "enlace"],
    texto:
      "Hola {{1}} 👋, queremos ayudarte a mantener activo SYMVORA. Vimos que intentaste activar tu plan ({{2}}). Puedes pagar con tarjeta, en OXXO o por transferencia desde aquí: {{3}}. ¿Necesitas ayuda? Responde este mensaje.",
  },
} as const;

export type NombrePlantilla = keyof typeof PLANTILLAS;

export type ValoresPlantilla<N extends NombrePlantilla> = Record<
  (typeof PLANTILLAS)[N]["parametros"][number],
  string
>;

/**
 * Parametros en el orden de la plantilla, limpios para Meta: la API rechaza
 * saltos de linea, tabuladores y mas de 4 espacios seguidos, y un parametro
 * vacio. Tambien se acota el largo para que un nombre absurdo no tumbe el
 * envio.
 */
export function parametrosPlantilla<N extends NombrePlantilla>(
  nombre: N,
  valores: ValoresPlantilla<N>
): string[] {
  const claves = PLANTILLAS[nombre].parametros as readonly string[];
  return claves.map((clave) => {
    const valor = (valores as Record<string, string>)[clave] ?? "";
    const limpio = valor.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, 200);
    return limpio || "-";
  });
}

/** Texto final como lo veria la persona (para pruebas y registros). */
export function textoPlantilla<N extends NombrePlantilla>(
  nombre: N,
  valores: ValoresPlantilla<N>
): string {
  const params = parametrosPlantilla(nombre, valores);
  return PLANTILLAS[nombre].texto.replace(/\{\{(\d+)\}\}/g, (_, n) => params[Number(n) - 1] ?? "");
}

const fechaCorta = (d?: Date | null) =>
  d ? d.toLocaleDateString("es-MX", { day: "numeric", month: "long", timeZone: "America/Mexico_City" }) : "";

/**
 * El `{{3}}` de `aviso_cobro`: lo mismo que dice el asunto del correo de cada
 * aviso (`sendAvisoCobroEmail`), en una frase.
 */
export function detalleAvisoCobro(
  tipo: AvisoCobro,
  datos: {
    venceEl?: Date | null;
    cobroFallido?: boolean;
    limiteDatos?: Date | null;
  }
): string {
  switch (tipo) {
    case "renovacion":
      return `tu mensualidad vence el ${fechaCorta(datos.venceEl)}; genera tu referencia de pago con tiempo`;
    case "gracia":
      return datos.cobroFallido
        ? "no pudimos cobrar tu mensualidad; tienes 3 días para pagar sin perder el acceso"
        : "tu mensualidad venció; tienes 3 días para pagar sin perder el acceso";
    case "solo_lectura":
      return "tu cuenta está en solo lectura; tu información sigue intacta y vuelves a vender al pagar";
    case "regreso":
      return `tienes tu primer mes de regreso a $${PRECIO_PROMO_MXN} en vez de $${precioListaMXN("monthly")}`;
    case "ultimo":
      return `tu información se conserva hasta el ${fechaCorta(datos.limiteDatos)}; es la última oportunidad para recuperarla`;
  }
}
