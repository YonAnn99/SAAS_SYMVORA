-- 091: encender el modulo en los negocios que ya usan esa funcion.
--
-- Hasta el 2026-09-24 los interruptores de Configuracion -> Modulos solo se
-- guardaban: no hacian nada. Desde esa fecha, apagar uno OCULTA sus opciones
-- (ver `src/lib/modulos.ts`). Muchas cuentas nacieron con variantes, granel o
-- servicios en `false` por defecto aunque despues los usaran; sin esta
-- migracion, al publicar el cambio verian desaparecer la pestaña Variantes o
-- las unidades por kilo que ya usan.
--
-- Solo ENCIENDE (nunca apaga) y solo donde hay uso real:
--   granel     -> productos en kg, g, l, ml o m
--   variantes  -> variantes creadas o productos con "maneja variantes"
--   lotes      -> lotes creados o productos con "maneja lotes"
--   mermas     -> ajustes con motivo MERMA
--   servicios  -> productos de servicio
--   credito    -> ventas a credito
-- Donde `modulos_activos` no existe no se toca: la app lo trata como todo
-- encendido (`normalizarModulos`).

WITH uso AS (
  SELECT
    ts.tenant_id,
    EXISTS (SELECT 1 FROM public.productos p WHERE p.tenant_id = ts.tenant_id
            AND p.unidad_medida::text IN ('KG','GRAMO','LITRO','MILILITRO','METRO')) AS granel,
    EXISTS (SELECT 1 FROM public.variantes_producto v WHERE v.tenant_id = ts.tenant_id)
      OR EXISTS (SELECT 1 FROM public.productos p WHERE p.tenant_id = ts.tenant_id AND p.permite_variantes) AS variantes,
    EXISTS (SELECT 1 FROM public.lotes l WHERE l.tenant_id = ts.tenant_id)
      OR EXISTS (SELECT 1 FROM public.productos p WHERE p.tenant_id = ts.tenant_id AND p.permite_lotes) AS lotes,
    EXISTS (SELECT 1 FROM public.ajustes_inventario a WHERE a.tenant_id = ts.tenant_id AND a.motivo = 'MERMA') AS mermas,
    EXISTS (SELECT 1 FROM public.productos p WHERE p.tenant_id = ts.tenant_id AND p.es_servicio) AS servicios,
    EXISTS (SELECT 1 FROM public.ventas v WHERE v.tenant_id = ts.tenant_id AND v.metodo_pago = 'CREDITO') AS credito
  FROM public.tenant_settings ts
  WHERE ts.configuracion_json ? 'modulos_activos'
)
UPDATE public.tenant_settings ts
SET configuracion_json = jsonb_set(
  ts.configuracion_json,
  '{modulos_activos}',
  (ts.configuracion_json->'modulos_activos')
    || CASE WHEN u.granel    THEN '{"permite_granel": true}'::jsonb          ELSE '{}'::jsonb END
    || CASE WHEN u.variantes THEN '{"permite_variantes": true}'::jsonb       ELSE '{}'::jsonb END
    || CASE WHEN u.lotes     THEN '{"permite_lotes_caducidad": true}'::jsonb ELSE '{}'::jsonb END
    || CASE WHEN u.mermas    THEN '{"permite_mermas": true}'::jsonb          ELSE '{}'::jsonb END
    || CASE WHEN u.servicios THEN '{"permite_servicios": true}'::jsonb       ELSE '{}'::jsonb END
    || CASE WHEN u.credito   THEN '{"permite_credito_fiado": true}'::jsonb   ELSE '{}'::jsonb END
)
FROM uso u
WHERE u.tenant_id = ts.tenant_id
  AND (u.granel OR u.variantes OR u.lotes OR u.mermas OR u.servicios OR u.credito);
