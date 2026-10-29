/**
 * Lo que devuelven `catalogo_publico` y `catalogo_publico_productos`
 * (migración 124). Solo lo que se pinta en la página pública: nada de costos,
 * códigos internos ni existencias exactas.
 */

export interface CatalogoEncabezado {
  slug: string;
  negocio: string;
  logo_url: string | null;
  color: string | null;
  direccion: string | null;
  /** E.164 con "+": a dónde se manda el pedido. */
  whatsapp: string;
  mensaje: string | null;
  mostrar_precios: boolean;
  total: number;
  categorias: { nombre: string; total: number }[];
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
  disponible: boolean;
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
}
