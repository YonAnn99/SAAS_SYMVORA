-- ===========================================================================
-- 115 — Tarjetas de lealtad con sellos
-- ===========================================================================
--
-- Cada negocio puede tener UN programa ("10 cafes = 1 gratis"). Sus clientes
-- reciben una tarjeta web con un QR; al cobrar, el POS la escanea y la venta
-- suma 1 sello. Al completar la meta, el premio se canjea EN LA VENTA y lo
-- calcula el servidor (como todo precio y descuento).
--
-- Todo es aditivo: `complete_sale` y `_crear_venta_desde_items` NO cambian.
-- El POS solo llama `complete_sale_lealtad` cuando la venta lleva tarjeta; sin
-- tarjeta, el flujo de siempre. Un negocio sin programa activo no ve cambios
-- en el POS.
--
-- Escrituras:
--   - programas_lealtad: desde la interfaz, con RLS `authorize('loyalty.manage')`.
--   - tarjetas_lealtad y movimientos_lealtad: SOLO por RPC. El codigo de la
--     tarjeta se genera en el servidor (no se adivina) y los sellos solo se
--     mueven con su movimiento: una escritura directa podria saltarse ambas
--     cosas, por eso no tienen politica de INSERT/UPDATE/DELETE.
--
-- La tarjeta publica (`tarjeta_publica`) es la UNICA funcion que puede llamar
-- `anon`: la pagina /tarjeta/<codigo> la ve el cliente final sin cuenta. Solo
-- devuelve lo que se pinta en la tarjeta (nada de telefono, correo ni montos).

-- ---------------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.programas_lealtad (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  nombre              text NOT NULL DEFAULT 'Tarjeta de lealtad',
  sellos_meta         integer NOT NULL DEFAULT 10,
  premio_descripcion  text NOT NULL,
  premio_tipo         text NOT NULL,
  premio_producto_id  uuid REFERENCES public.productos(id) ON DELETE RESTRICT,
  premio_variante_id  uuid REFERENCES public.variantes_producto(id) ON DELETE RESTRICT,
  premio_valor        numeric(10,2),
  compra_minima       numeric(10,2) NOT NULL DEFAULT 0,
  paleta              text NOT NULL DEFAULT 'clara',
  color_acento        text,
  activo              boolean NOT NULL DEFAULT false,
  creado_en           timestamptz NOT NULL DEFAULT now(),
  actualizado_en      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT programas_lealtad_meta_check CHECK (sellos_meta BETWEEN 2 AND 50),
  CONSTRAINT programas_lealtad_nombre_check CHECK (length(btrim(nombre)) BETWEEN 1 AND 60),
  CONSTRAINT programas_lealtad_premio_desc_check CHECK (length(btrim(premio_descripcion)) BETWEEN 1 AND 80),
  CONSTRAINT programas_lealtad_paleta_check CHECK (paleta IN ('clara', 'oscura')),
  CONSTRAINT programas_lealtad_acento_check CHECK (color_acento IS NULL OR color_acento ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT programas_lealtad_minima_check CHECK (compra_minima >= 0),
  CONSTRAINT programas_lealtad_premio_check CHECK (
    (premio_tipo = 'producto' AND premio_producto_id IS NOT NULL AND premio_valor IS NULL)
    OR (premio_tipo = 'monto' AND premio_valor > 0 AND premio_producto_id IS NULL AND premio_variante_id IS NULL)
    OR (premio_tipo = 'porcentaje' AND premio_valor > 0 AND premio_valor <= 100
        AND premio_producto_id IS NULL AND premio_variante_id IS NULL)
  )
);

COMMENT ON TABLE public.programas_lealtad IS
  'Programa de lealtad del negocio (uno por negocio). Ver migracion 115.';

CREATE TABLE IF NOT EXISTS public.tarjetas_lealtad (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  programa_id        uuid NOT NULL REFERENCES public.programas_lealtad(id) ON DELETE CASCADE,
  cliente_id         uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  codigo             text NOT NULL UNIQUE,
  sellos             integer NOT NULL DEFAULT 0,
  premios_canjeados  integer NOT NULL DEFAULT 0,
  ultima_visita      timestamptz,
  activa             boolean NOT NULL DEFAULT true,
  creado_en          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tarjetas_lealtad_cliente_unico UNIQUE (programa_id, cliente_id),
  CONSTRAINT tarjetas_lealtad_sellos_check CHECK (sellos >= 0),
  CONSTRAINT tarjetas_lealtad_canjes_check CHECK (premios_canjeados >= 0),
  CONSTRAINT tarjetas_lealtad_codigo_check CHECK (codigo ~ '^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{12}$')
);

COMMENT ON COLUMN public.tarjetas_lealtad.codigo IS
  'Va en el QR y en la URL publica /tarjeta/<codigo>. 12 caracteres aleatorios (~59 bits): no se adivina.';

CREATE TABLE IF NOT EXISTS public.movimientos_lealtad (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tarjeta_id  uuid NOT NULL REFERENCES public.tarjetas_lealtad(id) ON DELETE CASCADE,
  tipo        text NOT NULL,
  cantidad    integer NOT NULL,
  venta_id    uuid REFERENCES public.ventas(id) ON DELETE SET NULL,
  usuario_id  uuid,
  nota        text,
  creado_en   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT movimientos_lealtad_tipo_check CHECK (tipo IN ('sello', 'canje', 'ajuste')),
  CONSTRAINT movimientos_lealtad_cantidad_check CHECK (cantidad <> 0)
);

-- Una venta suma a lo mas UN sello y canjea a lo mas UN premio, aunque el POS
-- reintente el cobro (deadlock, red): la segunda vez el INSERT no entra.
CREATE UNIQUE INDEX IF NOT EXISTS movimientos_lealtad_venta_tipo_uq
  ON public.movimientos_lealtad (venta_id, tipo)
  WHERE venta_id IS NOT NULL;

-- Indices de llaves foraneas (regla de la migracion 105).
CREATE INDEX IF NOT EXISTS programas_lealtad_premio_producto_idx ON public.programas_lealtad (premio_producto_id);
CREATE INDEX IF NOT EXISTS programas_lealtad_premio_variante_idx ON public.programas_lealtad (premio_variante_id);
CREATE INDEX IF NOT EXISTS tarjetas_lealtad_tenant_idx ON public.tarjetas_lealtad (tenant_id);
CREATE INDEX IF NOT EXISTS tarjetas_lealtad_cliente_idx ON public.tarjetas_lealtad (cliente_id);
CREATE INDEX IF NOT EXISTS movimientos_lealtad_tarjeta_idx ON public.movimientos_lealtad (tarjeta_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS movimientos_lealtad_tenant_idx ON public.movimientos_lealtad (tenant_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS movimientos_lealtad_venta_idx ON public.movimientos_lealtad (venta_id);

-- actualizado_en del programa.
CREATE OR REPLACE FUNCTION public._programas_lealtad_actualizado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._programas_lealtad_actualizado() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_programas_lealtad_actualizado ON public.programas_lealtad;
CREATE TRIGGER trg_programas_lealtad_actualizado
  BEFORE UPDATE ON public.programas_lealtad
  FOR EACH ROW EXECUTE FUNCTION public._programas_lealtad_actualizado();

-- Cuenta en solo lectura (096): tampoco emite tarjetas ni mueve sellos.
DO $$
DECLARE
  v_tabla TEXT;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY['programas_lealtad', 'tarjetas_lealtad', 'movimientos_lealtad'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_solo_lectura ON public.%I', v_tabla);
    EXECUTE format(
      'CREATE TRIGGER trg_solo_lectura BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public._bloquear_si_solo_lectura()',
      v_tabla
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Permiso
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role, permission)
SELECT r.role, 'loyalty.manage'
FROM (VALUES ('SUPER_ADMIN'::public.app_role), ('ORG_ADMIN'::public.app_role)) AS r(role)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role = r.role AND rp.permission = 'loyalty.manage'
);

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.programas_lealtad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarjetas_lealtad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_lealtad ENABLE ROW LEVEL SECURITY;

-- Grants explicitos (no depender de los privilegios por defecto del esquema).
-- anon no toca las tablas: la tarjeta publica va por `tarjeta_publica`.
REVOKE ALL ON public.programas_lealtad, public.tarjetas_lealtad, public.movimientos_lealtad FROM anon;
GRANT SELECT ON public.programas_lealtad, public.tarjetas_lealtad, public.movimientos_lealtad TO authenticated;
GRANT INSERT, UPDATE ON public.programas_lealtad TO authenticated;

DROP POLICY IF EXISTS programas_lealtad_select ON public.programas_lealtad;
CREATE POLICY programas_lealtad_select ON public.programas_lealtad
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

DROP POLICY IF EXISTS programas_lealtad_insert ON public.programas_lealtad;
CREATE POLICY programas_lealtad_insert ON public.programas_lealtad
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND (SELECT public.authorize('loyalty.manage')));

DROP POLICY IF EXISTS programas_lealtad_update ON public.programas_lealtad;
CREATE POLICY programas_lealtad_update ON public.programas_lealtad
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()) AND (SELECT public.authorize('loyalty.manage')))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND (SELECT public.authorize('loyalty.manage')));

DROP POLICY IF EXISTS tarjetas_lealtad_select ON public.tarjetas_lealtad;
CREATE POLICY tarjetas_lealtad_select ON public.tarjetas_lealtad
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

DROP POLICY IF EXISTS movimientos_lealtad_select ON public.movimientos_lealtad;
CREATE POLICY movimientos_lealtad_select ON public.movimientos_lealtad
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

-- El premio de un programa tiene que ser un producto DEL MISMO negocio (y la
-- variante, de ese producto). La FK sola no lo garantiza.
CREATE OR REPLACE FUNCTION public._programas_lealtad_premio_valido()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.premio_producto_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.productos p
    WHERE p.id = NEW.premio_producto_id AND p.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'El producto del premio no es de este negocio';
  END IF;
  IF NEW.premio_variante_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.variantes_producto v
    WHERE v.id = NEW.premio_variante_id
      AND v.producto_id = NEW.premio_producto_id
      AND v.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'La variante del premio no corresponde al producto';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._programas_lealtad_premio_valido() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_programas_lealtad_premio ON public.programas_lealtad;
CREATE TRIGGER trg_programas_lealtad_premio
  BEFORE INSERT OR UPDATE ON public.programas_lealtad
  FOR EACH ROW EXECUTE FUNCTION public._programas_lealtad_premio_valido();

-- ---------------------------------------------------------------------------
-- 4. Funciones internas
-- ---------------------------------------------------------------------------

-- Precio unitario con el que se vendera un renglon: la misma regla que
-- `_crear_venta_desde_items` (precio de la variante si es > 0, si no el del
-- producto; la lista de precios lo pisa si tiene renglon con precio). Solo
-- sirve para calcular el premio y el tope ANTES de crear la venta; la venta
-- misma vuelve a calcular todo.
CREATE OR REPLACE FUNCTION public._precio_unitario_lealtad(
  p_tenant_id uuid, p_producto_id uuid, p_variante_id uuid, p_lista_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_precio numeric;
  v_lista numeric;
BEGIN
  SELECT CASE WHEN v.precio_venta > 0 THEN v.precio_venta ELSE p.precio_venta END
  INTO v_precio
  FROM public.productos p
  LEFT JOIN public.variantes_producto v
    ON v.id = p_variante_id AND v.producto_id = p.id AND v.tenant_id = p_tenant_id
  WHERE p.id = p_producto_id AND p.tenant_id = p_tenant_id;

  IF p_lista_id IS NOT NULL THEN
    SELECT pl.precio INTO v_lista
    FROM public.precios_lista pl
    JOIN public.listas_precios l ON l.id = pl.lista_id AND l.tenant_id = p_tenant_id
    WHERE pl.lista_id = p_lista_id
      AND pl.producto_id = p_producto_id
      AND pl.variante_id IS NOT DISTINCT FROM p_variante_id;
    IF v_lista IS NOT NULL THEN
      v_precio := v_lista;
    END IF;
  END IF;

  RETURN COALESCE(v_precio, 0);
END;
$$;
REVOKE ALL ON FUNCTION public._precio_unitario_lealtad(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Estado de una tarjeta para devolver al POS.
CREATE OR REPLACE FUNCTION public._estado_tarjeta_lealtad(p_tarjeta_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'tarjeta_id', t.id,
    'codigo', t.codigo,
    'cliente_id', t.cliente_id,
    'sellos', t.sellos,
    'sellos_meta', p.sellos_meta,
    'premios_canjeados', t.premios_canjeados,
    'premio_descripcion', p.premio_descripcion,
    'tiene_premio', p.activo AND t.activa AND t.sellos >= p.sellos_meta
  )
  FROM public.tarjetas_lealtad t
  JOIN public.programas_lealtad p ON p.id = t.programa_id
  WHERE t.id = p_tarjeta_id;
$$;
REVOKE ALL ON FUNCTION public._estado_tarjeta_lealtad(uuid) FROM PUBLIC, anon, authenticated;

-- 12 caracteres sin los que se confunden (0/O, 1/I/L, U).
CREATE OR REPLACE FUNCTION public._codigo_tarjeta_lealtad()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = ''
AS $$
DECLARE
  v_alfabeto CONSTANT text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_bytes bytea := extensions.gen_random_bytes(12);
  v_codigo text := '';
BEGIN
  FOR i IN 0..11 LOOP
    v_codigo := v_codigo || substr(v_alfabeto, (get_byte(v_bytes, i) % 30) + 1, 1);
  END LOOP;
  RETURN v_codigo;
END;
$$;
REVOKE ALL ON FUNCTION public._codigo_tarjeta_lealtad() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Emitir tarjeta (cualquiera que venda)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.emitir_tarjeta_lealtad(p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_tenant uuid;
  v_programa public.programas_lealtad%ROWTYPE;
  v_tarjeta_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT c.tenant_id INTO v_tenant FROM public.clientes c WHERE c.id = p_cliente_id;
  IF v_tenant IS NULL OR v_tenant NOT IN (SELECT public.user_tenant_ids()) THEN
    RAISE EXCEPTION 'Cliente invalido para este negocio';
  END IF;
  IF NOT public.authorize('sales.create') THEN
    RAISE EXCEPTION 'No tienes permiso para emitir tarjetas';
  END IF;

  SELECT * INTO v_programa FROM public.programas_lealtad WHERE tenant_id = v_tenant;
  IF v_programa.id IS NULL THEN
    RAISE EXCEPTION 'Configura primero el programa de lealtad';
  END IF;
  IF NOT v_programa.activo THEN
    RAISE EXCEPTION 'El programa de lealtad no esta activo';
  END IF;

  SELECT t.id INTO v_tarjeta_id
  FROM public.tarjetas_lealtad t
  WHERE t.programa_id = v_programa.id AND t.cliente_id = p_cliente_id;

  -- Hasta 5 intentos por si el codigo aleatorio choca con uno existente
  -- (practicamente imposible con ~59 bits, pero se cubre).
  FOR i IN 1..5 LOOP
    EXIT WHEN v_tarjeta_id IS NOT NULL;
    BEGIN
      INSERT INTO public.tarjetas_lealtad (tenant_id, programa_id, cliente_id, codigo)
      VALUES (v_tenant, v_programa.id, p_cliente_id, public._codigo_tarjeta_lealtad())
      RETURNING id INTO v_tarjeta_id;
    EXCEPTION WHEN unique_violation THEN
      -- O choco el codigo, o otra caja emitio la del mismo cliente al mismo tiempo.
      SELECT t.id INTO v_tarjeta_id
      FROM public.tarjetas_lealtad t
      WHERE t.programa_id = v_programa.id AND t.cliente_id = p_cliente_id;
    END;
  END LOOP;

  IF v_tarjeta_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo generar la tarjeta, intenta de nuevo';
  END IF;

  RETURN public._estado_tarjeta_lealtad(v_tarjeta_id);
END;
$$;
REVOKE ALL ON FUNCTION public.emitir_tarjeta_lealtad(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emitir_tarjeta_lealtad(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Ajustar sellos a mano (loyalty.manage)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ajustar_sellos_lealtad(
  p_tarjeta_id uuid, p_cantidad integer, p_nota text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_tarjeta public.tarjetas_lealtad%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad = 0 THEN
    RAISE EXCEPTION 'Indica cuantos sellos sumar o quitar';
  END IF;

  SELECT * INTO v_tarjeta
  FROM public.tarjetas_lealtad
  WHERE id = p_tarjeta_id AND tenant_id IN (SELECT public.user_tenant_ids())
  FOR UPDATE;
  IF v_tarjeta.id IS NULL THEN
    RAISE EXCEPTION 'Tarjeta invalida para este negocio';
  END IF;
  IF NOT public.authorize('loyalty.manage') THEN
    RAISE EXCEPTION 'No tienes permiso para ajustar sellos';
  END IF;
  IF v_tarjeta.sellos + p_cantidad < 0 THEN
    RAISE EXCEPTION 'La tarjeta solo tiene % sellos', v_tarjeta.sellos;
  END IF;

  UPDATE public.tarjetas_lealtad SET sellos = sellos + p_cantidad WHERE id = v_tarjeta.id;
  INSERT INTO public.movimientos_lealtad (tenant_id, tarjeta_id, tipo, cantidad, usuario_id, nota)
  VALUES (v_tarjeta.tenant_id, v_tarjeta.id, 'ajuste', p_cantidad, v_caller, NULLIF(btrim(p_nota), ''));

  RETURN public._estado_tarjeta_lealtad(v_tarjeta.id);
END;
$$;
REVOKE ALL ON FUNCTION public.ajustar_sellos_lealtad(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajustar_sellos_lealtad(uuid, integer, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Cobrar con tarjeta: venta + sello o canje, en una sola transaccion
-- ---------------------------------------------------------------------------
-- Mismos argumentos que `complete_sale` mas la tarjeta y si se canjea el
-- premio. `complete_sale` no se toca: el POS solo llama a esta cuando la
-- venta lleva tarjeta.
CREATE OR REPLACE FUNCTION public.complete_sale_lealtad(
  p_tenant_id uuid,
  p_usuario_id uuid,
  p_cliente_id uuid DEFAULT NULL,
  p_metodo_pago public.metodo_pago DEFAULT 'EFECTIVO',
  p_items jsonb DEFAULT NULL,
  p_include_iva boolean DEFAULT true,
  p_notas text DEFAULT NULL,
  p_monto_recibido numeric DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL,
  p_fecha_venta timestamptz DEFAULT NULL,
  p_caja_id uuid DEFAULT NULL,
  p_total_cobrado numeric DEFAULT NULL,
  p_origen text DEFAULT 'online',
  p_lista_precio_id uuid DEFAULT NULL,
  p_tarjeta_id uuid DEFAULT NULL,
  p_canjear boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_tarjeta public.tarjetas_lealtad%ROWTYPE;
  v_programa public.programas_lealtad%ROWTYPE;
  v_vigente boolean;
  v_items jsonb := p_items;
  v_item jsonb;
  v_venta jsonb;
  v_venta_id uuid;
  v_precio numeric;
  v_linea numeric;
  v_desc numeric;
  v_subtotal numeric := 0;
  v_manual numeric := 0;
  v_premio numeric := 0;
  v_restante numeric;
  v_aplicar numeric;
  v_encontrado boolean := false;
  v_sello boolean := false;
  v_canjeado boolean := false;
BEGIN
  -- Mismas comprobaciones que complete_sale.
  IF v_caller IS NULL OR v_caller <> p_usuario_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta debe incluir al menos un producto';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE user_id = v_caller AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'No perteneces a este negocio';
  END IF;
  IF NOT public.authorize('sales.create') THEN
    RAISE EXCEPTION 'No tienes permiso para registrar ventas';
  END IF;
  IF p_tarjeta_id IS NULL THEN
    RAISE EXCEPTION 'Falta la tarjeta de lealtad';
  END IF;

  -- Reintento del mismo cobro: la venta ya existe. Se devuelve tal cual y la
  -- tarjeta NO se vuelve a tocar.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT to_jsonb(v.*) INTO v_venta
    FROM public.ventas v
    WHERE v.idempotency_key = p_idempotency_key AND v.tenant_id = p_tenant_id;
    IF v_venta IS NOT NULL THEN
      RETURN v_venta || jsonb_build_object(
        'lealtad',
        COALESCE(public._estado_tarjeta_lealtad(p_tarjeta_id), '{}'::jsonb)
          || jsonb_build_object('reintento', true)
      );
    END IF;
  END IF;

  -- La tarjeta se bloquea ANTES que los productos (que bloquea la venta). Toda
  -- venta con tarjeta sigue ese orden y las ventas sin tarjeta no la tocan:
  -- no hay cruce que provoque un deadlock.
  SELECT * INTO v_tarjeta
  FROM public.tarjetas_lealtad
  WHERE id = p_tarjeta_id AND tenant_id = p_tenant_id
  FOR UPDATE;
  IF v_tarjeta.id IS NULL THEN
    RAISE EXCEPTION 'Tarjeta de lealtad invalida para este negocio';
  END IF;
  IF p_cliente_id IS NOT NULL AND p_cliente_id <> v_tarjeta.cliente_id THEN
    RAISE EXCEPTION 'La tarjeta de lealtad es de otro cliente';
  END IF;

  SELECT * INTO v_programa FROM public.programas_lealtad WHERE id = v_tarjeta.programa_id;
  v_vigente := v_programa.activo AND v_tarjeta.activa;

  IF p_canjear THEN
    IF NOT v_vigente THEN
      RAISE EXCEPTION 'El programa de lealtad no esta activo';
    END IF;
    IF v_tarjeta.sellos < v_programa.sellos_meta THEN
      RAISE EXCEPTION 'La tarjeta aun no completa sus sellos (% de %)',
        v_tarjeta.sellos, v_programa.sellos_meta;
    END IF;
  END IF;

  -- Subtotal y descuento manual con los precios del servidor: el tope del
  -- cajero (094) se valida aqui solo sobre lo que mando el POS, porque el
  -- premio no es un descuento manual.
  FOR i IN 0 .. jsonb_array_length(p_items) - 1 LOOP
    v_item := p_items -> i;
    v_precio := public._precio_unitario_lealtad(
      p_tenant_id,
      (v_item ->> 'productId')::uuid,
      NULLIF(v_item ->> 'varianteId', '')::uuid,
      p_lista_precio_id
    );
    v_linea := ROUND(v_precio * COALESCE((v_item ->> 'cantidad')::numeric, 0), 2);
    v_subtotal := v_subtotal + v_linea;
    v_manual := v_manual + LEAST(GREATEST(ROUND(COALESCE((v_item ->> 'descuento')::numeric, 0), 2), 0), v_linea);
  END LOOP;

  IF NOT public.authorize('sales.discount_unlimited')
     AND v_manual > ROUND(v_subtotal * 10 / 100, 2) THEN
    RAISE EXCEPTION 'El descuento supera el máximo permitido (10 %% del ticket)';
  END IF;

  -- El premio, calculado aqui y metido como descuento de renglon.
  IF p_canjear THEN
    IF v_programa.premio_tipo = 'producto' THEN
      FOR i IN 0 .. jsonb_array_length(v_items) - 1 LOOP
        v_item := v_items -> i;
        IF (v_item ->> 'productId')::uuid = v_programa.premio_producto_id
           AND (v_programa.premio_variante_id IS NULL
                OR NULLIF(v_item ->> 'varianteId', '')::uuid = v_programa.premio_variante_id) THEN
          v_precio := public._precio_unitario_lealtad(
            p_tenant_id, (v_item ->> 'productId')::uuid,
            NULLIF(v_item ->> 'varianteId', '')::uuid, p_lista_precio_id
          );
          v_linea := ROUND(v_precio * (v_item ->> 'cantidad')::numeric, 2);
          v_desc := LEAST(GREATEST(ROUND(COALESCE((v_item ->> 'descuento')::numeric, 0), 2), 0), v_linea);
          -- Una unidad gratis (o lo que quede del renglon).
          v_aplicar := LEAST(v_precio, v_linea - v_desc);
          v_items := jsonb_set(v_items, ARRAY[i::text, 'descuento'], to_jsonb(v_desc + v_aplicar));
          v_premio := v_aplicar;
          v_encontrado := true;
          EXIT;
        END IF;
      END LOOP;
      IF NOT v_encontrado THEN
        RAISE EXCEPTION 'Agrega al carrito el producto del premio';
      END IF;
    ELSE
      v_premio := CASE
        WHEN v_programa.premio_tipo = 'monto' THEN v_programa.premio_valor
        ELSE ROUND((v_subtotal - v_manual) * v_programa.premio_valor / 100, 2)
      END;
      v_premio := LEAST(v_premio, v_subtotal - v_manual);
      v_restante := v_premio;
      FOR i IN 0 .. jsonb_array_length(v_items) - 1 LOOP
        EXIT WHEN v_restante <= 0;
        v_item := v_items -> i;
        v_precio := public._precio_unitario_lealtad(
          p_tenant_id, (v_item ->> 'productId')::uuid,
          NULLIF(v_item ->> 'varianteId', '')::uuid, p_lista_precio_id
        );
        v_linea := ROUND(v_precio * (v_item ->> 'cantidad')::numeric, 2);
        v_desc := LEAST(GREATEST(ROUND(COALESCE((v_item ->> 'descuento')::numeric, 0), 2), 0), v_linea);
        v_aplicar := LEAST(v_restante, v_linea - v_desc);
        IF v_aplicar > 0 THEN
          v_items := jsonb_set(v_items, ARRAY[i::text, 'descuento'], to_jsonb(v_desc + v_aplicar));
          v_restante := v_restante - v_aplicar;
        END IF;
      END LOOP;
      v_premio := v_premio - v_restante;
    END IF;
  END IF;

  -- La venta, con el motor de siempre. Tope NULL: ya se valido arriba.
  v_venta := public._crear_venta_desde_items(
    p_tenant_id, v_caller, v_tarjeta.cliente_id, p_metodo_pago, v_items,
    p_include_iva, p_notas, p_monto_recibido,
    p_idempotency_key, p_fecha_venta, p_caja_id, p_total_cobrado,
    (p_origen = 'offline'), p_origen, p_lista_precio_id, NULL
  );
  v_venta_id := (v_venta ->> 'id')::uuid;

  IF p_canjear THEN
    INSERT INTO public.movimientos_lealtad (tenant_id, tarjeta_id, tipo, cantidad, venta_id, usuario_id, nota)
    VALUES (p_tenant_id, v_tarjeta.id, 'canje', -v_programa.sellos_meta, v_venta_id, v_caller,
            'Premio: ' || v_programa.premio_descripcion)
    ON CONFLICT (venta_id, tipo) WHERE venta_id IS NOT NULL DO NOTHING;
    IF FOUND THEN
      UPDATE public.tarjetas_lealtad
      SET sellos = sellos - v_programa.sellos_meta,
          premios_canjeados = premios_canjeados + 1,
          ultima_visita = now()
      WHERE id = v_tarjeta.id;
      v_canjeado := true;
    END IF;
  ELSIF v_vigente AND (v_venta ->> 'total')::numeric >= v_programa.compra_minima THEN
    -- La venta del canje no suma sello; las demas, uno.
    INSERT INTO public.movimientos_lealtad (tenant_id, tarjeta_id, tipo, cantidad, venta_id, usuario_id)
    VALUES (p_tenant_id, v_tarjeta.id, 'sello', 1, v_venta_id, v_caller)
    ON CONFLICT (venta_id, tipo) WHERE venta_id IS NOT NULL DO NOTHING;
    IF FOUND THEN
      UPDATE public.tarjetas_lealtad
      SET sellos = sellos + 1, ultima_visita = now()
      WHERE id = v_tarjeta.id;
      v_sello := true;
    END IF;
  ELSE
    UPDATE public.tarjetas_lealtad SET ultima_visita = now() WHERE id = v_tarjeta.id;
  END IF;

  RETURN v_venta || jsonb_build_object(
    'lealtad',
    public._estado_tarjeta_lealtad(v_tarjeta.id) || jsonb_build_object(
      'sello_sumado', v_sello,
      'premio_canjeado', v_canjeado,
      'premio_monto', v_premio
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.complete_sale_lealtad(
  uuid, uuid, uuid, public.metodo_pago, jsonb, boolean, text, numeric, uuid,
  timestamptz, uuid, numeric, text, uuid, uuid, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_sale_lealtad(
  uuid, uuid, uuid, public.metodo_pago, jsonb, boolean, text, numeric, uuid,
  timestamptz, uuid, numeric, text, uuid, uuid, boolean
) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Tarjeta publica (la pagina /tarjeta/<codigo>, sin cuenta)
-- ---------------------------------------------------------------------------
-- UNICA funcion de lealtad ejecutable por anon. Solo lo que se pinta en la
-- tarjeta: del cliente, el PRIMER nombre; nada de telefono, correo ni montos.
CREATE OR REPLACE FUNCTION public.tarjeta_publica(p_codigo text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'codigo', t.codigo,
    'negocio', tn.nombre_comercial,
    'logo_url', tn.logo_url,
    'paleta', p.paleta,
    'color_acento', COALESCE(p.color_acento, tn.color_primario),
    'programa', p.nombre,
    'sellos_meta', p.sellos_meta,
    'premio_descripcion', p.premio_descripcion,
    'sellos', t.sellos,
    'premios_canjeados', t.premios_canjeados,
    'cliente', split_part(btrim(c.nombre), ' ', 1),
    'activa', p.activo AND t.activa
  )
  FROM public.tarjetas_lealtad t
  JOIN public.programas_lealtad p ON p.id = t.programa_id
  JOIN public.tenants tn ON tn.id = t.tenant_id
  JOIN public.clientes c ON c.id = t.cliente_id
  WHERE t.codigo = upper(btrim(p_codigo));
$$;
REVOKE ALL ON FUNCTION public.tarjeta_publica(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tarjeta_publica(text) TO anon, authenticated;
