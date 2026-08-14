# Aislamiento del modo demo

> **Estado actual:** demo y producción comparten el mismo proyecto de Supabase, pero el usuario demo solo tiene membership en un tenant dedicado (`abarrotes-don-pedro`). Las integraciones externas (pagos, facturación CFDI, invitaciones) están bloqueadas desde el backend para que el demo no toque sistemas reales ni datos de clientes.

## 1. Principio general

El usuario demo (`demo@symvora.com`) es tratado por la app como un `ORG_ADMIN` del tenant demo. Esto le permite hacer todo el flujo operativo (POS, productos, clientes, ventas, caja, reportes) sobre datos sintéticos. **No puede** disparar acciones con efectos externos ni afectar a otros tenants.

El aislamiento se sostiene sobre **tres capas**:

| Capa | Mecanismo | Cubre |
| --- | --- | --- |
| **RLS** | `tenant_memberships` solo contiene al usuario demo en el tenant demo. Las policies filtran por `tenant_id IN (user_tenant_ids())`. | Visibilidad y mutación entre tenants distintos. |
| **Aplicación** | `assertNotDemo()` (migración 022 + `src/lib/supabase/demo-guard.ts`) bloquea endpoints sensibles con `403 + code: DEMO_MODE_RESTRICTED`. | Acciones que tocan integraciones externas o que mutan estado que no debería tocarse en demo. |
| **DB (función)** | `reset_demo_tenant()` está `REVOKE`d de `anon`/`authenticated`. Solo `service_role` puede invocarla. | Auto-protección contra resets no autorizados. |

## 2. Endpoints con guard

Todos estos endpoints devuelven `403 { code: "DEMO_MODE_RESTRICTED" }` cuando el usuario autenticado es `demo@symvora.com`:

| Endpoint | Razón |
| --- | --- |
| `POST /api/conekta/create-checkout` | Crearía un customer + orden real en Conekta. |
| `POST /api/conekta/cancel-subscription` | Cancelaría la suscripción real. |
| `POST /api/mercadopago/create-order` | Crearía una orden real en el terminal Point. |
| `POST /api/mercadopago/cancel-order` | Cancelaría una orden real. |
| `POST /api/mercadopago/test-connection` | Cambiaría la terminal real a modo PDV. |
| `POST /api/mercadopago/config` | Sobreescribiría `access_token_id` / `webhook_secret_id`. |
| `POST /api/facturas/stamp` | Timbraría un CFDI real vía PAC. |
| `POST /api/facturas/cancel` | Cancelaría un CFDI real. |
| `POST /api/facturas/create` | Insertaría BORRADORES basura en el tenant demo (que se resetan cada "Ver demo", pero igual bloqueamos). |
| `POST /api/facturas/config` | Sobreescribiría configuración fiscal del tenant demo. |
| `POST /api/users/invite` | Enviaría un email real de invitación. |
| `POST /api/trial-codes/redeem` | Canjearía un trial code real contra el tenant demo. |

Las acciones permitidas para el usuario demo (sin guard) son todas las que afectan **únicamente** al snapshot del tenant demo y que no tienen efectos externos:

- Ventas (POS) y devoluciones (vía `complete_sale`).
- Ajustes de inventario.
- CRUD de productos, clientes, proveedores, variantes, lotes.
- Apertura/cierre de caja.
- Generación de reportes.
- Aceptación de términos legales.
- Actividad log (solo escribe filas en `activity_logs` del propio tenant demo).

## 3. Helpers de detección

### `src/lib/supabase/demo-guard.ts`

```ts
import { assertNotDemo, isDemoUser, isDemoUserSync, DEMO_USER_EMAIL } from "@/lib/supabase/demo-guard";
```

- **`DEMO_USER_EMAIL`**: constante `"demo@symvora.com"`.
- **`isDemoUser()`**: lee el usuario actual vía `supabase.auth.getUser()` y devuelve `true` si su email coincide con `DEMO_USER_EMAIL` **o** si `app_metadata.is_demo === true` (seteado por la migración 022).
- **`isDemoUserSync(email)`**: variante sin I/O para casos donde ya tienes el email.
- **`assertNotDemo()`**: helper "todo en uno" para usar en endpoints:

  ```ts
  const auth = await requireTenantAccess(request, { tenantId });
  if (!auth.ok) return auth.response;

  const demo = await assertNotDemo();
  if (!demo.ok) return demo.response;
  ```

### Migración 022

```sql
public.is_demo_user()         -- SECURITY DEFINER, solo service_role
public.current_user_is_demo() -- STABLE, ejecutable por authenticated (para policies)
```

`auth.users.raw_app_meta_data.is_demo = true` queda fijado para el usuario demo (Supabase sincroniza `raw_app_meta_data` ↔ `app_metadata` automáticamente).

## 4. `requireTenantAccess`

Desde la migración 022, el resultado de `requireTenantAccess()` incluye `isDemo: boolean`. Esto permite usar el flag sin una segunda llamada al servidor de Supabase:

```ts
const auth = await requireTenantAccess(request, { tenantId });
if (!auth.ok) return auth.response;
if (auth.isDemo) {
  // logica especifica para demo
}
```

Esto es **opcional** y complementa `assertNotDemo()`. Está pensado para casos donde quieras matizar la respuesta (p. ej. devolver un mensaje distinto, o redirigir a una página alternativa).

## 5. UI

### Hook cliente

```ts
import { useIsDemo } from "@/hooks/use-is-demo";

const isDemo = useIsDemo();
```

Combina tres fuentes: `sessionStorage["demo_active"]`, `?demo=1` en la URL, y `user.email` / `app_metadata.is_demo`. La tercera fuente es la definitiva.

### Componente `<DemoRestrictedNotice />`

```tsx
import { DemoRestrictedNotice } from "@/components/demo/demo-restricted-notice";

if (isDemo) return <DemoRestrictedNotice />;
// o en modo inline dentro de un card:
<DemoRestrictedNotice variant="inline" />
```

Páginas que actualmente lo muestran en sesión demo:

- `/[locale]/billing` — banner a página completa.
- `/[locale]/settings/payments` — banner a página completa.
- `/[locale]/users` — banner arriba + botón "Agregar usuario" deshabilitado.
- `/[locale]/facturas` — banner arriba + botones "Timbrar" / "Cancelar" deshabilitados (chequeo extra en los handlers).
- `/[locale]/facturas/[id]` — chequeo extra en `handleStamp`.
- `/[locale]/facturas/config` — banner a página completa + chequeo extra en `handleSave`.

## 6. Reseeding del tenant demo

Cada vez que un visitante hace clic en **"Ver demo"** desde el landing:

1. `POST /api/demo/start` (rate-limited 5/min/IP) llama a `reset_demo_tenant()`.
2. La función borra **solo** las filas del tenant demo (DELETE con `WHERE tenant_id = v_demo_tenant_id`, nunca `TRUNCATE`). Fix aplicado en migración 018.
3. Se re-siembran 20 productos, 10 clientes, 30 ventas históricas y la configuración de caja.
4. Se genera un magic link con `supabase.auth.admin.generateLink({ type: "magiclink" })`.
5. El navegador verifica el OTP y aterriza en `/[locale]/dashboard?demo=1`.

El advisory lock `pg_advisory_xact_lock(hashtext('reset_demo_tenant'))` evita resets concurrentes.

## 7. Tests

### Unitarios (`npm run test`)

- `src/__tests__/demo-guard.test.ts`: cubre `isDemoUser`, `isDemoUserSync`, `assertNotDemo`.

### E2E (`npm run test:e2e`)

- `e2e/demo-isolation.spec.ts`: verifica que el flujo demo (login + magic link + dashboard) produce `403 + code: DEMO_MODE_RESTRICTED` en todos los endpoints listados arriba, y que las páginas restringidas muestran el banner.

## 8. Riesgos que **no** se cubren

| Riesgo | Por qué |
| --- | --- |
| **Métricas globales de actividad se contaminan** | El demo escribe en `activity_logs` de su propio tenant. Si tienes dashboards cross-tenant, excluye el tenant demo (subdominio `abarrotes-don-pedro`). |
| **Contadores de secuencias consumen IDs** | Cada venta demo consume IDs reales de `ventas`, `detalle_ventas`, etc. El reset los libera, pero entre resets hay churn. |
| **RLS podría revertirse en una migración futura** | Las policies viven en `002_rls_rbac.sql` y siguientes. Un DROP POLICY accidental las eliminaría. La migración 022 no incluye un test automatizado de RLS — considerar añadirlo si la base de policies crece. |
| **Rotación de `CONEKTA_PRIVATE_KEY` o PAC keys** | Si en producción se rotan estas claves, el demo (que no las usa) no se ve afectado. Pero si una migración futura mueve la lógica del demo a apuntar a las claves reales, el guard de aplicación + DB es la última defensa. |

## 9. Checklist para añadir nuevos endpoints sensibles

Si añades un endpoint nuevo que toca integraciones externas (Stripe, nuevos PACs, email transaccional, webhooks salientes, etc.):

1. Importa `assertNotDemo` desde `@/lib/supabase/demo-guard`.
2. Justo después de `requireTenantAccess`, llama `const demo = await assertNotDemo(); if (!demo.ok) return demo.response;`.
3. Si tiene UI, muestra `<DemoRestrictedNotice />` cuando `useIsDemo()` sea `true`.
4. Añade el endpoint a la lista de este documento.
5. Añade un caso al test E2E `e2e/demo-isolation.spec.ts`.
