-- =============================================
-- 064: Productos favoritos, por usuario
-- ---------------------------------------------
-- QUE HABILITA: un corazon en la columna ACCIONES de /products y un chip de
-- acceso rapido "Favoritos" junto a Filtros/CSV/PDF.
--
-- POR QUE UNA TABLA Y NO UNA COLUMNA EN `productos`: los favoritos son DE CADA
-- USUARIO, no del negocio. Con una columna booleana en `productos`, el cajero
-- que quita un favorito se lo quita a todos, y el listado seria uno solo para
-- toda la tienda. Con esta tabla cada quien tiene el suyo y nadie ve el ajeno.
--
-- PRIVACIDAD REAL, NO SOLO DE INTERFAZ: las cuatro politicas exigen
-- `user_id = auth.uid()`. No basta con que la pantalla no lo enseñe — sin esa
-- condicion, cualquier miembro del negocio podria leer por PostgREST los
-- favoritos de sus compañeros.
--
-- SIN `authorize()`, A DIFERENCIA DEL RESTO DE TABLAS: marcar un favorito no
-- es una accion privilegiada. El catalogo esta abierto a todo miembro (ver
-- `productos_select` en la migracion 002 y el comentario de `src/lib/modules.ts`
-- sobre por que /products no exige `inventory.manage`), asi que exigir un
-- permiso aqui dejaria al cajero sin poder marcar los suyos.
-- =============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.productos_favoritos (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- DEFAULT auth.uid(): el cliente NO manda el id de usuario. Asi no puede
  -- escribir en los favoritos de otro ni por error ni a proposito, y se sigue
  -- la casa (`use-permissions.ts` tampoco pasea el id por el cliente: deja que
  -- la base lo resuelva).
  user_id UUID NOT NULL DEFAULT auth.uid()
    REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ON DELETE CASCADE: al borrar un producto desaparece de los favoritos de
  -- todos. Sin esto el filtro apuntaria a productos que ya no existen.
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,

  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- La clave primaria es la pareja, no un UUID suelto:
  --   1. Hace el marcado IDEMPOTENTE: pulsar dos veces el corazon no duplica.
  --   2. Regala el indice de la unica consulta que se hace ("los favoritos de
  --      este usuario"), que en un UUID suelto habria que crear aparte.
  PRIMARY KEY (user_id, producto_id)
);

ALTER TABLE public.productos_favoritos ENABLE ROW LEVEL SECURITY;

-- DOS BARRERAS, no una: el usuario Y el negocio. La de tenant es redundante
-- mientras `user_id = auth.uid()` se cumpla, pero este proyecto ya ha visto
-- caer la barrera unica cuatro veces (bugs #1, #27, #33, #34) y el coste de la
-- segunda es un indice que ya existe.
CREATE POLICY "productos_favoritos_select" ON public.productos_favoritos
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) AND tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "productos_favoritos_insert" ON public.productos_favoritos
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()) AND tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "productos_favoritos_delete" ON public.productos_favoritos
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()) AND tenant_id IN (SELECT public.user_tenant_ids()));

-- NO hay politica de UPDATE, y es deliberado: un favorito existe o no existe.
-- No hay ningun campo que editar, asi que abrir UPDATE solo daria superficie
-- para mover una fila a otro producto o a otro tenant.

COMMIT;

-- =============================================
-- VERIFICACION
--
--   -- Las tres politicas, ninguna de UPDATE:
--   SELECT policyname, cmd FROM pg_policies
--    WHERE tablename = 'productos_favoritos' ORDER BY cmd;
--
--   -- El DEFAULT esta puesto (si falta, el INSERT del cliente fallara por
--   -- user_id nulo, no por RLS, y el mensaje despistaria):
--   SELECT column_name, column_default, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'productos_favoritos';
--
--   -- Idempotencia: el segundo INSERT debe chocar con la clave primaria.
-- =============================================
