import type { EntregaPedido } from "@/features/catalogo/pedido-envio";

/** Estado BASE del motor (`pedidos_catalogo.estado`): lo que mueve stock, caja y cancelación. */
export type EstadoBase = "nuevo" | "confirmado" | "en_curso" | "entregado" | "cancelado";

/** Un estado que el negocio define (`pedido_estados`, migración 146). */
export interface EstadoPropio {
  id: string;
  nombre: string;
  color: string;
  base: Exclude<EstadoBase, "nuevo">;
  aplica_a: "ambos" | "recoger" | "domicilio";
  orden: number;
  activo: boolean;
  es_sistema: boolean;
}

export interface ItemPedido {
  id: string;
  producto_id: string | null;
  variante_id: string | null;
  nombre: string;
  variante: string | null;
  unidad: string | null;
  cantidad: number;
  precio_unitario: number;
}

/** Una fila de `pedidos_catalogo` con sus renglones (141-146). */
export interface Pedido {
  id: string;
  folio: number;
  codigo_seguimiento: string | null;
  cliente_nombre: string;
  cliente_telefono: string | null;
  entrega: EntregaPedido;
  direccion: string | null;
  nota: string | null;
  estado: EstadoBase;
  estado_id: string | null;
  estado_nombre: string | null;
  estado_color: string | null;
  pagado: boolean;
  pagado_en: string | null;
  metodo_pago: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | null;
  total: number;
  /** Costo de envío que vio el cliente (144). NO está en la venta: se cobra aparte. */
  costo_envio: number | null;
  mensaje_cliente: string | null;
  nota_interna: string | null;
  origen: "catalogo" | "pos";
  venta_id: string | null;
  creado_en: string;
  pedido_items: ItemPedido[];
}
