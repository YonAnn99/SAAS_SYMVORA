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
├── supabase/migrations/        # 001-056 (schema, RBAC, onboarding, sales, legal, demo guards, conekta methods, referidos, códigos promo, hardening, auditoría, invite keys, IVA toggle, monto recibido, sugerencias, billing_period, security hardening, precio $399, RBAC billing/miembros — 034/035 reconstruidas el 2026-09-08, ver sesión abajo)
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

- **Enums (14)**: app_role, unidad_medida, metodo_pago (+`TARJETA_TERMINAL`, migración 016), estado_venta, estado_compra, estado_caja, tipo_movimiento (+`VENTA`, migración 018), estado_orden_compra, motivo_ajuste, subscription_status, payment_method (+7 valores en la 025), estado_factura, metodo_pago_cfdi, estado_cancelacion. (`billing_period` **no** es un enum de Postgres: es `TEXT` con `CHECK IN ('monthly','yearly')` — ver migración 047.)
- **Tablas (34, todas con RLS habilitado)**: verificado contra producción el 2026-09-10. Núcleo: tenants, tenant_settings, user_roles, role_permissions, tenant_memberships, productos, clientes, proveedores, ventas, detalle_ventas, compras, detalle_compras, cajas, movimientos_caja. Inventario avanzado: variantes_producto, stock_variantes, lotes, ajustes_inventario, ordenes_compra, detalle_orden_compra. Facturación: facturas, factura_detalle, facturas_folios, facturas_cancelaciones, factura_fiscal_secrets. Cobro/negocio: subscriptions, payment_history, codigos_promocionales, referidos, pagos_credito, pagos_terminal. Otras: activity_logs, legal_acceptances, user_invite_keys, sugerencias. (`trial_codes` eliminada en migración 029 — sistema muerto, reemplazado por códigos promocionales.) `codigos_promocionales` tiene RLS **sin políticas** a propósito: solo se toca por RPC SECURITY DEFINER o service role.
- ⚠️ El conteo de "19 tablas / 9 enums" que este documento traía hasta el 2026-09-10 llevaba tiempo desfasado. Antes de citar estas listas, confirmarlas contra `pg_class`/`pg_type`; se quedan viejas en cuanto entra una migración que no las actualice.
- **Funciones SQL clave**: `user_tenant_ids()`, `authorize()`, `custom_access_token_hook()`, `log_activity()`, `complete_onboarding()` (SECURITY DEFINER, valida `auth.uid()`), `complete_sale()` (SECURITY DEFINER atómico), `reset_demo_tenant()`, `is_demo_user()` / `current_user_is_demo()` (solo service_role), `validar_codigo_promo()` / `aplicar_codigo_promo()` (SECURITY DEFINER, migración 027).
- **Migraciones**: 001-056. Aplicar en Supabase SQL Editor con "Without RLS" (o vía MCP `apply_migration`). ⚠️ **034/035 no tenían archivo local** hasta el 2026-09-08 (se aplicaron con `apply_migration` sin comitear el `.sql` correspondiente) — reconstruidos desde el estado real de `log_table_changes()` en producción; si se detecta otro hueco así, reconstruir desde `pg_get_functiondef`/`information_schema` antes de asumir que "no pasa nada".

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
  - `demo.symvora.com.mx` → **demo pública** (host propio, ya en `PROD_HOSTS` del middleware y usado por el botón "Ver demo" del hero en producción). Tiene host separado de `app` a propósito: las cookies de sesión quedan acotadas por host, así que la sesión de demo no pisa la sesión real del usuario. Verificado en vivo (HTTP 200) el 2026-09-08.
  - `symvora.com.mx` (apex) → redirige 308 a `www` en Vercel.
  - `saas-symvora.vercel.app` → 308 a `www` (dominio de producción en Vercel = `www.symvora.com.mx`).
- **Host routing**: `src/lib/supabase/middleware.ts` — `PROD_HOSTS` = {app, www, apex}; en prod redirige 308 cruzado por host (rutas de app en `www` → `app`, rutas de marketing en `app` → `www`). No aplica en localhost ni previews.
- **noindex**: `src/middleware.ts` agrega `X-Robots-Tag: noindex, nofollow` a cualquier host que no sea `www`/apex (cubre `app.*`, previews `*.vercel.app`, dominio viejo). Además, `(dashboard)` y `(auth)` layouts tienen `robots.index=false`.
- **Env en Vercel (Production)**: `NEXT_PUBLIC_APP_URL=https://app.symvora.com.mx`, `NEXT_PUBLIC_SITE_URL=https://www.symvora.com.mx`. Fallbacks en código actualizados (site.ts, referrals.ts, create-checkout, email.ts logo).
- ⚠️ **Variables de entorno en Vercel requieren redeploy**: cambiar un valor en el dashboard de Vercel NO afecta un deployment ya corriendo — el runtime de la función serverless tiene el valor viejo hasta el próximo deploy. Aplica a **cualquier** env var (no solo `NEXT_PUBLIC_*`). Si "ya cambié la variable pero el bug sigue" → redeploy primero, no seguir depurando código.
- **Integración con Git de Vercel: se cayó y se restauró el 2026-09-11.** Durante unas horas, `git push` a `main` **no disparaba ningún deployment** — el push llegaba a GitHub y Vercel se quedaba quieto. Se resolvió reconectando el repositorio en `https://vercel.com/symvora/saas-symvora/settings/git`; verificado: el deployment siguiente salió solo al pushear. **Cómo detectar que volvió a pasar** (esto es lo reutilizable): (a) `vercel ls saas-symvora` y comparar la antigüedad del último deployment contra la del último commit; (b) `vercel project inspect` no muestra sección de repositorio Git; (c) **la señal más fiable** — un deployment disparado por Git recibe el alias `saas-symvora-git-main-symvora.vercel.app` (patrón `-git-<rama>-`), y uno hecho por CLI **no**; (d) los deployments por CLI no traen metadatos de commit/branch. Si vuelve a fallar, revisar en este orden: *Ignored Build Step* (un comando que devuelva 0 cancela cada build en silencio), Production Branch (`main`), y los permisos de la app de Vercel en GitHub → Settings → Applications.
- ⚠️ **Al desplegar a mano con `vercel --prod`, producción se construye desde el *working tree local*, no desde lo commiteado.** Cualquier archivo sin commitear se va a producción sin quedar registrado en el repo. Verificar siempre `git status` limpio y sincronizado con `origin/main` antes de un despliegue manual. Aplica cada vez que haya que saltarse la integración de Git.
- **Datos del proyecto en Vercel**: proyecto `saas-symvora` (`prj_HubI8UpiXW9qrjjxNzO4egb3MCvl`), team `SYMVORA-TEAM` (`team_Ocqwbj4bIMak3m7SrwIAc4b1`), framework Next.js, Node 24.x, build `npm run build` (que es `next build --webpack`). El CLI de Vercel está instalado globalmente y autenticado como `yonann99`.
- **Vercel Deployment Protection ("Vercel Authentication") en Preview** bloquea webhooks externos (Conekta, etc.) con 401 antes de llegar a la ruta — no se nota en pruebas manuales porque el navegador ya está autenticado con Vercel, pero un servicio externo (sin sesión de Vercel) rebota. Producción normalmente no tiene esta protección activa (rompería el acceso de clientes reales), pero **confirmar en Settings → Deployment Protection**, no asumir. Fix para Preview: Settings → Deployment Protection → "Protection Bypass for Automation" → generar secreto → agregarlo como query param `?x-vercel-protection-bypass=<secreto>` al final de la URL del webhook registrada en el proveedor externo.
- **Supabase Auth**: Site URL = `https://app.symvora.com.mx`; Redirect URLs incluyen `app/**`, `www/**`, apex, vercel.app.
- **Turnstile**: lista Hostname del widget incluye `app.symvora.com.mx`, `www.symvora.com.mx`, `symvora.com.mx`.
- **SEO**: locale `en` habilitado en `i18n/routing.ts` (es+en, `/en` live). `sitemap.ts` (`/es`, `/en`, legales — 8 URLs con hreflang), `robots.ts` (disallow `/api/`, `/es/demo`, `/en/demo`), `metadataBase` en layout raíz, canonical `/es` en landing + legales, imagen OG `public/og-symvora-v3.jpg` (1200×630, JPG para compatibilidad con WhatsApp/Meta).
- **Cloudflare Email Routing** (solo recepción): destino `jonattan10.99@hotmail.com`; alias `hola@symvora.com.mx` → hotmail. Envío con `@symvora.com.mx` (Resend Sending Domain) queda pendiente si se desea.
- ⚠️ **Demo**: corre en `demo.symvora.com.mx` (host dedicado; en `www` fallaría al redirigir a dashboard porque las cookies de sesión están ligadas al host). La ruta `/demo` también responde bajo `app.symvora.com.mx`, pero **la URL canónica para comunicación externa es `demo.symvora.com.mx`** — es la del CTA de la landing.

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
- Docs: `docs/social-strategy.md` (pilares, producción con IA, métricas, roadmap 90 días), `docs/social-calendar.md` (30 posts/4 semanas con hooks+copy+prompts IA), `docs/social-reels.md` (8 guiones de reels con VO ElevenLabs, organizados en 3 tiers de costo de producción + 1 reel legado obsoleto), `docs/social-carousels-posts.md` (8 carruseles + 11 posts estáticos + biblioteca de 43 hooks). **Actualizado 2026-09-05**: los 5 carruseles y el post SP5/SP8 originales mencionaban CFDI 4.0 (módulo ahora oculto) — se reescribieron los 5 carruseles con ángulos 100% vigentes (señales de necesitar un sistema, importación de catálogo, hábitos de control de dinero, simplicidad del POS, flujo de venta) y se corrigieron SP5/SP8. **Actualizado 2026-09-08**: se agregó una biblioteca de 43 hooks a `social-carousels-posts.md` (24 de video con los 3 componentes + on-ramp, 10 de portada de carrusel, 9 de post estático, incluido E9 de referidos con la mecánica verificada contra el webhook) construida con las skills `ad-creative/hook-system` y `social/short-form-video`, y se derivaron de ella 8 guiones de reels nuevos en `social-reels.md`. El reel legado "Todo en Uno" quedó marcado **OBSOLETO — no publicar**: tiene un bloque completo de facturación/SAT (11–15s) más menciones en solución y beneficio final, de cuando el módulo CFDI aún era visible.
- **Pilares 80/20:** EDU 35% (CFDI/SAT/control), Antes/Después 25%, Demo producto 25%, Promo+Referidos 15%.
- **Plataformas:** FB+IG base local, TikTok/Reels alcance, Shorts educación, WhatsApp conversión. LinkedIn/X NO prioritarios.
- **Producción 100% IA:** Higgsfield (video, clips 3-6s), ElevenLabs (VO es-MX), Gemini/ChatGPT (imágenes). Prompts piden **sin texto** (se superpone en CapCut). Para slides de producto usar capturas reales de la demo `app.symvora.com.mx/es/demo`.
- **Reglas:** hook de 3s (visual+verbal+texto), subtítulos ≤2 líneas/3-5 palabras, sin links en el cuerpo, consistencia > cantidad (5/sem).
- **Pendiente:** WhatsApp Business con número dedicado para CTA; 2FA en las 3 cuentas; prompts IA para cover de FB y portadas de highlights.

---

## Estado Actual

### Completado
- **Core**: dashboard (KPIs + 3 gráficas Recharts), productos CRUD, POS, compras/proveedores, caja, users/roles, activity logs, reports, settings, lots/variants/inventory-adjustments/purchase-orders.
- **Billing**: Conekta (checkout, webhook firmado, trial codes, subscriptions, payment_history), métodos actuales v2.3 (tarjeta/billeteras/SPEI/BBVA/efectivo en tiendas), historial de pagos en `/billing`. **Cobro anual + suscripciones recurrentes reales** (2026-09-07, ver sesión detallada abajo): toggle mensual/anual conectado de punta a punta, tarjeta crea una Subscription real de Conekta (cobro automático cada periodo, no una orden única), trial de 7 días abierto a toda cuenta nueva sin código promocional. Cancelar suscripción con diálogo de confirmación + encuesta de motivo + correo de baja al cliente y notificación a soporte. **Precio vigente (desde 2026-09-09): $399 MXN/mes o $3,588 MXN/año ($299/mes, 25% de ahorro)** — fuente única en `src/lib/pricing.ts`, planes de Conekta `-v3`; ver sesión 2026-09-08/09.
- **Códigos promocionales** (2026-08-24): migración 027, RPCs validar/aplicar, API `/api/promo/apply`, campo en signup (salta checkout de Conekta) y sección en `/billing`. Verificado en BD (7 tests SQL: válido, reuso, idempotencia, tenant ajeno, anon). Generación manual vía Supabase (ver sección "Códigos Promocionales").
- **Refactor FDD (Fases 0-7)**: lógica extraída de páginas/lib hacia `src/features/` (pos, cash-register, customers, inventory, payments, facturacion) con barrels, services, hooks y componentes; `lib/{cfdi,conekta,mercadopago}` reubicados; `lib/fiscal-secrets.ts` conserva credenciales PAC; rutas API delgadas sobre `factura-service`; nuevo Combobox (Base UI, 0 deps) con `customer-selector` buscable + hook `use-customers`. Verificado: tsc limpio, 104 tests, lint baseline 188, build webpack (el build Turbopack tiene panic preexistente de sourcemaps → usar `next build --webpack`).
- **Facturación CFDI 4.0**: schema, catálogos SAT, XML, PAC, APIs create/stamp/cancel/list, UI `/facturas`.
- **Landing**: hero con PosMockup, features, FAQ (8 preguntas), CTA anual/mensual, WhatsApp, CompatibilityBar, footer legal.
- **Demo**: self-serve (`/demo` → magic link), banner `?demo=1`, aislamiento total (12 endpoints + UI restringida + 10 tests).
- **Seguridad**: `requireTenantAccess` en todas las APIs, webhook firmado, RBAC granular, RLS total, CAPTCHA Turnstile, headers (CSP, HSTS, nosniff, Referrer-Policy), `complete_sale` atómico con precio desde BD.
- **Legal (LFPDPPP)**: aviso de privacidad integral, términos 17 secciones, política de cookies, `legal_acceptances` (IP+UA+versiones), PolicyUpdateBanner post-login.
- **Calidad**: 197 tests Vitest (16 archivos, incluye `product-import.test.ts` y `complete-sale.test.ts` con cobertura de `montoRecibido`), Playwright E2E, CI GitHub Actions.
- **Cuenta de prueba (2026-08-25)**: `pruebas@symvora.com.mx` / `dZsFT8bPvFIhYQcU` — usuario real (no demo) con tenant "Pruebas SYMVORA" (subdominio `pruebas`, código referido `SYMAB77A437`), OR_ADMIN, suscripción trial. Creada vía `scripts/create-test-account.ts` (Admin API, idempotente — re-ejecutar rota la contraseña) + `complete_onboarding` vía SQL. Sin bandeja real (`email_confirm: true`, ningún correo sale a terceros). Aislada por RLS; puede probar Conekta real (cobros reales — montos pequeños). Login por script lo bloquea Turnstile (esperado) — probar en navegador.
- **Legal**: stub de correo ya resuelto — `PRIVACY_EMAIL = "privacidad@symvora.com.mx"` en `src/lib/contact.ts` (real, no placeholder). Solo queda pendiente el domicilio físico (ver Pendiente).
- **CFDI**: config fiscal UI+API (`facturas/config`) completa (RFC, razón social, régimen, CP, PAC, certificados); descarga XML/PDF + vista de detalle (`facturas/[id]`) completas; `pac-client.ts` ya resuelve endpoint de producción vs pruebas correctamente (no hardcodea demo). Solo falta cargar credenciales fiscales reales y escribir tests (ver "Plan Pendiente: Módulo CFDI").
- **`role_permissions`**: RLS habilitado desde la migración `021_qa_role_permissions_rls.sql` (la nota de "decidir si habilitar" en versiones previas de este documento ya no aplica).

### Sesión 2026-08-31

- **PWA**: instalable + más rápida en mobile + catálogo del POS disponible sin conexión (dentro de la misma sesión ya abierta). `src/app/manifest.ts` (nombre, íconos 192/512 "any" + "maskable", `display: standalone`, colores de marca); service worker con **Serwist** (`src/app/sw.ts` + `@serwist/next` en `next.config.ts`, reemplaza a `next-pwa` que estaba instalado pero nunca conectado y es incompatible con Turbopack-dev de este proyecto; deshabilitado en dev, solo corre en el build de producción `--webpack`); `public/offline.html` estático (fuera del enrutado de Next/middleware) como fallback de navegación sin conexión, precacheado en el `sw.js` generado (⚠️ **este archivo se borró por accidente en el commit `f6555b1` y estuvo dando 404 en producción hasta el 2026-09-11, rompiendo el service worker entero — ver bug #29**); `useOnlineStatus()` (`src/hooks/use-online-status.ts`, nuevo) + caché en `localStorage` del último catálogo de productos del POS (`use-pos-catalog.ts`) para seguir viéndolo sin internet; "Completar venta" se bloquea explícitamente sin conexión (nunca se intenta completar una venta offline — decisión explícita para no arriesgar desincronizar stock). Íconos y splash screens (9 tamaños de iPhone/iPad) generados con `sharp` a partir del logo real `symvora-logo.webp`.
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

### Sesión 2026-09-05 — Módulo de Facturación (CFDI) deshabilitado temporalmente

Por decisión de negocio, el módulo de Facturación (CFDI 4.0) se ocultó "por el momento" — **no se borró código ni tablas**, solo se apagó el acceso. Para reactivarlo:

- **Dashboard**: quitar `hidden: true` de la entrada `layout.facturas` en `src/components/layout/sidebar.tsx`; volver a agregar la entrada `facturas` en `NAVIGATION_ITEMS` de `src/components/search/command-menu.tsx`; quitar `/facturas` de `DISABLED_PATHS` en `src/lib/supabase/middleware.ts`; cambiar `FACTURAS_MODULE_ENABLED` a `true` en `src/lib/feature-flags.ts` (usado por una guarda agregada al inicio de los 7 handlers bajo `src/app/api/facturas/**`).
- **Landing**: volver a importar y renderizar `<CFDISection />` en `src/app/[locale]/page.tsx` (el componente en `src/components/marketing/cfdi-section.tsx` no se tocó); volver a agregar los ítems quitados de `why-choose-us.tsx` (objeto `cfdi` en `benefits`, más el bloque de renderizado de `benefit.tags` que se eliminó — habría que restaurarlo desde git), `cta.tsx` (`"cfdi"` en `featureKeys`), `navbar.tsx` (`landing.nav.products.invoicing`), y el índice `"6"` de vuelta en `FAQ_KEYS` (`page.tsx`); volver a agregar `"CFDI"` a las listas de chips en `why-choose-us.tsx`/`business-types.tsx`.
- **Traducciones**: las keys `landing.cfdi.*`, `landing.whyChooseUs.cfdi.*`, `landing.cta.features.cfdi`, `landing.nav.products.invoicing`, `landing.faq.items.6.*` siguen intactas en `es.json`/`en.json` (nunca se borraron, mismo patrón que `landing.hero.eyebrow`). Sí se reescribieron (no solo se dejaron de usar, porque son texto siempre visible) `landing.footer.description`, `landing.hero.subtitle`, `landing.about.story` y `landing.demo.restricted.description` — habría que restaurar la mención a CFDI en esas 4 keys manualmente si se reactiva.
- **Metadata/SEO**: `src/app/[locale]/page.tsx` (metadata + JSON-LD), `src/app/layout.tsx` (metadata + JSON-LD) y `src/app/manifest.ts` tenían texto hardcodeado (no en JSON) mencionando CFDI — se reescribió directo, revisar el diff de este commit para restaurar el texto original si se reactiva.
- **Legales**: `terminos/page.tsx` y `aviso-privacidad/page.tsx` se reescribieron para quitar menciones a CFDI (timbrado, cancelación de comprobantes fiscales) sin renumerar las secciones — si se reactiva el módulo, revisar si esas cláusulas deben restaurarse tal cual o mantenerse genéricas.
- **Imagen OG (2026-09-05, resuelto)**: el usuario confirmó compartiendo el link real por WhatsApp que `og-symvora-v3.jpg` sí tenía "facturación CFDI" incrustado gráficamente. Se probaron un par de recreaciones generadas por código (`og-symvora-v4.jpg`/`v5.jpg`, HTML+captura de navegador, luego borradas por quedar obsoletas) antes de que el usuario aportara el diseño definitivo hecho por él mismo: `public/og-symvora.jpeg` (2848×1496, misma proporción 1.9:1 que el estándar OG de 1200×630). Las 4 referencias (`page.tsx` y `layout.tsx`, openGraph + twitter, incluyendo `width`/`height`) apuntan a ese archivo. `og-symvora-v3.jpg` (el original con CFDI) se dejó en `public/` sin borrar por si hace falta comparar/revertir.

### Sesión 2026-09-04 — Auditoría QA (navegador, producción) + fixes

Auditoría manual en `app.symvora.com.mx` con la cuenta de prueba real (login, POS, caja, compras, productos, importación, usuarios, RBAC con cuenta CAJERO real, checkout Conekta sin confirmar pago). 7 hallazgos críticos corregidos (ver lista numerada 12-17 en "Bugs Críticos Corregidos" arriba). Además:

- **Exportación de datos**: se descubrió que `src/components/ui/data-table-toolbar.tsx` (botones CSV/PDF) ya existe y funciona, pero solo está conectado en `/products` — corregido el estado documentado en "Pendiente" más abajo (antes decía "sin empezar", lo cual ya no era exacto).
- **Flash de sidebar con permisos incorrectos**: mientras `useCurrentTenant()` resuelve el rol (`role` es `null` unos cientos de ms tras cada navegación dura), `hasRole(null, minRole)` devuelve `false` para todos los ítems con `minRole`, así que el sidebar mostraba momentáneamente solo el subconjunto de CAJERO sin importar el rol real (visible en Finanzas, POS, Lotes, Settings, Compras, etc.). Fix: `sidebar.tsx` ahora muestra un skeleton (`animate-pulse`) mientras `loading` es `true` en vez de calcular `visibleNav`/`visibleInventory` con un rol aún no resuelto. No se tocó el mismo patrón en `header.tsx` (avatar con inicial "N" durante la carga) — cosmético de menor impacto, se dejó documentado pero sin arreglar.
- **Eventos `[EXCEPTION]` genéricos en consola en `/login`**: se observaron varias veces durante la sesión de auditoría (mensaje "Event" sin stack trace). No se encontró causa raíz reproducible — podría ser ruido del entorno de automatización (extensión de Chrome) más que un bug real de la app. Si vuelve a aparecer en uso normal (no automatizado), investigar con más detalle.


### Sesión 2026-09-07/08 — Cobro anual + suscripciones recurrentes reales, auditoría de seguridad, tutorial y reorganización de Configuración

Sesión larga con varios bloques de trabajo encadenados. Resumen por bloque (ver también los items 19-23 de "Bugs Críticos Corregidos" arriba para los hallazgos de seguridad/datos).

**SEO/GSC (inicio de sesión, antes de lo demás)**: diagnóstico y fix de "Duplicada: canónica diferente" en Search Console — `permanentRedirect` agregado en `src/app/page.tsx`. Verificado con `tsc`/`vitest`. Aparte, se investigó (sin cambio de código, es lag de índice) por qué la Vista IA de Google seguía mostrando "CFDI" y enlazando a Términos en vez del home: el sitio público ya no menciona CFDI en ningún lado (confirmado por grep — solo queda en el módulo interno de facturas, detrás de login, que Google no puede rastrear); es una instantánea vieja del índice de Google (~12 ago, coincide con la fecha de "actualizado" de la página de Términos que cita) — se le indicó al usuario resolver desde Search Console (solicitar indexación, reenviar sitemap), no había nada que arreglar en código.

**Cobro anual + suscripciones recurrentes reales (bloque grande)**:
- Toggle Mensual/Anual ya existía visualmente en la landing pero nunca estaba conectado a nada real — se conectó de punta a punta: `subscriptions.billing_period` (migración `047_billing_period.sql`, `TEXT` con `CHECK IN ('monthly','yearly')`, no es un enum de Postgres pese a que la lista de "Enums" arriba del documento lo mencione), toggle también agregado en `/billing` (`Método de Pago`), `create-checkout/route.ts` calcula monto/descripción según el periodo ($399 MXN mensual, $3,588 MXN anual = $299/mes, 25% de ahorro; actualizado 2026-09-08 — antes $400/$3,840).
- **Cobro automático real, no solo un checkout de una sola exhibición**: se completó infraestructura que ya existía a medias sin usarse (`src/features/payments/services/conekta/{plans,subscriptions}.ts`, columnas `conekta_subscription_id`/`conekta_card_id` en `subscriptions` desde la migración 006). Para tarjeta, `create-checkout` ahora crea el checkout con `checkout.plan_ids` (nueva función `createSubscriptionCheckout` en `orders.ts`) en vez de `line_items` — Conekta tokeniza/guarda la tarjeta y cobra sola cada periodo, sin necesidad de un formulario propio de tokenización. Efectivo sigue siendo pago único (Conekta no soporta suscripciones en efectivo).
- **Trial abierto a todas las cuentas nuevas**: `complete_onboarding` ya creaba el trial de 7 días server-side sin condición, pero `auth-forms.tsx` redirigía a Conekta automáticamente si no había código promocional. Se quitó ese redirect forzado — toda cuenta nueva entra directo al dashboard con su trial ya activo; el pago real ahora solo se ofrece desde `/billing`.
- Webhook (`src/app/api/conekta/webhook/route.ts`) completado: `subscription.created`/`subscription.paid`/`subscription.payment_failed`/`subscription.canceled` actualizan `current_period_start/end` **solo cuando el evento trae esos datos** (antes sobreescribían con `null` si un reenvío llegaba sin `billing_cycle_start/end`, borrando fechas ya correctas). El correo de "Pago confirmado" se manda en **cada** cobro completado (antes solo en el primerísimo pago de la cuenta — un cambio de plan mensual→anual en una cuenta ya existente se quedaba sin correo).
- `cancel-subscription/route.ts`: trata "recurso no encontrado" de Conekta (`resource_not_found_error`) como ya-cancelado en vez de error duro — Conekta solo permite una suscripción activa por cliente, así que un segundo intento de cancelar (ej. porque la sincronización local falló la primera vez) fallaba con 404 y bloqueaba todo.
- **Encuesta de motivo de cancelación + 2 correos nuevos**: al cancelar desde `/billing`, tras confirmar aparece un segundo diálogo pidiendo el motivo (6 opciones + "Otro" con texto libre). Al confirmar: `sendCancellationEmail` (al dueño, confirma la baja) y `sendCancellationFeedbackEmail` (a `soporte@symvora.com.mx`, nueva dirección en `src/lib/contact.ts`, con `reply-to` al cliente) — ambas nuevas en `src/lib/email.ts`, mismo patrón visual que las plantillas existentes.
- Correos: se quitó la mención de "CFDI 4.0" (obsoleta, el módulo está oculto) de las plantillas de bienvenida/pago confirmado.
- Depuración de infraestructura (dejó lecciones permanentes, ver sección "Dominios, Despliegue y SEO" arriba): Vercel Deployment Protection bloqueando el webhook en Preview con 401 (bypass token), variables de entorno de Vercel necesitan redeploy para aplicarse, y la llave pública del webhook (`CONEKTA_WEBHOOK_PUBLIC_KEY`) ahora se normaliza en código (`normalizePemPublicKey()` en `webhook/route.ts`) reconstruyendo el PEM desde cero sin importar cómo haya quedado pegada en Vercel (con `\n` literales, sin saltos de línea, etc.) — antes un pegado imperfecto rompía `crypto.verify()` con `DECODER routines::unsupported`.

**Auditoría completa de `supabase/migrations/` + hardening** (ver items 22-23 en Bugs Críticos): comparación archivo-local vs `list_migrations` remoto (sin drift funcional real, solo diferencias de nombre por reorganización de archivos), advisors de seguridad de Supabase revisados, dos archivos de migración faltantes reconstruidos (034/035), y migración nueva `048_security_hardening.sql` aplicada.

**Tutorial guiado del dashboard — rediseño y fixes** (`src/components/tutorial/`, `src/hooks/use-tutorial.ts`):
- El diálogo se cortaba porque calculaba su posición con una altura *estimada* fija en vez de medir el tamaño real renderizado (`tutorial-dialog.tsx` ahora usa un `ref` al `DialogContent` + `MutationObserver` + reintento en resize). Un bug de CSS aparte (márgenes negativos de `DialogFooter`, pensados para un `DialogContent` con padding, sobre un diálogo con `p-0`) cortaba los botones del pie en todos los pasos — se cancelan explícitamente con `mx-0 mb-0`.
- **Bug de fondo en la navegación automática**: `waitingForRoute` (qué decide si se muestra "Ir a X módulo") se calculaba con el `navigates` del paso que se estaba **dejando**, no del paso al que se **llegaba** — quedaba desfasado un paso. No se notaba en pasos que apuntaban al sidebar (siempre visible), pero rompía cualquier paso que apuntara a un botón específico de otra página. Rediseñado: ahora es reactivo en `TutorialProvider` (compara el paso actual contra la URL real cada vez que cambian), `next()` ya no recibe ni decide ese parámetro.
- Varios pasos apuntaban al selector equivocado: paso 6 usaba `document.querySelector("button")` genérico (agarraba el botón de colapsar sidebar, no "Agregar producto" — se le puso `id="tutorial-add-product-btn"`), pasos 7/9 asumían que "Abrir/Cerrar caja" vivía en Punto de Venta cuando en realidad vive en Finanzas (`id="tutorial-open-cash-btn"`/`"tutorial-close-cash-btn"` en `finances/page.tsx`), paso 13 apuntaba al mismo link de sidebar que el paso 2 en vez de a la pestaña "Módulos" específica (`id="settings-tab-modules"` en `settings/page.tsx`).
- El tutorial ahora se activa automáticamente la primera vez que alguien entra al sistema (antes solo vía el botón "Iniciar tutorial" del header) — detecta "nunca se tocó" por ausencia total de la key de localStorage `symvora_tutorial_step`, no solo "no completado". Botón minimizado subido de `bottom-6` a `bottom-20` (se sobreponía con el footer).

**Bitácora de actividad**: `ENTITY_KEYS` (`src/app/(dashboard)/[locale]/activity/page.tsx`) tenía `orden_compra` (singular) pero el trigger real (`log_table_changes()`) usa `TG_TABLE_NAME` = `ordenes_compra` (plural, el nombre real de la tabla) — cualquier registro de órdenes de compra tronaba la página entera con `MISSING_MESSAGE` porque el fallback pasaba el string crudo a `t()`. Se agregó la clave que faltaba y se hizo el lookup defensivo (si no hay mapeo, se muestra el texto tal cual en vez de llamar a `t()`) — protege contra cualquier otra entidad no mapeada a futuro, no solo esta.

**Reorganización de Configuración — módulo "Inventario"** (⚠️ **superado el 2026-09-11**: se movieron de nuevo, ahora a `/products`, ver esa sesión): "Variantes"/"Lotes"/"Ajustes" dejaron de ser una sección aparte del sidebar (quitada de `sidebar.tsx`) y pasaron a ser sub-pestañas de una tercera pestaña "Inventario" en `/settings`, junto a "General"/"Módulos" (`src/components/settings/inventory-settings-tab.tsx`, reusa tal cual los hooks/componentes de `@/features/inventory` que ya usaban las páginas originales). Las rutas viejas (`/variants`, `/lots`, `/inventory-adjustments`) se dejaron funcionando por si alguien las tiene guardadas — decisión explícita del usuario, no borrar esos archivos sin confirmar de nuevo. Nota aparte (no es bug): el selector de producto en Variantes/Lotes solo muestra productos con `permite_variantes`/`permite_lotes` activado individualmente en el formulario de producto (`product-dialog.tsx`, ver bug #13 de la lista de arriba) — si un producto no aparece ahí es por eso, no por la reorganización.


### Sesión 2026-09-08/09 — Cambio de precios: $399 mensual y 25% de ahorro anual

Precio nuevo: **$399 MXN/mes** y **$3,588 MXN/año** (equivale a $299/mes, ahorro de $1,200 = 25.1%). Antes era $400/mes y $3,840/año ($320/mes, 20%). Se eligió $3,588 sobre el 25% matemáticamente exacto ($3,591) porque $299/mes y "$1,200 de ahorro" son números comunicables; el 0.1% extra se paga solo en claridad de copy.

**Decisión de negocio: los suscriptores existentes conservan su precio viejo.** No se migró a nadie, y salió gratis porque no había ningún cliente real de pago. (Corrección del 2026-09-10: este párrafo decía que la única suscripción recurrente era la del tenant `aloo9`. Es falso — ese customer no existe en la Conekta de producción. La única suscripción viva estaba bajo `mercurial1099@gmail.com`, cuenta de pruebas del dueño, y se canceló.)

- **Fuente única de precio**: `src/lib/pricing.ts` (nuevo) exporta `SUBSCRIPTION_PRICE_CENTS` = `{ monthly: 39900, yearly: 358800 }`. Antes el monto vivía **duplicado en tres lugares que no se hablaban** (ver bug #24). Deliberadamente **no** vive en `conekta/config.ts`: ese módulo instancia el SDK de Conekta al importarse, y `lib/seo/structured-data.ts` (landing pública) también necesita el número.
- **Planes de Conekta bumpeados a `-v3`** (`symvora-basic-monthly-v3` / `symvora-basic-yearly-v3`). Es obligatorio en cada cambio de precio: Conekta no permite editar el monto de un plan existente. El historial de versiones quedó documentado como comentario en `config.ts`.
- **Guarda nueva en `plans.ts`**: cuando Conekta responde "el plan ya existe", ahora se consulta el plan con el `getPlan()` que estaba sin usar y se registra un `console.error` si el monto no coincide con el precio vigente. Es lo que habría delatado este problema las dos veces anteriores en vez de dejarlo pasar en silencio.
- **Webhook**: los 6 fallbacks `data.amount || 40000` se reemplazaron por `fallbackAmountCents(billing_period)`. No era cosmético: dos de esos valores alimentan **reembolsos** del crédito de referidos (`consumeFreeMonthCredit`), así que un fallback mensual sobre un cobro anual devolvía dinero incorrecto.
- **UI/i18n** (`es.json`/`en.json`): `priceMonthly` `$399`, `priceYearly` `$299`, `saveBadge` "Ahorra 25%"/"Save 25%", más las tres frases con el precio embebido en prosa (2 FAQ + el paso de billing del tutorial, este último solo en español porque `en.json` no tiene namespace `tutorial`). Se aprovechó para que `periodYearly` muestre el total anual ("MXN / mes · $3,588 facturado al año"): antes la UI nunca decía cuánto se cobra de una sola vez, un hueco de transparencia en un flujo de pago.
- **SEO**: `structured-data.ts` (JSON-LD `Offer` + `UnitPriceSpecification`) y la meta description de `[locale]/page.tsx`. Nota: el JSON-LD solo modela el plan mensual, no existe un `Offer` anual.
- **Migración `049_update_payment_amount_default.sql`** (aplicada vía MCP): `payment_history.amount` default `400.00 → 399.00`. Es un fallback muerto (todos los INSERT pasan `amount` explícito), se alineó por higiene.
- **Copy de marketing** (`docs/social-carousels-posts.md`): SP11 reescrito; el hook E6 pasó de "casi dos meses y medio gratis" a "tres meses gratis", que con el ahorro nuevo de $1,200 contra $399/mes ahora es exacto.
- **Verificación en producción (2026-09-09)**: las 4 rutas de cobro confirmadas contra la API real de Conekta — tarjeta mensual (plan `39900`), tarjeta anual (plan `358800`), efectivo mensual (`payment_history` = 399.00) y efectivo anual (3588.00). **Cero dinero cobrado**: todas las órdenes quedaron en `pending_payment`. Técnica usada: `ensurePlanExists()` corre en `create-checkout` **antes** del redirect, así que basta con iniciar el checkout y cerrar la pantalla de Conekta sin capturar tarjeta para crear y verificar el plan.
- ⚠️ **Las llaves de Conekta en `.env.local` son de PRODUCCIÓN** (`livemode: true`, verificado por API). Un checkout con tarjeta completado desde localhost cobra de verdad. Para pruebas reales de pago hay que cambiar a llaves de sandbox y reiniciar el dev server. Forma rápida de saber en qué modo estás: `curl -s https://api.conekta.io/plans -u "$CONEKTA_PRIVATE_KEY:" -H "Accept: application/vnd.conekta-v2.2.0+json"` y mirar `livemode` (las llaves no lo revelan por su prefijo).
- Quedaron varias referencias de efectivo en `payment_history` con `status: pending` de estas pruebas y de sesiones previas; se marcan `expired` solas cuando el webhook de producción recibe `order.expired`.

---

### Sesión 2026-09-10 — Auditoría completa + hardening RBAC de cobro y miembros

Análisis a fondo del sistema (código + migraciones + **estado real de producción vía MCP**) y corrección de los hallazgos por severidad. `tsc` limpio y 121/121 tests en cada paso.

**Escaladas de privilegio corregidas** (ver items 26 y 27 de "Bugs Críticos Corregidos"): un CAJERO podía cancelar la suscripción del negocio, y un ORG_ADMIN podía borrar permanentemente la cuenta del dueño. Migración `050_rbac_billing_members_hardening.sql` (aplicada vía MCP): permisos nuevos `subscription.manage` y `org.manage_members_write`, ambos **solo SUPER_ADMIN**, más las tres políticas RLS de escritura de `tenant_memberships`. Se optó por **añadir** permisos en vez de revocarle `org.manage_members` a ORG_ADMIN porque ese permiso también gobierna el `SELECT` de `user_roles`, y revocarlo le quitaría la vista de solo-lectura de usuarios que sí le corresponde.

**Limpieza de tenants huérfanos**: 9 de 14 tenants no tenían ningún miembro (`tenants` no tiene FK a `auth.users`, así que borrar el usuario deja tenant + suscripción vivos y sin dueño). Todos estaban vacíos — 0 productos/ventas/clientes/cajas/compras/facturas/referidos — y se borraron con un `DELETE` auto-limitado por ocho `NOT EXISTS`, que por construcción no podía alcanzar un tenant con datos. Quedan 5 tenants, todos con miembro. `Abarrotes Don Pedro` (el demo) figura con 0 SUPER_ADMIN **a propósito**: `reset_demo_tenant()` siembra al usuario demo como ORG_ADMIN y lo reaplica en cada reset, lo que lo mantiene fuera de `/billing` y de la gestión de usuarios.

**Conekta**: se canceló `sub_31hMZkCaYECAP9sKZ` (plan v1 `symvora-basic-yearly`, $3,840, en trial, a 4 días de cobrar). Ver la corrección en la sección "Dominios, Despliegue y SEO" sobre a quién pertenecía realmente. Estado final verificado contra la API: **0 suscripciones capaces de cobrar**.

**`key-login` paginado**: `listUsers()` sin argumentos devuelve solo la primera página (50 usuarios). Con >50 cuentas, un empleado existente fuera de esa página no se encontraba, se intentaba crear de nuevo y reventaba con 500 — habría roto el login por clave de todos los empleados sin aviso. Ahora `findUserByEmail()` pagina con `nextPage` y una cota dura de 100 páginas.

**Leaked Password Protection — cerrado el 2026-09-11 como "no aplicable"**: la opción vive en **Authentication → Providers → Email** (no en Policies, como decía una versión previa de esta nota) y la documentación oficial es explícita: *"Leaked password protection is available on the Pro Plan and above"*. El proyecto está en **Free**, así que el toggle no está disponible. Como mitigación sí se activaron en esa misma pantalla la longitud mínima y los caracteres requeridos, que sí funcionan en Free. El MCP de Supabase no expone configuración de Auth (solo BD/migraciones/advisors/edge functions/branches), así que aunque se suba a Pro el cambio es manual o vía Management API con un personal access token. Nota: las contraseñas temporales de `key-login` (`Symvora{timestamp}!`) cumplen cualquier combinación de esos requisitos, no se rompen. Menores sin tocar: `tenant-context.tsx` y `middleware.ts` eligen tenant con `.limit(1)` **sin `order`** mientras `custom_access_token_hook` usa `ORDER BY creado_en DESC` (inconsistente para un usuario con 2+ tenants, latente hoy); `demo/start` sigue con rate limit en un `Map` en memoria que no sobrevive a serverless.

---

### Sesión 2026-09-11 — Fallos en Safari/iOS, despliegue y conexión Git de Vercel

Reporte del usuario con capturas: la landing no cargaba al abrirla desde Instagram en iPhone (*"Safari no puede abrir la página porque se interrumpió la conexión de red"*) y la visualización del dashboard fallaba en iPhone/Safari. **Se descartó primero que fuera de red**: la cadena `symvora.com.mx` → `www` (308) → `/es` (307) → 200 responde bien en HTTP/2 en 1.2s con UA de iOS. En iOS ese mensaje (`NSURLErrorNetworkConnectionLost`) es el síntoma de que el proceso de WebKit se cayó, **no** de un error HTTP — no perder tiempo depurando red cuando aparezca.

Se encontraron **dos causas raíz independientes**, ambas corregidas y **verificadas en iPhone real el mismo día** (ver bugs #29 y #30): la landing carga desde Safari/iOS y el dashboard se ve bien en `/users` y `/billing`.

**Optimización de la landing (parcial, solo lo de riesgo cero)**: `logo-carousel` pasó a **server component** (era `"use client"` sin estado, efectos ni handlers: pura marquesina CSS), y en `src/components/ui/app-frame.tsx` tanto `BubbleMenu` como `VoiceNarrator` pasaron a `next/dynamic`. Esto último importa: `AppFrame` envuelve **toda** la landing e importaba `BubbleMenu`, que arrastra **gsap entero**, así que cada visita descargaba gsap solo por el menú móvil.

⚠️ **La migración fuera de `motion` se detuvo a propósito antes de empezar.** El plan original asumía que migrar los 8 componentes "presentacionales" quitaría el chunk de 242.9 KB. **Es falso**: `motion` lo importan 16 componentes, incluidos los 3 interactivos que el plan dejaba intactos y el `footer`, que ni figuraba. Mientras uno solo lo importe, el chunk se descarga igual (verificado tras el build: `5254-*.js` seguía ahí). Es todo o nada — ver el pendiente "Peso de la landing" con el inventario completo.

**Despliegue — la integración con Git de Vercel dejó de operar y se restauró el mismo día** (ver la sección "Dominios, Despliegue y SEO" arriba, que conserva las señales para diagnosticarlo si se repite). El usuario hizo commit y push, GitHub los recibió, y Vercel no desplegó nada. Se desplegó manualmente con `vercel --prod` (deployment `dpl_BXKrSXiMGTbv5En9zso8Td9kkbi1`, commit `e7e74fc`), verificando antes que el árbol estuviera limpio y sincronizado con `origin/main` para que producción coincidiera con el repo. Los 4 dominios respondieron 200.

**✅ Verificado en iPhone real (2026-09-11)**: tras el despliegue, la landing carga correctamente en Safari/iOS — el fallo "se interrumpió la conexión de red" desapareció. Comparación del `sw.js` desplegado antes/después: `/offline.html` pasó de **404 a 200**, las entradas de precache de **1 a 187** (o sea que el service worker ahora sí completa el `install`), `navigationPreload` a `false` y el cache `symvora-offline-fallback` presente. **Nota de método**: los arreglos de iOS no se pueden comprobar desde el entorno de desarrollo (la herramienta de navegador disponible es Chrome, otro motor). Al probar en iPhone hay que **borrar antes los datos del sitio** en Ajustes → Safari → Avanzado → Datos de sitios web: el service worker roto sigue registrado en el dispositivo y sobrevive al despliegue, así que sin ese paso el fallo puede persistir aunque el arreglo esté bien.

---

### POS Offline con sincronización automática (2026-09-11)

El POS puede cobrar sin internet y las ventas se suben solas al volver la conexión. **Alcance deliberado: solo ventas.** Las otras 48 operaciones de escritura del sistema siguen necesitando red — ampliarlo es un proyecto aparte (ver el pendiente correspondiente).

**Migración `051`** (aplicada en producción como `051a/051b/051c`, ver nota en el propio archivo). Columnas nuevas en `ventas`:

| Columna | Para qué |
|---|---|
| `idempotency_key` UUID | UNIQUE parcial. Ancla anti-duplicados: si la red se corta después de que el servidor insertó pero antes de que el cliente reciba la respuesta, el reintento devuelve la venta existente en vez de duplicarla. |
| `origen` | `'online'` / `'offline'`, con CHECK. |
| `requiere_revision` | Marca las ventas que necesitan mirada humana. Índice parcial para la bandeja. |
| `total_cobrado` | El total del ticket que se le entregó al cliente. |

`complete_sale` y `_crear_venta_desde_items` recibieron 5 parámetros nuevos (`p_idempotency_key`, `p_fecha_venta`, `p_caja_id`, `p_total_cobrado`, `p_origen`).

**Cuatro decisiones de diseño que hay que entender antes de tocar esto:**

1. **Stock negativo permitido en offline** (decisión de negocio del usuario). Dos cajeros sin red venden la última unidad: al sincronizar, ambas ventas entran, el stock queda negativo y las dos se marcan `requiere_revision`. Rechazar la segunda dejaría dinero cobrado sin registrar y la caja descuadrada — la venta ya ocurrió y no se puede deshacer. **La ruta online sigue abortando con "Stock insuficiente" exactamente como antes**; hay un test de regresión para eso.
2. **El precio se sigue recalculando desde `productos.precio_venta`** — la protección del bug #5 no se relajó ni siquiera offline. Si el precio cambió durante la ventana sin red, el total recalculado no coincidirá con el ticket físico: se guarda `total_cobrado` aparte y la diferencia marca `requiere_revision` en vez de desaparecer.
3. **`p_caja_id` es obligatorio conceptualmente para ventas offline.** La función buscaba la caja abierta *en el momento de ejecutarse*; una venta sincronizada horas después se habría colgado de la caja equivocada, o de la del día siguiente. El POS captura la caja al vender y la cachea. Si la caja no existe o es de otro tenant, la venta **no se pierde**: se registra y se marca para revisión.
4. **Sincronización en primer plano, NO con Background Sync**, ni siquiera en Android donde sí existe. El RPC necesita un JWT válido y los tokens de Supabase caducan (~1h); el service worker no puede refrescar la sesión de forma fiable porque el cliente de Supabase y su refresh token viven en el contexto de la página. Un reintento desde el SW fallaría con 401 y gastaría un intento. Se dispara con el evento `online`, al volver a la pestaña y al montar el POS.

**Cliente**: `src/lib/offline/queue.ts` (IndexedDB — `localStorage` no sirve: es síncrono, ~5 MB y volátil, y aquí se guarda dinero cobrado), `src/lib/offline/persist.ts` (`storage.persist()` + detección de PWA/iOS), `src/features/pos/hooks/use-sale-sync.ts` (orquestador) y `pending-sales-banner.tsx`.

**Reglas del cliente que no se deben relajar:**
- Una venta **solo** se borra de la cola cuando el servidor la confirma. Un fallo la conserva y suma un intento; al agotar `MAX_SYNC_ATTEMPTS` pasa a `failed` pero **sigue guardada**.
- Subida **secuencial y en orden de `createdAt`**, nunca `Promise.all`: cada venta descuenta stock y el histórico debe corresponder con lo que pasó en el mostrador. Si una falla, se corta en seco y se retoma en el siguiente disparo.
- **`navigator.onLine` no basta** — devuelve `true` con WiFi sin salida a internet, que es justo el caso de un local con el módem caído. Antes de vaciar la cola se confirma con un `HEAD` real a un estático propio.
- Si la sesión caducó offline, **no se descarta nada**: la cola queda intacta y el banner pide volver a iniciar sesión.

**Restricciones de UX**: sin red solo se cobra `EFECTIVO` y `TARJETA` (`OFFLINE_PAYMENT_METHODS` en `pos/page.tsx`). Quedan fuera `TARJETA_TERMINAL` (MercadoPago Point necesita red), `CREDITO` (hay que validar `saldo_pendiente` contra el servidor) y `TRANSFERENCIA` (el cajero no puede confirmar que el dinero llegó). Además **no se puede cerrar la caja con ventas sin subir** (`use-cash-register.ts`): el saldo esperado estaría incompleto y el corte no cuadraría nunca.

**Límite real en iOS que no se puede resolver con código**: Safari no soporta Background Sync y puede desalojar IndexedDB tras ~7 días sin uso. Instalar la PWA y `storage.persist()` lo mitigan pero **no lo garantizan**. Por eso el banner de pendientes no se puede descartar: es lo único que le dice a una persona "todavía no cierres el día". Si se toca la UI del POS, no esconderlo.

**Advertencias al usuario (añadidas el 2026-09-11)**: `src/lib/offline/capabilities.ts` es la **fuente única** de qué funciona sin conexión y de cuánta urgencia hay — el diálogo y el banner leen de ahí para no contradecirse cuando cambie el alcance. Si se amplía `OFFLINE_PAYMENT_METHODS` en `pos/page.tsx`, hay que actualizar esas listas: un test lo vigila.

- **Diálogo de bienvenida** (`src/components/pwa/offline-capabilities-dialog.tsx`, montado en `dashboard-shell.tsx`): sale **una sola vez** y **solo si la app corre como PWA instalada**, que es cuando alguien puede creer razonablemente que "ya todo funciona sin internet". Lista lo que sí y lo que no, **con el motivo de cada restricción** — sin el motivo la gente insiste. Evita el escenario malo: un cajero que da por hecho que puede vender a crédito sin red y lo descubre con el cliente delante.
- **Banner escalonado por antigüedad** (`evaluateOfflineRisk`): el tono sube con las horas que lleva esperando la venta más antigua — `ok` (<6h) → `atencion` (6h) → `urgente` (24h) → `critico` (72h). Los umbrales están **muy por debajo de los ~7 días** en que iOS puede desalojar el almacenamiento, para que nadie llegue ahí por descuido. Un aviso que dice siempre lo mismo se vuelve paisaje en dos días; uno que escala cuando el riesgo real sube, no. En `urgente`/`critico` el banner pasa a `aria-live="assertive"`.

**De paso se cerró un hueco**: `use-pos-catalog.ts` consultaba productos *y* clientes pero solo cacheaba productos, así que sin red la lista de clientes quedaba vacía. Ahora cachea productos, clientes y la caja activa, con compatibilidad hacia atrás para el formato viejo (un array pelado de productos).

**Dependencia nueva**: `fake-indexeddb` (solo dev) para poder testear la cola — jsdom no implementa IndexedDB.

---

### Ganancia sobre productos (2026-09-11)

Antes de esto **no existía ningún cálculo de ganancia en todo el sistema**: `costo_compra` se capturaba en el formulario de producto (obligatorio) pero no alimentaba nada, y Dashboard/Reportes/Finanzas mostraban solo **ingresos**.

**Migración `052`** (aplicada como `052a/052b/052c`). Columna `detalle_ventas.costo_unitario`, **nullable a propósito**: distingue "no se capturó el costo" de "el costo era cero", que es lo que permite excluir esas líneas en vez de contarlas como 100% de ganancia.

**Por qué se congela el costo al vender** (y no se cruza `productos.costo_compra` actual): si se calculara contra el costo vigente, cada actualización de costo —o sea, **cada compra a precio nuevo**— reescribiría la ganancia de todo el histórico. Un reporte de un mes cerrado dejaría de ser el mismo al volver a mirarlo. `detalle_compras` ya guardaba `costo_unitario` desde la 001; las ventas se habían quedado sin ese espejo.

**El cambio en `_crear_venta_desde_items` NO tocó la firma**, solo el cuerpo: la función ya leía `productos` en su bucle, así que bastó con añadir `costo_compra` a ese `SELECT` y arrastrarlo hasta el `INSERT`. Por eso se usó `CREATE OR REPLACE` sin `DROP`, y **no aplicaron** las trampas de los bugs #18 (overload huérfano) y #23 (grants perdidos) — verificado igualmente: una sola firma de cada función y `anon` sin acceso. El costo sale de la BD, nunca del cliente (protección del bug #5).

**`src/lib/profit.ts`** es la fuente única del cálculo para las cuatro pantallas. Dos reglas que no se deben relajar:

1. **El IVA no entra.** Todo se calcula sobre `detalle_ventas.subtotal` (pre-impuesto), **nunca** sobre `ventas.total`. El IVA se cobra para enterarlo al SAT: no es ingreso del negocio. La diferencia no es menor — en el tenant demo, 4,507 pre-IVA contra 11,847 de total con IVA.
2. **Costo nulo se excluye por completo**, ni su ingreso ni su costo entran. Incluir el ingreso sin el costo daría un margen artificialmente alto que nadie sospecharía. Un costo de **cero sí computa** (es un dato, no una ausencia).

**Margen ≠ markup** y se confunden constantemente: $15 con costo $10 son 33.3% de margen y 50% de markup. El formulario muestra ambos con su nombre porque poner precios creyendo que se gana 50% cuando se gana 33% es un error caro.

**Dónde se ve**: margen en vivo en `product-dialog.tsx` (avisa en rojo si el costo ≥ precio), columna de margen en `products-table.tsx` (guion si no hay costo, **nunca 100%**), sección de ganancias en `/reports` con desglose **ordenado por lo que más deja, no por lo que más factura**, y KPI "Ganancia del mes" en el Dashboard. El dashboard **no añadió consulta**: se amplió el `select` de `detalle_ventas` que ya existía para contar productos.

**Backfill del histórico**: se rellenó `costo_unitario` con el costo actual en las 84 líneas existentes. Seguro porque todas pertenecían al tenant demo y a la cuenta de pruebas del dueño — cero clientes reales. **No repetir** ese backfill si hay ventas de clientes reales sin costo: dejarlas en NULL.

⚠️ **Alcance**: esto es **margen bruto sobre producto**, no la utilidad del negocio — no descuenta renta, sueldos, luz ni la suscripción de SYMVORA. La UI lo dice explícitamente y no debe re-etiquetarse como "utilidad". Y el número solo vale lo que valgan los costos capturados: el aviso detecta productos **sin** costo, pero **no** puede detectar un costo desactualizado.

**Verificado contra producción**: tenant demo con 60 líneas → ingresos 4,507, costo 3,050, ganancia 1,457, margen 32.33%, contrastado con una cuenta a mano línea por línea en SQL.

---

### Inventario movido a Productos + RBAC real (2026-09-11)

Variantes, Lotes y Ajustes pasaron de ser una pestaña de `/settings` a ser pestañas de `/products` — es información de productos. **Una sola barra**: `[Catálogo] [Variantes] [Lotes] [Ajustes]`, sin anidar. Las rutas `/variants`, `/lots` e `/inventory-adjustments` quedaron como **redirects** a `/products?tab=…`, para que los enlaces guardados sigan funcionando y exista una sola interfaz que mantener.

El componente se movió de `components/settings/inventory-settings-tab.tsx` a **`features/inventory/components/inventory-tabs.tsx`** y ahora exporta `VariantsSection` / `LotsSection` / `AdjustmentsSection` por separado (el envoltorio con su propia `Tabs` se eliminó).

**Lo importante no fue el movimiento, sino lo que destapó.** `/products` es accesible para **CAJERO** (sin `minRole`, fuera de `ADMIN_ONLY_PATHS`) mientras que las rutas de inventario eran ORG_ADMIN+. Al comprobar si la base de datos respaldaba esos permisos resultó que **no lo hacía, en tres capas** — ver bug #33.

**Gating de la UI**: `showInventoryTabs = !tenantLoading && hasRole(role, "ORG_ADMIN")`. **No se pinta la barra hasta que el rol resuelve**, misma lección del fix del sidebar del 2026-09-04 (calcular con `role` aún en `null` mostraba unos cientos de ms el subconjunto equivocado). Cualquier `?tab=` de inventario cae de vuelta al catálogo si el rol no da. Este gate es **solo cosmético por sí mismo**: lo que protege de verdad es la migración 053.

**No se tocó `id="settings-tab-modules"`** en `settings/page.tsx`: el paso 13 del tutorial apunta a ese selector (`steps-data.tsx:174`).

**Este cambio no amplía ni recorta permisos**: el CAJERO no gana ni pierde acceso a nada que hoy pudiera ver. Lo que cambia es que ahora la base de datos lo respalda.

---

### Permisos por usuario: excepciones sobre el rol (2026-09-11)

El SUPER_ADMIN puede conceder o quitar módulos a un usuario concreto desde `/users` (botón "Permisos" → diálogo con switches). **Por defecto nada cambia**: sin excepciones, todo se comporta exactamente igual que antes — verificado contra la línea base (SUPER_ADMIN 17 permisos, ORG_ADMIN 14, CAJERO 4, idéntico antes y después).

**La decisión que sostiene el diseño**: 75 políticas RLS en 25 tablas llaman a `authorize()`. Haciendo que **esa** función consulte las excepciones, las 75 lo heredan sin tocar ninguna, y el permiso queda enforced en la base de datos en vez de solo en la interfaz. Migración `055`: tabla `user_permission_overrides` + `authorize()` reescrita (**sin cambio de firma**, así que `CREATE OR REPLACE` y no aplican los bugs #18/#23) + dos RPCs de permisos efectivos.

**Sidebar y middleware pasaron de decidir por ROL a decidir por PERMISO EFECTIVO.** Era obligatorio: si se hubieran quedado mirando el rol, un CAJERO con Finanzas concedido tendría el permiso en la base de datos pero no vería el módulo ni podría abrir la ruta. El sidebar usa `usePermissions()`, el middleware `get_effective_permissions_for_user()` (necesita la variante que recibe el usuario porque corre con `service_role`, donde `auth.uid()` es NULL).

**`src/lib/modules.ts` es la fuente única** de qué módulo exige qué permiso. Lo consumen las cuatro capas. ⚠️ **Trampa que costó un error durante la implementación**: `/products` (el catálogo) está **abierto a todo el equipo** — es lo que el cajero consulta para vender. El módulo "inventory" (variantes/lotes/ajustes) sí exige `inventory.manage`, pero vive como **pestañas dentro** de esa página, no como ruta propia. Mapear `/products` a `inventory.manage` deja a los cajeros sin catálogo. Hay un test que lo fija.

**Tres barreras independientes** sobre los permisos que reparten poder (`org.manage_members`, `org.manage_members_write`, `org.delete`, `subscription.manage`), porque en este repo la barrera única ya falló cuatro veces: el diálogo no ofrece el switch (`grantable: false`), el endpoint lo rechaza, y el `CHECK` de la tabla lo rechaza aunque se salten los dos anteriores. Verificado ejecutando los cuatro intentos contra la base.

**Candados de la UI y del endpoint**: nadie edita sus propios permisos ni los de otro SUPER_ADMIN. Se valida en el servidor, no solo ocultando el botón.

⚠️ **Limitación conocida y deliberada**: `authorize()` no recibe `tenant_id` (añadírselo obligaría a reescribir las 75 políticas), así que busca la excepción solo por `auth.uid()`. Hoy **cada usuario pertenece a un solo tenant**, así que es exacto. Si algún día hay usuarios en dos negocios, una excepción concedida en uno **se filtraría al otro** y habría que pasar a una firma con tenant. `get_effective_permissions()` sí acota por tenant y no tiene esa ambigüedad.

**Correcciones del mismo día, tras probarlo en el navegador:**

- 🐛 **Error 500 al conceder Compras** (`duplicate key ... purchases.manage`): `Compras` y `Órdenes de compra` eran dos módulos que apuntaban al **mismo permiso**, así que al activar ambos switches el permiso viajaba duplicado y chocaba con el `UNIQUE`. Se fusionaron en **un módulo con varias rutas**: `href: string | null` pasó a **`paths: string[]`**. Deduplicar en el endpoint no habría bastado — dos switches que controlan el mismo permiso son engañosos (si activas uno y desactivas el otro, el resultado es indefinido). Hay dedup defensivo igualmente, y **dos tests nuevos** que fijan los invariantes que faltaban: ningún permiso en dos módulos concedibles, y ninguna ruta en dos módulos. El test original comprobaba claves únicas, no permisos únicos: ahí estuvo el hueco.
- 🐛 **Conceder Inventario no surtía efecto**: `products/page.tsx` se quedó usando `hasRole(role, "ORG_ADMIN")` cuando el sidebar y el middleware pasaron a permisos. El permiso se guardaba pero la página nunca lo miraba. Ahora usa `can("inventory.manage")`, igual que `canImport`. **Fueron dos bugs seguidos por la misma causa** —cambiar el modelo de permisos sin revisar todos los consumidores—, así que quedó un `grep` de comprobación: el único `hasRole` que debe quedar fuera de `lib/rbac.ts` es el fallback del sidebar para rutas sin permiso mapeado.
- **Quitados del diálogo**: `Facturación CFDI` (módulo descartado) y `Cancelar ventas` (`sales.void` **no lo usa ninguna pantalla**; el permiso sigue en `role_permissions` gobernando la RLS de `ventas`). Sin `facturas` en el mapa, `/facturas` cae al chequeo por rol del middleware — mismo comportamiento que antes, sin regresión.
- **Botón "Restablecer"**: devuelve al usuario a lo que da su rol, sin excepciones. Manda `overrides: []`, que el endpoint ya interpretaba como "borra todo". Solo pide confirmación si hay excepciones que deshacer.

**Consecuencia para el dueño del negocio**: a partir de ahora **el rol ya no cuenta toda la historia**. Dos ORG_ADMIN pueden tener accesos distintos. Por eso el diálogo etiqueta cada módulo como **"por rol"** o **"manual"** — sin esa distinción, en unos meses nadie sabría por qué un usuario ve lo que ve. No quitar esas etiquetas.

---

### Venta por variante en el POS (2026-09-11)

El POS **ignoraba las variantes por completo**: `detalle_ventas` no tenía `variante_id` y `CartItem` no llevaba variante. Vender un producto con variantes descontaba el stock del **producto** y cobraba el precio del **producto**, dejando el stock por talla/color congelado para siempre.

Ahora, al agregar un producto que **tiene variantes creadas**, se abre un diálogo para elegir cuál. Migración `056`.

**Modelo de stock** (decisión del usuario): cada variante tiene **su propio anaquel** y el stock del producto pasa a ser el **"sin clasificar"**, del que salen las ventas generales (se pidió permitir ambas). **No se descuentan los dos** — serían dos cifras que cuadrar a mano, y ya estaban descuadradas (`sueter`: 50 en producto contra 5 en la variante).

**Detalles que importan:**

- **Solo se pregunta si el producto TIENE variantes creadas.** Uno marcado como `permite_variantes` pero sin ninguna (caso real: `Cafe`) se vende directo. Obligar a elegir lo dejaría invendible.
- **La variante forma parte de la IDENTIDAD de la línea del carrito** (`cartLineKey(productId, varianteId)`). Dos tallas del mismo producto son dos líneas separadas; fusionarlas vendería la cantidad total contra una sola variante. `removeItem`/`updateQuantity`/`updateDiscount` reciben ahora la **clave de línea**, no el `productId`.
- **Precio y costo: `0` en la variante significa "usa el del producto"**, para no repetirlos en cada talla cuando todas valen igual. El costo alimenta el cálculo de ganancia de la migración 052.
- **La firma del RPC no cambia**: la variante viaja dentro del JSON de items, así que `CREATE OR REPLACE` y no aplican los bugs #18/#23.
- **Seguridad**: el servidor valida que la variante pertenezca al producto **y** al tenant. Sin eso, un cliente manipulado podría mandar el id de una variante ajena y vender a su precio. Verificado con una prueba que lo intenta.
- El diálogo muestra el **stock y el precio de cada opción**, y las agotadas salen deshabilitadas. `fetchPosVariants` **no** filtra por stock > 0 a propósito: el cajero necesita poder ver que una talla está agotada, no que desaparezca.

**Verificado contra producción** (con `ROLLBACK`): vender la variante baja 5→3 y deja el producto en 50; vender general baja 50→47 y deja la variante intacta; el detalle guarda `variante_id` en el primer caso y `NULL` en el segundo; y una variante de otro producto se rechaza.

---

### Filtros y orden en el catálogo de productos (2026-09-11)

`/products` solo filtraba por texto y siempre ordenaba por nombre. Se añadió un botón **Filtros** (con contador de filtros activos) que abre un diálogo con tres bloques: **Ordenar** (9 opciones), **Categoría** y **Stock**.

**`src/features/inventory/stock-status.ts` es la fuente única.** Define tres grupos **mutuamente excluyentes que cubren todo**, así los conteos suman el total:

```
agotado   stock <= 0
bajo      0 < stock <= stock_minimo
ok        stock > stock_minimo
```

⚠️ **Corrigió una incoherencia real**: `products-table.tsx` pintaba la etiqueta con `stock_actual <= stock_minimo ? "Stock bajo" : "OK"`, regla que mete a los **agotados dentro de "stock bajo"** (0 <= mínimo es cierto). Un producto agotado decía "Stock bajo" en la tabla pero habría filtrado como "Agotado". Ahora la etiqueta tiene **tres estados** y lee de la misma función que el filtro, así que no pueden divergir — mismo patrón que `profit.ts` y `modules.ts`.

**Detalles que importan:**

- **El orden por defecto cambió de nombre a "Últimos creados"**, siguiendo la referencia del usuario. Es un cambio visible en la primera carga de la página.
- **Búsqueda y filtros se aplican EN CADENA**, no se sustituyen: buscar "coca" con el filtro "stock bajo" da las cocas por acabarse. En `use-products.ts` son dos `useMemo` encadenados.
- **Los conteos de los chips salen del catálogo COMPLETO**, no de lo ya filtrado. Si salieran de lo filtrado, marcar "stock bajo" pondría los otros dos en cero y no se podría volver atrás con criterio.
- **El diálogo trabaja sobre un borrador** y solo lo vuelca al pulsar Aplicar. Si cada clic filtrara la tabla de detrás, "Limpiar" no tendría sentido.
- **Todas las ordenaciones desempatan por nombre**, para que la lista no "salte" entre recargas cuando hay valores repetidos.
- **Sin `stock_minimo` definido (0, el valor por defecto) todo lo que tenga existencias sale "ok"** — sin mínimo no hay forma de saber qué es "poco", y no se inventa un umbral.

**Quedaron fuera dos cosas de la imagen de referencia**: **Favoritos** (no existe tal columna en `productos`; haría falta migración) y **Stock indefinido** (correspondería a `es_servicio` y no hay ningún servicio en la base — sería un chip que nunca filtra nada).

Filtrado y ordenación **en cliente**: `fetchProducts` ya trae todo el catálogo sin paginar. Con miles de productos el problema será esa carga completa, no este diálogo.

---

### Pendiente

> Re-verificado contra el código real el 2026-08-31 — varios puntos que seguían listados aquí ya estaban resueltos y fueron movidos a "Completado" o eliminados (ver sección "Sesión 2026-08-31" más abajo para el detalle de esa verificación).

- **Google Search Console (2026-08-25)**: ✅ sitemap.xml restaurado (`src/app/sitemap.ts` había sido eliminado en 57b6fd2 — daba 404) y verificado HTTP 200 en producción. Pendiente en GSC: reenviar sitemap (`www.symvora.com.mx/sitemap.xml`), Request indexing en `/es` y `/en`. Los avisos "Página con redirección" (host routing apex→www, marketing→app) y "Excluida por noindex" (app.*) son intencionales — no corregir. "Descubierta sin indexar" se resuelve sola con el sitemap + tiempo.
- Config fiscal de **producción** (RFC, PAC, certificados reales cargados en `/facturas/config`) — la UI/API ya existen (ver Completado), falta cargar credenciales reales; prerequisito para timbrar CFDI de verdad.
- Legal stub en aviso de privacidad: **`[Domicilio del responsable]`** sigue sin reemplazar (el correo `privacidad@symvora.com.mx` ya está resuelto, ver Completado).
- Env pendiente: `STITCH_API_KEY` (nota: `NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_SITE_URL` ya configurados en Vercel Production como app/www).
- **Conekta producción**: claves productivas configuradas en Vercel, webhook fail-closed verificado (401 sin firma), flujo de pago en efectivo probado end-to-end en producción (2026-08-31, ver Completado). Webhook de producción **ya configurado** (2026-09-08: URL correcta `app.symvora.com.mx/api/conekta/webhook`, todos los eventos seleccionados, llave de firma de producción en Vercel). ✅ **Resuelto el 2026-09-10** (ver sesión de esa fecha): la suscripción v1 viva se canceló y hoy hay **cero suscripciones capaces de cobrar** en la cuenta de producción, verificado contra la API. ⚠️ La versión anterior de este párrafo atribuía esa suscripción al tenant `aloo9` — **era incorrecto**: el `conekta_customer_id` guardado en esa fila (`cus_31hMekQXz6MHJLzfP`) ni siquiera existe en la Conekta de producción. La suscripción real estaba bajo `cus_31hMZRk6XEwy5nGXj` (`mercurial1099@gmail.com`), un customer que **ninguna fila de `subscriptions` referenciaba**. Lección: los `conekta_customer_id` de la BD pueden ser residuos de modo sandbox — verificar siempre contra la API (`GET /customers/{id}`) antes de dar por buena una relación tenant↔Conekta, y ojo con que la respuesta de error trae `object: "error"`, no `type: "error"`. Sigue pendiente **archivar** `symvora-basic-monthly-v2` (sin uso) y `symvora-basic-yearly` (v1, ya sin suscriptores).
- **Peso de la landing: salir de `motion` (2026-09-11)**: la landing publica sirve **968 KB de JS comprimido** (medido en produccion con UA de iOS) mas 208 KB de HTML, y el chunk mas pesado son **242.9 KB de la libreria `motion`**. Es un factor de riesgo en iPhone con datos moviles, pero **no era la causa raiz** de los fallos reportados en Safari/iOS: esas eran el service worker roto (`public/offline.html` devolvia 404 y hacia fallar el `install`) y la saturacion de contextos WebGL de `SpecularButton`, ambas corregidas el 2026-09-11. ⚠️ **Es todo o nada**: `motion` lo importan **16 componentes**, no los 8 "presentacionales" que uno esperaria. Mientras UNO solo lo importe, el chunk se descarga igual — verificado: tras migrar componentes sueltos, `5254-*.js` seguia en el build. Inventario de usos: `features` 82, `footer` 30, `cta` 30, `benefits` 29, `why-choose-us` 29, `business-types` 26, `hero` 25, `setup` 23, `faq` 20, `security-section` 20, `about-us` 10, `pos-mockup` 8, `trusted-by` 8, `compatibility-bar` 6, `navbar` 4, `whatsapp-fab` 2. El trabajo tampoco es solo "reveal al hacer scroll": hay **68 `animate`**, **16 `whileHover`**, **6 `repeat: Infinity`** y `features.tsx` anima barras por dato (`animate={{ height: "${h}%" }}`), asi que un `<Reveal>` con IntersectionObserver no cubre el caso. Si se acomete, hacerlo por fases con revision visual entre cada una y empezando por `features` como piloto. **Es el cambio de mayor superficie visual de todo el proyecto** — no emprenderlo sin tiempo para revisar la landing entera.
- **Peso de la landing: diferir secciones bajo el fold (2026-09-11)**: alternativa de mucho menor riesgo al punto anterior, con ahorro parcial. Cargar con `next/dynamic` las secciones que viven bajo el fold (`benefits`, `setup`, `about-us`, `security-section`, `business-types`) para que su JS deje de bloquear la carga inicial, **sin tocar ninguna animacion**. No elimina el chunk de `motion` (ver arriba), solo lo saca de la ruta critica. Ya aplicado con este patron en `src/components/ui/app-frame.tsx`: `BubbleMenu` (arrastraba `gsap` entero en cada visita solo por el menu movil) y `VoiceNarrator` pasaron a `next/dynamic` el 2026-09-11 — usar eso como referencia. Ojo: no diferir `hero` ni nada sobre el fold, perjudica LCP y SEO.
- **Ampliar el modo offline más allá de las ventas (2026-09-11)**: hoy solo `complete_sale` funciona sin conexión (ver la sección "POS Offline"). Las otras **48 operaciones de escritura** (11 servicios) siguen necesitando red: movimientos y apertura/cierre de caja, compras a proveedor, productos, clientes, lotes, variantes, ajustes de inventario y órdenes de compra. La infraestructura reutilizable ya existe (`src/lib/offline/queue.ts` es genérica salvo por el tipo `PendingSale`), pero **cada entidad trae su propia política de conflictos**, que es la parte difícil y no la técnica: qué pasa si se cierra una caja offline y el servidor ya tiene movimientos posteriores, o si una compra mueve stock que otra venta offline ya movió. No emprenderlo sin decidir esas políticas una por una con el dueño del negocio, igual que se hizo con el stock negativo de las ventas.
- **OAuth Microsoft (Azure) pendiente**: provider keys aún no funcionales en Supabase. UI preparada (`continueWithMicrosoft` en `es.json`/`en.json`, `MicrosoftIcon` ya exportado en `auth-forms.tsx`). Cuando se resuelvan los problemas de inicio de sesión en Azure, añadir `<button onClick={() => handleOAuth("azure")}>` junto al botón de Google en `auth-forms.tsx`.
- **Exportación de datos (CSV/Excel/PDF)**: **corrección (2026-09-04, auditoría QA en navegador)** — ya existe un componente reutilizable `src/components/ui/data-table-toolbar.tsx` (botones CSV/PDF, usa `src/lib/export/csv.ts` y `pdf.ts`), pero **solo está conectado en `/products`** — ningún otro listado (ventas, compras, ajustes, movimientos de caja, clientes/proveedores) lo usa todavía. Tampoco existe ningún endpoint `/api/export/*`, streaming para datasets grandes, ni exports programados (Fase 3). Pendiente real: conectar `DataTableToolbar` a las demás tablas (Fase 2 del plan original) y construir la infraestructura de Fase 1/3 si se necesita exportar más de lo que cabe en memoria del navegador. (Distinto de la **importación** de productos, ya implementada — ver Sesión 2026-09-01.)
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
12. **Password en texto plano en consola del navegador** (login por clave, 2026-09-04): `auth-forms.tsx` hacía `console.log` de la respuesta completa de `/api/auth/key-login`, incluyendo la contraseña temporal generada server-side. Fix: log eliminado. No volver a loguear el `data` completo de esa respuesta.
13. **Módulos Lotes/Variantes inutilizables** (2026-09-04): el selector de producto en "Crear lote"/"Crear variante" filtra por `productos.permite_lotes`/`permite_variantes` (columnas a nivel de producto), pero el diálogo de crear/editar producto no tenía ningún control para activarlas — el toggle de "Configuración → Módulos" es solo a nivel tenant y no basta. Fix: switches "Maneja lotes y fecha de caducidad" / "Maneja variantes" agregados a `product-dialog.tsx`. No quitar sin dar otra forma de setear esos dos campos por producto.
14. **Importación de productos: duplicados intra-archivo tumbaban el chunk completo** (2026-09-04): dos filas nuevas con el mismo código de barras en el mismo archivo se marcaban ambas "Nuevo"; al insertar, el conflicto de `uq_productos_tenant_codigo_barras` hacía fallar el chunk entero (250 filas), incluidas filas válidas no relacionadas. Fix: `import-row-processor.ts` detecta duplicados dentro del propio archivo y marca las repeticiones como inválidas antes de insertar.
15. **Compras y caja sin validación mínima** (2026-09-04): se podía crear una compra con total negativo, abrir caja con fondo inicial negativo, y registrar movimientos de caja con monto $0 y descripción vacía — nada de esto estaba bloqueado pese a que los schemas Zod correspondientes (`cashRegisterOpenSchema`, `cashMovementSchema`, etc. en `lib/validations/schemas.ts`) ya existían pero nunca se conectaron a los diálogos. Fix: validaciones agregadas directamente en `use-purchases.ts`/`use-cash-register.ts` (no se conectó Zod, se optó por checks explícitos consistentes con el resto del código de esos hooks).
16. **Invitación de usuarios sin validar formato de email** (2026-09-04): tanto el cliente (`users/page.tsx`) como `api/users/invite/route.ts` solo chequeaban que el campo no estuviera vacío — se podía invitar a "asd" y se generaba una clave real. Fix: regex de email agregado en ambos lados.
17. **Banner de pago pendiente permanente** (2026-09-04): una referencia de pago en efectivo (OXXO/Efectivo Conekta) que vence sin pagarse dejaba su fila en `payment_history` en `status: "pending"` para siempre — el webhook nunca manejaba `order.expired`/`order.canceled`. Esto hacía que `/billing` mostrara "Pago en proceso" incluso con la suscripción ya `active` por otro medio. Fix: banner oculto si `subscription.status === "active"`, y el webhook ahora marca esas filas como `"expired"` al recibir esos eventos.
18. **`complete_onboarding` con overload fantasma: el fundador quedaba `ORG_ADMIN` en vez de `SUPER_ADMIN`** (2026-09-05): la migración 023 (referidos) creó `complete_onboarding` con 8 parámetros (incluye `p_referral_code`) hardcodeando 'ORG_ADMIN' para el fundador. La migración 038 ("fix roles first user superadmin") corrigió la lógica pero solo recreó la firma de **7** parámetros — una función huérfana que nada llama. El signup real (`auth-forms.tsx`) siempre pasa `p_referral_code`, así que siempre resolvía al overload de 8 parámetros nunca corregido. Confirmado en producción: 2 tenants reales (`LA GOMA`, `Abarrotes Don Pedro`) sin ningún `SUPER_ADMIN`. Fix (migración `044_fix_complete_onboarding_referral_overload.sql`, aplicada directo a producción vía MCP): se recreó el overload de 8 parámetros con la lógica correcta, se eliminó el de 7 (para no dejar una segunda copia sin uso), y se repararon los tenants ya afectados (promovidos a `SUPER_ADMIN` en `tenant_memberships` y `user_roles`). **Lección**: Postgres permite overloading por firma — al "arreglar" una función con `DROP FUNCTION IF EXISTS` + `CREATE`, verificar SIEMPRE cuál firma llama realmente el código (`grep` del RPC en `src/`) antes de asumir que se corrigió, y no dejar funciones huérfanas con lógica vieja sin usar.
19. **Links de referidos apuntando a `localhost:3000` en producción** (2026-09-07): `NEXT_PUBLIC_APP_URL` mal configurada en Vercel Production (valor de prueba filtrado). `getReferralSignupUrl()` (`src/lib/referrals.ts`) y `getSiteUrl()`/`getAppUrl()` (`src/lib/site.ts`) ahora tienen un guard `resolveUrl()` que ignora el valor de la env var si contiene `localhost` estando en `NODE_ENV=production`, cayendo al dominio real hardcodeado. No quitar ese guard aunque la env var ya esté bien — es la última línea de defensa contra este mismo error volviendo a pasar.
20. **Conekta: nombre del cliente rechazado por formato** (2026-09-07): `create-checkout/route.ts` mandaba `tenant.nombre_comercial` (texto libre del negocio, puede tener dígitos/símbolos) como `name` del Customer — Conekta lo rechaza con `parameter_validation.name.invalid` si no "parece" nombre de persona, tumbando el checkout completo. Fix: usa primero el nombre real del dueño (`user_metadata.nombre` del signup) y sanea el resultado (solo letras/espacios) antes de mandarlo. No volver a mandar `nombre_comercial` crudo a Conekta.
21. **Webhook de Conekta: reintentos duplicaban `payment_history` y reenviaban el correo de bienvenida** (2026-09-07): `subscription.created`/`subscription.paid` insertaban una fila nueva cada vez que Conekta reintentaba la entrega (sin `200` no confirma), sin revisar si ese `conekta_order_id` ya se había registrado — a diferencia de `order.paid`, que sí lo hacía. Fix: mismo chequeo idempotente (`.eq("conekta_order_id", ...).eq("status", "completed")`) antes de insertar Y antes de disparar el correo/conversión de referido. No quitar ese chequeo — Conekta reintenta agresivamente mientras no reciba 200.
22. **Plan de Conekta con trial duplicado** (2026-09-07): `ensurePlanExists()` (`src/features/payments/services/conekta/plans.ts`) copiaba `trial_period_days: 7` al plan de Conekta, pero SYMVORA ya maneja su propio trial de 7 días a nivel de app (`subscriptions.trial_end`) antes de que el usuario llegue a "Pagar con tarjeta" — el resultado era un trial duplicado que retrasaba 7 días el primer cobro real incluso para quien decide pagar de inmediato. Fix: `trial_period_days: 0` en el plan de Conekta. Los IDs de plan se renombraron a `symvora-basic-monthly-v2`/`symvora-basic-yearly-v2` (en `config.ts`) para forzar que Conekta cree planes nuevos limpios — los viejos (`symvora-basic-monthly`/`symvora-basic-yearly`, con el bug) quedaron huérfanos en Conekta, no borrar ni reusar esos IDs. **Actualización 2026-09-09**: con el cambio de precio los IDs pasaron a `-v3`; `symvora-basic-yearly-v2` nunca se creó realmente en Conekta.
23. **Permisos `anon` en funciones `SECURITY DEFINER` + `log_activity()` sin `search_path` fijo** (2026-09-08, auditoría completa de migraciones): `complete_sale`, `get_current_user_email`, `get_tenant_members`, `log_table_changes`, `registrar_pago_credito`, `validate_invite_key` eran ejecutables por `anon` pese a que la migración 039 ya había hecho `REVOKE` para `get_tenant_members` — una redefinición posterior (probablemente `CREATE` en vez de `CREATE OR REPLACE`) restableció el privilegio por default de Postgres (`EXECUTE` a `PUBLIC` en funciones nuevas). `log_activity()` además era `SECURITY DEFINER` sin `search_path` fijo (vector de escalación de privilegios). Fix en migración `048_security_hardening.sql`: `REVOKE ... FROM PUBLIC, anon` + `GRANT ... TO authenticated` explícito en esas 6 funciones, y `ALTER FUNCTION log_activity(...) SET search_path = public`. Si se vuelve a redefinir alguna de estas funciones con `DROP` + `CREATE` (no `CREATE OR REPLACE`), reaplicar el `REVOKE`/`GRANT` — no asume que sobrevive automáticamente.

24. **El precio de la suscripción vivía duplicado en 3 fuentes independientes** (2026-09-09): el mismo monto estaba hardcodeado en `conekta/config.ts` (`CONEKTA_PLAN_AMOUNTS`, usado **solo** para tarjeta al crear el Plan), en `create-checkout/route.ts:171` (literal aparte, usado **solo** para efectivo/transferencia vía `line_items`) y en `lib/seo/structured-data.ts` (JSON-LD público). Cambiar una sin las otras hacía que **tarjeta y efectivo cobraran montos distintos** sin que nada fallara ni avisara. Fix: `src/lib/pricing.ts` como fuente única, importada por las tres. No volver a escribir un monto de suscripción a mano en ningún archivo — importarlo siempre de `pricing.ts`.
25. **`setState` con navegación dentro del updater en `/billing/success`** (2026-09-09): `page.tsx` llamaba `router.push()` **dentro** de la función updater de `setCountdown`. React ejecuta los updaters durante el render, así que navegar ahí disparaba `Cannot update a component (Router) while rendering a different component`. Fix: se separó en dos efectos — uno hace el tick del contador con `setTimeout`, otro observa `countdown === 0` y navega. Regla general: nunca llamar `router.push()` (ni ningún setState de otro componente) dentro de un updater de estado.
26. **Un CAJERO podía cancelar la suscripción del negocio** (2026-09-10): dos fallas que se sumaban. (a) `SUPER_ADMIN_ONLY_PATHS = ["/billing"]` en `middleware.ts` era **código muerto**: `/billing` cae en `isPublicRoute` (necesario por el bug #9, el redirect loop), y todo el bloque de RBAC vivía dentro de `if (user && !isAuthRoute && !isPublicRoute)`, así que nunca se evaluaba. (b) `cancel-subscription`, `create-checkout` y `promo/apply` llamaban `requireTenantAccess()` **sin `permission`**, o sea bastaba con ser miembro del tenant. Resultado: el rol de menor privilegio escribía la URL, entraba a `/billing` y daba de baja el servicio de todo el negocio. Fix: `isBillingRoute` nuevo en el middleware — el chequeo de **rol** ahora corre también en `/billing` (no puede ciclarse porque redirige a `/dashboard`, otra ruta), mientras que el chequeo de **suscripción** se salta esa ruta explícitamente para no reabrir el bug #9; y los tres endpoints exigen `subscription.manage`. No volver a meter el chequeo de rol dentro de la condición de `isPublicRoute`.
27. **Un ORG_ADMIN podía borrar permanentemente la cuenta del dueño** (2026-09-10): `role_permissions` concede `org.manage_members` a SUPER_ADMIN **y** ORG_ADMIN, y era el único permiso que exigían las 4 rutas de gestión de usuarios. La UI restringe a SUPER_ADMIN (`canManage` en `users/page.tsx`) pero eso es cosmético: un `DELETE` directo a la API pasaba. Peor todavía, las políticas RLS de `tenant_memberships` (INSERT/UPDATE/DELETE) usaban el mismo permiso, así que el ORG_ADMIN podía manipular membresías **por PostgREST sin tocar la API**. Y `supabase.auth.admin.deleteUser()` es **global, no por tenant**: sacar a alguien de un negocio le borraba la cuenta entera y con ella el acceso a cualquier otro negocio. Fix (migración 050 + código): permiso nuevo `org.manage_members_write` SUPER_ADMIN-only en las 4 rutas y en las 3 políticas de escritura; `DELETE` ahora rechaza eliminar al único SUPER_ADMIN del tenant y solo borra la cuenta de auth si al usuario no le queda **ninguna otra membresía**. Al cerrar una escalada de privilegios, revisar SIEMPRE si el mismo permiso gobierna además una política RLS — cerrar solo la ruta HTTP deja PostgREST abierto.
28. **Cambiar el rol de un usuario borraba su `user_metadata`** (2026-09-10): `api/users/[userId]` PATCH hacía `updateUserById(userId, { user_metadata: { role } })`, y eso **reemplaza el objeto completo**, no mezcla. Se perdía `nombre`, justo el campo que `create-checkout` usa para el nombre del cliente de Conekta — o sea que a cualquier usuario al que se le cambiara el rol se le reintroducía el bug #20 (checkout tumbado con `parameter_validation.name.invalid`). Fix: leer el metadata actual con `getUserById` y hacer spread antes de escribir.
29. **Un archivo estático borrado dejó el service worker roto en producción durante días** (2026-09-11): `public/offline.html` se borró como daño colateral en el commit `f6555b1` ("Mejora en el opengraph"), pero `sw.ts` lo seguía declarando como fallback de navegación y era la **única entrada de precache** del service worker. El archivo devolvía **404**, así que el precaching fallaba, el evento `install` se rechazaba y **el service worker nunca se activaba**. En escritorio eso pasa desapercibido; en Safari/iOS las peticiones de navegación terminaban en "se interrumpió la conexión de red". Agravado por `navigationPreload: true`, una API que Safari soporta tarde y mal y que aplica justo a las navegaciones. Fix: archivo restaurado desde `f6555b1^`, `navigationPreload: false`, y un handler `install` propio que cachea la página offline en `symvora-offline-fallback` dentro de un `try/catch` — **un estático opcional no debe poder tumbar el arranque de la PWA**. Señal de diagnóstico: el `sw.js` desplegado tenía **1 sola entrada de precache**; un build sano tiene ~187. Si el service worker vuelve a comportarse raro, contar las entradas de precache antes que nada.
30. **Saturación de contextos WebGL en iOS por los botones Specular** (2026-09-11): `SpecularButton.tsx` hace `new Renderer()` de `ogl` **por instancia**, o sea un contexto WebGL por botón. Hay 67 instancias y hasta **11 en una sola página** (`users`, `billing`), cuando **Safari/iOS admite ~8 contextos simultáneos**: al pasarse descarta los más antiguos (canvas en blanco) y puede tumbar el proceso de GPU junto con la página. Encima `specular-action-button.tsx` pone `autoAnimate = true` por defecto, así que los 11 corrían un bucle `requestAnimationFrame` a 60fps aunque estuvieran fuera de pantalla y sin hover. Fix: el componente detecta `(hover: hover)` y `prefers-reduced-motion` tras montar (en `useState` inicializado en `false` para no romper la hidratación SSR) y **en táctil no crea el contexto, no monta el canvas ni arranca el rAF**; el borde de `lineColor` se repone con un ring CSS inset que no altera el layout. En escritorio el comportamiento es idéntico al anterior. **✅ Verificado en iPhone real (2026-09-11)**: `/users` y `/billing` (las dos páginas con 11 botones, las peores del sistema en este aspecto) se ven correctamente, sin canvas en blanco ni recargas. **No aplicar este botón a elementos repetidos** (filas de tabla, listas): el límite de contextos es del navegador, no del componente. El cleanup con `WEBGL_lose_context.loseContext()` ya existía y es correcto, no quitarlo.

---

31. **El tutorial completado reaparecía en cada arranque** (2026-09-11): el efecto de montaje de `src/hooks/use-tutorial.ts` hacía `setIsActive(true)` dentro de la rama `if (isCompleted())` cuando el paso guardado era > 0. Como al terminar queda `symvora_tutorial_completed = "true"` **junto con** `symvora_tutorial_step = 14`, esa condición se cumplía siempre: el diálogo se reabría en "Paso 15 de 15" en cada carga. `TutorialDialog` se muestra con `isActive` a secas (no consulta `minimized`), y el `setMinimized(true)` que acompañaba tampoco servía de nada porque `TutorialMinimized` se oculta si `completed` es true. Molestaba sobre todo en la PWA instalada, que se abre muchas veces al día. Fix: al detectar el tutorial completado se restaura el paso (para que el progreso sea coherente si alguien lo reabre desde el header) pero **no se reactiva**. Nota aparte, sin arreglar: un tutorial empezado y abandonado a medias (no completado, con paso guardado) no restaura nada al recargar — ni el diálogo ni la burbuja minimizada. Se dejó así a propósito para no introducir otro elemento que aparece solo.
32. **El splash de Android mostraba el logo dentro de un cuadrado gris** (2026-09-11): los cuatro iconos de `public/icons/` traían un fondo **opaco `#1a1a1a`** incrustado, mientras `src/app/manifest.ts` declara `background_color: "#0A0A0A"`. El navegador dibuja el icono sobre `background_color`, así que esa diferencia de tono se veía como un recuadro alrededor del logo. Fix: `scripts/generate-pwa-icons.mjs` (nuevo) regenera los iconos desde `public/symvora-logo.webp`. Dos reglas que **no hay que invertir**: los `purpose: "any"` van con fondo **transparente** (se dibujan sobre `background_color`, así el logo queda contorneado sin importar el tono), y los `purpose: "maskable"` van con fondo **opaco a sangre** en `#0A0A0A` y el logo al 56% — Android los recorta a una forma y con transparencia saldrían artefactos. Detalle de la fuente: `symvora-logo.webp` es **negro sobre transparente**, así que el script usa su canal alfa como máscara y lo rellena de blanco; recolorear por umbral dejaría halos en los bordes. Los splash de iOS (`public/splash/`) ya estaban bien y no se tocaron. Si se cambia `background_color` en el manifest, hay que reejecutar el script: el fondo de los maskable debe coincidir.
33. **Las tablas y RPCs de inventario no tenían RBAC: un CAJERO podía alterar stock** (2026-09-11): descubierto al mover Inventario a `/products`. Tres capas, todas abiertas. (a) `variantes_producto`, `lotes`, `ajustes_inventario` y `stock_variantes` tenían **una sola política `FOR ALL` con solo aislamiento por tenant, sin `authorize()`** — la forma exacta del **bug #1**, que la migración 002 corrigió en `productos`/`ventas` pero que nunca se aplicó a estas tablas, añadidas en la 005. Cualquier CAJERO podía crear, editar y borrar por PostgREST sin tocar la interfaz; lo único que lo frenaba era el middleware bloqueando las páginas, que es una barrera **de navegación, no de datos**. (b) `ajustar_inventario` es `SECURITY DEFINER` —**salta RLS por diseño**— y no validaba ningún permiso: arreglar solo las tablas habría dejado esa puerta abierta. (c) `recibir_orden_compra`, igual y peor, porque **suma stock**; además no validaba ni siquiera `auth.uid()`. Las dos funciones resolvían el tenant con `(auth.jwt() ->> 'tenant_id')`, que es el claim de la membresía **más reciente** (`custom_access_token_hook` usa `ORDER BY creado_en DESC LIMIT 1`): para un usuario con dos negocios podía ser el equivocado. Fix (migración 053): las 4 tablas pasan al patrón `SELECT` por tenant + `INSERT/UPDATE/DELETE` con `authorize('inventory.manage')`, y las dos funciones derivan el tenant **del propio registro**, validan membresía contra `tenant_memberships` y exigen el permiso contra `role_permissions` (`inventory.manage` y `purchases.manage`). **La lectura se deja por tenant a propósito**: el CAJERO necesita consultar lotes y variantes desde el POS; lo que no debe es modificarlos. Lección, la tercera vez que aparece en este repo: **una escalada de privilegios puede vivir en tres sitios a la vez** — la ruta HTTP, la política RLS y el RPC `SECURITY DEFINER`. Cerrar uno solo no sirve, y el `SECURITY DEFINER` es el que más se olvida porque salta RLS por definición.
34. **Un CAJERO podía convertirse en SUPER_ADMIN mediante una clave de invitación** (2026-09-11): encontrado al responder "cómo quedaron las restricciones por usuario". `user_invite_keys` tenía `INSERT`/`UPDATE`/`DELETE` **`TO authenticated` con solo aislamiento por tenant**, y la tabla tiene columna `role TEXT` (default `'CAJERO'`) **sin `CHECK`**. La cadena, verificada: el cajero inserta por PostgREST una clave con `role='SUPER_ADMIN'` → llama a `POST /api/auth/key-login` → `validate_invite_key()` **devuelve el rol** (`TABLE(p_tenant_id, p_role, p_valid)`) → el endpoint hace `upsert` en `tenant_memberships` **con ese rol**. Resultado: SUPER_ADMIN de su propio negocio, con acceso a facturación y gestión de usuarios. `/api/users/invite` **sí** exigía `org.manage_members_write`; el hueco era que PostgREST expone la tabla directamente y se salta la ruta. Fix (migración 054): las escrituras exigen `org.manage_members_write` (el mismo permiso que la ruta), **más dos barreras independientes sobre el dato** porque una sola ya falló — `CHECK (role IN ('ORG_ADMIN','CAJERO'))`, que impide que **ninguna** clave otorgue SUPER_ADMIN pase lo que pase con la política (para nombrar otro dueño hay que ascenderlo desde `/users`), y `UNIQUE (key)`, sin el cual dos filas podían compartir clave y `validate_invite_key()` resolvía de forma ambigua cuál y con qué rol. En la misma migración se cerró `ordenes_compra`/`detalle_orden_compra` con `purchases.manage` (mismo defecto, menos grave). **Antes de apretar se verificó que ningún flujo del navegador escribe esa tabla** (`users/page.tsx` solo hace `.select()`; invitar y revocar van por rutas API con `service_role`, que salta RLS).

    ⚠️ **Este es el CUARTO hallazgo del mismo patrón** (bugs #1, #27, #33 y este). Ya no es sobre una tabla concreta: las tablas nuevas se crean con `FOR ALL` + aislamiento por tenant y nadie vuelve a ponerles el `authorize()`. **Toda tabla nueva con RLS necesita su política de escritura con `authorize()` desde el día uno.** La migración 054 deja guardado al final un **barrido de auditoría** que lista cualquier tabla con escrituras sin permiso — reejecutarlo periódicamente; es lo que habría delatado #33 y #34 sesiones antes. Resultado esperado: solo `service_role` (correcto, salta RLS por diseño) más `activity_logs` y `sugerencias`, que deben estar abiertas a todos.

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
| Variants/Lots/Adjustments¹ | ✅ | ✅ | ❌ redirige |
| **Users (crear/eliminar/cambiar rol)** | ✅ full | ✅ solo lectura | ❌ redirige |
| **Billing/Suscripción** | ✅ | ❌ redirige | ❌ redirige |

¹ Desde 2026-09-08 el punto de entrada principal es la pestaña "Inventario" dentro de Configuración (`/settings`), no un grupo aparte del sidebar — las rutas `/variants`/`/lots`/`/inventory-adjustments` y su protección por rol siguen existiendo igual, solo cambió el link de acceso.

> ⚠️ **Desde el 2026-09-10 esta tabla se aplica de verdad, no solo en la UI.** Antes, "ORG_ADMIN = solo lectura en Users" y "Billing = solo SUPER_ADMIN" eran ciertos únicamente en el sidebar y en `canManage`: la API y las políticas RLS dejaban pasar a ORG_ADMIN (y a CAJERO en `/billing`). Ahora lo respaldan los permisos `org.manage_members_write` y `subscription.manage` (migración 050). Si se agrega un módulo nuevo a esta tabla, no basta con ponerle `minRole` en el sidebar — hay que exigir el permiso en la ruta de API y, si la tabla se toca por PostgREST, también en la política RLS.

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
