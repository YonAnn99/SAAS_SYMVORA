# SYMVORA SaaS - Contexto del Proyecto

## Visión General

SaaS multi-tenant ERP/POS para negocios en México (punto de venta, inventario, finanzas, compras). Diseñado para abarrotes, verdulerías, mascotas, ropa, ferreterías y farmacias. Stack: **Next.js 16.3 + Supabase + Tailwind v4 + TypeScript**. Pagos con **Conekta** (hosted checkout) y **MercadoPago** (terminal Point en POS). Facturación **CFDI 4.0** (PAC Finkok/SWSapien).

---

## Estructura del Proyecto

```
├── src/
│   ├── hooks/                  # use-current-tenant, use-is-demo, use-online-status, use-tutorial, use-pos-catalog
│   ├── contexts/                # tenant-context.tsx
│   ├── __tests__/              # Tests unitarios Vitest (117, en 10 archivos)
│   ├── sentry.{client,server,edge}.config.ts  # @sentry/nextjs (errores + replay), wrapped en next.config.ts
│   ├── proxy.ts                  # i18n + sesión Supabase + subscription access control + host routing (www/app) + X-Robots-Tag noindex (antes middleware.ts — renombrado en Next.js 16)
│   ├── i18n/                   # routing/request/navigation (locales es+en activos, default es)
│   ├── messages/               # es.json + en.json
│   ├── lib/
│   │   ├── supabase/           # client, server (service_role), middleware, auth (requireTenantAccess), demo-guard, activity-logger
│   │   ├── fiscal-secrets.ts   # credenciales PAC cifradas + ResolvedFiscalSecrets (antes lib/cfdi)
│   │   ├── validations/        # schemas Zod (login, signup, tenant, import de productos)
│   │   ├── export/             # csv.ts, pdf.ts (jspdf) — export genérico usado por reportes/facturas, no confundir con el CSV/Excel export de tablas (ver Pendiente)
│   │   ├── config/env.ts       # helpers de variables de entorno
│   │   ├── legal/versions.ts   # versiones de términos/privacidad para legal_acceptances
│   │   ├── seo/structured-data.ts # JSON-LD (schema.org) para landing
│   │   └── types/database.ts   # tipos TS de todas las tablas DB
│   ├── features/               # módulos autocontenidos (refactor FDD): components/, hooks/, services/, types/, stores/, index.ts barrel
│   │   ├── pos/                # stores/cart.ts (Zustand), pos-service, hooks, componentes
│   │   ├── cash-register/      # caja: service + hooks + dialogs
│   │   ├── customers/          # customer-service, customer-selector (Combobox Base UI), new-customer-dialog, fiscal-data-form
│   │   ├── inventory/          # productos/lotes/variants/compras/purchase-orders/ajustes (services + hooks + tables) + products/import/ (wizard de importación CSV/XLSX)
│   │   ├── payments/           # conekta/* + mercadopago/* (antes lib/conekta, lib/mercadopago)
│   │   ├── facturacion/        # catalogs (SAT), pac-client (Finkok/SWSapien), xml-generator, pdf-generator, factura-service (antes lib/cfdi)
│   │   └── suggestions/        # módulo de sugerencias del cliente (BD + correo)
│   ├── components/
│   │   ├── layout/             # sidebar, header, legal-footer
│   │   ├── dashboard/           # dashboard-shell, legal-footer
│   │   ├── search/              # command-menu.tsx (cmdk, búsqueda global del dashboard)
│   │   ├── tutorial/             # onboarding guiado del dashboard: tutorial-provider/dialog/arrow/progress/minimized/trigger + steps-data
│   │   ├── auth/               # auth-forms (login/signup con acordeones), gradient-waves (fondo WebGL)
│   │   ├── marketing/          # hero, features, navbar, footer, legal-shell, FAQ, PosMockup, voice-narrator.tsx + use-section-audio.ts + audio-config.ts (narración didáctica de módulos)
│   │   ├── demo/                # demo-banner, demo-restricted-notice
│   │   ├── compliance/         # cookie-consent, policy-update-banner
│   │   ├── charts/             # Recharts (ventas, top productos, métodos de pago)
│   │   └── ui/                 # shadcn/ui v4 base-nova + accordion, password-input, sonner, specular-action-button, etc.
│   └── app/
│       ├── api/                # conekta/*, mercadopago/*, facturas/*, users/invite, trial-codes/*, legal/*, demo/start, suggestions
│       ├── (auth)/[locale]/    # login, signup
│       ├── (dashboard)/[locale]/ # dashboard, billing, products, pos, purchases, finances, users, facturas, reports, settings, activity, lots, variants, inventory-adjustments, purchase-orders, suggestions
│       ├── robots.ts           # robots.txt (disallow /api/, /es/demo, /en/demo; sitemap)
│       ├── sitemap.ts          # sitemap.xml (www.symvora.com.mx: /es + /en + legales, hreflang)
│       └── layout.tsx          # metadataBase = getSiteUrl() (www.symvora.com.mx)
├── supabase/migrations/        # 001-043 (schema, RBAC, onboarding, sales, legal, demo guards, conekta methods, referidos, códigos promo, hardening, auditoría, invite keys, IVA toggle, monto recibido, sugerencias — sin 034/035, numeración con hueco intencional)
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

next 16.3, react 19.2, @supabase/ssr 0.12, supabase-js 2.112, next-intl 4.13, zustand 5, zod 4.4, @base-ui/react (shadcn base-nova), tailwind v4, recharts, cmdk, jspdf, conekta 9.0.1, @marsidev/react-turnstile 1.6, ogl (fondo login + Specular Button de `@react-bits`), sonner, serwist + @serwist/next (PWA, reemplaza a `next-pwa` que nunca se conectó), @sentry/nextjs (errores + session replay, configs en `src/sentry.{client,server,edge}.config.ts`), papaparse + xlsx (import de productos CSV/Excel).

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
- **Calidad**: 117 tests Vitest (10 archivos, incluye `product-import.test.ts` y `complete-sale.test.ts` con cobertura de `montoRecibido`), Playwright E2E, CI GitHub Actions.
- **Cuenta de prueba (2026-08-25)**: `pruebas@symvora.com.mx` / `dZsFT8bPvFIhYQcU` — usuario real (no demo) con tenant "Pruebas SYMVORA" (subdominio `pruebas`, código referido `SYMAB77A437`), OR_ADMIN, suscripción trial. Creada vía `scripts/create-test-account.ts` (Admin API, idempotente — re-ejecutar rota la contraseña) + `complete_onboarding` vía SQL. Sin bandeja real (`email_confirm: true`, ningún correo sale a terceros). Aislada por RLS; puede probar Conekta real (cobros reales — montos pequeños). Login por script lo bloquea Turnstile (esperado) — probar en navegador.
- **Legal**: stub de correo ya resuelto — `PRIVACY_EMAIL = "privacidad@symvora.com.mx"` en `src/lib/contact.ts` (real, no placeholder). Solo queda pendiente el domicilio físico (ver Pendiente).
- **CFDI**: config fiscal UI+API (`facturas/config`) completa (RFC, razón social, régimen, CP, PAC, certificados); descarga XML/PDF + vista de detalle (`facturas/[id]`) completas; `pac-client.ts` ya resuelve endpoint de producción vs pruebas correctamente (no hardcodea demo). Solo falta cargar credenciales fiscales reales y escribir tests (ver "Plan Pendiente: Módulo CFDI").
- **`role_permissions`**: RLS habilitado desde la migración `021_qa_role_permissions_rls.sql` (la nota de "decidir si habilitar" en versiones previas de este documento ya no aplica).

### Sesión 2026-08-31

- **PWA**: instalable + más rápida en mobile + catálogo del POS disponible sin conexión (dentro de la misma sesión ya abierta). `src/app/manifest.ts` (nombre, íconos 192/512 "any" + "maskable", `display: standalone`, colores de marca); service worker con **Serwist** (`src/app/sw.ts` + `@serwist/next` en `next.config.ts`, reemplaza a `next-pwa` que estaba instalado pero nunca conectado y es incompatible con Turbopack-dev de este proyecto; deshabilitado en dev, solo corre en el build de producción `--webpack`); `public/offline.html` estático (fuera del enrutado de Next/middleware) como fallback de navegación sin conexión, precacheado y verificado en el `sw.js` generado; `useOnlineStatus()` (`src/hooks/use-online-status.ts`, nuevo) + caché en `localStorage` del último catálogo de productos del POS (`use-pos-catalog.ts`) para seguir viéndolo sin internet; "Completar venta" se bloquea explícitamente sin conexión (nunca se intenta completar una venta offline — decisión explícita para no arriesgar desincronizar stock). Íconos y splash screens (9 tamaños de iPhone/iPad) generados con `sharp` a partir del logo real `symvora-logo.webp`.
- **Módulo "Suggestions"**: el cliente puede mandar sugerencias que se guardan en BD y llegan por correo. Migración `043_sugerencias.sql` (tabla `sugerencias` + RLS); `src/app/api/suggestions/route.ts` (antes solo enviaba el correo, ahora también inserta el registro; rate limit de 5/hora movido de un `Map` en memoria — no sobrevive a serverless — a un conteo real contra la tabla); `sendSuggestionEmail` en `src/lib/email.ts` (reutiliza el patrón Resend existente); UI en `/suggestions` (`src/features/suggestions/`).
- **Rediseño de botones (Specular Button, `@react-bits`)**: 57 botones principales/CTA del dashboard (nunca el landing, que no usa el `Button` compartido) convertidos a `src/components/ui/specular-action-button.tsx` — envoltorio sobre el componente WebGL instalado en `src/components/SpecularButton.tsx`, con tono por función (`money`=verde, `add`=azul, `destructive`=rojo, `neutral`=azul marino). Deliberadamente **no** se aplicó a íconos de acción repetidos por fila en tablas (saturaría los contextos WebGL del navegador). Iteraciones de corrección: `shrink-0 whitespace-nowrap` para el bug de layout ícono-arriba-texto-abajo, luego se quitaron los íconos de todos los botones convertidos (persistía en botones anchos como los de `/billing`) dejando solo texto; `autoAnimate: true` para que el brillo se vea también en modo claro (antes solo aparecía al pasar el mouse encima).
- **Compras**: función de editar un registro existente (proveedor, número de factura, total) — `updatePurchase()` en `purchase-service.ts`, mismo diálogo de crear/editar (patrón `editingPurchase`), solo permitido mientras la compra está en estado `PENDIENTE`.
- **Finanzas**: corregido bug donde las ventas completadas se contaban como "Salida" (negativas) en vez de no afectar el balance de Entrada/Salida — `calculateRegisterTotals()` ahora distingue `ENTRADA`/`SALIDA`/`VENTA` correctamente (`VENTA` se excluye de esa suma a propósito, para no duplicar contra la tarjeta "Ventas"); corregidos los tipos TS generados de `movimientos_caja`/`ventas` que estaban desactualizados desde la migración 018.
- **POS**: campo de monto recibido + cambio sugerido en el carrito para pagos en efectivo, persistido en `ventas.monto_recibido`/`cambio` (migración `042_venta_monto_recibido.sql`, valida server-side que el monto recibido cubra el total); checkbox de IVA cambiado a **desactivado por defecto** (`src/features/pos/stores/cart.ts`).
- **Conekta**: tiempo de espera del checkout de efectivo reducido de 90s a 20s; `/billing/success` ahora distingue pago confirmado vs pendiente (antes mostraba "éxito" para cualquier redirect, incluyendo efectivo pendiente de confirmar); webhook ya no hardcodea `payment_method: "card"` (lee el método real de Conekta); `payment_history` se actualiza correctamente en vez de duplicar filas; el correo con la referencia de pago en efectivo ahora llega al email de login del `SUPER_ADMIN` real del tenant (antes usaba `tenants.email`, un campo de contacto de negocio no siempre igual al de login); corregido el filtro de rol del correo de bienvenida (`ORG_ADMIN` → `SUPER_ADMIN`, el rol real del primer usuario/dueño); banner de "pago pendiente" agregado a `/billing`.
- **Verificación de todo el sistema (2026-08-31)**: se re-confirmó contra el código real el estado de cada pendiente listado en este archivo (varios ya estaban resueltos y no reflejados aquí, ver arriba); `npx tsc --noEmit` limpio en todo el proyecto.

### Sesión 2026-09-01

- **Módulo de importación/migración de datos de productos**: wizard de 4 pasos en `src/features/inventory/services/product-import-service.ts` + `src/app/(dashboard)/[locale]/products/import/` (upload → mapeo de columnas → preview/validación → resultados). Acepta CSV (`papaparse`) y Excel (`xlsx`, paquete servido desde CDN de SheetJS). Botón "Importar" agregado a `/products` (`products/page.tsx`) y a la landing (sección nueva en `features.tsx` promocionando la migración de datos, con CTA en `cta.tsx`). Tipos en `features/inventory/types/import.types.ts`, validación Zod agregada a `lib/validations/schemas.ts`. Cubierto por `src/__tests__/product-import.test.ts` (193 líneas). **No confundir** con la "Exportación de datos (CSV/Excel/PDF)" que sigue pendiente más abajo — esto es solo importación de productos, no exportación de ventas/compras/reportes.
- **Reorganización de landing + fix de modo mobile**: `page.tsx` reordena secciones para incluir las promos de PWA y migración de datos; bug de layout en `features.tsx` al cambiar de modo en mobile corregido en un commit de seguimiento inmediato.

### Sesión 2026-08-30 (no documentada previamente)

- **Narración didáctica en la landing**: `src/components/marketing/voice-narrator.tsx` + `use-section-audio.ts` + `audio-config.ts` — reproduce audio explicativo por sección/módulo al hacer scroll en la landing pública (independiente del tutorial guiado del dashboard).
- **Tutorial guiado del dashboard**: `src/components/tutorial/` (`tutorial-provider`, `tutorial-dialog`, `tutorial-arrow`, `tutorial-progress`, `tutorial-minimized`, `tutorial-trigger`, `steps-data.tsx`) + hook `use-tutorial` — onboarding paso a paso dentro del dashboard, con estado de progreso, minimizado y navegación a cada módulo.
- **Sentry**: `@sentry/nextjs` integrado (`src/sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `withSentryConfig` en `next.config.ts`), incluye `replayIntegration()` y CSP actualizada para permitir `js.sentry-cdn.com` / `*.sentry.io`.
- **Búsqueda global**: `src/components/search/command-menu.tsx` (cmdk) para navegación rápida entre módulos del dashboard.

### Pendiente

> Re-verificado contra el código real el 2026-08-31 — varios puntos que seguían listados aquí ya estaban resueltos y fueron movidos a "Completado" o eliminados (ver sección "Sesión 2026-08-31" más abajo para el detalle de esa verificación).

- **Google Search Console (2026-08-25)**: ✅ sitemap.xml restaurado (`src/app/sitemap.ts` había sido eliminado en 57b6fd2 — daba 404) y verificado HTTP 200 en producción. Pendiente en GSC: reenviar sitemap (`www.symvora.com.mx/sitemap.xml`), Request indexing en `/es` y `/en`. Los avisos "Página con redirección" (host routing apex→www, marketing→app) y "Excluida por noindex" (app.*) son intencionales — no corregir. "Descubierta sin indexar" se resuelve sola con el sitemap + tiempo.
- Config fiscal de **producción** (RFC, PAC, certificados reales cargados en `/facturas/config`) — la UI/API ya existen (ver Completado), falta cargar credenciales reales; prerequisito para timbrar CFDI de verdad.
- Legal stub en aviso de privacidad: **`[Domicilio del responsable]`** sigue sin reemplazar (el correo `privacidad@symvora.com.mx` ya está resuelto, ver Completado).
- Env pendiente: `STITCH_API_KEY` (nota: `NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_SITE_URL` ya configurados en Vercel Production como app/www).
- **Conekta producción**: claves productivas configuradas en Vercel, webhook fail-closed verificado (401 sin firma), flujo de pago en efectivo probado end-to-end en producción (2026-08-31, ver Completado). Pendiente: confirmar que la URL del webhook esté registrada en el dashboard de Conekta y hacer una prueba de pago **con tarjeta** completada end-to-end (solo se ha probado efectivo).
- **OAuth Microsoft (Azure) pendiente**: provider keys aún no funcionales en Supabase. UI preparada (`continueWithMicrosoft` en `es.json`/`en.json`, `MicrosoftIcon` ya exportado en `auth-forms.tsx`). Cuando se resuelvan los problemas de inicio de sesión en Azure, añadir `<button onClick={() => handleOAuth("azure")}>` junto al botón de Google en `auth-forms.tsx`.
- **Exportación de datos (CSV/Excel/PDF)**: funcionalidad de exportar datos de inventario, ventas, compras, ajustes, etc. — sin empezar, no existe ningún endpoint `/api/export/*` ni UI de exportar en las tablas todavía. (Distinto de la **importación** de productos, ya implementada — ver Sesión 2026-09-01. `papaparse`/`xlsx` ya están instalados y podrían reutilizarse para esta fase de exportación.)
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

1. **Config fiscal UI + API** (`facturas/config`): RFC, razón social, régimen, CP, PAC (finkok/swsapien), certificados, email. Guardar en `tenant_settings.configuracion_fiscal`. — ✅ hecho (página y campos existen; falta cargar credenciales **reales** de producción, ver sección Pendiente).
2. **Fix endpoints PAC de producción** (`pac-client.ts`). — ✅ hecho (`finkokEndpoint()` resuelve prod vs test según `PAC_TEST_MODE`, ya no hardcodea demo).
3. **Descarga XML/PDF**: APIs `facturas/[id]/xml|pdf` + botones en la tabla (solo facturas TIMBRADAS). — ✅ hecho (`src/app/api/facturas/[id]/xml|pdf`, botones en `facturas/[id]/page.tsx`).
4. **Historial de pagos** real en `/billing` (query a `payment_history`). — ✅ hecho (tabla de pagos en `/billing`).
5. **Cancelar suscripción** vía API Conekta + Dialog de confirmación. — ✅ hecho (`/api/conekta/cancel-subscription`).
6. **Vista detalle factura** (`facturas/[id]`). — ✅ hecho.
7. **Tests** de CFDI y APIs de facturación. — pendiente.

Solo queda pendiente el paso 7 (tests) y cargar credenciales fiscales reales de producción (paso 1).

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

---

## Autenticación por Clave (invite keys) + RBAC + Gestión de Usuarios (2026-08-27)

### Resumen del sistema

Sistema completo de autenticación por clave para empleados (CAJERO/ORG_ADMIN), gestión de usuarios (invitar/eliminar/cambiar rol), y control de acceso basado en roles (RBAC) a nivel sidebar + middleware.

### Arquitectura de la solución

**Flujo de invite key:**
1. SUPER_ADMIN invita desde `/users` → API genera clave de 8 caracteres (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`) → almacena en `user_invite_keys` → envía email branded via Resend
2. Invitado usa mismo email+clave cada vez que inicia sesión (la clave es **permanente**, no single-use)
3. `validate_invite_key()` RPC valida email+clave → retorna `tenant_id`
4. API crea/actualiza usuario en Supabase Auth con contraseña temporal (`Symvora{Date.now()}!`) → retorna credenciales al cliente
5. Cliente llama `signInWithPassword()` con token Turnstile → sesión creada

**Tablas DB:**
- `user_invite_keys`: `id`, `tenant_id`, `email`, `key` (8 chars, unique), `created_at`. Sin `used`/`used_at`/`expires_at` (eliminados en migración 037)
- RPC `validate_invite_key(email, key)`: matchea email+key → retorna `tenant_id`. Sin validación de uso/expiración.
- RPC `log_activity()`: triggers DB leen JWT via `current_setting('request.jwt.claims')` porque `auth.uid()` retorna NULL en contexto SECURITY DEFINER

**Supabase JS API (limitaciones conocidas):**
- `getUserByEmail` NO existe; usar `listUsers()` + `find()`
- `signInWithPassword` requiere token Turnstile (gated por `NEXT_PUBLIC_TURNSTILE_SITE_KEY`)

### RBAC — Niveles de acceso

| Módulo | SUPER_ADMIN | ORG_ADMIN | CAJERO |
|---|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ |
| POS | ✅ | ✅ | ✅ |
| Products | ✅ | ✅ | ✅ |
| Activity Log | ✅ | ✅ | ✅ |
| Reports | ✅ | ✅ | ✅ |
| Purchases | ✅ | ✅ | ❌ redirige |
| Purchase Orders | ✅ | ✅ | ❌ redirige |
| Finances | ✅ | ✅ | ❌ redirige |
| Facturas | ✅ | ✅ | ❌ redirige |
| Settings | ✅ | ✅ | ❌ redirige |
| Payments | ✅ | ✅ | ❌ redirige |
| Variants/Lots/Adjustments | ✅ | ✅ | ❌ redirige |
| **Users (crear/eliminar/cambiar rol)** | ✅ full | ✅ solo lectura | ❌ redirige |
| **Billing/Suscripción** | ✅ | ❌ redirige | ❌ redirige |

**Implementación:**
- `sidebar.tsx`: `minRole` por módulo. CAJERO solo ve 5 módulos; ORG_ADMIN ve todo excepto Users y Billing; SUPER_ADMIN ve todo
- `middleware.ts`: dos tiers de protección — `ADMIN_ONLY_PATHS` (ORG_ADMIN+) y `SUPER_ADMIN_ONLY_PATHS` (solo /billing). Redirige a `/dashboard` si el rol es insuficiente
- `users/page.tsx`: `canManage = myRole === "SUPER_ADMIN"` controla botón invitar, eliminar miembro, cambiar rol, revocar claves. ORG_ADMIN ve tabla en solo lectura
- `useCurrentTenant()` extiende con campo `role` desde `tenant_memberships`
- `src/lib/rbac.ts`: helper `hasRole()` con jerarquía CAJERO(1) < ORG_ADMIN(2) < SUPER_ADMIN(3)

### Archivos creados/modificados

**Nuevos:**
- `src/lib/rbac.ts` — helper `hasRole()` con jerarquía de roles
- `src/app/api/users/invite/route.ts` — API de invitación (genera clave + envía email)
- `src/app/api/users/[userId]/route.ts` — PATCH (cambiar rol) + DELETE (remover miembro)
- `src/app/api/users/keys/[keyId]/route.ts` — DELETE (revocar clave)
- `src/app/api/auth/key-login/route.ts` — API login por clave (valida RPC, crea auth user, retorna credenciales)
- `src/lib/email.ts` — `sendInviteKeyEmail()` plantilla HTML branded
- `supabase/migrations/036_user_invite_keys.sql` — tabla + `validate_invite_key()` RPC
- `supabase/migrations/037_permanent_invite_keys.sql` — claves permanentes (sin expiración/single-use)

**Modificados:**
- `src/hooks/use-current-tenant.ts` — extiende con `role` desde `tenant_memberships`
- `src/components/layout/sidebar.tsx` — `minRole` por módulo, Users + Billing → SUPER_ADMIN
- `src/lib/supabase/middleware.ts` — dos tiers: `ADMIN_ONLY_PATHS` + `SUPER_ADMIN_ONLY_PATHS` para /billing
- `src/components/auth/auth-forms.tsx` — sección UI login por clave (email + 8-char key + Turnstile)
- `src/app/(dashboard)/[locale]/users/page.tsx` — gestión completa: invitar, eliminar, cambiar rol, revocar claves. `canManage` para SUPER_ADMIN
- `src/app/(dashboard)/[locale]/dashboard/page.tsx` — fix scrollbar: charts siempre en DOM, ocultos con `invisible h-0 overflow-hidden`
- `src/messages/es.json` + `en.json` — traducciones para auth por clave, users, activity

### Commits realizados (este chat)

1. `eccb03c` — Fix lint (7→0 errors)
2. `ce4fe68` — Fix Select UUID display bug
3. `87c1ca3` — Auto-generación número de orden `OC-001`
4. `199913a` — Fix cash register "Abrir caja" (missing tenant_id)
5. `66a99ab` — Fix MovementTypes translation keys `ENTRY`/`EXIT` → `ENTRADA`/`SALIDA`
6. `fe91700` — Fix DropdownMenuTrigger `nativeButton` conflict
7. `7766554` — Activity log system (DB triggers)
8. `1229802` — Activity log frontend
9. `2de4611` — Activity page UI + pagination
10. `a9b2999` — Activity i18n (ES/EN)
11. `2753420` — Migration 037: permanent invite keys
12. `472b6b7` — Key-login API + dashboard scrollbar fix + auth UI + dashboard chart layout
13. `0a32fb4` — Key-login: removed `getUserByEmail` (not in Supabase JS API)
14. `a9c0600` — Key-login: proper `signInWithPassword` flow with Turnstile captcha
15. `8dc3d5b` — Auth page: key-login UI with email + 8-char key inputs
16. `19bc4a7` — Users page: delete members, change role, revoke keys, invite dialog
17. `781e3e2` — Restrict Users + Billing to SUPER_ADMIN only (sidebar, middleware, users page)

### Bugs conocidos / notas

- `next build` por Turbopack timeout (>120s). Usar `next build --webpack` o `npx tsc --noEmit` para verificar
- `supabase` CLI no instalado globalmente (solo via npx)
- Base UI `DropdownMenuTrigger` en `src/components/ui/dropdown-menu.tsx:18` defaulta `nativeButton={true}` — el padre NO debe pasar `nativeButton={false}`
- RLS requiere `tenant_id` en todos los INSERTs; falta causa fallos silenciosos
