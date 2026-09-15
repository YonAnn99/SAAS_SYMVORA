-- =============================================
-- 063: Reparar los `details` doblemente encodeados de la bitacora
-- ---------------------------------------------
-- SINTOMA: en /activity, la columna DETALLES mostraba
--   0: { 1: " 2: f 3: o 4: n 5: d 6: o 7: _ 8: i ...
-- en las filas de caja, cliente, compra, movimiento_caja, orden_compra y
-- proveedor.
--
-- CAUSA: `src/lib/supabase/activity-logger.ts` mandaba el detalle con
-- `JSON.stringify(details)` a `log_activity(p_details jsonb)`. Como supabase-js
-- YA serializa el cuerpo del RPC, Postgres recibia una cadena ya serializada y
-- la guardaba como un ESCALAR STRING de JSON:
--
--   "{\"fondo_inicial\":300}"      en vez de      {"fondo_inicial": 300}
--
-- La pantalla hacia `Object.entries()` sobre eso y, como en JavaScript
-- `Object.entries("abc")` devuelve [["0","a"],["1","b"],["2","c"]], salia la
-- ristra de indices.
--
-- El origen ya esta corregido (se manda el objeto tal cual) y la pantalla lleva
-- una guarda para no volver a descomponer una cadena. Falta reparar lo ya
-- guardado: 40 filas de 205.
-- =============================================

BEGIN;

-- `#>> '{}'` saca el texto del escalar y el cast lo vuelve a parsear.
--
-- ⚠️ EL `WHERE` NO ES COSMETICO. Sin el, la conversion se aplicaria tambien a
-- las 165 filas correctas (las del trigger `log_table_changes`, que siempre
-- guardo jsonb de verdad) y las romperia: `#>> '{}'` sobre un objeto devuelve
-- NULL y se perderia el detalle.
UPDATE public.activity_logs
   SET details = (details #>> '{}')::jsonb
 WHERE jsonb_typeof(details) = 'string';

COMMIT;

-- =============================================
-- VERIFICACION
--
--   -- No debe quedar ningun `string`; solo `object`:
--   SELECT jsonb_typeof(details) AS tipo, count(*)
--     FROM public.activity_logs
--    WHERE details IS NOT NULL
--    GROUP BY 1;
--
--   -- Y el contenido debe ser legible:
--   SELECT entity, details
--     FROM public.activity_logs
--    WHERE entity IN ('caja', 'orden_compra')
--    ORDER BY created_at DESC LIMIT 5;
--
-- Antes de aplicar se comprobo que las 40 filas afectadas contenian JSON de
-- objeto valido, asi que el cast no puede fallar:
--   SELECT count(*) FILTER (WHERE (details #>> '{}') ~ '^\s*\{')
--     FROM public.activity_logs WHERE jsonb_typeof(details) = 'string';  -- 40
-- =============================================
