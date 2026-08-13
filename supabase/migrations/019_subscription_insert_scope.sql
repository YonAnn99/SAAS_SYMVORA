-- =============================================
-- 019: Subscription INSERT restringido a tenants del usuario
-- ---------------------------------------------
-- El onboarding (auth-forms.tsx) inserta la suscripcion trial via
-- browser client, por eso existe una policy INSERT para authenticated
-- que NO vive en el historial de migraciones (agregada directamente en
-- remote). Esa policy permitia a CUALQUIER usuario autenticado insertar
-- una suscripcion para CUALQUIER tenant. Se reemplaza por una scoped:
-- solo puede crear suscripcion para un tenant del que sea miembro.
-- =============================================

BEGIN;

DROP POLICY IF EXISTS "Authenticated users can insert subscription" ON public.subscriptions;

CREATE POLICY "Users can create subscription for own tenant" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
    )
  );

COMMIT;
