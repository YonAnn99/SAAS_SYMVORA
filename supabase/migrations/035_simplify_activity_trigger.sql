-- =============================================
-- 035: Simplify activity trigger (reconstruida)
-- ---------------------------------------------
-- NOTA: al igual que 034, esta migración ya estaba aplicada en producción
-- (historial remoto: "simplify_activity_trigger", 27 ago) pero el archivo
-- nunca se comiteó. Reconstruida a partir de pg_get_functiondef() sobre la
-- función real y vigente en la base de datos (auditoría de sept 2026) —
-- este SQL, al aplicarse, deja la función en el mismo estado que ya tiene
-- producción hoy.
--
-- Cambia log_table_changes() para leer el usuario desde
-- request.jwt.claims directamente (con fallback a la columna usuario_id
-- del registro) en vez de auth.uid()/tenant_memberships — evita que el
-- log se pierda cuando el trigger corre en un contexto donde auth.uid()
-- no resuelve, y añade el mapeo de nombre de entidad por tabla.
-- =============================================

CREATE OR REPLACE FUNCTION public.log_table_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  v_record JSONB;
  v_jwt_claims JSONB;
BEGIN
  -- Convert record to jsonb for easy field access
  IF TG_OP = 'DELETE' THEN
    v_record := to_jsonb(OLD);
  ELSE
    v_record := to_jsonb(NEW);
  END IF;

  -- Get tenant_id from the record (all tracked tables have it)
  v_tenant_id := (v_record->>'tenant_id')::uuid;

  -- Get entity_id
  v_entity_id := (v_record->>'id')::uuid;

  -- Try to get user from JWT claims
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
    v_user_id := (v_jwt_claims->>'sub')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  -- Fallback: use usuario_id from record if available
  IF v_user_id IS NULL THEN
    v_user_id := (v_record->>'usuario_id')::uuid;
  END IF;

  -- If still no user, skip
  IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Get email
  SELECT COALESCE(u.email, 'unknown@system') INTO v_user_email
  FROM auth.users u WHERE u.id = v_user_id LIMIT 1;

  v_entity := TG_TABLE_NAME;

  IF TG_OP = 'INSERT' THEN
    v_action := 'CREATE';
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
  END IF;

  -- Get entity name
  CASE TG_TABLE_NAME
    WHEN 'productos' THEN
      v_entity_name := v_record->>'nombre';
    WHEN 'clientes' THEN
      v_entity_name := v_record->>'nombre';
    WHEN 'proveedores' THEN
      v_entity_name := v_record->>'nombre';
    WHEN 'ventas' THEN
      v_entity_name := 'Venta ' || SUBSTRING(v_entity_id::TEXT, 1, 8);
    WHEN 'compras' THEN
      v_entity_name := COALESCE(v_record->>'numero_factura', 'Compra ' || SUBSTRING(v_entity_id::TEXT, 1, 8));
    WHEN 'ordenes_compra' THEN
      v_entity_name := COALESCE(v_record->>'numero_orden', 'OC ' || SUBSTRING(v_entity_id::TEXT, 1, 8));
    WHEN 'cajas' THEN
      v_entity_name := 'Caja ' || TO_CHAR((v_record->>'fecha_apertura')::timestamptz, 'DD/MM/YYYY HH24:MI');
    WHEN 'movimientos_caja' THEN
      v_entity_name := v_record->>'descripcion';
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
