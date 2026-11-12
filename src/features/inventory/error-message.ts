/**
 * Traduce a castellano legible lo que devuelve la base de datos.
 *
 * Los mensajes que llegan de Postgres y de PostgREST no son presentables:
 * `ajustar_inventario` lanza su tope de stock en ingles y PostgREST responde
 * con su jerga de cache de esquema. Al cajero le salian tal cual.
 */

/**
 * Saca el texto del error venga como venga.
 *
 * ⚠️ NO BASTA CON `instanceof Error`. supabase-js **no lanza excepciones**:
 * devuelve `{ message, details, hint, code }`, un objeto plano que no hereda de
 * `Error`. Comprobando solo `Error` el texto salia siempre vacio y cualquier
 * traduccion posterior era codigo muerto: el usuario recibia el mensaje
 * generico pasara lo que pasara.
 */
function textoDelError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    const msg = typeof obj.message === "string" ? obj.message : "";
    const det = typeof obj.details === "string" ? obj.details : "";
    return `${msg} ${det}`.trim();
  }
  return "";
}

/** Errores conocidos; la interfaz los traduce (`inventory.errors.<codigo>`). */
export type CodigoErrorInventario =
  | "barcodeDuplicate"
  | "skuDuplicate"
  | "negativeStock"
  | "noPermission"
  | "notAvailable"
  | "generic";

/** Codigo del error y, si no se reconoce, su texto crudo (viene del servidor). */
export function codigoDeError(error: unknown): { codigo: CodigoErrorInventario; crudo: string } {
  const crudo = textoDelError(error);
  if (
    crudo.includes("uq_productos_tenant_codigo_barras") ||
    (crudo.includes("23505") && crudo.includes("codigo_barras"))
  ) {
    return { codigo: "barcodeDuplicate", crudo };
  }
  if (crudo.includes("uq_productos_tenant_sku") || (crudo.includes("23505") && crudo.includes("sku"))) {
    return { codigo: "skuDuplicate", crudo };
  }
  if (crudo.includes("Stock cannot be negative")) return { codigo: "negativeStock", crudo };
  if (crudo.includes("row-level security") || crudo.includes("No tienes permiso")) {
    return { codigo: "noPermission", crudo };
  }
  // La tabla de favoritos llega en la migracion 064. Si el codigo se despliega
  // antes que ella, PostgREST responde 404 con "Could not find the table
  // 'public.productos_favoritos' in the schema cache".
  if (crudo.includes("schema cache") || crudo.includes("does not exist")) {
    return { codigo: "notAvailable", crudo };
  }
  return { codigo: "generic", crudo };
}

const MENSAJE_ES: Record<CodigoErrorInventario, string> = {
  barcodeDuplicate: "Ya existe un producto con este código de barras",
  skuDuplicate: "Ya existe un producto con este SKU",
  negativeStock: "El stock no puede quedar en negativo",
  noPermission: "No tienes permiso para modificar productos",
  notAvailable: "Esta función aún no está disponible en tu base de datos",
  generic: "No se pudo guardar el cambio",
};

/**
 * El mensaje en espanol. Con `traducir` (el `t` de `inventory.errors`) sale en el
 * idioma activo; un error desconocido muestra su texto crudo del servidor.
 */
export function mensajeDeError(error: unknown, traducir?: (codigo: CodigoErrorInventario) => string): string {
  const { codigo, crudo } = codigoDeError(error);
  if (codigo === "generic" && crudo) return crudo;
  return traducir ? traducir(codigo) : MENSAJE_ES[codigo];
}
