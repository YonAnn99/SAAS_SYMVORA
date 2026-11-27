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
  /** Moneda del negocio (133). Ausente en respuestas anteriores: pesos. */
  moneda?: string | null;
  /** Pedidos guardados (141-142): el formulario de pedido en vez del envío por WhatsApp. Ausente = no. */
  recibir_pedidos?: boolean;
  /** Costo de envío a domicilio (144): null/ausente = el negocio lo confirma; 0 = gratis. */
  costo_envio?: number | null;
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
  /** Guarda los pedidos del cliente final (141); apagado de fábrica. Solo con el plan que lo incluye. */
  recibir_pedidos: boolean;
  /** Costo de envío a domicilio (144); NULL = «el negocio confirma el costo», 0 = gratis. */
  costo_envio: number | null;
  /** Días para recoger el pedido (146); NULL = no se muestra. */
  plazo_retiro_dias: number | null;
}

/** Ajustes de un producto en el catálogo (tabla `catalogo_productos`, 125). */
export interface AjusteProductoCatalogo {
  oculto: boolean;
  destacado: boolean;
  precio_especial: number | null;
}

/** Lo que devuelve `pedido_publico` (141-146): la página de seguimiento. Sin teléfono, dirección del cliente ni notas. */
export interface PedidoPublico {
  folio: number;
  /** Estado base del motor (`nuevo`…`cancelado`). */
  estado: string;
  /** Nombre del estado propio del negocio (146). */
  estado_nombre: string;
  estado_color: string | null;
  entrega: "recoger" | "domicilio";
  pagado: boolean;
  creado_en: string;
  actualizado_en: string | null;
  negocio: string;
  logo_url: string | null;
  /** Dirección del NEGOCIO (no del cliente): para «Cómo llegar». */
  direccion_negocio: string | null;
  moneda: string | null;
  color: string | null;
  slug: string | null;
  whatsapp: string | null;
  /** Costo de envío que vio el cliente; null = el negocio lo confirma. */
  costo_envio: number | null;
  /** Días para recoger el pedido (catálogo, 146); null = no se muestra. */
  plazo_retiro_dias: number | null;
  mensaje_cliente: string | null;
  /** NULL si el negocio no muestra precios. */
  total: number | null;
  eventos: { etiqueta: string; color: string | null; tipo: string; en: string }[];
  items: { nombre: string; variante: string | null; unidad: string | null; cantidad: number; precio: number | null; imagen: string | null }[];
}
