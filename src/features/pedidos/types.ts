import type { EntregaPedido, EstadoPedido } from "@/features/catalogo/pedido-envio";

export interface ItemPedido {
  id: string;
  nombre: string;
  variante: string | null;
  unidad: string | null;
  cantidad: number;
  precio_unitario: number;
}

/** Una fila de `pedidos_catalogo` con sus renglones (migración 141). */
export interface Pedido {
  id: string;
  folio: number;
  codigo_seguimiento: string;
  cliente_nombre: string;
  cliente_telefono: string;
  entrega: EntregaPedido;
  direccion: string | null;
  nota: string | null;
  estado: EstadoPedido;
  pagado: boolean;
  metodo_pago: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | null;
  total: number;
  /** Costo de envío que vio el cliente (144). NO está en la venta: se cobra aparte. */
  costo_envio: number | null;
  venta_id: string | null;
  creado_en: string;
  pedido_items: ItemPedido[];
}
