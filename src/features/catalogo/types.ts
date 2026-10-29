/**
 * Lo que devuelven `catalogo_publico` y `catalogo_publico_productos`
 * (migraciones 124-125), y sus gemelas de vista previa. Solo lo que se pinta en
 * la página pública: nada de costos, códigos internos ni existencias exactas.
 */

export interface CatalogoEncabezado {
  /** NULL solo en la vista previa de un catálogo que nunca se ha guardado. */
  slug: string | null;
  /** Solo útil en la vista previa: el público nunca ve uno apagado. */
  activo?: boolean;
  negocio: string;
  logo_url: string | null;
  color: string | null;
  /** Imagen del encabezado (125). Ausente en la respuesta de la 124. */
  portada_url?: string | null;
  direccion: string | null;
  /** E.164 con "+": a dónde se manda el pedido. NULL en una vista previa sin configurar. */
  whatsapp: string | null;
  mensaje: string | null;
  mostrar_precios: boolean;
  total: number;
  categorias: { nombre: string; total: number }[];
  /** Hasta 12, para la fila de arriba (125). */
  destacados?: CatalogoProducto[];
}

export interface CatalogoVariante {
  id: string;
  etiqueta: string;
  /** Ausente si el negocio no muestra precios. */
  precio?: number;
  imagen_url: string | null;
  unidad_medida: string;
  disponible: boolean;
}

export interface CatalogoProducto {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  imagen_url: string | null;
  unidad_medida: string;
  contenido_cantidad: number | null;
  contenido_unidad: string | null;
  es_servicio: boolean;
  /** NULL si el negocio no muestra precios. Con variantes, el rango. */
  precio_min: number | null;
  precio_max: number | null;
  /** Precio solo del catálogo (125; sin variantes). El POS cobra el normal. */
  precio_especial?: number | null;
  disponible: boolean;
  destacado?: boolean;
  variantes: CatalogoVariante[];
}

export interface CatalogoPagina {
  total: number;
  productos: CatalogoProducto[];
}

/** La configuración que edita el negocio (tabla `catalogos_en_linea`). */
export interface CatalogoConfig {
  tenant_id: string;
  activo: boolean;
  slug: string;
  whatsapp: string | null;
  mostrar_precios: boolean;
  mostrar_agotados: boolean;
  mensaje: string | null;
  /** Color del catálogo (125); NULL = el del negocio o el azul de SYMVORA. */
  color: string | null;
  portada_url: string | null;
}

/** Ajustes de un producto en el catálogo (tabla `catalogo_productos`, 125). */
export interface AjusteProductoCatalogo {
  oculto: boolean;
  destacado: boolean;
  precio_especial: number | null;
}
