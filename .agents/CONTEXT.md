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
├── supabase/migrations/        # 001-025 (schema, RBAC, onboarding, sales, legal, demo guards, conekta methods)
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
- **Tablas (19)**: tenants, tenant_settings, user_roles, tenant_memberships, productos, clientes, proveedores, ventas, detalle_ventas, compras, detalle_compras, cajas, movimientos_caja, activity_logs, subscriptions, payment_history, trial_codes, legal_acceptances, facturas/factura_detalle.
- **Funciones SQL clave**: `user_tenant_ids()`, `authorize()`, `custom_access_token_hook()`, `log_activity()`, `complete_onboarding()` (SECURITY DEFINER, valida `auth.uid()`), `complete_sale()` (SECURITY DEFINER atómico), `reset_demo_tenant()`, `is_demo_user()` / `current_user_is_demo()` (solo service_role).
- **Migraciones**: 001-025. Aplicar en Supabase SQL Editor con "Without RLS".

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
- **Refactor FDD (Fases 0-7)**: lógica extraída de páginas/lib hacia `src/features/` (pos, cash-register, customers, inventory, payments, facturacion) con barrels, services, hooks y componentes; `lib/{cfdi,conekta,mercadopago}` reubicados; `lib/fiscal-secrets.ts` conserva credenciales PAC; rutas API delgadas sobre `factura-service`; nuevo Combobox (Base UI, 0 deps) con `customer-selector` buscable + hook `use-customers`. Verificado: tsc limpio, 104 tests, lint baseline 188, build webpack (el build Turbopack tiene panic preexistente de sourcemaps → usar `next build --webpack`).
- **Facturación CFDI 4.0**: schema, catálogos SAT, XML, PAC, APIs create/stamp/cancel/list, UI `/facturas`.
- **Landing**: hero con PosMockup, features, FAQ (8 preguntas), CTA anual/mensual, WhatsApp, CompatibilityBar, footer legal.
- **Demo**: self-serve (`/demo` → magic link), banner `?demo=1`, aislamiento total (12 endpoints + UI restringida + 10 tests).
- **Seguridad**: `requireTenantAccess` en todas las APIs, webhook firmado, RBAC granular, RLS total, CAPTCHA Turnstile, headers (CSP, HSTS, nosniff, Referrer-Policy), `complete_sale` atómico con precio desde BD.
- **Legal (LFPDPPP)**: aviso de privacidad integral, términos 17 secciones, política de cookies, `legal_acceptances` (IP+UA+versiones), PolicyUpdateBanner post-login.
- **Calidad**: 104 tests Vitest, Playwright E2E, CI GitHub Actions.

### Pendiente
- **Google Search Console (verificar mañana)**: comprobar estado del sitemap `https://www.symvora.com.mx/sitemap.xml` (debe estar "Success"), usar URL Inspection → Request indexing en `https://www.symvora.com.mx/es`, y confirmar que `app.symvora.com.mx/*` aparece como "Excluded/noindex". Verificar antes que `/robots.txt` y `/sitemap.xml` responden en producción.
- Envío de correo con `@symvora.com.mx` (Resend Sending Domain + fusión SPF con `include:_spf.mx.cloudflare.net include:amazonses.com`) — solo si se quiere.
- Config fiscal de producción (RFC, PAC, certificados) — prerequisito para timbrar.
- Fix `pac-client.ts` `getEndpoint()` (retorna demo URL en producción).
- Locales hardcodeados en redirects (`auth-forms.tsx`, `billing/success`).
- Descarga XML/PDF de facturas + vista de detalle.
- Legal stubs en aviso de privacidad (`[Domicilio del responsable]`, `[privacidad@symvora.com]`).
- Env pendientes: `STITCH_API_KEY` (nota: `NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_SITE_URL` ya configurados en Vercel Production como app/www).
- **Conekta producción (2026-08-24)**: claves productivas configuradas en Vercel (`CONEKTA_PRIVATE_KEY`, `CONEKTA_PUBLIC_KEY`, `CONEKTA_WEBHOOK_PUBLIC_KEY`) y `CONEKTA_WEBHOOK_SECRET` legacy eliminado. Webhook fail-closed verificado (401 sin firma). Pendiente: registrar la URL del webhook en el dashboard de Conekta y prueba de pago real end-to-end.
- `role_permissions` con RLS deshabilitado (decidir si habilitar).
- **OAuth Microsoft (Azure) pendiente**: provider keys aún no funcionales en Supabase. UI preparada (`continueWithMicrosoft` en `es.json`/`en.json`, `MicrosoftIcon` ya exportado en `auth-forms.tsx`). Cuando se resuelvan los problemas de inicio de sesión en Azure, añadir `<button onClick={() => handleOAuth("azure")}>` junto al botón de Google en `auth-forms.tsx`.

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
3. **Descarga XML/PDF**: APIs `facturas/[id]/xml|pdf` + botones en la tabla (solo facturas TIMBRADAS). *(API XML/PDF ya delgadas sobre `factura-service`.)*
4. **Historial de pagos** real en `/billing` (query a `payment_history`). — ✅ hecho (tabla de pagos en `/billing`).
5. **Cancelar suscripción** vía API Conekta + Dialog de confirmación. — ✅ hecho (`/api/conekta/cancel-subscription`).
6. **Vista detalle factura** (`facturas/[id]`).
7. **Tests** de CFDI y APIs de facturación.

Orden sugerido: 1 → 2 → 3 → 4 → 5 → 6 → 7.
