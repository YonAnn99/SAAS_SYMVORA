-- ============================================================================
-- 120 · Tarjetas de lealtad: icono del sello y color de fondo
-- ============================================================================
-- Personalizacion de la tarjeta (2026-10-16). Hasta la 115 solo se elegia la
-- paleta (clara/oscura) y el color de acento; el sello era siempre una
-- palomita. Ahora:
--   - icono_sello: el dibujo del sello lleno (cafe, estrella, huella...). La
--     lista vive tambien en `ICONOS_SELLO` (features/lealtad/lealtad.ts); si
--     cambia una, cambia la otra.
--   - color_fondo: fondo libre de la tarjeta. NULL = el de la paleta, como
--     hasta hoy. El texto se ajusta al fondo en el cliente (paletaDeTarjeta).
--
-- Aditiva: columnas con default/NULL. Un cliente viejo que no las manda deja
-- los programas como estaban. `tarjeta_publica` solo agrega dos claves; mismos
-- permisos (anon y authenticated).
-- ============================================================================

ALTER TABLE public.programas_lealtad
  ADD COLUMN IF NOT EXISTS icono_sello text NOT NULL DEFAULT 'check',
  ADD COLUMN IF NOT EXISTS color_fondo text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'programas_lealtad_icono_check') THEN
    ALTER TABLE public.programas_lealtad
      ADD CONSTRAINT programas_lealtad_icono_check CHECK (icono_sello IN (
        'check', 'cafe', 'estrella', 'corazon', 'huella', 'hueso', 'pizza',
        'tijeras', 'flor', 'pan', 'helado', 'bolsa', 'pesa', 'cerveza'
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'programas_lealtad_fondo_check') THEN
    ALTER TABLE public.programas_lealtad
      ADD CONSTRAINT programas_lealtad_fondo_check CHECK (color_fondo IS NULL OR color_fondo ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.tarjeta_publica(p_codigo text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object('codigo', t.codigo, 'negocio', tn.nombre_comercial, 'logo_url', tn.logo_url, 'paleta', p.paleta,
    'color_acento', COALESCE(p.color_acento, tn.color_primario), 'programa', p.nombre, 'sellos_meta', p.sellos_meta,
    'premio_descripcion', p.premio_descripcion, 'sellos', t.sellos, 'premios_canjeados', t.premios_canjeados,
    'cliente', split_part(btrim(c.nombre), ' ', 1), 'activa', p.activo AND t.activa,
    'icono_sello', p.icono_sello, 'color_fondo', p.color_fondo)
  FROM public.tarjetas_lealtad t JOIN public.programas_lealtad p ON p.id = t.programa_id JOIN public.tenants tn ON tn.id = t.tenant_id
  JOIN public.clientes c ON c.id = t.cliente_id WHERE t.codigo = upper(btrim(p_codigo)); $$;

REVOKE ALL ON FUNCTION public.tarjeta_publica(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tarjeta_publica(text) TO anon, authenticated;
