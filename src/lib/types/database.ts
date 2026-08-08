export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          nombre_comercial: string;
          subdominio: string;
          giro_comercial: string;
          logo_url: string | null;
          color_primario: string | null;
          direccion: string | null;
          telefono: string | null;
          email: string | null;
          creado_en: string;
        };
        Insert: {
          id?: string;
          nombre_comercial: string;
          subdominio: string;
          giro_comercial: string;
          logo_url?: string | null;
          color_primario?: string | null;
          direccion?: string | null;
          telefono?: string | null;
          email?: string | null;
          creado_en?: string;
        };
        Update: {
          id?: string;
          nombre_comercial?: string;
          subdominio?: string;
          giro_comercial?: string;
          logo_url?: string | null;
          color_primario?: string | null;
          direccion?: string | null;
          telefono?: string | null;
          email?: string | null;
          creado_en?: string;
        };
      };
      tenant_settings: {
        Row: {
          id: string;
          tenant_id: string;
          configuracion_json: Json;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          configuracion_json: Json;
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          configuracion_json?: Json;
          creado_en?: string;
          actualizado_en?: string;
        };
      };
      tenant_memberships: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          role: "SUPER_ADMIN" | "ORG_ADMIN" | "CAJERO";
          creado_en: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          role: "SUPER_ADMIN" | "ORG_ADMIN" | "CAJERO";
          creado_en?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          role?: "SUPER_ADMIN" | "ORG_ADMIN" | "CAJERO";
          creado_en?: string;
        };
      };
      productos: {
        Row: {
          id: string;
          tenant_id: string;
          codigo_barras: string | null;
          sku: string | null;
          nombre: string;
          descripcion: string | null;
          unidad_medida: "PIEZA" | "KG" | "GRAMO" | "LITRO" | "SERVICIO";
          precio_venta: number;
          costo_compra: number;
          stock_actual: number;
          stock_minimo: number;
          es_servicio: boolean;
          permite_variantes: boolean;
          permite_lotes: boolean;
          categoria: string | null;
          proveedor_id: string | null;
          imagen_url: string | null;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          codigo_barras?: string | null;
          sku?: string | null;
          nombre: string;
          descripcion?: string | null;
          unidad_medida: "PIEZA" | "KG" | "GRAMO" | "LITRO" | "SERVICIO";
          precio_venta: number;
          costo_compra: number;
          stock_actual?: number;
          stock_minimo?: number;
          es_servicio?: boolean;
          permite_variantes?: boolean;
          permite_lotes?: boolean;
          categoria?: string | null;
          proveedor_id?: string | null;
          imagen_url?: string | null;
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          codigo_barras?: string | null;
          sku?: string | null;
          nombre?: string;
          descripcion?: string | null;
          unidad_medida?: "PIEZA" | "KG" | "GRAMO" | "LITRO" | "SERVICIO";
          precio_venta?: number;
          costo_compra?: number;
          stock_actual?: number;
          stock_minimo?: number;
          es_servicio?: boolean;
          permite_variantes?: boolean;
          permite_lotes?: boolean;
          categoria?: string | null;
          proveedor_id?: string | null;
          imagen_url?: string | null;
          creado_en?: string;
          actualizado_en?: string;
        };
      };
      clientes: {
        Row: {
          id: string;
          tenant_id: string;
          nombre: string;
          email: string | null;
          telefono: string | null;
          direccion: string | null;
          limite_credito: number;
          saldo_pendiente: number;
          creado_en: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          nombre: string;
          email?: string | null;
          telefono?: string | null;
          direccion?: string | null;
          limite_credito?: number;
          saldo_pendiente?: number;
          creado_en?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          nombre?: string;
          email?: string | null;
          telefono?: string | null;
          direccion?: string | null;
          limite_credito?: number;
          saldo_pendiente?: number;
          creado_en?: string;
        };
      };
      proveedores: {
        Row: {
          id: string;
          tenant_id: string;
          nombre: string;
          contact_name: string | null;
          email: string | null;
          telefono: string | null;
          direccion: string | null;
          tiempo_surtido: string | null;
          condiciones_comerciales: string | null;
          creado_en: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          nombre: string;
          contact_name?: string | null;
          email?: string | null;
          telefono?: string | null;
          direccion?: string | null;
          tiempo_surtido?: string | null;
          condiciones_comerciales?: string | null;
          creado_en?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          nombre?: string;
          contact_name?: string | null;
          email?: string | null;
          telefono?: string | null;
          direccion?: string | null;
          tiempo_surtido?: string | null;
          condiciones_comerciales?: string | null;
          creado_en?: string;
        };
      };
      ventas: {
        Row: {
          id: string;
          tenant_id: string;
          usuario_id: string;
          cliente_id: string | null;
          total: number;
          subtotal: number;
          impuesto: number;
          descuento: number;
          metodo_pago: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "CREDITO";
          estado: "COMPLETADA" | "CANCELADA" | "PENDIENTE";
          notas: string | null;
          fecha_venta: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          usuario_id: string;
          cliente_id?: string | null;
          total: number;
          subtotal: number;
          impuesto?: number;
          descuento?: number;
          metodo_pago: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "CREDITO";
          estado?: "COMPLETADA" | "CANCELADA" | "PENDIENTE";
          notas?: string | null;
          fecha_venta?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          usuario_id?: string;
          cliente_id?: string | null;
          total?: number;
          subtotal?: number;
          impuesto?: number;
          descuento?: number;
          metodo_pago?: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "CREDITO";
          estado?: "COMPLETADA" | "CANCELADA" | "PENDIENTE";
          notas?: string | null;
          fecha_venta?: string;
        };
      };
      detalle_ventas: {
        Row: {
          id: string;
          venta_id: string;
          producto_id: string;
          cantidad: number;
          precio_unitario: number;
          subtotal: number;
          descuento: number;
        };
        Insert: {
          id?: string;
          venta_id: string;
          producto_id: string;
          cantidad: number;
          precio_unitario: number;
          subtotal: number;
          descuento?: number;
        };
        Update: {
          id?: string;
          venta_id?: string;
          producto_id?: string;
          cantidad?: number;
          precio_unitario?: number;
          subtotal?: number;
          descuento?: number;
        };
      };
      compras: {
        Row: {
          id: string;
          tenant_id: string;
          proveedor_id: string;
          usuario_id: string;
          numero_factura: string | null;
          total: number;
          estado: "PENDIENTE" | "RECIBIDA" | "CANCELADA";
          fecha_compra: string;
          fecha_recepcion: string | null;
          notas: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          proveedor_id: string;
          usuario_id: string;
          numero_factura?: string | null;
          total: number;
          estado?: "PENDIENTE" | "RECIBIDA" | "CANCELADA";
          fecha_compra?: string;
          fecha_recepcion?: string | null;
          notas?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          proveedor_id?: string;
          usuario_id?: string;
          numero_factura?: string | null;
          total?: number;
          estado?: "PENDIENTE" | "RECIBIDA" | "CANCELADA";
          fecha_compra?: string;
          fecha_recepcion?: string | null;
          notas?: string | null;
        };
      };
      detalle_compras: {
        Row: {
          id: string;
          compra_id: string;
          producto_id: string;
          cantidad: number;
          costo_unitario: number;
          subtotal: number;
        };
        Insert: {
          id?: string;
          compra_id: string;
          producto_id: string;
          cantidad: number;
          costo_unitario: number;
          subtotal: number;
        };
        Update: {
          id?: string;
          compra_id?: string;
          producto_id?: string;
          cantidad?: number;
          costo_unitario?: number;
          subtotal?: number;
        };
      };
      cajas: {
        Row: {
          id: string;
          tenant_id: string;
          usuario_id: string;
          fondo_inicial: number;
          total_ventas: number;
          total_entradas: number;
          total_salidas: number;
          saldo_esperado: number;
          saldo_real: number;
          diferencia: number;
          estado: "ABIERTA" | "CERRADA";
          fecha_apertura: string;
          fecha_cierre: string | null;
          notas_apertura: string | null;
          notas_cierre: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          usuario_id: string;
          fondo_inicial: number;
          total_ventas?: number;
          total_entradas?: number;
          total_salidas?: number;
          saldo_esperado?: number;
          saldo_real?: number;
          diferencia?: number;
          estado?: "ABIERTA" | "CERRADA";
          fecha_apertura?: string;
          fecha_cierre?: string | null;
          notas_apertura?: string | null;
          notas_cierre?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          usuario_id?: string;
          fondo_inicial?: number;
          total_ventas?: number;
          total_entradas?: number;
          total_salidas?: number;
          saldo_esperado?: number;
          saldo_real?: number;
          diferencia?: number;
          estado?: "ABIERTA" | "CERRADA";
          fecha_apertura?: string;
          fecha_cierre?: string | null;
          notas_apertura?: string | null;
          notas_cierre?: string | null;
        };
      };
      movimientos_caja: {
        Row: {
          id: string;
          caja_id: string;
          tipo: "ENTRADA" | "SALIDA";
          monto: number;
          descripcion: string;
          fecha: string;
        };
        Insert: {
          id?: string;
          caja_id: string;
          tipo: "ENTRADA" | "SALIDA";
          monto: number;
          descripcion: string;
          fecha?: string;
        };
        Update: {
          id?: string;
          caja_id?: string;
          tipo?: "ENTRADA" | "SALIDA";
          monto?: number;
          descripcion?: string;
          fecha?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      authorize: {
        Args: {
          requested_permission: string;
        };
        Returns: boolean;
      };
      user_tenant_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
    };
    Enums: {
      app_role: "SUPER_ADMIN" | "ORG_ADMIN" | "CAJERO";
      unidad_medida: "PIEZA" | "KG" | "GRAMO" | "LITRO" | "SERVICIO";
      metodo_pago: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "CREDITO";
      estado_venta: "COMPLETADA" | "CANCELADA" | "PENDIENTE";
      estado_compra: "PENDIENTE" | "RECIBIDA" | "CANCELADA";
      estado_caja: "ABIERTA" | "CERRADA";
      tipo_movimiento: "ENTRADA" | "SALIDA";
    };
  };
};

export type Tenant = Database["public"]["Tables"]["tenants"]["Row"];
export type TenantSettings =
  Database["public"]["Tables"]["tenant_settings"]["Row"];
export type TenantMembership =
  Database["public"]["Tables"]["tenant_memberships"]["Row"];
export type Producto = Database["public"]["Tables"]["productos"]["Row"];
export type Cliente = Database["public"]["Tables"]["clientes"]["Row"];
export type Proveedor = Database["public"]["Tables"]["proveedores"]["Row"];
export type Venta = Database["public"]["Tables"]["ventas"]["Row"];
export type DetalleVenta =
  Database["public"]["Tables"]["detalle_ventas"]["Row"];
export type Compra = Database["public"]["Tables"]["compras"]["Row"];
export type DetalleCompra =
  Database["public"]["Tables"]["detalle_compras"]["Row"];
export type Caja = Database["public"]["Tables"]["cajas"]["Row"];
export type MovimientoCaja =
  Database["public"]["Tables"]["movimientos_caja"]["Row"];

export type UserRole = Database["public"]["Enums"]["app_role"];
export type UnidadMedida = Database["public"]["Enums"]["unidad_medida"];
export type MetodoPago = Database["public"]["Enums"]["metodo_pago"];
export type EstadoVenta = Database["public"]["Enums"]["estado_venta"];
export type EstadoCompra = Database["public"]["Enums"]["estado_compra"];
export type EstadoCaja = Database["public"]["Enums"]["estado_caja"];
export type TipoMovimiento = Database["public"]["Enums"]["tipo_movimiento"];

export interface TenantConfiguracion {
  permite_granel: boolean;
  permite_variantes: boolean;
  permite_lotes_caducidad: boolean;
  permite_mermas: boolean;
  permite_servicios: boolean;
  permite_credito_fiado: boolean;
}

export interface POSConfig {
  teclado_rapido: boolean;
  lector_barras: boolean;
  impresion_automatica: boolean;
}

export interface TenantSettingsJSON {
  tenant_id: string;
  giro_comercial: string;
  modulos_activos: TenantConfiguracion;
  pos_config: POSConfig;
}
