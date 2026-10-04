/**
 * Tipos y colores de Usuarios, compartidos por la pagina (tablas de
 * escritorio) y las listas deslizables del celular.
 */

export const roleColors: Record<string, string> = {
  SUPER_ADMIN: "bg-[#FDEBEC] text-[#9F2F2D] dark:bg-[#9F2F2D]/20 dark:text-[#F2A5A4]",
  ORG_ADMIN: "bg-[#E1F3FE] text-[#1F6C9F] dark:bg-[#1F6C9F]/20 dark:text-[#7BB8DA]",
  CAJERO: "bg-[#EDF3EC] text-[#346538] dark:bg-[#346538]/20 dark:text-[#7BC67E]",
};

export interface Member {
  id: string;
  tenant_id: string;
  user_id: string;
  role: string;
  creado_en: string;
  user_email: string;
  /** `nombre_de_usuario()` de la base (migracion 101); `null` si no tiene. */
  user_nombre: string | null;
}

export interface InviteKey {
  id: string;
  email: string;
  key: string;
  role: string;
  created_at: string;
  /** Capturados al invitar (migracion 101). Las claves viejas no los tienen. */
  nombre: string | null;
  apellido: string | null;
}

/** Nombre para mostrar; sin nombre, el correo (como antes de la migracion 101). */
export const nombreVisible = (nombre: string | null | undefined, email: string | null | undefined) =>
  nombre?.trim() || email || "N/A";

/** Nombre completo capturado en una clave de invitacion, o `null`. */
export const nombreDeClave = (clave: Pick<InviteKey, "nombre" | "apellido">) =>
  [clave.nombre, clave.apellido].map((x) => x?.trim()).filter(Boolean).join(" ") || null;

export const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
