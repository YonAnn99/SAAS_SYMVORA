-- ============================================================================
-- 143 — Los 4 negocios que ya pagan quedan en el nivel Pro
-- ============================================================================
-- Decisión del dueño (2026-11-24): quien ya pagaba antes de los niveles queda en Pro. NO se toca su cobro
-- en Conekta ni su precio (siguen en su plan actual); solo cambia el nivel en la base, que hasta hoy era
-- NULL («heredado», todo permitido y sin tope). Pro incluye 3 sucursales, lealtad, catálogo y pedidos.
--
-- Lista EXPLÍCITA (nunca por filtro): los negocios activos con un pago completado, sin demos. «Abarrotes
-- Don Pedro» (el demo compartido viejo, sin pagos reales) y quien sigue en la prueba de 14 días NO entran:
-- siguen heredados y eligen nivel al contratar.
--   Clínica Médica del Centro (anual), Clarabella Store, Refaccionaria Fridisa, INNOVA-C (mensuales).
-- Todos tienen ≤ 2 sucursales activas, así que caben en el tope de 3. `asignar_nivel` rechaza (y revierte
-- todo) si alguno rebasara el tope, y deja intactos sus datos: bajar de nivel nunca borra nada.
-- ============================================================================

DO $$
DECLARE
  v_tenant uuid;
  v_n integer := 0;
BEGIN
  FOREACH v_tenant IN ARRAY ARRAY[
    '1dc5e9e2-c45e-4a1b-915b-8339ccdc7563'::uuid, -- Clínica Médica del Centro
    '317c42bd-e765-4682-a931-58953f7de726'::uuid, -- Clarabella Store
    '8a8daf5c-c909-4894-bfb1-7e5bcda53299'::uuid, -- Refaccionaria Fridisa
    'fd018950-d948-47bd-99fb-a27b1a9b8a66'::uuid  -- INNOVA-C
  ] LOOP
    -- Solo si sigue siendo un negocio real, activo y todavía heredado: si cambió algo, no se toca.
    IF EXISTS (
      SELECT 1
      FROM public.subscriptions s
      JOIN public.tenants t ON t.id = s.tenant_id
      WHERE s.tenant_id = v_tenant
        AND s.status = 'active'
        AND s.nivel IS NULL
        AND t.demo_expira_en IS NULL
    ) THEN
      PERFORM public.asignar_nivel(v_tenant, 'pro');
      v_n := v_n + 1;
    END IF;
  END LOOP;
  RAISE NOTICE '143: % negocios pasaron al nivel Pro', v_n;
END;
$$;
