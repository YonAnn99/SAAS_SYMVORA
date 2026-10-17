-- ============================================================================
-- 121 · Tarjetas de lealtad: el cliente se registra solo con el QR del local
-- ============================================================================
-- El negocio imprime un cartel con un QR (`codigo_alta`); el cliente lo escanea,
-- deja nombre y celular y obtiene su tarjeta al momento, sin cuenta
-- (/[locale]/tarjeta/unirse/<codigo_alta>).
--
-- Es la PRIMERA escritura anonima sobre datos de un negocio. Por eso:
--   - `alta_publica_lealtad` es SOLO de service_role. La unica puerta es
--     POST /api/lealtad/unirse, que valida Turnstile y el rate limit por IP antes
--     de llamarla; anon no puede saltarse el captcha llamando a PostgREST.
--   - Un celular que ya existe en el negocio NO recibe tarjeta ni se le devuelve
--     la suya: quien teclee el celular de otra persona se quedaria con su codigo
--     y podria canjear su premio. Se le pide ir a caja.
--   - Tope de altas con QR por negocio y dia (hora CDMX), contado con el
--     programa bloqueado.
--   - El trigger de solo lectura (096) deja pasar a service_role: aqui se revisa
--     `acceso_tenant` a mano. Las demos no aceptan altas.
--   - `programa_alta_publica` (anon) solo da lo que se pinta en la pagina: nada
--     de clientes, montos ni contacto.
--
-- Aditiva: columnas con default/NULL. `codigo_alta` no se escribe a mano: lo
-- genera un trigger al activar el registro y solo cambia con
-- `regenerar_codigo_alta_lealtad`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Columnas
-- ---------------------------------------------------------------------------
ALTER TABLE public.programas_lealtad
  ADD COLUMN IF NOT EXISTS alta_publica boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS codigo_alta text,
  ADD COLUMN IF NOT EXISTS aviso_privacidad_url text;

ALTER TABLE public.tarjetas_lealtad
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'equipo',
  ADD COLUMN IF NOT EXISTS acepto_aviso_en timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'programas_lealtad_codigo_alta_check') THEN
    ALTER TABLE public.programas_lealtad
      ADD CONSTRAINT programas_lealtad_codigo_alta_check
      CHECK (codigo_alta IS NULL OR codigo_alta ~ '^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{10}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'programas_lealtad_aviso_url_check') THEN
    ALTER TABLE public.programas_lealtad
      ADD CONSTRAINT programas_lealtad_aviso_url_check
      CHECK (aviso_privacidad_url IS NULL OR (aviso_privacidad_url ~ '^https://[^\s]+$' AND length(aviso_privacidad_url) <= 300));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tarjetas_lealtad_origen_check') THEN
    ALTER TABLE public.tarjetas_lealtad
      ADD CONSTRAINT tarjetas_lealtad_origen_check CHECK (origen IN ('equipo', 'qr'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS programas_lealtad_codigo_alta_key
  ON public.programas_lealtad (codigo_alta) WHERE codigo_alta IS NOT NULL;
-- El tope diario cuenta las altas con QR de hoy.
CREATE INDEX IF NOT EXISTS tarjetas_lealtad_alta_qr_idx
  ON public.tarjetas_lealtad (tenant_id, creado_en) WHERE origen = 'qr';

-- ---------------------------------------------------------------------------
-- 2. Codigo del cartel
-- ---------------------------------------------------------------------------
-- Mismo alfabeto que las tarjetas (sin 0/O, 1/I/L ni U), 10 caracteres.
CREATE OR REPLACE FUNCTION public._codigo_alta_lealtad()
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE v_alfabeto CONSTANT text := '23456789ABCDEFGHJKMNPQRSTVWXYZ'; v_bytes bytea := extensions.gen_random_bytes(10); v_codigo text := '';
BEGIN FOR i IN 0..9 LOOP v_codigo := v_codigo || substr(v_alfabeto, (get_byte(v_bytes, i) % 30) + 1, 1); END LOOP; RETURN v_codigo; END; $$;
REVOKE ALL ON FUNCTION public._codigo_alta_lealtad() FROM PUBLIC, anon, authenticated;

-- Nadie escribe `codigo_alta` a mano (el programa se guarda por tabla con
-- loyalty.manage, y un codigo elegido seria adivinable). Al activar el registro
-- sin codigo se genera uno; solo `regenerar_codigo_alta_lealtad` lo cambia.
CREATE OR REPLACE FUNCTION public._programas_lealtad_codigo_alta()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF coalesce(current_setting('symvora.regenerar_codigo_alta', true), '') <> 'si' THEN
    NEW.codigo_alta := CASE WHEN TG_OP = 'UPDATE' THEN OLD.codigo_alta ELSE NULL END;
  END IF;
  IF NEW.alta_publica AND NEW.codigo_alta IS NULL THEN
    NEW.codigo_alta := public._codigo_alta_lealtad();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_programas_lealtad_codigo_alta ON public.programas_lealtad;
CREATE TRIGGER trg_programas_lealtad_codigo_alta
  BEFORE INSERT OR UPDATE ON public.programas_lealtad
  FOR EACH ROW EXECUTE FUNCTION public._programas_lealtad_codigo_alta();

-- «Cambiar codigo»: los carteles impresos dejan de servir.
CREATE OR REPLACE FUNCTION public.regenerar_codigo_alta_lealtad(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_codigo text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_tenant_id IS NULL OR p_tenant_id NOT IN (SELECT public.user_tenant_ids()) THEN
    RAISE EXCEPTION 'Negocio invalido';
  END IF;
  IF NOT public.authorize('loyalty.manage') THEN
    RAISE EXCEPTION 'No tienes permiso para cambiar el codigo del QR';
  END IF;

  PERFORM set_config('symvora.regenerar_codigo_alta', 'si', true);
  -- Hasta 5 intentos por si el codigo aleatorio choca (practicamente imposible).
  FOR i IN 1..5 LOOP
    BEGIN
      UPDATE public.programas_lealtad SET codigo_alta = public._codigo_alta_lealtad()
      WHERE tenant_id = p_tenant_id
      RETURNING codigo_alta INTO v_codigo;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_codigo := NULL;
    END;
  END LOOP;
  PERFORM set_config('symvora.regenerar_codigo_alta', '', true);

  IF v_codigo IS NULL THEN
    RAISE EXCEPTION 'Configura primero el programa de lealtad';
  END IF;
  RETURN v_codigo;
END; $$;
REVOKE ALL ON FUNCTION public.regenerar_codigo_alta_lealtad(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerar_codigo_alta_lealtad(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Lo que ve la pagina del cartel (anon)
-- ---------------------------------------------------------------------------
-- NULL si el codigo no existe, el programa esta pausado o sin registro con QR,
-- o el negocio esta en solo lectura (el alta fallaria igual).
CREATE OR REPLACE FUNCTION public.programa_alta_publica(p_codigo_alta text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object('codigo_alta', p.codigo_alta, 'negocio', tn.nombre_comercial, 'logo_url', tn.logo_url,
    'paleta', p.paleta, 'color_acento', COALESCE(p.color_acento, tn.color_primario), 'icono_sello', p.icono_sello,
    'color_fondo', p.color_fondo, 'programa', p.nombre, 'sellos_meta', p.sellos_meta,
    'premio_descripcion', p.premio_descripcion, 'aviso_privacidad_url', p.aviso_privacidad_url)
  FROM public.programas_lealtad p JOIN public.tenants tn ON tn.id = p.tenant_id
  WHERE p.codigo_alta = upper(btrim(p_codigo_alta)) AND p.activo AND p.alta_publica
    AND tn.demo_expira_en IS NULL AND public.acceso_tenant(tn.id) <> 'solo_lectura'; $$;
REVOKE ALL ON FUNCTION public.programa_alta_publica(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.programa_alta_publica(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Tipo de aviso nuevo (solo se agrega el valor)
-- ---------------------------------------------------------------------------
ALTER TABLE public.notificaciones DROP CONSTRAINT IF EXISTS notificaciones_tipo_check;
ALTER TABLE public.notificaciones ADD CONSTRAINT notificaciones_tipo_check CHECK (tipo IN (
  'stock_bajo', 'stock_agotado', 'caja_cerrada', 'producto',
  'compra', 'orden_compra', 'ajuste', 'traspaso',
  'lote_por_caducar', 'lote_caducado', 'lote', 'insumo_faltante',
  'lealtad_alta'
));

-- ---------------------------------------------------------------------------
-- 5. El alta (solo service_role)
-- ---------------------------------------------------------------------------
-- Devuelve {estado: 'creada', codigo} o {estado: 'ya_registrado'}; lo demas
-- (codigo invalido, tope, negocio sin acceso) es una excepcion con mensaje para
-- el cliente final.
CREATE OR REPLACE FUNCTION public.alta_publica_lealtad(p_codigo_alta text, p_nombre text, p_telefono text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_tope_diario CONSTANT integer := 100;
  v_programa public.programas_lealtad%ROWTYPE;
  v_nombre text := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_telefono text := btrim(coalesce(p_telefono, ''));
  v_digitos text := right(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), 10);
  v_inicio_dia timestamptz := date_trunc('day', now() AT TIME ZONE 'America/Mexico_City') AT TIME ZONE 'America/Mexico_City';
  v_altas_hoy integer;
  v_cliente_id uuid;
  v_tarjeta_id uuid;
  v_codigo text;
  v_existente public.notificaciones%ROWTYPE;
  v_cantidad integer;
BEGIN
  IF length(v_nombre) NOT BETWEEN 2 AND 60 OR v_nombre ~* '(https?:|www\.|[<>/@])' THEN
    RAISE EXCEPTION 'Escribe tu nombre (de 2 a 60 letras)';
  END IF;
  IF v_telefono !~ '^\+[0-9]{8,15}$' OR length(v_digitos) < 10 THEN
    RAISE EXCEPTION 'Revisa tu numero de celular';
  END IF;

  -- Bloqueado: dos altas al mismo tiempo no se saltan el tope ni el duplicado.
  SELECT * INTO v_programa FROM public.programas_lealtad
  WHERE codigo_alta = upper(btrim(coalesce(p_codigo_alta, ''))) FOR UPDATE;
  IF v_programa.id IS NULL OR NOT v_programa.activo OR NOT v_programa.alta_publica THEN
    RAISE EXCEPTION 'Este registro no esta disponible';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = v_programa.tenant_id AND t.demo_expira_en IS NOT NULL)
     OR coalesce(public.acceso_tenant(v_programa.tenant_id), 'solo_lectura') = 'solo_lectura' THEN
    RAISE EXCEPTION 'El registro no esta disponible por ahora';
  END IF;

  SELECT count(*) INTO v_altas_hoy FROM public.tarjetas_lealtad
  WHERE tenant_id = v_programa.tenant_id AND origen = 'qr' AND creado_en >= v_inicio_dia;
  IF v_altas_hoy >= c_tope_diario THEN
    RAISE EXCEPTION 'Hoy ya no se pueden registrar mas tarjetas aqui. Pidela en caja';
  END IF;

  -- Mismo celular (ultimos 10 digitos) en este negocio: ni tarjeta nueva ni la suya.
  IF EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.tenant_id = v_programa.tenant_id
      AND right(regexp_replace(coalesce(c.telefono, ''), '\D', '', 'g'), 10) = v_digitos
  ) THEN
    RETURN jsonb_build_object('estado', 'ya_registrado');
  END IF;

  INSERT INTO public.clientes (tenant_id, nombre, telefono)
  VALUES (v_programa.tenant_id, v_nombre, v_telefono)
  RETURNING id INTO v_cliente_id;

  FOR i IN 1..5 LOOP
    EXIT WHEN v_tarjeta_id IS NOT NULL;
    BEGIN
      INSERT INTO public.tarjetas_lealtad (tenant_id, programa_id, cliente_id, codigo, origen, acepto_aviso_en)
      VALUES (v_programa.tenant_id, v_programa.id, v_cliente_id, public._codigo_tarjeta_lealtad(), 'qr', now())
      RETURNING id, codigo INTO v_tarjeta_id, v_codigo;
    EXCEPTION WHEN unique_violation THEN
      v_tarjeta_id := NULL;
    END;
  END LOOP;
  IF v_tarjeta_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo generar la tarjeta, intenta de nuevo';
  END IF;

  -- Aviso al equipo, agrupado por dia. Un aviso nunca tumba el alta (regla 108).
  BEGIN
    IF public._notif_tenant_activo(v_programa.tenant_id) THEN
      SELECT * INTO v_existente FROM public.notificaciones n
      WHERE n.tenant_id = v_programa.tenant_id AND n.tipo = 'lealtad_alta' AND n.creado_en >= v_inicio_dia
      ORDER BY n.creado_en DESC LIMIT 1 FOR UPDATE;
      IF FOUND THEN
        v_cantidad := coalesce((v_existente.datos->>'cantidad')::integer, 1) + 1;
        UPDATE public.notificaciones
        SET titulo = format('%s clientes se unieron con el QR hoy', v_cantidad),
            mensaje = format('El más reciente: %s', split_part(v_nombre, ' ', 1)),
            entidad_id = v_tarjeta_id,
            datos = v_existente.datos || jsonb_build_object('cantidad', v_cantidad),
            creado_en = now()
        WHERE id = v_existente.id;
      ELSE
        INSERT INTO public.notificaciones (tenant_id, tipo, titulo, mensaje, enlace, permiso, entidad_id, datos)
        VALUES (v_programa.tenant_id, 'lealtad_alta',
          format('%s se unió a tu programa de lealtad', split_part(v_nombre, ' ', 1)),
          'Con el QR de tu mostrador', '/customers?tab=lealtad', 'sales.create', v_tarjeta_id,
          jsonb_build_object('cantidad', 1));
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'alta_publica_lealtad: aviso no creado: %', SQLERRM;
  END;

  RETURN jsonb_build_object('estado', 'creada', 'codigo', v_codigo);
END; $$;
REVOKE ALL ON FUNCTION public.alta_publica_lealtad(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alta_publica_lealtad(text, text, text) TO service_role;
