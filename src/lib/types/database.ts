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
          rfc: string | null;
          razon_social: string | null;
          regimen_fiscal: string | null;
          codigo_postal: string | null;
          subscription_status: "trial" | "active" | "past_due" | "canceled" | "expired" | null;
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
          rfc?: string | null;
          razon_social?: string | null;
          regimen_fiscal?: string | null;
          codigo_postal?: string | null;
          subscription_status?: "trial" | "active" | "past_due" | "canceled" | "expired" | null;
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
          rfc?: string | null;
          razon_social?: string | null;
          regimen_fiscal?: string | null;
          codigo_postal?: string | null;
          subscription_status?: "trial" | "active" | "past_due" | "canceled" | "expired" | null;
          creado_en?: string;
        };
      };
      tenant_settings: {
        Row: {
          id: string;
          tenant_id: string;
          configuracion_json: Json;
          configuracion_fiscal: Json;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          configuracion_json: Json;
          configuracion_fiscal?: Json;
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          configuracion_json?: Json;
          configuracion_fiscal?: Json;
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
          clave_prod_serv: string | null;
          clave_unidad: string | null;
          no_identificacion: string | null;
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
          clave_prod_serv?: string | null;
          clave_unidad?: string | null;
          no_identificacion?: string | null;
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
          clave_prod_serv?: string | null;
          clave_unidad?: string | null;
          no_identificacion?: string | null;
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
          rfc: string | null;
          razon_social: string | null;
          regimen_fiscal_receptor: string | null;
          uso_cfdi: string | null;
          codigo_postal: string | null;
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
          rfc?: string | null;
          razon_social?: string | null;
          regimen_fiscal_receptor?: string | null;
          uso_cfdi?: string | null;
          codigo_postal?: string | null;
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
          rfc?: string | null;
          razon_social?: string | null;
          regimen_fiscal_receptor?: string | null;
          uso_cfdi?: string | null;
          codigo_postal?: string | null;
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
          metodo_pago: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "CREDITO" | "TARJETA_TERMINAL";
          estado: "COMPLETADA" | "CANCELADA" | "PENDIENTE";
          notas: string | null;
          fecha_venta: string;
          factura_id: string | null;
          monto_recibido: number | null;
          cambio: number | null;
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
          metodo_pago: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "CREDITO" | "TARJETA_TERMINAL";
          estado?: "COMPLETADA" | "CANCELADA" | "PENDIENTE";
          notas?: string | null;
          fecha_venta?: string;
          factura_id?: string | null;
          monto_recibido?: number | null;
          cambio?: number | null;
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
          factura_id?: string | null;
          monto_recibido?: number | null;
          cambio?: number | null;
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
          tipo: "ENTRADA" | "SALIDA" | "VENTA";
          monto: number;
          descripcion: string;
          fecha: string;
        };
        Insert: {
          id?: string;
          caja_id: string;
          tipo: "ENTRADA" | "SALIDA" | "VENTA";
          monto: number;
          descripcion: string;
          fecha?: string;
        };
        Update: {
          id?: string;
          caja_id?: string;
          tipo?: "ENTRADA" | "SALIDA" | "VENTA";
          monto?: number;
          descripcion?: string;
          fecha?: string;
        };
      };
      lotes: {
        Row: {
          id: string;
          tenant_id: string;
          producto_id: string;
          numero_lote: string;
          cantidad: number;
          fecha_caducidad: string | null;
          fecha_fabricacion: string | null;
          costo_unitario: number;
          estado: "ACTIVO" | "VENCIDO" | "AGOTADO";
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          producto_id: string;
          numero_lote: string;
          cantidad: number;
          fecha_caducidad?: string | null;
          fecha_fabricacion?: string | null;
          costo_unitario?: number;
          estado?: "ACTIVO" | "VENCIDO" | "AGOTADO";
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          producto_id?: string;
          numero_lote?: string;
          cantidad?: number;
          fecha_caducidad?: string | null;
          fecha_fabricacion?: string | null;
          costo_unitario?: number;
          estado?: "ACTIVO" | "VENCIDO" | "AGOTADO";
          creado_en?: string;
          actualizado_en?: string;
        };
      };
      variantes_producto: {
        Row: {
          id: string;
          tenant_id: string;
          producto_id: string;
          sku: string | null;
          codigo_barras: string | null;
          talla: string | null;
          color: string | null;
          precio_venta: number;
          costo_compra: number;
          stock_actual: number;
          imagen_url: string | null;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          producto_id: string;
          sku?: string | null;
          codigo_barras?: string | null;
          talla?: string | null;
          color?: string | null;
          precio_venta: number;
          costo_compra?: number;
          stock_actual?: number;
          imagen_url?: string | null;
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          producto_id?: string;
          sku?: string | null;
          codigo_barras?: string | null;
          talla?: string | null;
          color?: string | null;
          precio_venta?: number;
          costo_compra?: number;
          stock_actual?: number;
          imagen_url?: string | null;
          creado_en?: string;
          actualizado_en?: string;
        };
      };
      stock_variantes: {
        Row: {
          id: string;
          variante_id: string;
          lote_id: string | null;
          cantidad: number;
        };
        Insert: {
          id?: string;
          variante_id: string;
          lote_id?: string | null;
          cantidad?: number;
        };
        Update: {
          id?: string;
          variante_id?: string;
          lote_id?: string | null;
          cantidad?: number;
        };
      };
      ajustes_inventario: {
        Row: {
          id: string;
          tenant_id: string;
          producto_id: string;
          variante_id: string | null;
          lote_id: string | null;
          motivo: "MERMA" | "CONTEO_FISICO" | "DEVOLUCION" | "DAÑO" | "OTRO";
          cantidad_anterior: number;
          cantidad_ajuste: number;
          cantidad_nueva: number;
          notas: string | null;
          usuario_id: string;
          creado_en: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          producto_id: string;
          variante_id?: string | null;
          lote_id?: string | null;
          motivo: "MERMA" | "CONTEO_FISICO" | "DEVOLUCION" | "DAÑO" | "OTRO";
          cantidad_anterior: number;
          cantidad_ajuste: number;
          cantidad_nueva: number;
          notas?: string | null;
          usuario_id: string;
          creado_en?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          producto_id?: string;
          variante_id?: string | null;
          lote_id?: string | null;
          motivo?: "MERMA" | "CONTEO_FISICO" | "DEVOLUCION" | "DAÑO" | "OTRO";
          cantidad_anterior?: number;
          cantidad_ajuste?: number;
          cantidad_nueva?: number;
          notas?: string | null;
          usuario_id?: string;
          creado_en?: string;
        };
      };
      ordenes_compra: {
        Row: {
          id: string;
          tenant_id: string;
          proveedor_id: string;
          usuario_id: string;
          numero_orden: string;
          estado: "BORRADOR" | "ENVIADA" | "RECIBIDA_PARCIAL" | "RECIBIDA_TOTAL" | "CANCELADA";
          subtotal: number;
          impuesto: number;
          total: number;
          fecha_estimada_recepcion: string | null;
          fecha_recepcion: string | null;
          notas: string | null;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          proveedor_id: string;
          usuario_id: string;
          numero_orden: string;
          estado?: "BORRADOR" | "ENVIADA" | "RECIBIDA_PARCIAL" | "RECIBIDA_TOTAL" | "CANCELADA";
          subtotal?: number;
          impuesto?: number;
          total?: number;
          fecha_estimada_recepcion?: string | null;
          fecha_recepcion?: string | null;
          notas?: string | null;
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          proveedor_id?: string;
          usuario_id?: string;
          numero_orden?: string;
          estado?: "BORRADOR" | "ENVIADA" | "RECIBIDA_PARCIAL" | "RECIBIDA_TOTAL" | "CANCELADA";
          subtotal?: number;
          impuesto?: number;
          total?: number;
          fecha_estimada_recepcion?: string | null;
          fecha_recepcion?: string | null;
          notas?: string | null;
          creado_en?: string;
          actualizado_en?: string;
        };
      };
      detalle_orden_compra: {
        Row: {
          id: string;
          orden_compra_id: string;
          producto_id: string;
          variante_id: string | null;
          cantidad_solicitada: number;
          cantidad_recibida: number;
          costo_unitario: number;
          subtotal: number;
          notas: string | null;
        };
        Insert: {
          id?: string;
          orden_compra_id: string;
          producto_id: string;
          variante_id?: string | null;
          cantidad_solicitada: number;
          cantidad_recibida?: number;
          costo_unitario: number;
          subtotal: number;
          notas?: string | null;
        };
        Update: {
          id?: string;
          orden_compra_id?: string;
          producto_id?: string;
          variante_id?: string | null;
          cantidad_solicitada?: number;
          cantidad_recibida?: number;
          costo_unitario?: number;
          subtotal?: number;
          notas?: string | null;
        };
      };
      facturas: {
        Row: {
          id: string;
          tenant_id: string;
          serie: string;
          folio: number;
          emisor_rfc: string;
          emisor_razon_social: string;
          emisor_regimen_fiscal: string;
          emisor_codigo_postal: string;
          receptor_rfc: string;
          receptor_razon_social: string;
          receptor_regimen_fiscal: string;
          receptor_uso_cfdi: string;
          receptor_codigo_postal: string;
          subtotal: number;
          impuesto: number;
          descuento: number;
          total: number;
          metodo_pago: "PUE" | "PPD";
          forma_pago: string;
          estado: "BORRADOR" | "TIMBRADA" | "CANCELADA";
          uuid_cfdi: string | null;
          fecha_timbrado: string | null;
          fecha_emision: string;
          xml_url: string | null;
          pdf_url: string | null;
          xml_timbrado: string | null;
          pac_nombre: string | null;
          pac_response: Json | null;
          fecha_cancelacion: string | null;
          motivo_cancelacion: string | null;
          folio_sustitucion: string | null;
          venta_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          serie?: string;
          folio: number;
          emisor_rfc: string;
          emisor_razon_social: string;
          emisor_regimen_fiscal: string;
          emisor_codigo_postal: string;
          receptor_rfc: string;
          receptor_razon_social: string;
          receptor_regimen_fiscal: string;
          receptor_uso_cfdi: string;
          receptor_codigo_postal: string;
          subtotal: number;
          impuesto: number;
          descuento?: number;
          total: number;
          metodo_pago?: "PUE" | "PPD";
          forma_pago?: string;
          estado?: "BORRADOR" | "TIMBRADA" | "CANCELADA";
          uuid_cfdi?: string | null;
          fecha_timbrado?: string | null;
          fecha_emision?: string;
          xml_url?: string | null;
          pdf_url?: string | null;
          xml_timbrado?: string | null;
          pac_nombre?: string | null;
          pac_response?: Json | null;
          fecha_cancelacion?: string | null;
          motivo_cancelacion?: string | null;
          folio_sustitucion?: string | null;
          venta_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          serie?: string;
          folio?: number;
          emisor_rfc?: string;
          emisor_razon_social?: string;
          emisor_regimen_fiscal?: string;
          emisor_codigo_postal?: string;
          receptor_rfc?: string;
          receptor_razon_social?: string;
          receptor_regimen_fiscal?: string;
          receptor_uso_cfdi?: string;
          receptor_codigo_postal?: string;
          subtotal?: number;
          impuesto?: number;
          descuento?: number;
          total?: number;
          metodo_pago?: "PUE" | "PPD";
          forma_pago?: string;
          estado?: "BORRADOR" | "TIMBRADA" | "CANCELADA";
          uuid_cfdi?: string | null;
          fecha_timbrado?: string | null;
          fecha_emision?: string;
          xml_url?: string | null;
          pdf_url?: string | null;
          xml_timbrado?: string | null;
          pac_nombre?: string | null;
          pac_response?: Json | null;
          fecha_cancelacion?: string | null;
          motivo_cancelacion?: string | null;
          folio_sustitucion?: string | null;
          venta_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      factura_detalle: {
        Row: {
          id: string;
          factura_id: string;
          producto_id: string | null;
          descripcion: string;
          clave_prod_serv: string;
          clave_unidad: string;
          no_identificacion: string | null;
          cantidad: number;
          unidad: string;
          precio_unitario: number;
          descuento: number;
          subtotal: number;
          base_impuesto: number;
          tasa_impuesto: number;
          importe_impuesto: number;
          orden: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          factura_id: string;
          producto_id?: string | null;
          descripcion: string;
          clave_prod_serv: string;
          clave_unidad: string;
          no_identificacion?: string | null;
          cantidad: number;
          unidad: string;
          precio_unitario: number;
          descuento?: number;
          subtotal: number;
          base_impuesto: number;
          tasa_impuesto?: number;
          importe_impuesto: number;
          orden?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          factura_id?: string;
          producto_id?: string | null;
          descripcion?: string;
          clave_prod_serv?: string;
          clave_unidad?: string;
          no_identificacion?: string | null;
          cantidad?: number;
          unidad?: string;
          precio_unitario?: number;
          descuento?: number;
          subtotal?: number;
          base_impuesto?: number;
          tasa_impuesto?: number;
          importe_impuesto?: number;
          orden?: number;
          created_at?: string;
        };
      };
      facturas_cancelaciones: {
        Row: {
          id: string;
          factura_id: string;
          motivo: string;
          folio_sustitucion: string | null;
          fecha_solicitud: string;
          fecha_respuesta: string | null;
          estado: "PENDIENTE" | "ACEPTADA" | "RECHAZADA";
          pac_response: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          factura_id: string;
          motivo: string;
          folio_sustitucion?: string | null;
          fecha_solicitud?: string;
          fecha_respuesta?: string | null;
          estado?: "PENDIENTE" | "ACEPTADA" | "RECHAZADA";
          pac_response?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          factura_id?: string;
          motivo?: string;
          folio_sustitucion?: string | null;
          fecha_solicitud?: string;
          fecha_respuesta?: string | null;
          estado?: "PENDIENTE" | "ACEPTADA" | "RECHAZADA";
          pac_response?: Json | null;
          created_at?: string;
        };
      };
      facturas_folios: {
        Row: {
          id: string;
          tenant_id: string;
          serie: string;
          ultimo_folio: number;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          serie?: string;
          ultimo_folio?: number;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          serie?: string;
          ultimo_folio?: number;
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
      ajustar_inventario: {
        Args: {
          p_producto_id: string;
          p_cantidad_ajuste: number;
          p_motivo: "MERMA" | "CONTEO_FISICO" | "DEVOLUCION" | "DAÑO" | "OTRO";
          p_notas?: string;
          p_variante_id?: string;
          p_lote_id?: string;
        };
        Returns: Json;
      };
      recibir_orden_compra: {
        Args: {
          p_orden_id: string;
          p_items: Json;
        };
        Returns: Json;
      };
      get_next_folio: {
        Args: {
          p_tenant_id: string;
          p_serie?: string;
        };
        Returns: number;
      };
    };
    Enums: {
      app_role: "SUPER_ADMIN" | "ORG_ADMIN" | "CAJERO";
      unidad_medida: "PIEZA" | "KG" | "GRAMO" | "LITRO" | "SERVICIO";
      metodo_pago: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "CREDITO" | "TARJETA_TERMINAL";
      estado_venta: "COMPLETADA" | "CANCELADA" | "PENDIENTE";
      estado_compra: "PENDIENTE" | "RECIBIDA" | "CANCELADA";
      estado_caja: "ABIERTA" | "CERRADA";
      tipo_movimiento: "ENTRADA" | "SALIDA" | "VENTA";
      estado_orden_compra: "BORRADOR" | "ENVIADA" | "RECIBIDA_PARCIAL" | "RECIBIDA_TOTAL" | "CANCELADA";
      motivo_ajuste: "MERMA" | "CONTEO_FISICO" | "DEVOLUCION" | "DAÑO" | "OTRO";
      estado_factura: "BORRADOR" | "TIMBRADA" | "CANCELADA";
      metodo_pago_cfdi: "PUE" | "PPD";
      estado_cancelacion: "PENDIENTE" | "ACEPTADA" | "RECHAZADA";
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
export type Lote = Database["public"]["Tables"]["lotes"]["Row"];
export type VarianteProducto =
  Database["public"]["Tables"]["variantes_producto"]["Row"];
export type StockVariante =
  Database["public"]["Tables"]["stock_variantes"]["Row"];
export type AjusteInventario =
  Database["public"]["Tables"]["ajustes_inventario"]["Row"];
export type OrdenCompra =
  Database["public"]["Tables"]["ordenes_compra"]["Row"];
export type DetalleOrdenCompra =
  Database["public"]["Tables"]["detalle_orden_compra"]["Row"];
export type Factura = Database["public"]["Tables"]["facturas"]["Row"];
export type FacturaDetalle =
  Database["public"]["Tables"]["factura_detalle"]["Row"];
export type FacturaCancelacion =
  Database["public"]["Tables"]["facturas_cancelaciones"]["Row"];
export type FacturaFolio =
  Database["public"]["Tables"]["facturas_folios"]["Row"];

export type UserRole = Database["public"]["Enums"]["app_role"];
export type UnidadMedida = Database["public"]["Enums"]["unidad_medida"];
export type MetodoPago = Database["public"]["Enums"]["metodo_pago"];
export type EstadoVenta = Database["public"]["Enums"]["estado_venta"];
export type EstadoCompra = Database["public"]["Enums"]["estado_compra"];
export type EstadoCaja = Database["public"]["Enums"]["estado_caja"];
export type TipoMovimiento = Database["public"]["Enums"]["tipo_movimiento"];
export type EstadoOrdenCompra =
  Database["public"]["Enums"]["estado_orden_compra"];
export type MotivoAjuste = Database["public"]["Enums"]["motivo_ajuste"];
export type EstadoFactura = Database["public"]["Enums"]["estado_factura"];
export type MetodoPagoCFDI = Database["public"]["Enums"]["metodo_pago_cfdi"];
export type EstadoCancelacion =
  Database["public"]["Enums"]["estado_cancelacion"];

export interface PagoTerminal {
  id: string;
  tenant_id: string;
  usuario_id: string;
  cliente_id: string | null;
  mp_order_id: string | null;
  external_reference: string;
  monto: number;
  estado: string;
  payload_items: unknown;
  venta_id: string | null;
  creado_en: string;
  actualizado_en: string;
}

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

export interface MercadoPagoPointSettings {
  habilitado: boolean;
  terminal_id: string;
  access_token_id: string;
  webhook_secret_id: string;
}

export interface TenantSettingsJSON {
  tenant_id: string;
  giro_comercial: string;
  modulos_activos: TenantConfiguracion;
  pos_config: POSConfig;
  mercado_pago_point?: MercadoPagoPointSettings;
}

export interface TenantConfiguracionFiscal {
  cfdi_serie: string;
  cfdi_metodo_pago: MetodoPagoCFDI;
  cfdi_forma_pago_default: string;
  pac_proveedor: "finkok" | "swsapien" | "mascarilla";
  pac_usuario: string;
  pac_password_id: string;
  certificado_cer_id: string;
  certificado_key_id: string;
  certificado_password_id: string;
  email_envio_facturas: string;
}
