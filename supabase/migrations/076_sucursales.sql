-- =============================================
-- 076: sucursales — cifras y estadisticas por local
-- ---------------------------------------------
-- QUE HABILITA: que un negocio con varios locales vea sus numeros por separado
-- (ingresos, ticket promedio, top de productos, metodos de pago) y tambien
-- consolidados, sin dejar de ser UN SOLO negocio: un catalogo, una suscripcion,
-- un inicio de sesion.
--
-- ⚠️ EL STOCK SIGUE SIENDO DEL NEGOCIO, NO DEL LOCAL. Esta migracion NO separa
-- existencias: si vendes el mismo producto en dos sucursales, las unidades son
-- un unico numero compartido. Separarlas es la fase grande —toca inventario,
-- punto de venta, compras, ajustes y traspasos— y se dejo fuera a proposito.
-- Aqui solo se anade la DIMENSION por la que agrupar las cifras.
--
-- DE DONDE SACA UNA VENTA SU SUCURSAL. De la caja. Una caja es, fisicamente, un
-- mostrador en un local concreto: se elige al abrirla y todas las ventas de ese
-- turno la heredan. Esto no obligo a inventar nada — `_crear_venta_desde_items`
-- YA RECIBE `p_caja_id` y no lo usaba para esto.
--
-- Y eso importa mas de lo que parece: **la firma de la funcion no cambia**, asi
-- que no hay que rehacer grants (bug #23). Mismo motivo por el que el historial
-- de ventas (`listar_ventas`) se queda fuera: ahi si haria falta un parametro
-- nuevo, y ese cambio merece llegar solo.
--
-- POR QUE SE REESCRIBE DESDE `pg_get_functiondef`: la funcion son ~350 lineas y
-- solo cambian cuatro puntos. Se parte de lo DESPLEGADO y se comprueba que las
-- cuatro sustituciones prendan; si alguna falla, aborta sin dejarla a medias.
-- Misma tecnica que la 075, donde una sonda revertida caza lo que un
-- `COMMIT` optimista no.
-- =============================================

BEGIN;

-- =============================================
-- 1. El local
-- =============================================

CREATE TABLE IF NOT EXISTS public.sucursales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,

  -- El domicilio del local, que no tiene por que ser el del negocio
  -- (`tenants.direccion`, que es el que imprime el pie del ticket).
  direccion TEXT,

  -- Una sucursal que cierra NO se borra: sus ventas historicas la siguen
  -- apuntando y el pasado no se reescribe. Se desactiva y deja de ofrecerse al
  -- abrir caja.
  activa BOOLEAN NOT NULL DEFAULT TRUE,

  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Dos "Centro" en el mismo negocio serian indistinguibles en el desplegable
  -- de apertura de caja, que es justo donde se elige.
  UNIQUE (tenant_id, nombre)
);

-- =============================================
-- 2. RLS
-- ---------------------------------------------
-- LECTURA PARA TODO MIEMBRO, ESCRITURA CON `org.manage_settings`.
--
-- La asimetria es la misma que en `listas_precios` y por el mismo motivo: el
-- CAJERO tiene que LEER las sucursales para elegir una al abrir su caja, pero
-- dar de alta un local es una decision de gestion. `org.manage_settings` ya lo
-- tienen SUPER_ADMIN y ORG_ADMIN, y CAJERO no — verificado contra
-- `role_permissions`, no supuesto.
--
-- `user_tenant_ids()` envuelto en subconsulta: lo exige la optimizacion de la
-- migracion 059 (se evalua una vez por consulta, no por fila).
-- =============================================

ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sucursales_select" ON public.sucursales
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "sucursales_insert" ON public.sucursales
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids())
              AND public.authorize('org.manage_settings'));

CREATE POLICY "sucursales_update" ON public.sucursales
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids())
         AND public.authorize('org.manage_settings'))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids())
              AND public.authorize('org.manage_settings'));

CREATE POLICY "sucursales_delete" ON public.sucursales
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids())
         AND public.authorize('org.manage_settings'));

-- =============================================
-- 3. La sucursal en la caja y en la venta
-- ---------------------------------------------
-- LAS DOS NULLABLE, A PROPOSITO. Un negocio de un solo local no debe verse
-- obligado a inventarse una sucursal para seguir cobrando, y una venta sin caja
-- abierta no tiene de donde sacarla. `ON DELETE RESTRICT` protege el historico:
-- borrar un local con ventas detras falla en vez de dejarlas huerfanas — para
-- eso esta `activa = FALSE`.
-- =============================================

ALTER TABLE public.cajas
  ADD COLUMN IF NOT EXISTS sucursal_id UUID
  REFERENCES public.sucursales(id) ON DELETE RESTRICT;

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS sucursal_id UUID
  REFERENCES public.sucursales(id) ON DELETE RESTRICT;

-- La forma exacta de las consultas del panel: "las ventas de ESTE negocio, de
-- ESTA sucursal, en ESTE rango de fechas".
CREATE INDEX IF NOT EXISTS idx_ventas_tenant_sucursal_fecha
  ON public.ventas (tenant_id, sucursal_id, fecha_venta DESC);

-- =============================================
-- 4. Los datos que ya existen
-- ---------------------------------------------
-- Sin esto, TODO el historico apareceria como "sin sucursal" y la funcion
-- naceria pareciendo rota. A cada negocio que ya tiene ventas o cajas se le crea
-- su local `Principal` y se le asigna lo suyo.
--
-- Solo a los que tienen historico: a un negocio vacio no se le inventa nada.
-- =============================================

INSERT INTO public.sucursales (tenant_id, nombre, direccion)
SELECT t.id, 'Principal', t.direccion
FROM public.tenants t
WHERE EXISTS (SELECT 1 FROM public.ventas v WHERE v.tenant_id = t.id)
   OR EXISTS (SELECT 1 FROM public.cajas c WHERE c.tenant_id = t.id)
ON CONFLICT (tenant_id, nombre) DO NOTHING;

UPDATE public.ventas v
SET sucursal_id = s.id
FROM public.sucursales s
WHERE s.tenant_id = v.tenant_id
  AND s.nombre = 'Principal'
  AND v.sucursal_id IS NULL;

UPDATE public.cajas c
SET sucursal_id = s.id
FROM public.sucursales s
WHERE s.tenant_id = c.tenant_id
  AND s.nombre = 'Principal'
  AND c.sucursal_id IS NULL;

-- =============================================
-- 5. Que la venta herede la sucursal de su caja
-- =============================================

DO $migracion$
DECLARE
  v_src TEXT;
  v_nuevo TEXT;
  v_aplicadas INT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = '_crear_venta_desde_items';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'No existe _crear_venta_desde_items';
  END IF;

  -- Si la funcion ya trae la columna, la migracion ya corrio: no se toca.
  IF v_src LIKE '%v_sucursal_id%' THEN
    RAISE NOTICE 'La funcion ya resuelve la sucursal; no se reescribe.';
    RETURN;
  END IF;

  v_nuevo := v_src;

  -- 1. La variable donde vive la sucursal resuelta.
  v_nuevo := replace(v_nuevo,
    E'DECLARE\n  v_item JSONB;',
    E'DECLARE\n  v_sucursal_id UUID;\n  v_item JSONB;');

  -- 2. Resolverla de la caja que la funcion YA recibe. Si no hay caja abierta,
  --    `p_caja_id` es NULL, la consulta no devuelve fila y `v_sucursal_id` se
  --    queda en NULL: la venta se cobra igual. Que falte la sucursal jamas
  --    puede impedir cobrar.
  v_nuevo := replace(v_nuevo,
    E'  INSERT INTO public.ventas (',
    E'  SELECT c.sucursal_id INTO v_sucursal_id\n  FROM public.cajas c\n  WHERE c.id = p_caja_id;\n\n  INSERT INTO public.ventas (');

  -- 3-4. La columna y su valor. El INSERT lleva lista EXPLICITA, asi que hay que
  --      tocar los dos lados o el numero de columnas deja de cuadrar.
  v_nuevo := replace(v_nuevo,
    E'    idempotency_key, origen, requiere_revision, total_cobrado, lista_precio_id\n  ) VALUES (',
    E'    idempotency_key, origen, requiere_revision, total_cobrado, lista_precio_id, sucursal_id\n  ) VALUES (');

  v_nuevo := replace(v_nuevo,
    E'    p_idempotency_key, p_origen, v_requiere_revision, p_total_cobrado, v_lista_id\n  )\n  RETURNING id INTO v_venta_id;',
    E'    p_idempotency_key, p_origen, v_requiere_revision, p_total_cobrado, v_lista_id, v_sucursal_id\n  )\n  RETURNING id INTO v_venta_id;');

  SELECT COUNT(*) INTO v_aplicadas FROM (
    SELECT 1 WHERE v_nuevo LIKE '%v_sucursal_id UUID;%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%SELECT c.sucursal_id INTO v_sucursal_id%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%lista_precio_id, sucursal_id%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%v_lista_id, v_sucursal_id%'
  ) t;

  IF v_aplicadas <> 4 THEN
    RAISE EXCEPTION 'Solo prendieron % de 4 sustituciones: la funcion desplegada no es la esperada', v_aplicadas;
  END IF;

  EXECUTE v_nuevo;
END
$migracion$;

COMMIT;
