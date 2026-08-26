# SYMVORA SaaS - Contexto del Proyecto

## Visión General

SaaS multi-tenant ERP/POS para negocios en México (punto de venta, inventario, finanzas, compras). Diseñado para abarrotes, verdulerías, mascotas, ropa, ferreterías y farmacias. Stack: **Next.js 16.3 + Supabase + Tailwind v4 + TypeScript**. Pagos con **Conekta** (hosted checkout) y **MercadoPago** (terminal Point en POS). Facturación **CFDI 4.0** (PAC Finkok/SWSapien).

---

## Estructura del Proyecto

```
├── src/
│   ├── hooks/                  # use-current-tenant, use-is-demo
│   ├── __tests__/              # Tests unitarios Vitest (104)
│   ├── middleware.ts            # i18n + sesión Supabase + subscription access control + host routing (www/app) + X-Robots-Tag noindex
│   ├── i18n/                   # routing/request/navigation (locales es+en activos, default es)
│   ├── messages/               # es.json + en.json (631/591 keys)
│   ├── lib/
│   │   ├── supabase/           # client, server (service_role), middleware, auth (requireTenantAccess), demo-guard, activity-logger
│   │   ├── fiscal-secrets.ts   # credenciales PAC cifradas + ResolvedFiscalSecrets (antes lib/cfdi)
│   │   ├── validations/        # schemas Zod (login, signup, tenant)
│   │   ├── export/             # csv.ts, pdf.ts (jspdf)
│   │   └── types/database.ts   # tipos TS de todas las tablas DB
│   ├── features/               # módulos autocontenidos (refactor FDD): components/, hooks/, services/, types/, stores/, index.ts barrel
│   │   ├── pos/                # stores/cart.ts (Zustand), pos-service, hooks, componentes
│   │   ├── cash-register/      # caja: service + hooks + dialogs
│   │   ├── customers/          # customer-service, customer-selector (Combobox Base UI), new-customer-dialog, fiscal-data-form
│   │   ├── inventory/          # productos/lotes/variants/compras/purchase-orders/ajustes (services + hooks + tables)
│   │   ├── payments/           # conekta/* + mercadopago/* (antes lib/conekta, lib/mercadopago)
│   │   └── facturacion/        # catalogs (SAT), pac-client (Finkok/SWSapien), xml-generator, pdf-generator, factura-service (antes lib/cfdi)
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
│       ├── (dashboard)/[locale]/ # dashboard, billing, products, pos, purchases, finances, users, facturas, reports, settings, activity, lots, variants, inventory-adjustments, purchase-orders
│       ├── robots.ts           # robots.txt (disallow /api/, /es/demo, /en/demo; sitemap)
│       ├── sitemap.ts          # sitemap.xml (www.symvora.com.mx: /es + /en + legales, hreflang)
│       └── layout.tsx          # metadataBase = getSiteUrl() (www.symvora.com.mx)
├── supabase/migrations/        # 001-030 (schema, RBAC, onboarding, sales, legal, demo guards, conekta methods, referidos, códigos promo, hardening, auditoría)
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

1. **Signup** (3 acordeones: Datos personales → Empresa → Seguridad) → `signUp` (email sin confirmación) → upload logo → [si hay código promo: validar con `validar_codigo_promo` antes de crear tenant] → `complete_onboarding` RPC (crea tenant + **suscripción trial server-side**, migración 028) → [si hay código promo válido: `/api/promo/apply` → entra directo al dashboard, sin checkout] → `/api/conekta/create-checkout` → redirect Conekta. Fallback `/es/billing`. Checkbox obligatorio de Términos (se registra en `legal_acceptances`). **El cliente ya NO inserta subscriptions** — políticas INSERT/UPDATE de authenticated eliminadas (anti bypass de pago).
2. **Login** → `signInWithPassword` + CAPTCHA Turnstile (gated por `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) + throttle (5 intentos, backoff 30s→15min, countdown en vivo).
3. **Middleware** refresca JWT por request; `custom_access_token_hook` inyecta `user_role` + `tenant_id` en el JWT.
4. **Hardening**: `requireTenantAccess()` autentica por cookie (nunca JWT claims) y valida el permiso contra `role_permissions`.
5. **OAuth login**: Google habilitado (provider activo en Supabase + UI en `/auth?mode=login` con `signInWithOAuth` → callback `/api/auth/callback`). Microsoft (Azure) **pendiente** — keys aún no funcionales en Supabase, dejar como TODO. Nuevos OAuth users bloqueados (config `Allow new users: OFF` por provider).

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
- **Tablas (19)**: tenants, tenant_settings, user_roles, tenant_memberships, productos, clientes, proveedores, ventas, detalle_ventas, compras, detalle_compras, cajas, movimientos_caja, activity_logs, subscriptions, payment_history, legal_acceptances, facturas/factura_detalle, codigos_promocionales. (`trial_codes` eliminada en migración 029 — sistema muerto, reemplazado por códigos promocionales.)
- **Funciones SQL clave**: `user_tenant_ids()`, `authorize()`, `custom_access_token_hook()`, `log_activity()`, `complete_onboarding()` (SECURITY DEFINER, valida `auth.uid()`), `complete_sale()` (SECURITY DEFINER atómico), `reset_demo_tenant()`, `is_demo_user()` / `current_user_is_demo()` (solo service_role), `validar_codigo_promo()` / `aplicar_codigo_promo()` (SECURITY DEFINER, migración 027).
- **Migraciones**: 001-027. Aplicar en Supabase SQL Editor con "Without RLS".

---

## Librerías Principales

next 16.3, react 19.2, @supabase/ssr 0.12, supabase-js 2.112, next-intl 4.13, zustand 5, zod 4.4, @base-ui/react (shadcn base-nova), tailwind v4, recharts, cmdk, jspdf, conekta 9.0.1, @marsidev/react-turnstile 1.6, ogl (fondo login), sonner.

---

## Decisiones de Arquitectura

1. Route groups `(auth)` / `(dashboard)` para separar layouts sin afectar URLs.
2. Sin Server Actions: todas las mutaciones usan cliente browser de Supabase.
3. Spanish-First (default `es`, moneda MXN).
4. Conekta hosted checkout (no iframe); webhook firmado RSA `DIGEST` (fail-closed, requiere `CONEKTA_WEBHOOK_PUBLIC_KEY`). Métodos actuales (API v2.3): `card` (+ billeteras `apple`/`google`), `cash` (Conekta Efectivo: BBVA, 7Eleven, Farmacia del Ahorro, Waldo's y más — reemplaza a OXXO), `bank_transfer`/`pay_by_bank` (SPEI/BBVA), `bnpl` (crédito directo). Checkout `create-checkout` mapea `type` (card/cash/bank_transfer) a estos métodos; enum `payment_method` ampliado en migración 025.
5. Signup → Conekta directo (sin onboarding; la página onboarding fue eliminada).
6. CFDI 4.0 con PAC Finkok/SWSapien, sello digital real (`@cfdi/xml` + timbrado SOAP), credenciales cifradas.
7. MercadoPago Point para cobro por terminal en el POS.
8. Demo pública con aislamiento total (`assertNotDemo()` en 12 endpoints → `403 DEMO_MODE_RESTRICTED`).

---

## Códigos Promocionales (migración 027)

Otorgan días de trial extra **sin pasar por Conekta**. Un código válido extiende `subscriptions.trial_end` y el usuario entra directo al sistema.

> ⚠️ **No confundir** con la tabla/API `trial_codes` (preexistente, migraciones anteriores) — sistema distinto. Los códigos promocionales viven en `codigos_promocionales` y usan `/api/promo/apply`.

- **Tabla `codigos_promocionales`**: `codigo` (unique, normalizado a uppercase), `trial_days` (1-90, default 7), `activo`, `expira_en`, `usado_por_tenant_id` + `usado_en` (**un solo uso global**). RLS habilitado **sin políticas** — nadie lee la tabla vía PostgREST; acceso solo vía RPCs SECURITY DEFINER o service role.
- **RPCs**: `validar_codigo_promo(codigo)` → `{valido, razon|trial_days}` (feedback en vivo, no consume); `aplicar_codigo_promo(codigo, tenant_id)` → atómico (`FOR UPDATE` anti-carrera), valida `auth.uid()` + membresía, idempotente para el mismo tenant, rechaza suscripciones `active` (nunca regresa a trial una cuenta que paga).
- **API**: `POST /api/promo/apply` (`requireTenantAccess` + `assertNotDemo`); ejecuta el RPC con el cliente autenticado del usuario (cookies), no con service role (el RPC valida `auth.uid()`).
- **UI**: signup (`auth-forms.tsx`, campo colapsable — valida **antes** de crear el tenant para retry limpio) y `/billing` (aplicable si la suscripción no está `active`).

### Cómo generar/gestionar códigos (Supabase Dashboard)

Los códigos los crea el dueño del negocio manualmente — no hay panel automático ni integración con Conekta.

**SQL Editor** (o Table Editor → tabla `codigos_promocionales` → Insert row):

```sql
-- Básico: 7 días de trial, sin expiración
INSERT INTO codigos_promocionales (codigo) VALUES ('LANZAMIENTO');

-- Con fecha de expiración
INSERT INTO codigos_promocionales (codigo, expira_en)
VALUES ('BIENVENIDA', '2026-12-31 23:59:59-06');

-- Con más días de prueba
INSERT INTO codigos_promocionales (codigo, trial_days)
VALUES ('PROMO15', 15);
```

```sql
-- Ver códigos y quién usó cuál
SELECT codigo, trial_days, activo, expira_en, usado_en, usado_por_tenant_id
FROM codigos_promocionales ORDER BY created_at DESC;

-- Desactivar (deja de funcionar sin borrarlo)
UPDATE codigos_promocionales SET activo = false WHERE codigo = 'LANZAMIENTO';
```

**Reglas activas**: uppercase (`lanzamiento` = `LANZAMIENTO`), trim automático, un solo uso global (queda registrado quién/cuándo), rechazados si expirados/inactivos/usados, nunca aplicables a cuentas que ya pagan. **Sugerencia**: usar códigos no adivinables (ej. `SYM-7X4K9`) porque cualquiera que los conozca puede consumirlos.

---

## Dominios, Despliegue y SEO (agosto 2026)

- **Dominios** (registrados en Cloudflare, DNS-only → Vercel):
  - `www.symvora.com.mx` → **marketing/landing** (canónico SEO).
  - `app.symvora.com.mx` → **sistema/dashboard** (login, signup, demo, billing, facturas, etc.).
  - `symvora.com.mx` (apex) → redirige 308 a `www` en Vercel.
  - `saas-symvora.vercel.app` → 308 a `www` (dominio de producción en Vercel = `www.symvora.com.mx`).
- **Host routing**: `src/lib/supabase/middleware.ts` — `PROD_HOSTS` = {app, www, apex}; en prod redirige 308 cruzado por host (rutas de app en `www` → `app`, rutas de marketing en `app` → `www`). No aplica en localhost ni previews.
- **noindex**: `src/middleware.ts` agrega `X-Robots-Tag: noindex, nofollow` a cualquier host que no sea `www`/apex (cubre `app.*`, previews `*.vercel.app`, dominio viejo). Además, `(dashboard)` y `(auth)` layouts tienen `robots.index=false`.
- **Env en Vercel (Production)**: `NEXT_PUBLIC_APP_URL=https://app.symvora.com.mx`, `NEXT_PUBLIC_SITE_URL=https://www.symvora.com.mx`. Fallbacks en código actualizados (site.ts, referrals.ts, create-checkout, email.ts logo).
- **Supabase Auth**: Site URL = `https://app.symvora.com.mx`; Redirect URLs incluyen `app/**`, `www/**`, apex, vercel.app.
- **Turnstile**: lista Hostname del widget incluye `app.symvora.com.mx`, `www.symvora.com.mx`, `symvora.com.mx`.
- **SEO**: locale `en` habilitado en `i18n/routing.ts` (es+en, `/en` live). `sitemap.ts` (`/es`, `/en`, legales — 8 URLs con hreflang), `robots.ts` (disallow `/api/`, `/es/demo`, `/en/demo`), `metadataBase` en layout raíz, canonical `/es` en landing + legales, imagen OG `public/og-symvora-v3.jpg` (1200×630, JPG para compatibilidad con WhatsApp/Meta).
- **Cloudflare Email Routing** (solo recepción): destino `jonattan10.99@hotmail.com`; alias `hola@symvora.com.mx` → hotmail. Envío con `@symvora.com.mx` (Resend Sending Domain) queda pendiente si se desea.
- ⚠️ **Demo**: corre en `app.symvora.com.mx` (cookies de sesión ligadas al host; en `www` fallaría al redirigir a dashboard).

---

## Redes Sociales — Setup de cuentas (agosto 2026)

- **Correo de registro (las 3):** `hola@symvora.com.mx` — funciona si el alias `hola@` de Cloudflare Email Routing está activo (llega a Hotmail). Si no llega el código, revisar spam o crear el alias en Cloudflare primero.
- **Handle/usuario:** `@symvora` en todas (IG/FB/TikTok). Si ocupado en IG, fallbacks en orden: `symvora.mx` (recomendado, refuerza dominio) → `symvora.pos` → `symvora.app` → `symvora.software` → `symvora.oficial` → `symvora.puntodeventa` → `symvora.negocios`. Mantener el mismo handle en todas las plataformas.
- **Foto de perfil:** logo SYMVORA cuadrado (`public/symvora-logo-email.png`). **Tagline unificado:** "El sistema todo-en-uno para tu tienda". **CTA unificado:** "Prueba 7 días gratis" → `https://app.symvora.com.mx`.
- **Voz:** cercana, español MX, "el villano es la libreta/miedo al SAT, no el competidor".

### Descripciones por plataforma
- **Facebook (página de negocio, categoría Software/Empresa de software):** nombre `SYMVORA`; About: *"Sistema de punto de venta, inventario y facturación CFDI 4.0 para negocios en México. Sin comisiones por venta y soporte en español. Prueba 7 días gratis → app.symvora.com.mx"*; servicios: POS · Inventario · CFDI 4.0 · Finanzas · Compras; contacto `hola@symvora.com.mx` + ciudad/estado; cover con CTA; URL `facebook.com/symvora`.
- **Instagram:** username `@symvora`, nombre visible `SYMVORA | POS para tu tienda`, categoría `Software`; bio (saltos de línea):
  ```
  Punto de venta, inventario y CFDI 4.0 🇲🇽
  Sin comisiones por venta
  Soporte en español
  👇 Prueba 7 días gratis
  ```
  Link bio → `https://app.symvora.com.mx`; highlights: `Demo` · `Precios` · `Referidos` · `FAQ`; conectar vía Meta Business Suite para programar con FB.
- **TikTok:** cuenta **TikTok Business**; username `@symvora`; bio (80 chars): *"POS + inventario + CFDI 4.0 para tu tienda 🇲🇽 Sin comisiones. Prueba gratis 👇"*; link → `app.symvora.com.mx`.

### Estrategia de contenido (skills coreyhaines31/marketingskills)
- Docs: `docs/social-strategy.md` (pilares, producción con IA, métricas, roadmap 90 días), `docs/social-calendar.md` (30 posts/4 semanas con hooks+copy+prompts IA), `docs/social-reels.md` (5 guiones de reels con VO ElevenLabs), `docs/social-carousels-posts.md` (5 carruseles + 10 posts estáticos).
- **Pilares 80/20:** EDU 35% (CFDI/SAT/control), Antes/Después 25%, Demo producto 25%, Promo+Referidos 15%.
- **Plataformas:** FB+IG base local, TikTok/Reels alcance, Shorts educación, WhatsApp conversión. LinkedIn/X NO prioritarios.
- **Producción 100% IA:** Higgsfield (video, clips 3-6s), ElevenLabs (VO es-MX), Gemini/ChatGPT (imágenes). Prompts piden **sin texto** (se superpone en CapCut). Para slides de producto usar capturas reales de la demo `app.symvora.com.mx/es/demo`.
- **Reglas:** hook de 3s (visual+verbal+texto), subtítulos ≤2 líneas/3-5 palabras, sin links en el cuerpo, consistencia > cantidad (5/sem).
- **Pendiente:** WhatsApp Business con número dedicado para CTA; 2FA en las 3 cuentas; prompts IA para cover de FB y portadas de highlights.

---

## Estado Actual

### Completado
- **Core**: dashboard (KPIs + 3 gráficas Recharts), productos CRUD, POS, compras/proveedores, caja, users/roles, activity logs, reports, settings, lots/variants/inventory-adjustments/purchase-orders.
- **Billing**: Conekta (checkout, webhook firmado, trial codes, subscriptions, payment_history), métodos actuales v2.3 (tarjeta/billeteras/SPEI/BBVA/efectivo en tiendas), historial de pagos en `/billing` + cancelar suscripción con diálogo de confirmación.
- **Códigos promocionales** (2026-08-24): migración 027, RPCs validar/aplicar, API `/api/promo/apply`, campo en signup (salta checkout de Conekta) y sección en `/billing`. Verificado en BD (7 tests SQL: válido, reuso, idempotencia, tenant ajeno, anon). Generación manual vía Supabase (ver sección "Códigos Promocionales").
- **Refactor FDD (Fases 0-7)**: lógica extraída de páginas/lib hacia `src/features/` (pos, cash-register, customers, inventory, payments, facturacion) con barrels, services, hooks y componentes; `lib/{cfdi,conekta,mercadopago}` reubicados; `lib/fiscal-secrets.ts` conserva credenciales PAC; rutas API delgadas sobre `factura-service`; nuevo Combobox (Base UI, 0 deps) con `customer-selector` buscable + hook `use-customers`. Verificado: tsc limpio, 104 tests, lint baseline 188, build webpack (el build Turbopack tiene panic preexistente de sourcemaps → usar `next build --webpack`).
- **Facturación CFDI 4.0**: schema, catálogos SAT, XML, PAC, APIs create/stamp/cancel/list, UI `/facturas`.
- **Landing**: hero con PosMockup, features, FAQ (8 preguntas), CTA anual/mensual, WhatsApp, CompatibilityBar, footer legal.
- **Demo**: self-serve (`/demo` → magic link), banner `?demo=1`, aislamiento total (12 endpoints + UI restringida + 10 tests).
- **Seguridad**: `requireTenantAccess` en todas las APIs, webhook firmado, RBAC granular, RLS total, CAPTCHA Turnstile, headers (CSP, HSTS, nosniff, Referrer-Policy), `complete_sale` atómico con precio desde BD.
- **Legal (LFPDPPP)**: aviso de privacidad integral, términos 17 secciones, política de cookies, `legal_acceptances` (IP+UA+versiones), PolicyUpdateBanner post-login.
- **Calidad**: 104 tests Vitest, Playwright E2E, CI GitHub Actions.
- **Cuenta de prueba (2026-08-25)**: `pruebas@symvora.com.mx` / `dZsFT8bPvFIhYQcU` — usuario real (no demo) con tenant "Pruebas SYMVORA" (subdominio `pruebas`, código referido `SYMAB77A437`), OR_ADMIN, suscripción trial. Creada vía `scripts/create-test-account.ts` (Admin API, idempotente — re-ejecutar rota la contraseña) + `complete_onboarding` vía SQL. Sin bandeja real (`email_confirm: true`, ningún correo sale a terceros). Aislada por RLS; puede probar Conekta real (cobros reales — montos pequeños). Login por script lo bloquea Turnstile (esperado) — probar en navegador.

### Pendiente
- **Google Search Console (2026-08-25)**: ✅ sitemap.xml restaurado (`src/app/sitemap.ts` había sido eliminado en 57b6fd2 — daba 404) y verificado HTTP 200 en producción. Pendiente en GSC: reenviar sitemap (`www.symvora.com.mx/sitemap.xml`), Request indexing en `/es` y `/en`. Los avisos "Página con redirección" (host routing apex→www, marketing→app) y "Excluida por noindex" (app.*) son intencionales — no corregir. "Descubierta sin indexar" se resuelve sola con el sitemap + tiempo.
- Envío de correo con `@symvora.com.mx` (Resend Sending Domain + fusión SPF con `include:_spf.mx.cloudflare.net include:amazonses.com`) — solo si se quiere.
- **Emails de bienvenida (2026-08-24)**: ✅ dominio `symvora.com.mx` verificado en Resend (DNS en Cloudflare); `RESEND_FROM_EMAIL=SYMVORA <no-reply@symvora.com.mx>` en Vercel (Production+Preview). Plantilla rediseñada con identidad de marca (negro/hueso `#F0EFED`) en `src/lib/email.ts` con 2 variantes (`type: "signup" | "first_payment"`). Trigger signup: `POST /api/email/welcome` (fire-and-forget desde `auth-forms.tsx`); trigger primer pago: webhook Conekta (`sendWelcomeEmailToOwner`). Envío real verificado a Hotmail (2/2 ok). Script de prueba: `scripts/test-email.ts` (requiere `TEST_EMAIL_TO` + `.env.local`).
- Config fiscal de producción (RFC, PAC, certificados) — prerequisito para timbrar.
- Fix `pac-client.ts` `getEndpoint()` (retorna demo URL en producción).
- Locales hardcodeados en redirects (`auth-forms.tsx`, `billing/success`).
- Descarga XML/PDF de facturas + vista de detalle.
- Legal stubs en aviso de privacidad (`[Domicilio del responsable]`, `[privacidad@symvora.com]`).
- Env pendientes: `STITCH_API_KEY` (nota: `NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_SITE_URL` ya configurados en Vercel Production como app/www).
- **Conekta producción (2026-08-24)**: claves productivas configuradas en Vercel (`CONEKTA_PRIVATE_KEY`, `CONEKTA_PUBLIC_KEY`, `CONEKTA_WEBHOOK_PUBLIC_KEY`) y `CONEKTA_WEBHOOK_SECRET` legacy eliminado. Webhook fail-closed verificado (401 sin firma). Pendiente: registrar la URL del webhook en el dashboard de Conekta y prueba de pago real end-to-end.
- `role_permissions` con RLS deshabilitado (decidir si habilitar).
- **Auditoría BD (2026-08-24, migraciones 028-030)**: ✅ cerrado bypass de pago en subscriptions; ✅ FK productos.proveedor_id; ✅ facturas_folios CASCADE; ✅ UNIQUE codigo_barras/RFC; ✅ REVOKE TRUNCATE/EXECUTE; ✅ `trial_codes` eliminada (0 filas, sin UI) junto con sus 3 APIs; ✅ `tenants_insert` arbitraria bloqueada; ✅ activity_logs exige `user_id = auth.uid()`; ✅ RBAC facturación (`authorize('billing.create')` para escrituras — CAJERO solo lectura; pagos_terminal solo lectura); ✅ initplan `(select auth.uid())`; ✅ 16 índices FK. Linters Supabase limpios (solo avisos intencionales). Pendiente menor: leaked password protection requiere plan Pro (no disponible en Free) — mitigado con política de contraseñas fuertes en Auth (min length + caracteres requeridos, gratis) + Turnstile + throttle de login; activar al pasar a Pro. Revisar índices sin uso con tráfico real antes de eliminar.
- **OAuth Microsoft (Azure) pendiente**: provider keys aún no funcionales en Supabase. UI preparada (`continueWithMicrosoft` en `es.json`/`en.json`, `MicrosoftIcon` ya exportado en `auth-forms.tsx`). Cuando se resuelvan los problemas de inicio de sesión en Azure, añadir `<button onClick={() => handleOAuth("azure")}>` junto al botón de Google en `auth-forms.tsx`.
- **Exportación de datos (CSV/Excel/PDF)**: funcionalidad de exportar datos de inventario, ventas, compras, ajustes, etc.
  - **Fase 1 - Infraestructura (Semana 1)**: API routes `/api/export/[entidad]` (products, variants, lots, sales, purchases, adjustments), streaming CSV para datasets grandes, Service Role para acceso completo tenant, validación tenant_id via JWT.
  - **Fase 2 - UI (Semana 1-2)**: Dropdown "Exportar" en tablas (ProductsTable, VariantsTable, LotsTable, SalesTable, PurchasesTable, AdjustmentsTable), formatos CSV/Excel/PDF, filtros de fecha/columnas, selección de columnas.
  - **Fase 3 - Avanzado (Semana 2-3)**: Exports programados (diario/semanal) vía email/S3, plantillas/preajustes, cola de trabajos para exports grandes (>10k filas), logs de auditoría de exportaciones.
  - Entidades a exportar: Productos (con variantes y lotes), Variantes, Lotes, Ventas (con detalle), Compras/Órdenes, Ajustes inventario, Movimientos caja, Clientes/Proveedores.
  - Formatos: CSV (streaming, UTF-8 BOM), Excel (xlsx via lib `xlsx`), PDF (jsPDF + autoTable).
  - Seguridad: Service Role para export, validación tenant_id via JWT, rate limiting por tenant, logs de auditoría.

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
10. **Bypass de pago en `subscriptions`** (migración 028): políticas INSERT (sin restricción de status) y UPDATE (ORG_ADMIN podía `SET status='active'` — PoC verificado) permitían activarse sin pagar por Conekta. Fix: trial se crea en `complete_onboarding` (server-side) y se eliminaron ambas políticas; el estado lo gestionan webhook/APIs (service_role BYPASSRLS). No reintroducir políticas de escritura de subscriptions para authenticated.
11. **Estandarización (migración 028)**: `productos.proveedor_id` sin FK (añadida, ON DELETE SET NULL); `facturas_folios.tenant_id` era la única FK a tenants sin CASCADE; faltaban UNIQUE de negocio `productos(tenant_id, codigo_barras)` y `clientes(tenant_id, rfc)` (índices únicos parciales); `TRUNCATE` otorgado a anon/authenticated (RLS no lo cubre — revocado); funciones trigger ejecutables por anon (revocado).

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
3. **Descarga XML/PDF**: APIs `facturas/[id]/xml|pdf` + botones en la tabla (solo facturas TIMBRADAS). *(API XML/PDF ya delgadas sobre `factura-service`.)*
4. **Historial de pagos** real en `/billing` (query a `payment_history`). — ✅ hecho (tabla de pagos en `/billing`).
5. **Cancelar suscripción** vía API Conekta + Dialog de confirmación. — ✅ hecho (`/api/conekta/cancel-subscription`).
6. **Vista detalle factura** (`facturas/[id]`).
7. **Tests** de CFDI y APIs de facturación.

Orden sugerido: 1 → 2 → 3 → 4 → 5 → 6 → 7.

---

## Cambios Frontend/Landing (2026-08-26)

### Hero — limpieza visual y centrado (`src/components/marketing/hero.tsx`)
- **Eliminado eyebrow span** (franja superior sobre el título): el `motion.span` que mostraba `landing.hero.eyebrow` ("POS · Inventario · Facturación CFDI") fue removido. El span estaba vacío tras quitar el texto pero seguía ocupando espacio como franja visible.
- **Eliminado trial notice box** (franja debajo del subtitle): el `motion.div` con icono de reloj que mostraba `landing.hero.trialTitle` + `landing.hero.trialDesc` ("Prueba 7 días gratis / Sin tarjeta de crédito...") fue removido. El bloque estaba vacío tras quitar los textos pero seguía renderizando el recuadro `bg-primary/5` con borde.
- **Centrado del hero**: padding superior reducido de `pt-24 lg:pt-32` a `pt-8 lg:pt-12`. El AppFrame ya aporta `pt-20 md:pt-28` por la navbar fija (`h-[88px]`), por lo que el padding extra del hero empujaba el contenido demasiado hacia abajo. Ahora queda mejor centrado verticalmente.
- El hero ahora contiene: Headline (título + highlight) → Subtitle → CTAs (botones "Prueba 7 días gratis" + "Ver demo") → columna derecha con PosMockup + badge "+24.5%".

### Claves i18n (`src/messages/es.json` + `en.json`)
- Las claves `landing.hero.eyebrow`, `landing.hero.trialTitle`, `landing.hero.trialDesc` ya no se consumen desde el componente pero **se mantienen en los JSON** (no eliminadas) para no romper traducciones si se reactivan. El error `MISSING_MESSAGE` reportado en consola era caché del dev server; tras reiniciar Turbopack se resolvió (log limpio, "✓ Compiled" sin errores).

### Nota
- `LogoCarousel` ("Equipos que construyen el futuro con SYMVORA") y `CompatibilityBar` (Celular/Tablet/Computadora/En la nube) siguen renderizándose después del Hero en `page.tsx` — no fueron eliminados. Si se quieren quitar, editar `src/app/[locale]/page.tsx` líneas 102-103.
