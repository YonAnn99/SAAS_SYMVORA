-- Fix: log_table_changes() should insert directly into activity_logs
-- instead of calling log_activity() which has an auth.uid() guard
-- that can fail inside SECURITY DEFINER trigger context.

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
  v_tenant_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(u.email, 'unknown@system') INTO v_user_email
  FROM auth.users u WHERE u.id = v_user_id LIMIT 1;

  SELECT tm.tenant_id INTO v_tenant_id
  FROM public.tenant_memberships tm
  WHERE tm.user_id = v_user_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_entity := TG_TABLE_NAME;

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

  v_details := jsonb_build_object(
    'operation', v_action,
    'table', TG_TABLE_NAME
  );

  INSERT INTO public.activity_logs (
    tenant_id, user_id, user_email, action, entity,
    entity_id, entity_name, details
  ) VALUES (
    v_tenant_id, v_user_id, v_user_email, v_action, v_entity,
    v_entity_id, v_entity_name, v_details
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
