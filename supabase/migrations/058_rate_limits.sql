-- =============================================
-- 058: Rate limit durable (sustituye al Map en memoria)
-- ---------------------------------------------
-- PROBLEMA: `src/app/api/demo/start/route.ts` limitaba a 5 peticiones por
-- minuto por IP con `const rateLimitMap = new Map()` a nivel de modulo. En
-- serverless eso no limita nada:
--   - cada instancia de la funcion tiene su propio Map, asi que N instancias
--     concurrentes permiten N x 5 peticiones;
--   - cada arranque en frio arranca el contador desde cero.
-- Era el unico rate limit del sistema y protegia el endpoint publico de la demo.
--
-- SOLUCION: contador compartido en Postgres, que es el unico estado que todas
-- las instancias ven igual.
--
-- RLS habilitado SIN POLITICAS a proposito: nadie debe leer ni escribir esta
-- tabla por PostgREST. Se toca unicamente con `service_role` (que salta RLS) a
-- traves del RPC de abajo. Es el mismo patron deliberado de
-- `codigos_promocionales`.
-- =============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.rate_limits (
  clave           TEXT PRIMARY KEY,
  ventana_inicio  TIMESTAMPTZ NOT NULL DEFAULT now(),
  contador        INTEGER     NOT NULL DEFAULT 0
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Para la limpieza oportunista del RPC.
CREATE INDEX IF NOT EXISTS idx_rate_limits_ventana
  ON public.rate_limits (ventana_inicio);

-- =============================================
-- RPC atomico
-- ---------------------------------------------
-- Todo ocurre en UN SOLO enunciado (INSERT ... ON CONFLICT DO UPDATE). Leer el
-- contador y despues escribirlo en dos pasos tendria una carrera justo en el
-- caso que importa: muchas peticiones simultaneas, que es cuando el limite debe
-- funcionar.
-- =============================================

CREATE OR REPLACE FUNCTION public.consumir_rate_limit(
  p_clave            TEXT,
  p_limite           INTEGER,
  p_ventana_segundos INTEGER
)
RETURNS TABLE (permitido BOOLEAN, contador_actual INTEGER, reinicia_en TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ventana INTERVAL := make_interval(secs => p_ventana_segundos);
  v_inicio  TIMESTAMPTZ;
  v_cont    INTEGER;
BEGIN
  -- Limpieza oportunista: sin cron en el sistema, esta tabla crecería sin
  -- limite acumulando claves de IPs de un solo uso. Se hace en ~1 de cada 100
  -- llamadas para no pagar el coste en cada peticion.
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits
     WHERE ventana_inicio < now() - INTERVAL '1 day';
  END IF;

  INSERT INTO public.rate_limits AS rl (clave, ventana_inicio, contador)
  VALUES (p_clave, now(), 1)
  ON CONFLICT (clave) DO UPDATE
    SET ventana_inicio = CASE
          WHEN rl.ventana_inicio < now() - v_ventana THEN now()
          ELSE rl.ventana_inicio
        END,
        contador = CASE
          WHEN rl.ventana_inicio < now() - v_ventana THEN 1
          ELSE rl.contador + 1
        END
  RETURNING rl.ventana_inicio, rl.contador INTO v_inicio, v_cont;

  RETURN QUERY SELECT (v_cont <= p_limite), v_cont, (v_inicio + v_ventana);
END;
$$;

-- Solo service_role. Si `authenticated` pudiera ejecutarlo, cualquiera podria
-- inflar el contador de otra clave y dejar fuera a terceros. Este REVOKE es
-- obligatorio en toda funcion SECURITY DEFINER nueva: Postgres concede EXECUTE
-- a PUBLIC por defecto (ver bug #23).
REVOKE ALL ON FUNCTION public.consumir_rate_limit(TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_rate_limit(TEXT, INTEGER, INTEGER)
  TO service_role;

COMMIT;

-- =============================================
-- VERIFICACION
--
--   -- 5 permitidas, la 6a no:
--   SELECT i, * FROM generate_series(1,6) i,
--     LATERAL public.consumir_rate_limit('prueba:1.2.3.4', 5, 60);
--
--   -- anon/authenticated no pueden ejecutarlo:
--   SELECT has_function_privilege('anon',
--     'public.consumir_rate_limit(text,integer,integer)', 'EXECUTE');  -- false
--
--   -- la tabla no es alcanzable por PostgREST (RLS sin politicas):
--   SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
--    WHERE c.relname = 'rate_limits';  -- 0
-- =============================================
