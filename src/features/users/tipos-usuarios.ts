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
}

export interface InviteKey {
  id: string;
  email: string;
  key: string;
  role: string;
  created_at: string;
}

export const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
