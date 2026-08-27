-- =============================================
-- 032: Activity Log Triggers
-- ---------------------------------------------
-- Crea triggers automaticos en las tablas principales
-- para registrar CREATE/UPDATE/DELETE en activity_logs.
--
-- El frontend TAMBIEN llamara logActivity() para entidades
-- complejas (POS, ajustes) o cuando necesite enviar
-- detalles enriquecidos que el trigger no puede capturar.
-- Los triggers son un fallback de seguridad que garantiza
-- que ningun cambio quede sin registrar.
-- =============================================

BEGIN;

-- Helper: obtener email del usuario actual
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(u.email, 'unknown@system')
  FROM auth.users u
  WHERE u.id = auth.uid()
  LIMIT 1;
$$;

-- Trigger generico: registra INSERT/UPDATE/DELETE
CREATE OR REPLACE FUNCTION public.log_table_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_entity TEXT;
  v_entity_name TEXT;
  v_entity_id UUID;
  v_action TEXT;
  v_details JSONB;
  v_old_name TEXT;
  v_new_name TEXT;
BEGIN
  v_user_id := auth.uid();

  -- Si no hay usuario autenticado, skip
  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_user_email := public.get_current_user_email();
  v_entity := TG_TABLE_NAME;

  -- Determinar accion
  IF TG_OP = 'INSERT' THEN
    v_action := 'CREATE';
    v_entity_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_entity_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_entity_id := OLD.id;
  END IF;

  -- Determinar entity_name segun la tabla
  CASE TG_TABLE_NAME
    WHEN 'productos' THEN
      v_entity_name := CASE WHEN TG_OP = 'DELETE' THEN OLD.nombre ELSE NEW.nombre END;
    WHEN 'clientes' THEN
      v_entity_name := CASE WHEN TG_OP = 'DELETE' THEN OLD.nombre ELSE NEW.nombre END;
    WHEN 'proveedores' THEN
      v_entity_name := CASE WHEN TG_OP = 'DELETE' THEN OLD.nombre ELSE NEW.nombre END;
    WHEN 'ventas' THEN
      v_entity_name := 'Venta ' || SUBSTRING(COALESCE(NEW.id, OLD.id)::TEXT, 1, 8);
    WHEN 'compras' THEN
      v_entity_name := COALESCE(
        CASE WHEN TG_OP = 'DELETE' THEN OLD.numero_factura ELSE NEW.numero_factura END,
        'Compra ' || SUBSTRING(COALESCE(NEW.id, OLD.id)::TEXT, 1, 8)
      );
    WHEN 'ordenes_compra' THEN
      v_entity_name := COALESCE(
        CASE WHEN TG_OP = 'DELETE' THEN OLD.numero_orden ELSE NEW.numero_orden END,
        'OC ' || SUBSTRING(COALESCE(NEW.id, OLD.id)::TEXT, 1, 8)
      );
    WHEN 'cajas' THEN
      v_entity_name := 'Caja ' || TO_CHAR(
        CASE WHEN TG_OP = 'DELETE' THEN OLD.fecha_apertura ELSE NEW.fecha_apertura END,
        'DD/MM/YYYY HH24:MI'
      );
    WHEN 'movimientos_caja' THEN
      v_entity_name := CASE WHEN TG_OP = 'DELETE' THEN OLD.descripcion ELSE NEW.descripcion END;
    ELSE
      v_entity_name := TG_TABLE_NAME;
  END CASE;

  -- Construir details (solo para UPDATE: que cambio)
  IF TG_OP = 'UPDATE' THEN
    v_details := jsonb_build_object(
      'operation', 'UPDATE',
      'table', TG_TABLE_NAME
    );
  ELSIF TG_OP = 'INSERT' THEN
    v_details := jsonb_build_object(
      'operation', 'CREATE',
      'table', TG_TABLE_NAME
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_details := jsonb_build_object(
      'operation', 'DELETE',
      'table', TG_TABLE_NAME
    );
  END IF;

  -- Insertar el log (usa log_activity que ya tiene RLS y auth.uid() guard)
  PERFORM public.log_activity(
    p_user_id := v_user_id,
    p_user_email := v_user_email,
    p_action := v_action,
    p_entity := v_entity,
    p_entity_id := v_entity_id,
    p_entity_name := v_entity_name,
    p_details := v_details
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- =============================================
-- TRIGGERS: Productos
-- =============================================
CREATE TRIGGER trg_log_productos
  AFTER INSERT OR UPDATE OR DELETE ON public.productos
  FOR EACH ROW EXECUTE FUNCTION public.log_table_changes();

-- =============================================
-- TRIGGERS: Clientes
-- =============================================
CREATE TRIGGER trg_log_clientes
  AFTER INSERT OR UPDATE OR DELETE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.log_table_changes();

-- =============================================
-- TRIGGERS: Proveedores
-- =============================================
CREATE TRIGGER trg_log_proveedores
  AFTER INSERT OR UPDATE OR DELETE ON public.proveedores
  FOR EACH ROW EXECUTE FUNCTION public.log_table_changes();

-- =============================================
-- TRIGGERS: Ventas
-- =============================================
CREATE TRIGGER trg_log_ventas
  AFTER INSERT OR UPDATE OR DELETE ON public.ventas
  FOR EACH ROW EXECUTE FUNCTION public.log_table_changes();

-- =============================================
-- TRIGGERS: Compras
-- =============================================
CREATE TRIGGER trg_log_compras
  AFTER INSERT OR UPDATE OR DELETE ON public.compras
  FOR EACH ROW EXECUTE FUNCTION public.log_table_changes();

-- =============================================
-- TRIGGERS: Ordenes de compra
-- =============================================
CREATE TRIGGER trg_log_ordenes_compra
  AFTER INSERT OR UPDATE OR DELETE ON public.ordenes_compra
  FOR EACH ROW EXECUTE FUNCTION public.log_table_changes();

-- =============================================
-- TRIGGERS: Cajas
-- =============================================
CREATE TRIGGER trg_log_cajas
  AFTER INSERT OR UPDATE OR DELETE ON public.cajas
  FOR EACH ROW EXECUTE FUNCTION public.log_table_changes();

-- =============================================
-- TRIGGERS: Movimientos de caja
-- =============================================
CREATE TRIGGER trg_log_movimientos_caja
  AFTER INSERT OR UPDATE OR DELETE ON public.movimientos_caja
  FOR EACH ROW EXECUTE FUNCTION public.log_table_changes();

COMMIT;
