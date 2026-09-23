-- =============================================
-- 085: que sucursales tiene asignadas cada usuario
-- ---------------------------------------------
-- QUE RESUELVE: con varios locales hace falta decir quien trabaja donde. Un
-- cajero asignado a Norte solo abre caja, ajusta, compra y traspasa desde Norte,
-- y solo VE las cifras de Norte.
--
-- TRES REGLAS, decididas con el dueño:
--   - Un usuario puede tener VARIAS sucursales (el encargado que cubre dos).
--   - SIN FILAS = TODAS, igual que antes de esta migracion. Nada cambia para los
--     usuarios que ya existen ni para los negocios de un solo local.
--   - El SUPER_ADMIN NUNCA se restringe, aunque tenga filas.
--
-- LA APLICA LA BASE, NO LA PANTALLA. Si solo se ocultara en la interfaz, un
-- cajero de Norte podria leer las ventas de Principal pidiendolas a PostgREST.
-- En este repo la barrera cosmetica ya fallo cuatro veces (bugs #1, #27, #33,
-- #34). Por eso se tocan las politicas de LECTURA de las tablas con sucursal, y
-- las funciones SECURITY DEFINER que las leen o escriben (esas saltan RLS).
--
-- `detalle_ventas` y `movimientos_caja` no se tocan y quedan restringidas
-- igual: sus politicas filtran A TRAVES de `ventas` y `cajas`, y RLS se aplica
-- tambien dentro de esas subconsultas.
-- =============================================

BEGIN;

-- =============================================
-- 1. La asignacion
-- =============================================

CREATE TABLE IF NOT EXISTS public.usuario_sucursales (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sucursal_id UUID NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, sucursal_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_sucursales_tenant_user
  ON public.usuario_sucursales (tenant_id, user_id);

-- La sucursal tiene que ser del negocio de la fila. Sin esto, una asignacion
-- podria apuntar a un local ajeno y `mis_sucursales` lo devolveria.
CREATE OR REPLACE FUNCTION public._usuario_sucursal_mismo_negocio()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sucursales s WHERE s.id = NEW.sucursal_id AND s.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'La sucursal no pertenece a este negocio';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_usuario_sucursales_negocio ON public.usuario_sucursales;
CREATE TRIGGER trg_usuario_sucursales_negocio
  BEFORE INSERT OR UPDATE ON public.usuario_sucursales
  FOR EACH ROW EXECUTE FUNCTION public._usuario_sucursal_mismo_negocio();

-- Se lee: la propia asignacion (el contexto de la app la necesita) y, quien
-- administra usuarios, la de todo su negocio. Se escribe SOLO por
-- `asignar_sucursales_usuario`: no hay politicas de escritura.
ALTER TABLE public.usuario_sucursales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario_sucursales_select" ON public.usuario_sucursales
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid())
         OR (tenant_id IN (SELECT public.user_tenant_ids())
             AND public.authorize('org.manage_members')));

-- =============================================
-- 2. Que sucursales puede ver y operar el usuario actual
-- ---------------------------------------------
-- POR NEGOCIO: estar restringido en uno no restringe en otro. Todas si es
-- SUPER_ADMIN o si no tiene filas en ese negocio; si no, solo las suyas.
-- =============================================

CREATE OR REPLACE FUNCTION public.mis_sucursales()
RETURNS SETOF UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT s.id
  FROM public.sucursales s
  JOIN public.tenant_memberships m
    ON m.tenant_id = s.tenant_id AND m.user_id = auth.uid()
  WHERE m.role = 'SUPER_ADMIN'
     OR NOT EXISTS (
       SELECT 1 FROM public.usuario_sucursales us
       WHERE us.user_id = auth.uid() AND us.tenant_id = s.tenant_id)
     OR EXISTS (
       SELECT 1 FROM public.usuario_sucursales us
       WHERE us.user_id = auth.uid() AND us.sucursal_id = s.id);
$fn$;

REVOKE ALL ON FUNCTION public.mis_sucursales() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mis_sucursales() TO authenticated, service_role;

-- El local de una operacion de USUARIO (ajuste, compra, recepcion).
--   - Con sucursal explicita: tiene que ser del negocio y estar permitida.
--   - Sin ella: la primera permitida. El "local por defecto" de un cajero de
--     Norte es Norte, no Principal.
--   - Sin sesion (procesos del sistema, cron): el local por defecto de siempre.
CREATE OR REPLACE FUNCTION public._sucursal_para_usuario(p_tenant_id UUID, p_sucursal_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_sucursal UUID;
BEGIN
  IF p_sucursal_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.sucursales s WHERE s.id = p_sucursal_id AND s.tenant_id = p_tenant_id
    ) THEN
      RAISE EXCEPTION 'La sucursal no pertenece a este negocio';
    END IF;
    IF auth.uid() IS NOT NULL AND p_sucursal_id NOT IN (SELECT public.mis_sucursales()) THEN
      RAISE EXCEPTION 'No tienes asignada esa sucursal';
    END IF;
    RETURN p_sucursal_id;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN public._sucursal_por_defecto(p_tenant_id);
  END IF;

  SELECT s.id INTO v_sucursal
  FROM public.sucursales s
  WHERE s.tenant_id = p_tenant_id
    AND s.id IN (SELECT public.mis_sucursales())
  ORDER BY s.activa DESC, s.creado_en
  LIMIT 1;

  IF v_sucursal IS NULL THEN
    RAISE EXCEPTION 'No tienes ninguna sucursal asignada en este negocio';
  END IF;
  RETURN v_sucursal;
END;
$fn$;

REVOKE ALL ON FUNCTION public._sucursal_para_usuario(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- =============================================
-- 3. Asignar (solo quien administra usuarios)
-- ---------------------------------------------
-- Sustituye la asignacion entera. Array vacio = sin restriccion (todas).
-- =============================================

CREATE OR REPLACE FUNCTION public.asignar_sucursales_usuario(
  p_tenant_id UUID,
  p_user_id UUID,
  p_sucursales UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_rol public.app_role;
  v_ajenas INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF NOT public._puede(p_tenant_id, 'org.manage_members_write') THEN
    RAISE EXCEPTION 'No tienes permiso para administrar usuarios';
  END IF;

  SELECT m.role INTO v_rol FROM public.tenant_memberships m
  WHERE m.tenant_id = p_tenant_id AND m.user_id = p_user_id;
  IF v_rol IS NULL THEN
    RAISE EXCEPTION 'Ese usuario no pertenece a este negocio';
  END IF;

  -- Se rechaza en vez de ignorarlo en silencio: el dueño ve siempre todo, y
  -- guardarle una asignacion que no hace nada solo confundiria a quien la mire.
  IF v_rol = 'SUPER_ADMIN' AND COALESCE(array_length(p_sucursales, 1), 0) > 0 THEN
    RAISE EXCEPTION 'El dueño del negocio siempre tiene todas las sucursales';
  END IF;

  SELECT count(*) INTO v_ajenas
  FROM unnest(COALESCE(p_sucursales, '{}')) AS x(id)
  WHERE NOT EXISTS (SELECT 1 FROM public.sucursales s WHERE s.id = x.id AND s.tenant_id = p_tenant_id);
  IF v_ajenas > 0 THEN
    RAISE EXCEPTION 'Alguna sucursal no pertenece a este negocio';
  END IF;

  DELETE FROM public.usuario_sucursales
  WHERE tenant_id = p_tenant_id AND user_id = p_user_id;

  INSERT INTO public.usuario_sucursales (tenant_id, user_id, sucursal_id)
  SELECT DISTINCT p_tenant_id, p_user_id, x.id
  FROM unnest(COALESCE(p_sucursales, '{}')) AS x(id);
END;
$fn$;

REVOKE ALL ON FUNCTION public.asignar_sucursales_usuario(UUID, UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.asignar_sucursales_usuario(UUID, UUID, UUID[]) TO authenticated, service_role;

-- La invitacion lleva sus sucursales; `key-login` las copia al aceptarla.
ALTER TABLE public.user_invite_keys
  ADD COLUMN IF NOT EXISTS sucursal_ids UUID[] NOT NULL DEFAULT '{}';

-- =============================================
-- 4. LECTURA: cada uno ve lo de sus sucursales
-- ---------------------------------------------
-- `sucursal_id IS NULL` sigue visible: son filas anteriores a las sucursales
-- que no pertenecen a ningun local (hoy no queda ninguna, pero una fila que
-- desaparece sin explicacion es peor que una que se ve de mas).
-- =============================================

DROP POLICY IF EXISTS "ventas_select" ON public.ventas;
CREATE POLICY "ventas_select" ON public.ventas
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids())
         AND (sucursal_id IS NULL OR sucursal_id IN (SELECT public.mis_sucursales())));

DROP POLICY IF EXISTS "cajas_select" ON public.cajas;
CREATE POLICY "cajas_select" ON public.cajas
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids())
         AND (sucursal_id IS NULL OR sucursal_id IN (SELECT public.mis_sucursales())));

DROP POLICY IF EXISTS "compras_select" ON public.compras;
CREATE POLICY "compras_select" ON public.compras
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids())
         AND (sucursal_id IS NULL OR sucursal_id IN (SELECT public.mis_sucursales())));

DROP POLICY IF EXISTS "ordenes_compra_select" ON public.ordenes_compra;
CREATE POLICY "ordenes_compra_select" ON public.ordenes_compra
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids())
         AND (sucursal_id IS NULL OR sucursal_id IN (SELECT public.mis_sucursales())));

DROP POLICY IF EXISTS "ajustes_inventario_select" ON public.ajustes_inventario;
CREATE POLICY "ajustes_inventario_select" ON public.ajustes_inventario
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids())
         AND (sucursal_id IS NULL OR sucursal_id IN (SELECT public.mis_sucursales())));

-- `mis_sucursales` ya implica ser miembro del negocio de la sucursal.
DROP POLICY IF EXISTS "stock_sucursal_select" ON public.stock_sucursal;
CREATE POLICY "stock_sucursal_select" ON public.stock_sucursal
  FOR SELECT TO authenticated
  USING (sucursal_id IN (SELECT public.mis_sucursales()));

-- Un traspaso se ve si sale O llega a una sucursal del usuario: al que recibe
-- tambien le interesa saber que le mandaron.
DROP POLICY IF EXISTS "traspasos_select" ON public.traspasos;
CREATE POLICY "traspasos_select" ON public.traspasos
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids())
         AND (sucursal_origen_id IN (SELECT public.mis_sucursales())
              OR sucursal_destino_id IN (SELECT public.mis_sucursales())));

-- =============================================
-- 5. ESCRITURA
-- =============================================

-- 5a. Abrir caja solo en una sucursal propia. Si llega sin sucursal y el
--     usuario solo tiene una en ese negocio, se le pone esa.
CREATE OR REPLACE FUNCTION public._caja_en_sucursal_permitida()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_permitidas UUID[];
BEGIN
  -- Procesos del sistema (cierre automatico con service_role): sin usuario.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(s.id) INTO v_permitidas
  FROM public.sucursales s
  WHERE s.tenant_id = NEW.tenant_id AND s.activa
    AND s.id IN (SELECT public.mis_sucursales());

  IF NEW.sucursal_id IS NULL THEN
    IF COALESCE(array_length(v_permitidas, 1), 0) = 1 THEN
      NEW.sucursal_id := v_permitidas[1];
    END IF;
    RETURN NEW;
  END IF;

  IF NOT (NEW.sucursal_id = ANY (COALESCE(v_permitidas, '{}'))) THEN
    RAISE EXCEPTION 'No puedes abrir caja en una sucursal que no tienes asignada';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_cajas_sucursal_permitida ON public.cajas;
CREATE TRIGGER trg_cajas_sucursal_permitida
  BEFORE INSERT OR UPDATE OF sucursal_id ON public.cajas
  FOR EACH ROW EXECUTE FUNCTION public._caja_en_sucursal_permitida();

-- 5b. Ordenes de compra: solo hacia una sucursal propia.
DROP POLICY IF EXISTS "ordenes_compra_insert" ON public.ordenes_compra;
CREATE POLICY "ordenes_compra_insert" ON public.ordenes_compra
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids())
              AND public.authorize('purchases.manage')
              AND (sucursal_id IS NULL OR sucursal_id IN (SELECT public.mis_sucursales())));

DROP POLICY IF EXISTS "ordenes_compra_update" ON public.ordenes_compra;
CREATE POLICY "ordenes_compra_update" ON public.ordenes_compra
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids())
         AND public.authorize('purchases.manage')
         AND (sucursal_id IS NULL OR sucursal_id IN (SELECT public.mis_sucursales())))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids())
              AND public.authorize('purchases.manage')
              AND (sucursal_id IS NULL OR sucursal_id IN (SELECT public.mis_sucursales())));

-- 5c. Las funciones SECURITY DEFINER (saltan RLS): resolver la sucursal con las
--     reglas del usuario. Sustituciones verificadas, como en la 075-082.
DO $migracion$
DECLARE v_src TEXT; v_nuevo TEXT;
BEGIN
  -- Ajuste
  SELECT pg_get_functiondef(p.oid) INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='ajustar_inventario';
  IF v_src NOT LIKE '%_sucursal_para_usuario%' THEN
    v_nuevo := replace(v_src,
$q$  IF p_sucursal_id IS NOT NULL THEN
    SELECT s.id INTO v_sucursal FROM public.sucursales s
    WHERE s.id = p_sucursal_id AND s.tenant_id = v_tenant_id;
    IF v_sucursal IS NULL THEN
      RAISE EXCEPTION 'La sucursal no pertenece a este negocio';
    END IF;
  ELSE
    v_sucursal := public._sucursal_por_defecto(v_tenant_id);
  END IF;$q$,
$q$  -- Del negocio y asignada al usuario (migracion 085).
  v_sucursal := public._sucursal_para_usuario(v_tenant_id, p_sucursal_id);$q$);
    IF v_nuevo NOT LIKE '%_sucursal_para_usuario(v_tenant_id, p_sucursal_id)%' THEN
      RAISE EXCEPTION 'Ajuste: la sustitucion no prendio';
    END IF;
    EXECUTE v_nuevo;
  END IF;

  -- Compra directa
  SELECT pg_get_functiondef(p.oid) INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='registrar_compra_directa';
  IF v_src NOT LIKE '%_sucursal_para_usuario%' THEN
    v_nuevo := replace(v_src,
$q$  IF p_sucursal_id IS NOT NULL THEN
    SELECT s.id INTO v_sucursal FROM public.sucursales s
    WHERE s.id = p_sucursal_id AND s.tenant_id = p_tenant_id;
    IF v_sucursal IS NULL THEN
      RAISE EXCEPTION 'La sucursal no pertenece a este negocio';
    END IF;
  ELSE
    v_sucursal := public._sucursal_por_defecto(p_tenant_id);
  END IF;$q$,
$q$  v_sucursal := public._sucursal_para_usuario(p_tenant_id, p_sucursal_id);$q$);
    IF v_nuevo NOT LIKE '%_sucursal_para_usuario(p_tenant_id, p_sucursal_id)%' THEN
      RAISE EXCEPTION 'Compra directa: la sustitucion no prendio';
    END IF;
    EXECUTE v_nuevo;
  END IF;

  -- Recepcion de orden: la sucursal de la orden tiene que ser del usuario.
  SELECT pg_get_functiondef(p.oid) INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='recibir_orden_compra';
  IF v_src NOT LIKE '%_sucursal_para_usuario%' THEN
    v_nuevo := replace(v_src,
$q$  SELECT s.id INTO v_sucursal FROM public.sucursales s
  WHERE s.id = v_orden.sucursal_id AND s.tenant_id = v_tenant_id;
  IF v_sucursal IS NULL THEN
    v_sucursal := public._sucursal_por_defecto(v_tenant_id);
  END IF;$q$,
$q$  v_sucursal := public._sucursal_para_usuario(v_tenant_id, v_orden.sucursal_id);$q$);
    IF v_nuevo NOT LIKE '%_sucursal_para_usuario(v_tenant_id, v_orden.sucursal_id)%' THEN
      RAISE EXCEPTION 'Recepcion: la sustitucion no prendio';
    END IF;
    EXECUTE v_nuevo;
  END IF;

  -- Venta sin caja: la primera sucursal DEL USUARIO, no la del negocio.
  SELECT pg_get_functiondef(p.oid) INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='_crear_venta_desde_items';
  IF v_src NOT LIKE '%_sucursal_para_usuario%' THEN
    v_nuevo := replace(v_src,
$q$    v_sucursal_id := public._sucursal_por_defecto(p_tenant_id);$q$,
$q$    v_sucursal_id := public._sucursal_para_usuario(p_tenant_id, NULL);$q$);
    IF v_nuevo NOT LIKE '%_sucursal_para_usuario(p_tenant_id, NULL)%' THEN
      RAISE EXCEPTION 'Venta: la sustitucion no prendio';
    END IF;
    EXECUTE v_nuevo;
  END IF;

  -- Traspaso: el ORIGEN tiene que ser del usuario. El destino puede ser
  -- cualquier local activo: mandar mercancia a otra tienda es normal.
  SELECT pg_get_functiondef(p.oid) INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='registrar_traspaso';
  IF v_src NOT LIKE '%mis_sucursales%' THEN
    v_nuevo := replace(v_src,
$q$  IF NOT public._puede(v_tenant, 'inventory.manage') THEN
    RAISE EXCEPTION 'No tienes permiso para traspasar mercancia';
  END IF;$q$,
$q$  IF NOT public._puede(v_tenant, 'inventory.manage') THEN
    RAISE EXCEPTION 'No tienes permiso para traspasar mercancia';
  END IF;

  IF p_origen_id NOT IN (SELECT public.mis_sucursales()) THEN
    RAISE EXCEPTION 'No tienes asignada la sucursal de origen';
  END IF;$q$);
    IF v_nuevo NOT LIKE '%No tienes asignada la sucursal de origen%' THEN
      RAISE EXCEPTION 'Traspaso: la sustitucion no prendio';
    END IF;
    EXECUTE v_nuevo;
  END IF;

  -- Fijar existencias: solo en una sucursal propia.
  SELECT pg_get_functiondef(p.oid) INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='establecer_stock_sucursal';
  IF v_src NOT LIKE '%mis_sucursales%' THEN
    v_nuevo := replace(v_src,
$q$    RAISE EXCEPTION 'No tienes permiso para modificar existencias';
  END IF;$q$,
$q$    RAISE EXCEPTION 'No tienes permiso para modificar existencias';
  END IF;

  IF p_sucursal_id NOT IN (SELECT public.mis_sucursales()) THEN
    RAISE EXCEPTION 'No tienes asignada esa sucursal';
  END IF;$q$);
    IF v_nuevo NOT LIKE '%No tienes asignada esa sucursal%' THEN
      RAISE EXCEPTION 'Fijar existencias: la sustitucion no prendio';
    END IF;
    EXECUTE v_nuevo;
  END IF;

  -- Ticket de una venta: no el de una sucursal ajena.
  SELECT pg_get_functiondef(p.oid) INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='detalle_venta';
  IF v_src NOT LIKE '%mis_sucursales%' THEN
    v_nuevo := replace(v_src,
$q$    RAISE EXCEPTION 'Solo puedes consultar tus propias ventas';
  END IF;$q$,
$q$    RAISE EXCEPTION 'Solo puedes consultar tus propias ventas';
  END IF;

  IF v_venta.sucursal_id IS NOT NULL
     AND v_venta.sucursal_id NOT IN (SELECT public.mis_sucursales()) THEN
    RAISE EXCEPTION 'Esa venta es de una sucursal que no tienes asignada';
  END IF;$q$);
    IF v_nuevo NOT LIKE '%que no tienes asignada%' THEN
      RAISE EXCEPTION 'Detalle de venta: la sustitucion no prendio';
    END IF;
    EXECUTE v_nuevo;
  END IF;

  -- Historial: salta RLS, asi que se filtra aqui.
  SELECT pg_get_functiondef(p.oid) INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='listar_ventas';
  IF v_src NOT LIKE '%mis_sucursales%' THEN
    v_nuevo := replace(v_src,
$q$    AND (p_sucursal_id IS NULL OR v.sucursal_id = p_sucursal_id)$q$,
$q$    AND (p_sucursal_id IS NULL OR v.sucursal_id = p_sucursal_id)
    -- Solo las sucursales asignadas al usuario (migracion 085).
    AND (v.sucursal_id IS NULL OR v.sucursal_id IN (SELECT public.mis_sucursales()))$q$);
    IF v_nuevo NOT LIKE '%mis_sucursales%' THEN
      RAISE EXCEPTION 'Historial: la sustitucion no prendio';
    END IF;
    EXECUTE v_nuevo;
  END IF;
END
$migracion$;

COMMIT;
