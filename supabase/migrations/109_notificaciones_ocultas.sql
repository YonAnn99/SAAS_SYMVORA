-- =============================================================================
-- 109 · Descartar notificaciones (X en escritorio, deslizar en celular)
--
-- Una notificacion es UNA fila compartida por el equipo (migracion 108):
-- "eliminarla" no puede borrarla para los demas. Se OCULTA solo para quien la
-- descarta, guardado en la base para que tambien desaparezca en sus otros
-- dispositivos.
--
-- La condicion `oculta_en >= creado_en` no es decorativa: una notificacion
-- agrupada ("Ana creo 12 productos") sube su `creado_en` cada vez que se le
-- suma una accion. Si el usuario la descarto y despues llegan mas acciones,
-- REAPARECE con el conteo nuevo en vez de quedarse escondida para siempre.
-- Realtime aplica la misma politica, asi que lo descartado no vuelve a llegar.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.notificaciones_ocultas (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notificacion_id UUID NOT NULL REFERENCES public.notificaciones(id) ON DELETE CASCADE,
  oculta_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, notificacion_id)
);
CREATE INDEX IF NOT EXISTS idx_notificaciones_ocultas_notificacion
  ON public.notificaciones_ocultas (notificacion_id);

-- Solo lectura de las propias; se escribe con `ocultar_notificacion`.
ALTER TABLE public.notificaciones_ocultas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notificaciones_ocultas_select ON public.notificaciones_ocultas;
CREATE POLICY notificaciones_ocultas_select ON public.notificaciones_ocultas
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.notificaciones_ocultas FROM anon, authenticated;
GRANT SELECT ON public.notificaciones_ocultas TO authenticated;
GRANT ALL ON public.notificaciones_ocultas TO service_role;

-- La de la 108, mas: no se ve lo que este usuario descarto (salvo que se haya
-- actualizado despues; ver arriba).
DROP POLICY IF EXISTS notificaciones_select ON public.notificaciones;
CREATE POLICY notificaciones_select ON public.notificaciones
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT public.user_tenant_ids())
    AND actor_id IS DISTINCT FROM (SELECT auth.uid())
    AND (permiso IS NULL OR public.authorize(permiso))
    AND (actor_id IS NULL OR public.authorize('activity.view'))
    AND NOT EXISTS (
      SELECT 1 FROM public.notificaciones_ocultas o
      WHERE o.notificacion_id = notificaciones.id
        AND o.user_id = (SELECT auth.uid())
        AND o.oculta_en >= notificaciones.creado_en
    )
  );

CREATE OR REPLACE FUNCTION public.ocultar_notificacion(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.notificaciones n
    JOIN public.tenant_memberships tm ON tm.tenant_id = n.tenant_id
    WHERE n.id = p_id AND tm.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  INSERT INTO public.notificaciones_ocultas (user_id, notificacion_id, oculta_en)
  VALUES (v_uid, p_id, NOW())
  ON CONFLICT (user_id, notificacion_id) DO UPDATE SET oculta_en = EXCLUDED.oculta_en;
END;
$fn$;

REVOKE ALL ON FUNCTION public.ocultar_notificacion(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocultar_notificacion(UUID) TO authenticated, service_role;

COMMIT;
