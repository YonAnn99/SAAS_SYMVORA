CREATE TABLE public.sugerencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  categoria TEXT NOT NULL CHECK (categoria IN ('general','bug','mejora','feature')),
  prioridad TEXT NOT NULL CHECK (prioridad IN ('baja','media','alta')),
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sugerencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sugerencias_select" ON public.sugerencias
FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "sugerencias_insert" ON public.sugerencias
FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND usuario_id = auth.uid());
