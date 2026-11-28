/**
 * Correos internos (a hola@) de «Eliminar mi cuenta»: quién lo pidió, en qué negocio y si era el último
 * usuario. Puro: los datos llegan ya leídos del servidor (service role), nunca del cuerpo de la petición.
 */

export interface PersonaBaja {
  nombre: string | null;
  correo: string | null;
  /** Rol en el negocio: SUPER_ADMIN, ORG_ADMIN, CAJERO... */
  rol: string | null;
}

export interface DatosAvisoBaja {
  persona: PersonaBaja;
  negocio: string;
  /** Personas con acceso al negocio (incluida ésta). */
  miembros: number;
  conservarContacto: boolean;
  motivo: string | null;
}

export interface AvisoSolicitud extends DatosAvisoBaja {
  tipo: "solicitud";
  /** Fecha en que se borrará (ISO). */
  ejecutarEn: string;
}

export interface AvisoCancelacion extends DatosAvisoBaja {
  tipo: "cancelacion";
  solicitadaEn: string;
  canceladaEn: string;
}

export interface CorreoBaja {
  subject: string;
  text: string;
  html: string;
}

const ROLES: Record<string, string> = {
  SUPER_ADMIN: "dueño",
  ORG_ADMIN: "administrador",
  CAJERO: "cajero",
};

const esc = (valor: string) => valor.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] as string);

const fechaMx = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** «Nombre (correo)», o lo que haya. */
export function etiquetaPersona(p: PersonaBaja): string {
  if (p.nombre && p.correo) return `${p.nombre} (${p.correo})`;
  return p.nombre ?? p.correo ?? "sin correo";
}

function rolTexto(rol: string | null): string {
  return (rol && ROLES[rol]) || "colaborador";
}

/** El correo es del último usuario: si se borra, el negocio queda sin nadie que lo use. */
export function esUltimoUsuario(miembros: number): boolean {
  return miembros <= 1;
}

export function construirAvisoBaja(aviso: AvisoSolicitud | AvisoCancelacion): CorreoBaja {
  const persona = etiquetaPersona(aviso.persona);
  const rol = rolTexto(aviso.persona.rol);
  const esDueno = aviso.persona.rol === "SUPER_ADMIN";
  const etiqueta = aviso.persona.nombre ?? aviso.persona.correo ?? "sin correo";
  const motivo = aviso.motivo?.trim() || "(sin motivo)";
  const conserva = aviso.conservarContacto ? "sí" : "no";
  const lineas: string[] = [];

  if (aviso.tipo === "solicitud") {
    const subject = `Solicitud de eliminación: ${aviso.negocio} · ${etiqueta}`;
    lineas.push(
      `${esDueno ? "El dueño" : "Un colaborador"} (${rol}) de «${aviso.negocio}» pidió eliminar su cuenta: ${persona}.`,
      `Se ejecuta el ${fechaMx(aviso.ejecutarEn)}.`,
      esDueno
        ? "Se borrará el negocio completo."
        : "Solo se cierra su acceso; el negocio sigue con sus demás usuarios."
    );
    lineas.push(`El negocio tiene ${aviso.miembros} ${aviso.miembros === 1 ? "persona" : "personas"} con acceso.`);
    if (esUltimoUsuario(aviso.miembros)) {
      lineas.push("ES EL ÚLTIMO USUARIO: el negocio quedaría sin acceso.");
    }
    lineas.push(`Conservar contacto: ${conserva}.`, `Motivo: ${motivo}`);
    return { subject, text: lineas.join("\n"), html: aHtml(lineas) };
  }

  const subject = `Canceló su solicitud de eliminación: ${aviso.negocio} · ${etiqueta}`;
  const minutos = Math.max(
    0,
    Math.round((new Date(aviso.canceladaEn).getTime() - new Date(aviso.solicitadaEn).getTime()) / 60000)
  );
  lineas.push(
    `${persona} canceló su solicitud de eliminación de «${aviso.negocio}» (${rol}).`,
    `La había pedido el ${fechaMx(aviso.solicitadaEn)} y la canceló ${minutos} ${minutos === 1 ? "minuto" : "minutos"} después.`,
    `Motivo original: ${motivo}.`,
    "Ya no se borra nada: la cuenta sigue activa."
  );
  return { subject, text: lineas.join("\n"), html: aHtml(lineas) };
}

function aHtml(lineas: string[]): string {
  return lineas
    .map((l) => {
      const texto = esc(l);
      return l.startsWith("ES EL ÚLTIMO USUARIO") ? `<p><strong>${texto}</strong></p>` : `<p>${texto}</p>`;
    })
    .join("");
}
