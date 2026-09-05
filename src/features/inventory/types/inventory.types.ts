import type {
  AjusteInventario,
  Compra,
  DetalleOrdenCompra,
  Lote,
  OrdenCompra,
  Producto,
  Proveedor,
  VarianteProducto,
} from "@/lib/types/database";

export type {
  AjusteInventario,
  Compra,
  DetalleOrdenCompra,
  Lote,
  OrdenCompra,
  Producto,
  Proveedor,
  VarianteProducto,
};

export interface ProductOption {
  id: string;
  nombre: string;
}

export interface ProductoOption extends ProductOption {
  permite_variantes: boolean;
  permite_lotes: boolean;
}

export interface VarianteOption {
  id: string;
  talla: string | null;
  color: string | null;
  sku: string | null;
}

export interface LoteOption {
  id: string;
  numero_lote: string;
  cantidad: number;
  fecha_caducidad: string | null;
}

export interface ProductFormData {
  nombre: string;
  descripcion: string;
  codigo_barras: string;
  sku: string;
  unidad_medida: "PIEZA" | "KG" | "GRAMO" | "LITRO" | "SERVICIO";
  precio_venta: string;
  costo_compra: string;
  stock_actual: string;
  stock_minimo: string;
  es_servicio: boolean;
  categoria: string;
  permite_lotes: boolean;
  permite_variantes: boolean;
}

export const defaultProductFormData: ProductFormData = {
  nombre: "",
  descripcion: "",
  codigo_barras: "",
  sku: "",
  unidad_medida: "PIEZA",
  precio_venta: "",
  costo_compra: "",
  stock_actual: "0",
  stock_minimo: "5",
  es_servicio: false,
  categoria: "",
  permite_lotes: false,
  permite_variantes: false,
};

export interface VarianteFormData {
  producto_id: string;
  sku: string;
  codigo_barras: string;
  talla: string;
  color: string;
  precio_venta: string;
  costo_compra: string;
  stock_actual: string;
}

export const defaultVarianteFormData: VarianteFormData = {
  producto_id: "",
  sku: "",
  codigo_barras: "",
  talla: "",
  color: "",
  precio_venta: "",
  costo_compra: "",
  stock_actual: "0",
};

export interface LoteFormData {
  producto_id: string;
  numero_lote: string;
  cantidad: string;
  fecha_caducidad: string;
  fecha_fabricacion: string;
  costo_unitario: string;
}

export const defaultLoteFormData: LoteFormData = {
  producto_id: "",
  numero_lote: "",
  cantidad: "",
  fecha_caducidad: "",
  fecha_fabricacion: "",
  costo_unitario: "",
};

export type MotivoAjuste =
  | "MERMA"
  | "CONTEO_FISICO"
  | "DEVOLUCION"
  | "DAÑO"
  | "OTRO";

export interface AjusteFormData {
  producto_id: string;
  variante_id: string;
  lote_id: string;
  motivo: MotivoAjuste;
  cantidad_ajuste: string;
  notas: string;
}

export const defaultAjusteFormData: AjusteFormData = {
  producto_id: "",
  variante_id: "",
  lote_id: "",
  motivo: "MERMA",
  cantidad_ajuste: "",
  notas: "",
};

export interface OrderItem {
  producto_id: string;
  cantidad_solicitada: string;
  costo_unitario: string;
}

export interface OrdenFormData {
  proveedor_id: string;
  numero_orden: string;
  notas: string;
  items: OrderItem[];
}

export const defaultOrdenFormData: OrdenFormData = {
  proveedor_id: "",
  numero_orden: "",
  notas: "",
  items: [{ producto_id: "", cantidad_solicitada: "", costo_unitario: "" }],
};

export interface PurchaseWithRelations extends Compra {
  proveedor?: { nombre: string } | null;
  usuario?: { email: string } | null;
}

export interface SupplierFormData {
  nombre: string;
  contact: string;
  email: string;
  phone: string;
}