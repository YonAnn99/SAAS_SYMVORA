/**
 * Nombre de la persona a partir de `user_metadata` de Supabase Auth.
 *
 * El registro con correo y el de Google (completar-registro) lo guardan en
 * `nombre`; Mi perfil lo guardaba antes solo en `nombre_completo`/`full_name`, y
 * Google trae su propio `full_name`. Esta es la unica lectura: el perfil, el
 * saludo del Dashboard y quien lo necesite resuelven el mismo nombre.
 */
type Metadatos = Record<string, unknown> | null | undefined;

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Prioridad: lo editado en Mi perfil (`nombre_completo`), lo capturado en el
 * registro (`nombre`) y, al final, lo que manda Google (`full_name`).
 */
export function nombreCompleto(meta: Metadatos): string {
  return (
    texto(meta?.nombre_completo) || texto(meta?.nombre) || texto(meta?.full_name)
  );
}

/**
 * Primera palabra de un nombre completo: el campo "Nombre" del registro, que
 * se guarda como `nombre segundo paterno materno`.
 */
export function primerNombre(completo: string): string {
  return completo.trim().split(/\s+/)[0] ?? "";
}
