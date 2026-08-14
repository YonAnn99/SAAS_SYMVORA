# SYMVORA SaaS - Contexto del Proyecto

## Visión General

SaaS multi-tenant ERP/POS para negocios en México (punto de venta, inventario, finanzas, compras). Diseñado para abarrotes, verdulerías, mascotas, ropa, ferreterías y farmacias. Stack: **Next.js 16.3 + Supabase + Tailwind v4 + TypeScript**. Pagos con **Conekta** (hosted checkout) y **MercadoPago** (terminal Point en POS). Facturación **CFDI 4.0** (PAC Finkok/SWSapien).

---

## Estructura del Proyecto

```
├── src/
│   ├── hooks/                  # use-current-tenant, use-is-demo
│   ├── __tests__/              # Tests unitarios Vitest (104)
│   ├── middleware.ts            # i18n + sesión Supabase + subscription access control
│   ├── i18n/                   # routing/request/navigation (es/en, default es)
│   ├── messages/               # es.json + en.json (~260 keys c/u)
│   ├── stores/                 # cart.ts (Zustand, carrito POS)
│   ├── lib/
│   │   ├── supabase/           # client, server (service_role), middleware, auth (requireTenantAccess), demo-guard, activity-logger
│   │   ├── conekta/            # config, plans, customers, subscriptions, orders
│   │   ├── mercadopago/        # cobro por terminal Point
│   │   ├── cfdi/               # catalogs (SAT), pac-client (Finkok/SWSapien), xml-generator
│   │   ├── validations/        # schemas Zod (login, signup, tenant)
│   │   ├── export/             # csv.ts, pdf.ts (jspdf)
│   │   └── types/database.ts   # tipos TS de todas las tablas DB
│   ├── components/
│   │   ├── layout/             # sidebar, header, legal-footer
│   │   ├── auth/               # auth-forms (login/signup con acordeones), gradient-waves (fondo WebGL)
│   │   ├── marketing/          # hero, features, navbar, footer, legal-shell, FAQ, PosMockup
│   │   ├── demo/               # demo-banner, demo-restricted-notice
│   │   ├── compliance/         # cookie-consent, policy-update-banner
│   │   ├── charts/             # Recharts (ventas, top productos, métodos de pago)
│   │   └── ui/                 # shadcn/ui v4 base-nova + accordion, password-input, sonner, etc.
│   └── app/
│       ├── api/                # conekta/*, mercadopago/*, facturas/*, users/invite, trial-codes/*, legal/*, demo/start
│       ├── (auth)/[locale]/    # login, signup
│       └── (dashboard)/[locale]/ # dashboard, billing, products, pos, purchases, finances, users, facturas, reports, settings, activity, lots, variants, inventory-adjustments, purchase-orders
├── supabase/migrations/        # 001-022 (schema, RBAC, onboarding, sales, legal, demo guards)
├── e2e/                        # Playwright (app.spec, demo-isolation.spec)
└── docs/                       # demo-isolation.md, login-background.md
```

---

## Rutas

- **Públicas** (`isPublicRoute`): `/` (landing), `/[locale]/login`, `/[locale]/signup`, `/[locale]/demo`, `aviso-privacidad`, `terminos`, `politica-cookies`, `not-found`, `/billing` (evita redirect loops).
- **Dashboard** (`(dashboard)/[locale]`): requieren sesión + suscripción activa (expirada → `/billing`).
- **APIs**: todas usan `requireTenantAccess()` salvo `conekta/webhook` (firma RSA), `trial-codes/validate` y `demo/start` (rate limit 5 req/min/IP).

---

## Autenticación

1. **Signup** (3 acordeones: Datos personales → Empresa → Seguridad) → `signUp` (email sin confirmación) → upload logo → `complete_onboarding` RPC (crea tenant) → subscription trial → `/api/conekta/create-checkout` → redirect Conekta. Fallback `/es/billing`. Checkbox obligatorio de Términos (se registra en `legal_acceptances`).
2. **Login** → `signInWithPassword` + CAPTCHA Turnstile (gated por `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) + throttle (5 intentos, backoff 30s→15min, countdown en vivo).
3. **Middleware** refresca JWT por request; `custom_access_token_hook` inyecta `user_role` + `tenant_id` en el JWT.
4. **Hardening**: `requireTenantAccess()` autentica por cookie (nunca JWT claims) y valida el permiso contra `role_permissions`.

---

## Multi-Tenancy

- BD compartida + RLS por filas. Cada negocio = fila en `tenants` con `subdominio` único; usuarios → `tenant_memberships`.
- Roles: **SUPER_ADMIN**, **ORG_ADMIN**, **CAJERO**. `authorize(permission)` en todas las políticas de escritura.
- Regla clave: **nunca confiar en `user_metadata` para authz** (es user-editable).

---

## POS

- Búsqueda de productos (nombre/código de barras) + carrito Zustand (subtotal, IVA 16%, descuento, total) + 4 métodos de pago (incluye crédito con selector de cliente).
- Venta vía RPC `complete_sale` (SECURITY DEFINER, transacción única, `SELECT FOR UPDATE`, recalculado precio desde `productos.precio_venta` — no confía en `precioUnitario` del cliente).
- Caja integrada: movimientos automáticos si hay caja abierta; cierre con saldo esperado vs real.

---

## Base de Datos (Supabase)

- **Enums (9)**: app_role, unidad_medida, metodo_pago, estado_venta, estado_compra, estado_caja, tipo_movimiento, subscription_status, billing_period.
- **Tablas (19)**: tenants, tenant_settings, user_roles, tenant_memberships, productos, clientes, proveedores, ventas, detalle_ventas, compras, detalle_compras, cajas, movimientos_caja, activity_logs, subscriptions, payment_history, trial_codes, legal_acceptances, facturas/factura_detalle.
- **Funciones SQL clave**: `user_tenant_ids()`, `authorize()`, `custom_access_token_hook()`, `log_activity()`, `complete_onboarding()` (SECURITY DEFINER, valida `auth.uid()`), `complete_sale()` (SECURITY DEFINER atómico), `reset_demo_tenant()`, `is_demo_user()` / `current_user_is_demo()` (solo service_role).
- **Migraciones**: 001-022. Aplicar en Supabase SQL Editor con "Without RLS".

---

## Librerías Principales

next 16.3, react 19.2, @supabase/ssr 0.12, supabase-js 2.112, next-intl 4.13, zustand 5, zod 4.4, @base-ui/react (shadcn base-nova), tailwind v4, recharts, cmdk, jspdf, conekta 9.0.1, @marsidev/react-turnstile 1.6, ogl (fondo login), sonner.

---

## Decisiones de Arquitectura

1. Route groups `(auth)` / `(dashboard)` para separar layouts sin afectar URLs.
2. Sin Server Actions: todas las mutaciones usan cliente browser de Supabase.
3. Spanish-First (default `es`, moneda MXN).
4. Conekta hosted checkout (no iframe); webhook firmado RSA `DIGEST` (fail-closed, requiere `CONEKTA_WEBHOOK_PUBLIC_KEY`).
5. Signup → Conekta directo (sin onboarding; la página onboarding fue eliminada).
6. CFDI 4.0 con PAC Finkok/SWSapien, sello digital real (`@cfdi/xml` + timbrado SOAP), credenciales cifradas.
7. MercadoPago Point para cobro por terminal en el POS.
8. Demo pública con aislamiento total (`assertNotDemo()` en 12 endpoints → `403 DEMO_MODE_RESTRICTED`).

---

## Estado Actual

### Completado
- **Core**: dashboard (KPIs + 3 gráficas Recharts), productos CRUD, POS, compras/proveedores, caja, users/roles, activity logs, reports, settings, lots/variants/inventory-adjustments/purchase-orders.
- **Billing**: Conekta (checkout, webhook firmado, trial codes, subscriptions, payment_history).
- **Facturación CFDI 4.0**: schema, catálogos SAT, XML, PAC, APIs create/stamp/cancel/list, UI `/facturas`.
- **Landing**: hero con PosMockup, features, FAQ (8 preguntas), CTA anual/mensual, WhatsApp, CompatibilityBar, footer legal.
- **Demo**: self-serve (`/demo` → magic link), banner `?demo=1`, aislamiento total (12 endpoints + UI restringida + 10 tests).
- **Seguridad**: `requireTenantAccess` en todas las APIs, webhook firmado, RBAC granular, RLS total, CAPTCHA Turnstile, headers (CSP, HSTS, nosniff, Referrer-Policy), `complete_sale` atómico con precio desde BD.
- **Legal (LFPDPPP)**: aviso de privacidad integral, términos 17 secciones, política de cookies, `legal_acceptances` (IP+UA+versiones), PolicyUpdateBanner post-login.
- **Calidad**: 104 tests Vitest, Playwright E2E, CI GitHub Actions.

### Pendiente
- Config fiscal de producción (RFC, PAC, certificados) — prerequisito para timbrar.
- Fix `pac-client.ts` `getEndpoint()` (retorna demo URL en producción).
- Locales hardcodeados en redirects (`auth-forms.tsx`, `billing/success`).
- Historial de pagos real en `/billing` + cancelar suscripción vía API Conekta.
- Descarga XML/PDF de facturas + vista de detalle.
- Legal stubs en aviso de privacidad (`[Domicilio del responsable]`, `[privacidad@symvora.com]`).
- Env pendientes: `CONEKTA_WEBHOOK_PUBLIC_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_APP_URL`, `STITCH_API_KEY`.
- `role_permissions` con RLS deshabilitado (decidir si habilitar).

---

## Bugs Críticos Corregidos (no reintroducir)

1. **RBAC no aplicado en RLS** (migración 002): políticas `FOR ALL` sin `authorize()` — CAJERO tenía permisos de escritura de SUPER_ADMIN.
2. **API routes sin autenticación**: usaban `service_role` sin verificar identidad (cualquiera podía crear SUPER_ADMIN). Fix `requireTenantAccess()`.
3. **Webhook Conekta sin firma**: cualquier POST falsificaba `order.paid`. Fix firma RSA `DIGEST`, fail-closed.
4. **`complete_onboarding` sin `auth.uid()` + ON CONFLICT roto** (migración 008): cualquiera podía autoasignarse membresía/tenant.
5. **`complete_sale` confiaba en `precioUnitario` del cliente** (migración 011): sobreventa + precios inventados. Fix RPC atómico, precio desde BD.
6. **Demo user podía tocar integraciones reales** (Conekta, MercadoPago, PAC, invites — 12 endpoints). Fix `assertNotDemo()` + migración 022 + UI restringida.
7. **Onboarding huérfano**: página duplicada de `complete_onboarding` eliminada (invitados van a `/dashboard`).
8. **`.single()` truena con multi-tenancy**: hook `use-current-tenant` con `.limit(1)`.
9. **Billing redirect loop**: `/billing` en `isPublicRoute`.

---

## Skills Instaladas

- **emilkowalski** (9): emil-design-eng, animate, review-animations, improve-animations, find-animation-opportunities, pick-ui-library, prototype, animation-vocabulary, apple-design. Reglas clave: animar solo transform/opacity, duración <300ms, springs para gestures, sin ease-in, sin scale(0).
- **impeccable** (pbakaus): design director, modos Persuade/Operate/Read/Experience, comandos shape/critique/audit/polish/animate/colorize, etc. Setup: `node .agents/skills/impeccable/scripts/context.mjs`.
- **taste-skill** (Leonxlnx, 13): design-taste-frontend (dials VARIANCE/MOTION/DENSITY), high-end-visual-design, minimalist-ui, industrial-brutalist-ui, brandkit, gpt-taste, image-to-code, imagegen-frontend-{web,mobile}, redesign-existing-projects, stitch-design-taste, full-output-enforcement, design-taste-frontend-v1.
- **supabase** (2): supabase, supabase-postgres-best-practices. Puntos clave: RLS en todos los schemas, nunca `user_metadata` para authz, UPDATE requiere SELECT policy, views requieren `security_invoker`, MCP en `opencode.json` (`https://mcp.supabase.com/mcp?project_ref=ffswcgrahxsczvydngrd`, OAuth vía `opencode mcp auth supabase`).

---

## Plan Pendiente: Módulo CFDI 4.0 — Próximos pasos

1. **Config fiscal UI + API** (`facturas/config`): RFC, razón social, régimen, CP, PAC (finkok/swsapien), certificados, email. Guardar en `tenant_settings.configuracion_fiscal`.
2. **Fix endpoints PAC de producción** (`pac-client.ts`).
3. **Descarga XML/PDF**: APIs `facturas/[id]/xml|pdf` + botones en la tabla (solo facturas TIMBRADAS).
4. **Historial de pagos** real en `/billing` (query a `payment_history`).
5. **Cancelar suscripción** vía API Conekta + Dialog de confirmación.
6. **Vista detalle factura** (`facturas/[id]`).
7. **Tests** de CFDI y APIs de facturación.

Orden sugerido: 1 → 2 → 3 → 4 → 5 → 6 → 7.
