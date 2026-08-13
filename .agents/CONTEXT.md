# SYMVORA SaaS - Contexto del Proyecto

## Visión General

SYMVORA es un **SaaS multi-tenant ERP/POS** para negocios en México (punto de venta, inventario, finanzas, compras). Diseñado para tiendas de abarrotes, verdulerías, mascotas, ropa, ferreterías y farmacias. Stack: **Next.js 16.3 + Supabase + Tailwind v4 + TypeScript**. Pagos con **Conekta** (gateway mexicano, hosted checkout).

---

## Estructura del Proyecto

```
symvora-saas/
├── .env.local                          # Credenciales Supabase (gitignored)
├── .env.example                        # Plantilla de variables de entorno
├── vitest.config.ts                    # Configuración Vitest (tests unitarios)
├── playwright.config.ts                # Configuración Playwright (E2E tests)
├── components.json                     # Configuración shadcn/ui v4
├── eslint.config.mjs                   # ESLint 9 flat config
├── next.config.ts                      # Next.js + next-intl plugin
├── postcss.config.mjs                  # @tailwindcss/postcss (Tailwind v4)
├── tsconfig.json                       # TypeScript, alias @/* -> ./src/*
├── opencode.json                       # Config opencode: MCP Supabase server
├── .github/
│   └── workflows/
│       └── ci.yml                      # GitHub Actions: lint, typecheck, tests, build
├── e2e/
│   └── app.spec.ts                     # Tests E2E con Playwright
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql      # Schema completo + RLS + seed
│       ├── 002_rls_rbac.sql           # RBAC fix: políticas granulares por operación
│       ├── 003_activity_logs.sql       # Tabla activity_logs + función log_activity()
│       ├── 004_complete_onboarding.sql # SECURITY DEFINER para onboarding
│       └── 007_facturacion.sql         # Tablas facturas/factura_detalle + permisos billing.*
└── src/
    ├── hooks/
    │   └── use-current-tenant.ts      # Hook centralizado para obtener tenant del usuario
    ├── __tests__/                     # Tests unitarios (Vitest)
    │   ├── setup.ts                   # Setup de testing
    │   ├── cart.test.ts               # Tests del store de carrito
    │   ├── schemas.test.ts            # Tests de validación Zod
    │   └── sales.test.ts              # Tests de cálculos de venta
    ├── middleware.ts                    # i18n + Supabase session middleware
    ├── i18n/                           # Configuración de idiomas
    │   ├── routing.ts                  # Locales: ["es", "en"], default: "es"
    │   ├── request.ts                  # Resolución server-side de locale
    │   └── navigation.ts              # Link, redirect, usePathname, useRouter
    ├── messages/
    │   ├── es.json                     # Traducciones español (~260 keys)
    │   └── en.json                     # Traducciones inglés (~260 keys)
    ├── stores/
    │   └── cart.ts                     # Zustand store del carrito POS
    ├── lib/
    │   ├── utils.ts                    # cn() - clsx + tailwind-merge
    │   ├── supabase/
    │   │   ├── client.ts              # Cliente browser
    │   │   ├── server.ts              # Cliente server (cookies) + createSupabaseServiceRoleClient()
    │   │   ├── middleware.ts          # Refresh sesión + auth guard + subscription access control
    │   │   ├── auth.ts                # requireTenantAccess(): autentica por cookie y valida membresía/permiso por tenant (usado en API routes)
    │   │   └── activity-logger.ts     # Helper para registrar acciones en activity_logs
    │   ├── conekta/
    │   │   ├── config.ts             # Conekta SDK init (conekta v9.0.1)
    │   │   ├── plans.ts              # Plan helpers (symvora-basic, $400 MXN/mes, 7d trial)
    │   │   ├── customers.ts          # Customer CRUD (createCustomer, getCustomer)
    │   │   ├── subscriptions.ts      # Subscription CRUD (createSubscription, cancelSubscription)
    │   │   └── orders.ts             # HostedPayment order creation via OrdersApi
    │   ├── cfdi/
    │   │   ├── catalogs.ts           # Catálogos SAT (claves prod/serv, unidades, formas pago)
    │   │   ├── pac-client.ts         # Clientes PAC (Finkok/SWSapien) para timbrado
    │   │   └── xml-generator.ts      # Generación de XML CFDI 4.0
    │   ├── validations/
    │   │   └── schemas.ts            # Schemas Zod (login, signup mejorado, tenant, etc.)
    │   ├── export/
    │   │   ├── csv.ts                # Utilidad exportar arrays a CSV
    │   │   └── pdf.ts                # Utilidad exportar tablas a PDF (jspdf)
    │   └── types/
    │       └── database.ts           # Tipos TypeScript de todas las tablas DB
    ├── components/
    │   ├── layout/
    │   │   ├── sidebar.tsx            # Sidebar colapsable con 8 links (incluye Bitácora)
    │   │   └── header.tsx             # Barra superior con menú de usuario + botón búsqueda
    │   ├── charts/
    │   │   ├── sales-chart.tsx        # Gráfica de área (ventas últimos 7 días)
    │   │   ├── top-products-chart.tsx # Gráfica de barras horizontales (top productos)
    │   │   └── payment-methods-chart.tsx # Gráfica de dona (métodos de pago)
    │   ├── search/
    │   │   └── command-menu.tsx       # Modal Cmd+K de búsqueda global
    │   ├── auth/
    │   │   └── auth-forms.tsx         # Formulario login/signup con acordeones, logo en panel oscuro
    │   ├── marketing/
    │   │   ├── hero.tsx               # Sección hero de la landing
    │   │   ├── features.tsx           # Sección de features
    │   │   ├── navbar.tsx             # Navbar de marketing
    │   │   ├── footer.tsx             # Footer de marketing con links (incluye legales)
    │   │   ├── legal-shell.tsx        # Layout compartido para páginas legales
    │   │   └── ...                    # Otros componentes de la landing
    │   ├── compliance/
    │   │   └── cookie-consent.tsx     # Banner de consentimiento de cookies (symvora_consent)
    │   └── ui/                        # 20+ componentes shadcn/ui (base-nova)
    │       ├── sonner.tsx             # Toaster con theme del proyecto
    │       ├── data-table-toolbar.tsx # Toolbar con botones export CSV/PDF
    │       ├── password-input.tsx     # Input contraseña con toggle + checklist
    │       ├── file-upload.tsx        # Drag & drop logo
    │       ├── color-picker.tsx       # Grid 8 paletas de colores
    │       └── accordion.tsx          # Componente acordeón (secciones colapsables)
    └── app/
        ├── layout.tsx                  # Root layout: fuentes, ThemeProvider, Toaster
        ├── page.tsx                    # Redirect a /es
        ├── [locale]/layout.tsx         # Locale wrapper: NextIntlClientProvider + CookieConsent
        ├── [locale]/aviso-privacidad/page.tsx   # Aviso de privacidad integral (LFPDPPP) - pública
        ├── [locale]/terminos/page.tsx           # Términos y condiciones - pública
        ├── [locale]/politica-cookies/page.tsx   # Política de cookies - pública
        ├── [locale]/not-found.tsx              # 404 dentro del locale (con Navbar/Footer, animación motion)
        ├── not-found.tsx                        # 404 raíz fallback (minimalista, redirige a /es)
        ├── api/auth/callback/route.ts  # OAuth callback
        ├── api/users/
        │   └── invite/route.ts           # Invite: requiere org.manage_members + SUPER_ADMIN para invitar SUPER_ADMIN
        ├── api/facturas/
        │   ├── list/route.ts             # Listar facturas (billing.view)
        │   ├── create/route.ts           # Crear factura CFDI (billing.create)
        │   ├── stamp/route.ts            # Timbrar factura vía PAC (billing.stamp)
        │   └── cancel/route.ts           # Cancelar factura (billing.cancel)
        ├── api/conekta/
        │   ├── create-checkout/route.ts  # Creates Conekta customer + hosted checkout, returns checkout_url
        │   └── webhook/route.ts          # Conekta webhook: subscription.*, order.paid
        ├── api/trial-codes/
        │   ├── generate/route.ts         # Generate trial codes
        │   ├── validate/route.ts         # Validate trial codes
        │   └── redeem/route.ts           # Redeem trial codes
        ├── (auth)/[locale]/
        │   ├── login/page.tsx          # Login email/password
        │   ├── signup/page.tsx         # Registro mejorado: nombre split, establecimiento, logo, color, contraseña con checklist
        │   └── onboarding/page.tsx     # Wizard 4 pasos: empresa -> giro -> review -> completo (creates tenant + subscription + Conekta checkout)
        └── (dashboard)/[locale]/
            ├── layout.tsx              # Sidebar + Header + contenido + CommandMenu
            ├── loading.tsx             # Skeleton loader general
            ├── dashboard/page.tsx      # Dashboard con Recharts: KPIs + 3 gráficas
            ├── billing/
            │   ├── page.tsx            # Subscription status, payment methods, Conekta checkout redirect
            │   └── success/
            │       └── page.tsx        # Post-payment success with auto-redirect countdown
            ├── activity/
            │   └── page.tsx            # Bitácora de actividad con filtros
            ├── products/
            │   ├── page.tsx            # Catálogo productos + búsqueda + export CSV/PDF
            │   └── loading.tsx         # Skeleton loader productos
            ├── pos/
            │   ├── page.tsx            # Terminal POS: entrada código barras + carrito + pago
            │   └── loading.tsx         # Skeleton loader POS
            ├── purchases/
            │   ├── page.tsx            # Compras + Proveedores
            │   └── loading.tsx         # Skeleton loader compras
            ├── finances/
            │   ├── page.tsx            # Caja: apertura/cierre + movimientos
            │   └── loading.tsx         # Skeleton loader finanzas
            ├── users/
            │   ├── page.tsx            # Gestión usuarios con roles
            │   └── loading.tsx         # Skeleton loader usuarios
            ├── facturas/
            │   └── page.tsx            # Módulo CFDI 4.0: crear/timbrar/cancelar facturas
            ├── lots/                   # Lotes (products extend)
            ├── variants/               # Variantes de producto
            ├── inventory-adjustments/  # Ajustes de inventario
            ├── purchase-orders/        # Órdenes de compra dedicadas
            ├── reports/                # Reportes con 4 cards + 3 charts
            └── settings/
                ├── page.tsx            # Config: General, Apariencia, Módulos
                └── loading.tsx         # Skeleton loader configuración
```

---

## Rutas de la App

| Ruta | Grupo | Descripción |
|---|---|---|
| `/` | Root | Redirect a `/es` |
| `/[locale]/login` | `(auth)` | Formulario login |
| `/[locale]/signup` | `(auth)` | Formulario registro |
| `/[locale]/onboarding` | `(auth)` | Wizard de configuración inicial |
| `/[locale]/dashboard` | `(dashboard)` | KPIs: ventas del día, mes, ticket promedio |
| `/[locale]/billing` | `(dashboard)` | Estado de suscripción, métodos de pago, checkout Conekta |
| `/[locale]/billing/success` | `(dashboard)` | Pago exitoso, redirect countdown |
| `/[locale]/products` | `(dashboard)` | Catálogo de productos con búsqueda |
| `/[locale]/pos` | `(dashboard)` | Terminal punto de venta |
| `/[locale]/purchases` | `(dashboard)` | Órdenes de compra + proveedores |
| `/[locale]/finances` | `(dashboard)` | Gestión de caja y movimientos |
| `/[locale]/users` | `(dashboard)` | Gestión de usuarios y roles |
| `/[locale]/activity` | `(dashboard)` | Bitácora de actividad |
| `/[locale]/facturas` | `(dashboard)` | Facturación CFDI 4.0 (crear, listar, timbrar, cancelar) |
| `/[locale]/settings` | `(dashboard)` | Configuración del tenant |
| `/` | Landing | Landing page pública (marketing) |
| `/[locale]/aviso-privacidad` | Pública | Aviso de privacidad integral (LFPDPPP) |
| `/[locale]/terminos` | Pública | Términos y condiciones (17 secciones: Aceptación, Registro, Uso, Responsabilidad fiscal, Suscripción, Cancelación, PI, Limitación, Ley aplicable, Contacto, Modificaciones, Soporte, SLA, Confidencialidad, Cesión, Fuerza mayor, Indemnidad) |
| `/[locale]/politica-cookies` | Pública | Política de cookies |
| `/[locale]/* (no match)` | Pública | Renderiza `not-found.tsx` con Navbar/Footer, animación motion, CTAs "Ir al inicio" / "Volver" |
| `/* (no match raíz)` | Pública | Renderiza `not-found.tsx` minimalista que redirige a `/es` |
| `/api/auth/callback` | API | OAuth code exchange |
| `/api/users/invite` | API | Invitar usuario (org.manage_members; solo SUPER_ADMIN invita SUPER_ADMIN) |
| `/api/facturas/list` | API | Listar facturas (billing.view) |
| `/api/facturas/create` | API | Crear factura CFDI (billing.create) |
| `/api/facturas/stamp` | API | Timbrar vía PAC (billing.stamp) |
| `/api/facturas/cancel` | API | Cancelar vía PAC (billing.cancel) |
| `/api/conekta/create-checkout` | API | Crear checkout Conekta (hosted payment) |
| `/api/conekta/webhook` | API | Webhook Conekta (pagos, suscripciones) |
| `/api/trial-codes/generate` | API | Generar códigos de prueba |
| `/api/trial-codes/validate` | API | Validar códigos de prueba |
| `/api/trial-codes/redeem` | API | Canjear códigos de prueba |

---

## Cómo funciona la Autenticación

1. **Signup**: Formulario con acordeones (4 secciones: Datos personales, Empresa, Seguridad, Personalización). Logo en panel oscuro. Sección Empresa incluye nombre, tipo negocio y logo. Sección Seguridad incluye email, contraseña con checklist, confirmar contraseña. Sección Personalización incluye paleta de colores. -> `supabase.auth.signUp()` -> upload logo -> `complete_onboarding` RPC (creates tenant) -> insert subscription (trial) -> call `/api/conekta/create-checkout` -> redirect to Conekta. Fallback a `/es/billing`
2. **Onboarding** (4 pasos):
   - Paso 1: Nombre empresa + subdominio
   - Paso 2: Seleccionar giro (ABARROTES, VERDULERIA, MASCOTAS, ROPA, FERRETERIA, FARMACIA, GENERAL)
   - Paso 3: Revisión
   - Paso 4: Crea registros vía `complete_onboarding()` RPC (SECURITY DEFINER, bypasses RLS): `tenants`, `tenant_settings`, `tenant_memberships`, `user_roles`. Then creates subscription with trial, calls Conekta checkout API, redirects to hosted checkout
3. **Login**: Email/password -> `supabase.auth.signInWithPassword()` -> redirige a `/es/dashboard`
4. **Sesión**: Middleware refresca JWT en cada request via `getUser()`. El `custom_access_token_hook` inyecta `user_role` y `tenant_id` en el JWT
5. **Logout**: `supabase.auth.signOut()` -> redirige a `/es/login`
6. **Protección de rutas**: Middleware verifica autenticación + subscription status. Usuarios con trial expirado o pago vencido son redirigidos a `/billing`. `/billing` está en `isPublicRoute` para evitar loops. Páginas legales (`aviso-privacidad`, `terminos`, `politica-cookies`) públicas (`isLegalRoute`)
7. **API routes (hardening)**: Todas las rutas `/api/*` usan `requireTenantAccess()` (`src/lib/supabase/auth.ts`) que autentica vía cookies y valida membresía + permiso por tenant. Control de acceso del usuario — nunca confiar en JWT claims para permisos. El webhook de Conekta usa verificación de firma RSA del header `DIGEST` (fail-closed)
8. **Email confirmation**: DESHABILITADA en Supabase Dashboard (requerida para el flujo signup → Conekta)

---

## Cómo funciona el Multi-Tenancy

**Modelo**: Base de datos compartida, aislamiento por filas (RLS).

1. **Tenant**: Cada negocio es una fila en `tenants` con `subdominio` único
2. **Membresía**: Usuarios pertenecen a tenants via `tenant_memberships` (user_id + tenant_id + role)
3. **Aislamiento**: Todas las tablas de negocio tienen `tenant_id` FK a `tenants`
4. **RLS**: Todas las tablas tienen Row-Level Security. Políticas usan `user_tenant_ids()` para asegurar acceso solo a filas del tenant del usuario
5. **JWT**: `custom_access_token_hook` inyecta `user_role` y `tenant_id` en el JWT
6. **Permisos**: Función `authorize()` verifica el rol contra `role_permissions`

**Roles**: SUPER_ADMIN (acceso total), ORG_ADMIN (gestión miembros/config/ventas/inventario/compras/finanzas), CAJERO (crear ventas, ver reportes, ver inventario)

---

## Cómo funciona el POS

- **Panel izquierdo**: Búsqueda de productos por nombre/código de barras + grid de productos disponibles
- **Panel derecho**: Carrito gestionado por Zustand (`useCartStore`)
  - Items con nombre, precio unitario, cantidad (+/-), eliminación
  - Selector de cliente (opcional)
  - Cálculos: subtotal, IVA 16%, descuento, total
- **Sección de pago**: 4 métodos (Efectivo, Tarjeta, Transferencia, Crédito)
- **Acciones**: Completar venta, vaciar carrito

**Store del carrito** (`src/stores/cart.ts`):
- `addItem` (merge si existe), `removeItem`, `updateQuantity`, `updateDiscount`, `clearCart`
- `getSubtotal()`, `getDiscount()`, `getTotal()`, `getItemCount()`

**Flujo de venta** (`src/lib/supabase/sales.ts`):
1. Inserta en `ventas` con subtotal, IVA 16%, descuento, total
2. Inserta cada item en `detalle_ventas`
3. Decrementa `stock_actual` en `productos` por cada item
4. Si hay caja abierta, registra movimiento de ENTRADA en `movimientos_caja`

**Integridad de precio (migración 011)**: el RPC `complete_sale` NO confía en el `precioUnitario` del cliente. Recalcula todo desde `productos.precio_venta` (única fuente de verdad) y clampa el descuento de línea a `[0, subtotal de línea]`. El cliente envía solo `productId`, `cantidad` y `descuento` por item.

**Estado actual**: POS conectado a Supabase, funcional con búsqueda, venta, IVA, stock, caja.

---

## Configuración de i18n

- **Librería**: `next-intl` v4.13.5
- **Idiomas**: Español (`es`, default) e Inglés (`en`)
- **Patrón URL**: Todas las rutas con prefijo `/[locale]/`
- **Provider**: `NextIntlClientProvider` envuelve todas las páginas
- **Archivos**: `src/messages/es.json` (~260 keys) y `src/messages/en.json` (~260 keys)

---

## Base de Datos (Supabase)

### Enums (9)
| Enum | Valores |
|---|---|
| `app_role` | SUPER_ADMIN, ORG_ADMIN, CAJERO |
| `unidad_medida` | PIEZA, KG, GRAMO, LITRO, SERVICIO |
| `metodo_pago` | EFECTIVO, TARJETA, TRANSFERENCIA, CREDITO |
| `estado_venta` | COMPLETADA, CANCELADA, PENDIENTE |
| `estado_compra` | PENDIENTE, RECIBIDA, CANCELADA |
| `estado_caja` | ABIERTA, CERRADA |
| `tipo_movimiento` | ENTRADA, SALIDA |
| `subscription_status` | TRIAL, ACTIVE, PAST_DUE, CANCELED, EXPIRED |
| `billing_period` | MONTHLY, YEARLY |

### Tablas (17)
| Tabla | Propósito |
|---|---|
| `tenants` | Identidad del negocio |
| `tenant_settings` | Configuración JSONB por tenant |
| `user_roles` | Roles globales de usuario (para JWT) |
| `tenant_memberships` | Asociación usuario-tenant con rol |
| `productos` | Catálogo de productos |
| `clientes` | Directorio de clientes con crédito |
| `proveedores` | Directorio de proveedores |
| `ventas` | Transacciones de venta |
| `detalle_ventas` | Líneas de venta |
| `compras` | Órdenes de compra |
| `detalle_compras` | Líneas de compra |
| `cajas` | Sesiones de caja |
| `movimientos_caja` | Movimientos de caja (entrada/salida) |
| `activity_logs` | Bitácora de acciones de usuarios |
| `subscriptions` | Suscripciones por tenant (status, trial, billing, payment methods) |
| `payment_history` | Historial de pagos (conekta事件) |
| `trial_codes` | Códigos de prueba canjeables |
| `legal_acceptances` | Auditoría legal: cada aceptación de Términos/Privacidad/Cookies con versiones, IP, user_agent y timestamp (migración 010) |

### Funciones SQL
- `user_tenant_ids()` - Retorna UUID[] de tenants del usuario actual
- `authorize(permission)` - Verifica si el rol tiene un permiso (usado en RLS policies)
- `custom_access_token_hook()` - Inyecta user_role y tenant_id en el JWT
- `log_activity()` - Registra acciones en activity_logs (CREATE/UPDATE/DELETE)
- `complete_onboarding()` - SECURITY DEFINER: crea tenant + settings + membership + role atómicamente (ON CONFLICT on (user_id, role))

### Migraciones
- `001_initial_schema.sql` - Schema completo + RLS (políticas FOR ALL inseguras)
- `002_rls_rbac.sql` - Fix RBAC: reemplaza FOR ALL por políticas granulares por operación (SELECT/INSERT/UPDATE/DELETE) con `authorize()` en escrituras
  - **Ejecutar en Supabase SQL Editor** con opción "Without RLS"
  - Sin datos existentes, seguro para producción
- `003_activity_logs.sql` - Tabla activity_logs + RLS + función log_activity()
  - **Ejecutar en Supabase SQL Editor** con opción "Without RLS"
- `004_complete_onboarding.sql` - Función SECURITY DEFINER `complete_onboarding()` para bypass RLS en onboarding
  - **Ejecutar en Supabase SQL Editor** con opción "Without RLS"
  - **FIX**: ON CONFLICT corregido de `(user_id)` a `(user_id, role)` para evitar conflictos con múltiples roles
- `005_conekta_integration.sql` - Conekta SDK, lib files, create-checkout API, webhook, sidebar billing link, translations
  - **Ejecutar en Supabase SQL Editor** con opción "Without RLS"
- `006_subscriptions.sql` - Tablas subscriptions, payment_history, trial_codes + enum subscription_status + RLS policies + subscription INSERT policy
  - **Ejecutar en Supabase SQL Editor** con opción "Without RLS"
- `007_facturacion.sql` - Tablas `facturas`, `factura_detalle` + catálogos CFDI + permisos `billing.view/create/stamp/cancel` en `role_permissions`
  - **Ejecutar en Supabase SQL Editor** con opción "Without RLS"
- `010_legal_acceptance.sql` - Tabla `legal_acceptances` (user_id, terms_version, privacy_version, cookies_version, ip_address, user_agent, accepted_at) + RLS. Sirve como evidencia legal ante aclaraciones/contracargos. UNIQUE INDEX evita duplicados exactos por versión
  - **Ejecutar en Supabase SQL Editor** con opción "Without RLS"

### MCP Server (Supabase)
- **Config**: `opencode.json` en raíz del proyecto
- **URL**: `https://mcp.supabase.com/mcp?project_ref=ffswcgrahxsczvydngrd`
- **Auth**: OAuth 2.1 vía `opencode mcp auth supabase`
- **Estado**: Conectado y autenticado
- **Features**: docs, account, database, debugging, development, functions, branching
- **Herramientas disponibles**: execute_sql, search_docs, get_advisors, apply_migration, etc.

---

## Librerías Principales

| Librería | Versión | Propósito |
|---|---|---|
| `next` | 16.3.0 | Framework React |
| `react` / `react-dom` | 19.2.8 | React 19 con Server Components |
| `@supabase/ssr` | 0.12.4 | Auth Supabase con SSR |
| `@supabase/supabase-js` | 2.112.2 | SDK cliente Supabase |
| `next-intl` | 4.13.5 | Internacionalización |
| `next-themes` | 0.4.6 | Dark/light mode |
| `zustand` | 5.0.14 | State management (carrito POS) |
| `zod` | 4.4.3 | Validación de schemas |
| `react-hook-form` | 7.85.0 | Formularios (instalado, no usado aún) |
| `@base-ui/react` | 1.7.0 | Primitivas headless UI |
| `class-variance-authority` | 0.7.1 | Variant styling |
| `clsx` | 2.1.1 | Clases condicionales |
| `tailwind-merge` | 3.6.0 | Merge de clases Tailwind |
| `lucide-react` | 1.30.0 | Iconos |
| `shadcn` | 4.16.2 | Generador de componentes UI |
| `sonner` | latest | Toast notifications |
| `recharts` | latest | Gráficas para dashboard |
| `cmdk` | latest | Cmd+K search modal |
| `jspdf` | latest | Generación de PDFs |
| `jspdf-autotable` | latest | Tablas en PDFs |
| `conekta` | 9.0.1 | Gateway de pagos mexicano (Conekta) |

---

## Decisiones de Arquitectura

1. **Route Groups**: Auth y Dashboard usan `(auth)` y `(dashboard)` para separar layouts sin afectar URLs
2. **Layouts en capas**: Root layout -> `[locale]` layout -> `(auth)` o `(dashboard)` layout
3. **Configuración por giro**: El onboarding selecciona un tipo de negocio que pre-configura módulos activos y settings del POS
4. **JWT Authorization**: Hooks de Supabase inyectan claims en el JWT para autorización sin queries extra
5. **shadcn/ui v4 base-nova**: Usa `@base-ui/react` (no Radix) para la mayoría de componentes
6. **Sin Server Actions**: Todas las mutaciones usan cliente browser de Supabase
7. **Diseño Spanish-First**: Locale default `es`, variables en español, moneda MXN
8. **Conekta Hosted Checkout**: Checkout en página de Conekta (no iframe), redirect via `window.location.href`. Plan `symvora-basic` ($400 MXN/mes, 7d trial). Webhook maneja `order.paid` para pagos de hosted checkout
9. **Signup → Conekta directo**: No pasar por onboarding; signup crea tenant (RPC) → inserta trial subscription → crea checkout en Conekta → redirect. Si falla, fallback a `/es/billing`

---

## Estado Actual / TODOs

### Completado
- Dashboard: KPIs con datos reales de Supabase + 3 gráficas Recharts (ventas, top productos, métodos de pago)
- Signup: Formulario con acordeones (Datos personales, Empresa, Seguridad, Personalización), logo en panel oscuro, email sin confirmación, paleta de colores
- Auth UI: Logo SYMVORA en paneles oscuros de login/signup, paneles toggle con textos intercambiados (Crear cuenta a la izquierda, Bienvenido de nuevo a la derecha)
- Componente Accordion: Secciones colapsables con animación CSS para el formulario de registro
- Toast notifications: Sonner integrado en root layout
- Cmd+K search: Búsqueda global con cmdk en header
- Export CSV/PDF: Utilidades reutilizables + toolbar en productos
- Activity Logs: Tabla activity_logs + página con filtros + sidebar link
- **Productos CRUD**: Conectado a Supabase con crear, editar, eliminar. Búsqueda por nombre/código de barras/SKU
- **POS funcional**: Búsqueda de productos, selección, carrito, IVA 16%, completar venta con decremento de stock
- **Ventas guardadas**: `lib/supabase/sales.ts` inserta en ventas, detalle_ventas, decrementa stock, registra en caja
- **Selector de cliente**: Dropdown opcional en POS para ventas con crédito
- **Caja integrada**: Movimientos de venta se registran automáticamente si hay caja abierta. Cierre con saldo esperado vs real
- **Fase 0 calidad**: Vitest (47 tests), Playwright (E2E), GitHub Actions CI, .env.example, README documentado
- **Onboarding fix**: Función SECURITY DEFINER `complete_onboarding()` para bypass RLS
- **Hook useCurrentTenant**: Centraliza lógica de tenant, usa `.limit(1)` en vez de `.single()`
- **Errores al usuario**: toast.error() en todos los flujos de escritura (purchases, settings)
- **Billing system**: Conekta SDK (v9.0.1), plan `symvora-basic` ($400 MXN/mes), hosted checkout. API create-checkout con errores detallados. Webhook maneja `subscription.*` y `order.paid`. Billing page con redirect a Conekta. Success page con auto-redirect
- **Subscription schema**: Tables `subscriptions`, `payment_history`, `trial_codes` + `subscription_status` enum + RLS policies. INSERT policy for authenticated users
- **Signup → Conekta**: Auth-forms creates user → uploads logo → creates tenant (RPC) → inserts trial subscription → calls Conekta API → redirects to hosted checkout. Fallback to `/es/billing`
- **Middleware subscription access**: Redirects expired/past_due to `/billing`. `/billing` in `isPublicRoute` to prevent redirect loops
- **Trial codes API**: Generate, validate, redeem endpoints for partner trial codes
- **Reports page** (`/reports`): Period selector, 4 summary cards, 3 charts
- **Módulo CFDI 4.0** (`/facturas`): Tablas `facturas`/`factura_detalle`, catálogos SAT, generador XML, clientes PAC (Finkok/SWSapien). APIs create/stamp/cancel/list con permisos `billing.*`
- **Landing page pública**: Hero, features, navbar, footer con links legales, secciones marketing
- **Hardening API routes**: Nuevo helper `requireTenantAccess()` en `src/lib/supabase/auth.ts`, aplicado a invite, facturas, create-checkout, trial-codes. Webhook Conekta firmado (RSA `DIGEST` header, fail-closed)
- **Cumplimiento LFPDPPP**: Banner de consentimiento de cookies (`cookie-consent.tsx`, cookie `symvora_consent` 7 días), páginas aviso-privacidad/terminos/politica-cookies públicas, aviso abreviado en signup, footer legal con links reales
- **Páginas 404**: `src/app/[locale]/not-found.tsx` (con Navbar/Footer, animación motion fadeInUp, CTAs Inicio/Volver) y `src/app/not-found.tsx` (fallback raíz minimalista). Strings i18n en `es.json`/`en.json` bajo `notFound`
- **Navbar móvil a negro**: Panel móvil con fondo negro puro (`bg-black`), texto blanco/grises claros, separadores `border-white/10`, "Comenzar gratis" invertido a `bg-white text-black`, header se vuelve negro al abrir el menú. Fix overflow lateral con `overflow-x-hidden` en `html`/`body` (globals.css) y wrappers de marketing
- **Términos y Condiciones expandido**: De 10 a 17 secciones (Modificaciones, Soporte técnico, SLA, Confidencialidad, Cesión, Fuerza mayor, Indemnidad) + §5.1 trial 7 días, §5.2 política de reembolsos (sin reembolso, cancelación al final del periodo), §7.1 propiedad de datos del usuario
- **Cumplimiento legal completo (3.A/3.B/3.C/3.D)**: Checkbox obligatorio en signup (`acceptTerms: z.literal(true)`) con links a Términos/Privacidad en `target="_blank" rel="noopener noreferrer"`, tabla `legal_acceptances` con IP+UA+timestamp para auditoría (`supabase/migrations/010_legal_acceptance.sql`), endpoints `POST /api/legal/accept` y `GET /api/legal/current-versions`, banner post-login (`PolicyUpdateBanner`) que muestra aviso prominente al iniciar sesión cuando hay nueva versión, footer legal en dashboard (`LegalFooter`). Versiones constantes en `src/lib/legal/versions.ts`
- **Auditoría landing (plan_de_mejora_landing_symvora)**: Hero con nuevo titular ("El sistema de punto de venta e inventarios / hecho para tu comercio") + mini-mockup HTML del POS (`PosMockup`) en lugar de foto corporativa externa; AboutUs reubicado al final con badge "Hecho en México"; BusinessTypes reescrito como tabs interactivos con mockups HTML por giro (Abarrotes grid, Verdulería cálculo por peso, Ropa matriz Talla×Color, Farmacia alertas de caducidad, Ferretería SKU, Mascotas catálogo, General módulos); CTA con toggle Anual/Mensual (motion layoutId pill) y CTA secundario WhatsApp; Integrations con badge verde "Acepta tarjetas, débito y OXXO"; WhyChooseUs con 4ta card "Disponibilidad 24/7" (badges 99.9% uptime + Edge global) y búsqueda sin `Cmd+K` chip (reemplazado por hint "Encuentra en menos de 1 segundo"); SecuritySection RLS renombrado a "Aislamiento Total de Datos"; WhatsAppFab flotante fixed bottom-right; TrustedBy eliminado por usar logos ficticios (archivo conservado para reactivación futura)
- **Hero mobile responsive + CompatibilityBar**: Fix de recorte del titular en mobile (`sm:whitespace-nowrap` en lugar de `whitespace-nowrap` permite que "comercio" baje a la siguiente línea en pantallas <640px), altura mínima del mockup reducida (`min-h-[280px] sm:min-h-[360px] lg:min-h-[600px]`), badge "+24.5%" ajustado con `right-auto max-w-[calc(100%-1rem)]` para no salirse del viewport. Nueva sección `CompatibilityBar` insertada entre Hero y Features con 4 trust badges (Celular, Tablet, Computadora, En la nube) usando íconos lucide-react — comunica "disponible en cualquier dispositivo con internet"
- **FAQ + WhatsApp SVG oficial**: Nueva sección FAQ con acordeón local (`AnimatePresence` height auto animado) — 8 preguntas (las 3 originales del usuario: equipo/código de barras, dispositivos compatibles, fin del trial de 7 días; + 5 adicionales: conocimientos técnicos, comisiones, CFDI 4.0, seguridad, cancelación). Layout grid 1 col mobile / 2 cols en `lg:`. Cada item tiene número circular (1-8) que cambia de color al expandirse (azul activo, gris cerrado), `aria-expanded`/`aria-controls`/`aria-labelledby` para accesibilidad. CTA final "¿No encontraste tu respuesta?" con botón WhatsApp verde (`bg-emerald-500`) que abre wa.me con mensaje prellenado específico del FAQ. Componente `WhatsAppLogo` (SVG oficial extraído del brand kit) reemplaza el `MessageCircle` de lucide-react en el FAB flotante — `fill="currentColor"` permite teñirlo via Tailwind. Aplicado solo al FAB (no al botón "Hablar por WhatsApp" del CTA que mantiene solo texto)

### Pendiente
 - Conekta API credentials verification — actual Conekta error visible with improved error handling
 - Conekta plan `symvora-basic` not yet confirmed as created in Conekta panel
 - `NEXT_PUBLIC_APP_URL` env var needs to be set in Vercel for checkout success/cancel URLs
 - User testing billing checkout flow
 - **Legal stubs**: Reemplazar `[Domicilio del responsable]`, `[privacidad@symvora.com]`, `[Ciudad]` en aviso de privacidad con datos reales
 - **Env novo**: `CONEKTA_WEBHOOK_PUBLIC_KEY` (llave pública RSA de https://api.conekta.io/webhook_keys) aún no establecida — sin ella el webhook rechaza todo (fail-closed), `STITCH_API_KEY` pendiente de configurar
 - **CAPTCHA Turnstile — activación manual**: crear widget en Cloudflare (Sitekey+Secret), activar CAPTCHA en Supabase Dashboard (Auth → Bot and Abuse Protection → Cloudflare Turnstile + secret key) y fijar `NEXT_PUBLIC_TURNSTILE_SITE_KEY` en Vercel. Código ya listo (gated por env).
 - **Advisor: `role_permissions` con RLS deshabilitado** — tabla de lookup; decidir si se habilita RLS con políticas adecuadas
 - **`auth-forms.tsx` redirect hardcoded**: `router.push("/es/dashboard")` en login (y signup fallback) aún hardcodea locale (`/es`)

---

## Bugs Corregidos

### 1. DropdownMenuTrigger - Error de nesting `<button>` dentro de `<button>`
- **Archivo**: `src/components/layout/header.tsx`
- **Problema**: `DropdownMenuTrigger` (de Base UI) renderiza un `<button>` por defecto, y el `<Button>` interno también renderiza `<button>`, causando HTML inválido
- **Solución**: Usar `nativeButton={false}` + `render={<div />}` para renderizar el trigger como `<div>` en lugar de `<button>`
- **Código**:
```tsx
<DropdownMenuTrigger nativeButton={false} render={<div className="..." />}>
  A
</DropdownMenuTrigger>
```

### 2. Supabase env vars - "Invalid supabaseUrl"
- **Archivo**: `.env.local`
- **Problema**: `NEXT_PUBLIC_SUPABASE_URL` tenía `/rest/v1/` al final
- **Solución**: URL sin el sufijo `/rest/v1/` (la librería lo agrega internamente)

### 3. Missing env var - "Missing required environment variable"
- **Archivos**: `src/lib/supabase/client.ts`, `server.ts`, `middleware.ts`
- **Problema**: Dependencia de `getSupabaseEnv()` en `env.ts` que fallaba en ciertos contextos
- **Solución**: Acceso directo a `process.env.NEXT_PUBLIC_SUPABASE_URL` sin wrapper

### 4. Settings stuck loading
- **Archivo**: `src/app/(dashboard)/[locale]/settings/page.tsx`
- **Problema**: `fetchTenantData` hacía early return sin `setLoading(false)` cuando no hay usuario o membership
- **Solución**: Agregar `setLoading(false)` antes de cada early return

### 5. CRITICAL: RBAC no se aplica en RLS (vulnerabilidad de seguridad)
- **Archivos**: `supabase/migrations/002_rls_rbac.sql` (fix)
- **Problema**: Todas las políticas RLS usaban `FOR ALL` con solo `user_tenant_ids()`. La función `authorize()` y la tabla `role_permissions` existían pero NINGUNA política las llamaba. Un CAJERO tenía los mismos permisos de escritura que un SUPER_ADMIN a nivel de base de datos.
- **Impacto**: Cualquier cuenta CAJERO comprometida podía borrar tenants, modificar inventario, gestionar finanzas, cambiar miembros, o escalar privilegios.
- **Solución**: Migración `002_rls_rbac.sql` que reemplaza todas las políticas `FOR ALL` por políticas granulares por operación (SELECT/INSERT/UPDATE/DELETE) que llaman a `authorize('permission')` en las operaciones de escritura.
- **Permisos por rol**:
  - CAJERO: solo `sales.create`, `sales.view_reports`, `inventory.view` (lectura en todo, escritura solo en ventas)
  - ORG_ADMIN: + `inventory.manage`, `purchases.manage`, `finances.manage`, `org.manage_members`, `org.manage_settings`
  - SUPER_ADMIN: + `org.delete` (puede borrar tenants y gestionar roles)
- **Ejecutar en Supabase SQL Editor**: Copiar el contenido de `002_rls_rbac.sql` y ejecutar con la opción "Without RLS"

### 6. Loading states entre módulos
- **Archivos**: `loading.tsx` en cada ruta del dashboard
- **Problema**: No había feedback visual al navegar entre módulos
- **Solución**: Skeleton loaders con `animate-pulse` para cada página (dashboard, products, pos, purchases, finances, users, settings)

### 7. Signup RLS - "new row violates row-level security policy for table tenants"
- **Archivo**: `supabase/migrations/002_rls_rbac.sql`
- **Problema**: La política de INSERT en `tenants` requería `authorize('org.delete')`, pero durante el signup el usuario no tiene rol aún
- **Solución**: Cambiar la política a `WITH CHECK (true)` para permitir a usuarios autenticados crear tenants durante el registro

### 8. Auth UI - Logo y textos de paneles toggle
- **Archivos**: `src/components/auth/auth-forms.tsx`, `src/styles/auth-toggle.css`
- **Problema**: Logo estaba en el formulario blanco, paneles oscuros no mostraban logo, textos de login/signup estaban invertidos
- **Solución**: Logo SYMVORA movido a paneles oscuros (arriba de "Crear cuenta" y "Bienvenido de nuevo"), textos intercambiados entre paneles izquierdo/derecho

### 9. Signup form - Scroll y orden de campos
- **Archivos**: `src/components/auth/auth-forms.tsx`, `src/components/ui/accordion.tsx`, `src/styles/auth-toggle.css`
- **Problema**: Formulario de registro muy largo, no se podía scrollear, campos en orden incorrecto, email de confirmación innecesario
- **Solución**: Formulario reorganizado con acordeones (4 secciones), logo movido a sección Empresa, email de confirmación eliminado, traducciones agregadas para títulos de secciones

### 10. CRITICAL: Onboarding no puede completarse (RLS bloquea)
- **Archivos**: `src/app/(auth)/[locale]/onboarding/page.tsx`, `supabase/migrations/004_complete_onboarding.sql`
- **Problema**: El onboarding intentaba 4 inserts separados (tenants, tenant_settings, tenant_memberships, user_roles), pero RLS bloqueaba los últimos 3 porque el usuario nuevo no tiene permisos todavía. `user_tenant_ids()` devolvía conjunto vacío, `authorize()` retornaba false.
- **Solución**: Crear función `complete_onboarding()` como `SECURITY DEFINER` que ejecuta los 4 inserts atómicamente bypassando RLS. Actualizar onboarding page para llamar `supabase.rpc('complete_onboarding', {...})`.
- **Migración**: `004_complete_onboarding.sql` — ejecutar en Supabase SQL Editor

### 11. Purchases/proveedores fallan por falta de tenant_id
- **Archivo**: `src/app/(dashboard)/[locale]/purchases/page.tsx`
- **Problema**: `handleCreatePurchase` y `handleCreateSupplier` insertaban en `compras` y `proveedores` sin incluir `tenant_id` (columna NOT NULL). Los inserts fallaban silenciosamente sin mostrar error al usuario.
- **Solución**: Obtener `tenant_id` del usuario al cargar la página, incluirlo en todos los inserts, agregar toast.error() y toast.success() para feedback.

### 12. `.single()` truena con multi-tenancy
- **Archivos**: `dashboard/page.tsx`, `settings/page.tsx`, `activity/page.tsx`, `products/page.tsx`, `pos/page.tsx`
- **Problema**: `.single()` en Supabase exige exactamente una fila. Si el usuario tiene 0 o 2+ tenants, la llamada regresa error y la página queda en blanco sin mensaje.
- **Solución**: Crear hook `src/hooks/use-current-tenant.ts` con `.limit(1)` en vez de `.single()`. Reemplazar en todas las páginas del dashboard.

### 13. Errores de escritura nunca se muestran al usuario
- **Archivos**: `purchases/page.tsx`, `settings/page.tsx`
- **Problema**: Patrón `if (!error) { ... }` sin `else` — cualquier fallo (RLS, red, validación) era indistinguible de "no hice nada".
- **Solución**: Agregar `toast.error()` y `toast.success()` en todos los flujos de escritura.

### 14. Billing page stuck on "Cargando..."
- **Archivo**: `src/app/(dashboard)/[locale]/billing/page.tsx`
- **Problema**: `fetchSubscription` fallaba silenciosamente cuando `tenantId` estaba vacío, nunca llamaba a `setLoading(false)`. También faltaba try/catch en el fetch.
- **Solución**: Agregar `try/catch`, early return con `setLoading(false)` cuando `!tenantId`, y `handleAddCard`/`handlePayOxxo` redirigen a Conekta via `window.location.href` (ya no muestran referencia OXXO)

### 15. Billing page infinite redirect loop
- **Archivo**: `src/lib/supabase/middleware.ts`
- **Problema**: `/billing` no estaba en `isPublicRoute`, así que el middleware lo bloqueaba y causaba redirect loop
- **Solución**: Agregar `/billing` a `isPublicRoute` para que usuarios con suscripción expirada puedan acceder a la página de billing

### 16. Signup RLS - "new row violates row-level security policy for table tenants"
- **Archivo**: `src/components/auth/auth-forms.tsx`
- **Problema**: Durante signup, el formulario intentaba hacer `INSERT INTO tenants` directamente, pero RLS bloqueaba porque el usuario no tiene rol aún
- **Solución**: Remover el INSERT directo a tenants del auth-forms.tsx. El `complete_onboarding` RPC (SECURITY DEFINER) maneja la creación del tenant

### 17. ON CONFLICT bug in complete_onboarding
- **Archivo**: `supabase/migrations/004_complete_onboarding.sql`
- **Problema**: `ON CONFLICT (user_id)` estaba mal — la tabla `tenant_memberships` tiene constraint en `(user_id, tenant_id)` o `(user_id, role)`, no solo `(user_id)`
- **Solución**: Cambiar a `ON CONFLICT (user_id, role)` para evitar conflictos

### 18. Conekta checkout "Failed to create checkout" sin error details
- **Archivo**: `src/app/api/conekta/create-checkout/route.ts`
- **Problema**: El catch block simplemente retornaba "Failed to create checkout" sin mostrar el error real de Conekta
- **Solución**: Agregar `console.error` con el error real y retornar un mensaje detallado (`error.message || error`) para que el usuario pueda diagnosticar el problema

### 19. CRITICAL: API routes sin autenticación (QA findings)
- **Archivos**: `src/lib/supabase/auth.ts` (nuevo helper), todas las rutas `/api/*`
- **Problema**: El QA reveló que todas las rutas API usaban `createSupabaseServiceRoleClient()` (bypass RLS) sin verificar identidad ni permisos. Cualquier llamada externa (ej. a `/api/users/invite`) podía crear miembros con rol SUPER_ADMIN
- **Solución**: Crear `requireTenantAccess(request, { tenantId?, permission?, selfUserId? })` que autentica vía cookie (nunca JWT claims), obtiene rol de `tenant_memberships` y compara contra `role_permissions`. Aplicado a: `users/invite` (org.manage_members + solo SUPER_ADMIN invita SUPER_ADMIN), `facturas/*` (billing.view/create/stamp/cancel), `conekta/create-checkout` (membresía), `trial-codes/redeem` (membresía + self), `trial-codes/generate` (SUPER_ADMIN). `trial-codes/validate` y `conekta/webhook` quedan públicos por diseño (webhook con firma)

### 20. Conekta webhook aceptaba payloads no firmados
- **Archivo**: `src/app/api/conekta/webhook/route.ts`
- **Problema**: El webhook procesaba cualquier POST sin validar firma, permitiendo falsificar eventos (ej. marcar `order.paid`)
- **Solución**: Implementar verificación RSA/SHA-256 del header `DIGEST` (Conekta no usa HMAC). Fail-closed: sin `CONEKTA_WEBHOOK_PUBLIC_KEY` rechaza con 401. Reemplaza el patrón de secreto HMAC previo (`CONEKTA_WEBHOOK_SECRET` removido de `.env.example`)

### 21. complete_onboarding: ON CONFLICT roto + sin validación de auth.uid()
- **Archivos**: `supabase/migrations/008_complete_onboarding_security.sql` (aplicada en vivo via MCP)
- **Problema**: Existían 2 overloads con drift: la 6-arg corregida en vivo pero sin auth.uid(), y la 7-arg (con `p_logo_url`) **aún con `ON CONFLICT (user_id)`** que no corresponde a la constraint real `UNIQUE(user_id, role)` (podía lanzar unique_violation). Ninguna validaba `auth.uid() = p_user_id` → cualquiera podía autoasignarse una membresía/tenant a nombre de otro usuario
- **Solución**: Migración 008 que dropea ambos overloads y crea UNA función unificada (con `p_logo_url` DEFAULT NULL, por lo que los callers de 6 y 7 args siguen funcionando) con: validación `auth.uid() = p_user_id`, `ON CONFLICT (user_id, role) DO NOTHING`, y `EXCEPTION WHEN unique_violation` para mensaje limpio del `UNIQUE(subdominio)`. Verificado en vivo

### 22. completeSale(): patrón no atómico expuesto a sobreventa
- **Archivos**: `supabase/migrations/009_complete_sale_atomico.sql` (aplicada en vivo via MCP), `src/lib/supabase/sales.ts` (refactorizado → RPC)
- **Problema**: El cliente hacía "leer stock → calcular → escribir" en 3 queries separadas; dos ventas concurrentes podían sobrevender. Además insertaba venta, detalle y stock en pasos sin transacción (datos parciales si fallaba uno)
- **Solución**: RPC `complete_sale` SECURITY DEFINER, transacción única (función plpgsql). Usa `SELECT ... FOR UPDATE` por producto (mata la sobreventa), valida stock, RBAC desde `tenant_memberships` + `role_permissions.sales.create` (no confía en JWT), valida `auth.uid() = p_usuario_id` y el cliente pertenece al tenant. `sales.ts:45` ahora llama al RPC. Los tests de `calculateSaleTotals` siguen pasando (función no removida)

### 23. Login: CAPTCHA (Turnstile) + throttle + headers de seguridad
- **Archivos**: `next.config.ts`, `src/components/auth/auth-forms.tsx`, `src/messages/{es,en}.json`, `.env.example`, deps `@marsidev/react-turnstile@1.6.0`
- **Problema**: Login/signup sin protección contra bots/brute-force y sin headers de seguridad (no CSP, no nosniff, sin HSTS)
- **Solución**:
  - **Headers** en `next.config.ts` (`headers()` + `poweredByHeader: false`): CSP (script/style/img/font/connect/frame cubriendo Supabase, Conekta, Turnstile `challenges.cloudflare.com`, unpkg Boxicons, Sentry, `'unsafe-eval'` solo en dev), `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restringida, HSTS solo en producción. Fonts self-hosted (`next/font`) por lo que no se abre googleapis/gstatic
  - **CAPTCHA Turnstile** (integración nativa Supabase): widgets en login y signup (ids de contenedor separados, refs separados), token en `options.captchaToken` de `signInWithPassword`/`signUp`. Gated por `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (sin la env no se renderiza ni rompe dev). **Activación manual**: widget en Cloudflare + toggle en Supabase Dashboard + env en Vercel
  - **Throttle en cliente**: en `handleLogin`, 5 fallos del mismo navegador → backoff exponencial (30s→15min) con countdown en vivo; reset al iniciar sesión

### 24. Navbar móvil: contraste pobre + overflow horizontal visible
- **Archivos**: `src/components/marketing/navbar.tsx`, `src/app/[locale]/page.tsx`, `src/components/marketing/legal-shell.tsx`, `src/app/globals.css`
- **Problema**: Panel móvil con `bg-white` y texto `text-neutral-600` se veía "lavado" sobre el header con backdrop-blur. Además, una "línea negra" aparecía al hacer scroll lateral porque alguna sección causaba overflow horizontal y el header `fixed` no cubría todo el viewport
- **Solución**:
  - **Panel móvil** → fondo negro puro (`bg-black text-white`), items `text-neutral-300`/`text-neutral-400`, separadores `border-white/10`, CTA "Comenzar gratis" invertido a `bg-white text-black`
  - **Header** → nueva lógica `headerOpaque = scrolled || mobileOpen`: cuando mobileOpen es true el header pasa a `bg-black border-white/10` para evitar parpadeo al cerrar; ícono X del hamburger se vuelve blanco
  - **Overflow fix** → `overflow-x-hidden` en `html`/`body` (globals.css) y wrappers `page.tsx`/`legal-shell.tsx` como red de seguridad

### 25. Páginas 404 inexistentes
- **Archivos**: `src/app/[locale]/not-found.tsx` (nuevo), `src/app/not-found.tsx` (nuevo), `src/app/[locale]/terminos/page.tsx` (expandido), `src/messages/es.json`, `src/messages/en.json`
- **Problema**: No existía ninguna página 404 personalizada. Términos y Condiciones solo tenía 10 secciones, faltando cobertura legal típica de SaaS mexicanos
- **Solución**:
  - **`/[locale]/not-found.tsx`**: Cliente component con animación `motion` (fadeInUp escalonado), "404" display gigante (`text-[clamp(7rem,18vw,11rem)]`), título, descripción, 2 CTAs (Link "Ir al inicio" vía next-intl navigation + button "Volver" con `window.history.back()`)
  - **`/not-found.tsx` (raíz)**: Server component minimalista con Link a `/es` como fallback para rutas fuera del locale
  - **Términos**: Añadidas §11 Modificaciones (15 días de aviso), §12 Soporte técnico (canales email + horarios), §13 SLA (según disponibilidad, exclusiones), §14 Confidencialidad (3 años post-terminación), §15 Cesión, §16 Fuerza mayor, §17 Indemnidad
  - **i18n**: Bloque `notFound` con keys `code`, `title`, `description`, `home`, `back` en ambos idiomas

### 26. Cumplimiento legal completo (3.A consentimiento, 3.B accesibilidad, 3.C auditoría, 3.D notificación)
- **Archivos**: `src/components/auth/auth-forms.tsx`, `src/lib/validations/schemas.ts`, `src/lib/legal/versions.ts`, `supabase/migrations/010_legal_acceptance.sql`, `src/app/api/legal/accept/route.ts`, `src/app/api/legal/current-versions/route.ts`, `src/components/compliance/policy-update-banner.tsx`, `src/components/dashboard/legal-footer.tsx`, `src/components/dashboard/dashboard-shell.tsx`, `src/app/[locale]/terminos/page.tsx`, `src/app/[locale]/aviso-privacidad/page.tsx`, `src/messages/{es,en}.json`
- **Problema**: Auditoría reveló que el cumplimiento legal estaba incompleto: (a) sin checkbox de consentimiento expreso en signup, solo un texto legal; (b) sin footer legal en dashboard; (c) sin tabla de auditoría que registrara versiones aceptadas, IP y timestamp; (d) sin mecanismo para notificar cambios de políticas. Además, T&C no mencionaba propiedad de datos del usuario, reembolsos ni periodo de prueba; Aviso de Privacidad no incluía IP ni Cloudflare/Sentry como terceros
- **Solución**:
  - **3.A Consentimiento expreso**: Checkbox obligatorio (`<input type="checkbox" required>`) antes del botón submit con texto "Acepto los Términos y Condiciones y he leído el Aviso de Privacidad" + links a ambos documentos con `target="_blank" rel="noopener noreferrer"`. Botón submit deshabilitado hasta que se marque. Validación Zod: `acceptTerms: z.literal(true)` con mensaje custom. i18n en `auth.acceptTermsIntro/And/Suffix/Terms/Privacy`
  - **3.B Accesibilidad**: Footer legal en dashboard (`LegalFooter`) con links a Términos/Privacidad/Cookies; visible en cada página del dashboard (no solo en landing)
  - **3.C Auditoría**: Migración `010_legal_acceptance.sql` crea tabla `legal_acceptances` con `user_id`, `terms_version`, `privacy_version`, `cookies_version`, `ip_address` (inet), `user_agent` y `accepted_at`. RLS: usuarios solo ven/insertan sus propias filas. UNIQUE INDEX evita duplicados por versión. Versiones constantes en `src/lib/legal/versions.ts`. Endpoint `POST /api/legal/accept` captura IP (`x-forwarded-for`/`x-real-ip`) + user_agent e inserta. Llamada desde `auth-forms.tsx` después de `signUp` exitoso (no bloqueante — el checkbox ya es evidencia)
  - **3.D Notificación de cambios**: `PolicyUpdateBanner` (cliente component) consulta `GET /api/legal/current-versions` al montar en el dashboard; si hay mismatch entre versión aceptada y versión vigente, muestra banner prominente con botón "Aceptar" (registra nueva versión vía `/api/legal/accept`) y X para dismiss (24h en localStorage `symvora_policy_banner_dismissed_until`). T&C §11 menciona 15 días de aviso. Aviso §9 detalla procedimiento de notificación
  - **Contenido Términos**: §5.1 trial 7 días, §5.2 reembolsos (sin reembolso, cancelación al final del periodo), §7.1 propiedad de datos del usuario (inventario/ventas/CFDI son del usuario, SYMVORA solo encargado)
  - **Contenido Aviso**: §2 incluye IP + datos técnicos + datos de uso; §5 incluye Cloudflare Turnstile y Sentry como terceros; §9 detalla notificación (correo + banner prominente + 15 días anticipación)

### 28. Self-Serve Demo interactiva ('Abarrotes Don Pedro')
- **Archivos**: `supabase/migrations/012_demo_seed.sql`, `supabase/migrations/013_demo_user_seed.sql`, `src/app/api/demo/start/route.ts`, `src/app/[locale]/demo/page.tsx`, `src/components/demo/demo-banner.tsx`, `src/components/dashboard/dashboard-shell.tsx`, `src/components/marketing/hero.tsx`, `src/messages/{es,en}.json`
- **Problema**: El botón "Ver demo" del hero (`hero.tsx`) era un `<motion.button>` sin acción. El funnel SaaS moderno exige "self-serve demo" — dejar al visitante probar la UI real sin registrarse.
- **Solución**: Click en "Ver demo" navega a `/<locale>/demo`, un client component que llama `POST /api/demo/start`. Esa API: (1) ejecuta `public.reset_demo_tenant()` (RPC idempotente con `pg_advisory_xact_lock` para serializar resets concurrentes); (2) genera un magic link para `demo@symvora.com` vía `supabase.auth.admin.generateLink({ redirectTo: <origin>/api/auth/callback?next=/es/dashboard?demo=1 })`; (3) devuelve el `action_link` y el frontend redirige. Supabase verifica el token → callback intercambia `code` por sesión → redirige a `/es/dashboard?demo=1`. Rate limit en memoria: 5 req/min/IP.
- **Snapshot del tenant demo** (cada reset lo recrea desde cero): 20 productos de abarrotes mexicanos típicos, 10 clientes del barrio, 30 ventas históricas distribuidas en los últimos 30 días con 1-3 productos cada una, 1 caja abierta con movimientos ENTRADA, suscripción ACTIVE (evita redirect a /billing), legal_acceptances v1.0 (evita banner de actualización). Demo user con rol `ORG_ADMIN` para que el visitante vea todas las features.
- **DemoBanner**: client component que lee `?demo=1` de `useSearchParams()` y renderiza un banner sticky `bg-gradient-to-r from-blue-600 to-purple-600` arriba del DashboardShell con texto "Estás probando la demo. Los datos se reinician al salir." + botones "Crear mi cuenta gratis" (→ `/es/signup`) y "Salir" (signOut + redirect a `/`). i18n en `landing.demo.banner.{text,cta,exit}`.
- **Seguridad**: el demo user es `ORG_ADMIN` pero solo ve el tenant demo (subdominio `abarrotes-don-pedro`) — no puede escapar a otros tenants vía RLS. La contraseña del demo user es aleatoria (nunca publicada); el login es exclusivamente por magic link que la API genera server-side. El banner disuade de intentar exploits.
- **Detalles PL/pgSQL**: `legal_acceptances` se referencia con `EXCEPTION WHEN undefined_table THEN NULL` porque la migración 010 puede no estar aplicada (BD que no tienen módulo legal habilitado). El `auth.users.email` no tiene constraint UNIQUE en este proyecto — la inserción del demo user se hace con `IF NOT EXISTS` en lugar de `ON CONFLICT (email)`.
- **Verificación**: `reset_demo_tenant()` probado 3 veces consecutivas en BD, devuelve mismas cuentas (20/10/30) — totalmente idempotente. `complete_sale()` funciona con el demo user (test ejecutado: venta registrada OK). 51 tests vitest, tsc, eslint verdes.

### 27. CRITICAL: complete_sale() confiaba en precioUnitario del cliente + página onboarding huérfana
- **Archivos**: `supabase/migrations/011_complete_sale_precio_desde_db.sql` (fix RPC), `src/lib/supabase/sales.ts`, `src/__tests__/complete-sale.test.ts`, `supabase/tests/complete_sale.sql`, `src/app/api/users/invite/route.ts`, `src/messages/{es,en}.json`, eliminado `src/app/(auth)/[locale]/onboarding/page.tsx`
- **Problema A (integridad de precio)**: `complete_sale()` registraba en `detalle_ventas.precio_unitario` el `precioUnitario` enviado por el cliente en `p_items`. Un atacante con llamada directa al RPC (misma firma que el frontend) podía registrar ventas a un precio inventado/menor mientras el stock real se descontaba — pérdida económica sin fricción.
- **Solución A**: Migración `011` reescribe el RPC para IGNORAR `precioUnitario` por completo: Pass 1 hace `SELECT ... FOR UPDATE` sobre `productos` y usa `productos.precio_venta` como única fuente de verdad, clampa el descuento de línea a `[0, subtotal de línea]` (nunca totales negativos), y guarda `(producto_id, cantidad, precio_venta, descuento)` en una temp table `_venta_items`; Pass 2 inserta `detalle_ventas` y decrementa stock desde esa tabla. Cliente `sales.ts` ya no envía `precioUnitario` al RPC (la interfaz `SaleItem` lo conserva solo para totales de UI).
- **Detalles PL/pgSQL encontrados en el camino**: (a) un `FOR ... IN SELECT` de varias columnas con variable de tipo `jsonb` falla con `22P02 invalid input syntax for type json` (Postgres castea la fila compuesta a jsonb por texto) — se usa `v_line RECORD`; (b) una temp table con `ON COMMIT DROP` NO se suelta hasta el COMMIT, así que llamar al RPC dos veces en la misma transacción (p.ej. un DO block con 8 ventas) falla con `relation "_venta_items" already exists` — fix: `DROP TABLE IF EXISTS` antes del `CREATE TEMP TABLE` y sin `ON COMMIT DROP`.
- **Problema B (código muerto)**: `src/app/(auth)/[locale]/onboarding/page.tsx` era huérfana (no había links/redirects hacia ella desde `src/`, el grep del usuario lo confirmó salvo una referencia que sí existía) y duplicaba lógica vieja del flujo de creación de tenant (`complete_onboarding`), que ahora vive en `auth-forms.tsx`. Invitados (magic link) llegaban a `/onboarding` por `src/app/api/users/invite/route.ts:63`.
- **Solución B**: Eliminada la página. Redirect de invitados en `route.ts` ahora apunta a `/es/dashboard` (ya tienen tenant_id + rol + membresía creados en el flujo de invite). Borrados los bloques `onboarding` muertos de `es.json` (había 2, uno con claves duplicadas) y `en.json`.
- **Verificación**: Smoke test `supabase/tests/complete_sale.sql` ampliado a 8 checks (precio desde BD ignorando `precioUnitario=1`, clamp de descuento 99999→subtotal, descuento legítimo preservado, RBAC, stock). 51 tests vitest + tsc + eslint verdes.

---

## Skills Instaladas

### Ubicación
```
.agents/skills/
├── animate/                          # Construir animaciones desde cero
├── animation-vocabulary/             # Vocabulario de animaciones
├── apple-design/                     # Filosofía de diseño Apple para web
├── brandkit/                         # Kit de marca y diseño
├── design-taste-frontend/            # Anti-slop frontend: landing pages, portfolios, redesigns
├── design-taste-frontend-v1/         # Versión anterior de design-taste-frontend
├── emil-design-eng/                  # Filosofía de Emil Kowalski: polish, componentes, animación
├── find-animation-opportunities/     # Buscar oportunidades de animación en el código
├── full-output-enforcement/          # Asegurar output completo
├── gpt-taste/                        # Design taste para GPT
├── high-end-visual-design/           # Diseño visual de alta gama
├── image-to-code/                    # Convertir imágenes a código
├── imagegen-frontend-mobile/         # Generación de imágenes para frontend móvil
├── imagegen-frontend-web/            # Generación de imágenes para frontend web
├── impeccable/                       # Design director: critique, audit, polish, animate, etc.
├── improve-animations/               # Auditar y mejorar animaciones existentes
├── industrial-brutalist-ui/          # Estilo industrial brutalista
├── minimalist-ui/                    # UI minimalista
├── pick-ui-library/                  # Elegir la librería correcta para cada tarea
├── prototype/                        # Prototipar variantes de UI con picker visual
├── redesign-existing-projects/       # Rediseñar proyectos existentes
├── review-animations/                # Revisar/criticar animaciones existentes
├── stitch-design-taste/              # Unir design taste en código
├── supabase/                         # Skill Supabase: auth, RLS, MCP, CLI, schema changes
└── supabase-postgres-best-practices/ # Postgres best practices: queries, indexes, RLS, security
```

---

### Package 1: emilkowalski/skill (9 skills)

**Autor:** Emil Kowalski (creador de Sonner, Vaul)
**Filosofía:** Los detalles invisibles se acumulan para crear interfaces que la gente ama sin saber por qué.

| Skill | Descripción | Cuándo usar |
|---|---|---|
| `emil-design-eng` | Filosofía completa de design engineering: animación, componentes, polish, CSS transforms, spring animations, accesibilidad | Revisar/polish de UI, construir componentes que se sientan bien |
| `animate` | Construir animaciones desde cero con el framework de decisión correcto | Cuando se pide animar algo, agregar movimiento, hacer un componente "vivo" |
| `review-animations` | Criticar/revisar animaciones existentes con estándares de Emil | Cuando se necesita auditar animaciones en el código |
| `improve-animations` | Auditar todo el codebase buscando mejoras de animación | Auditoría completa de motion en el proyecto |
| `find-animation-opportunities` | Buscar lugares en el código donde agregar animación tendría impacto | Explorar el proyecto buscando oportunidades de motion |
| `pick-ui-library` | Elegir la librería correcta para cada tarea (toasts, drag & drop, charts, etc.) | Cuando se necesita una librería y no se cuál usar |
| `prototype` | Construir múltiples variantes de un componente UI con picker visual | Explorar direcciones de diseño antes de comprometerse |
| `animation-vocabulary` | Vocabulario y patrones de animación | Aprender sobre animaciones |
| `apple-design` | El enfoque de Apple en interfaces fluidas, springs, drag/swipe, materiales translúcidos | Construir UI con física, springs, drag gestures |

**Reglas clave de Emil:**
- **Nunca animar acciones de teclado** (100+ veces/día)
- **Nunca usar `ease-in`** en UI (empieza lento, se siente pesado)
- **Nunca animar desde `scale(0)`** (empezar desde `scale(0.95)` + `opacity: 0`)
- **Duration UI < 300ms** (180ms dropdown se siente más rápido que 400ms)
- **Solo animar `transform` y `opacity`** (GPU, salta layout/paint)
- **Usar spring para gestures** (son interruptibles, llevan velocidad)
- **Botones: `scale(0.97)` en `:active`** (feedback táctil instantáneo)
- **`transform-origin` en el trigger** para popovers/dropdowns (no en el centro)

---

### Package 2: pbakaus/impeccable (1 skill)

**Skill:** `impeccable`
**Versión:** 4.0.4
**Descripción:** Design director con comprensión impecable de lo que hace excepcional al diseño. Cubre: UX review, jerarquía visual, arquitectura de información, accesibilidad, performance, theming, tipografía, spacing, layout, color, motion, micro-interacciones, i18n, y design systems.

**Modos de operación:**

| Modo | Descripción |
|---|---|
| `Persuade` | El visitante decide y actúa. Landing pages, marketing, pricing. |
| `Operate` | El visitante completa una tarea. App UI, dashboards, settings, tools. |
| `Read` | El visitante entiende algo. Docs, articles, guides. |
| `Experience` | El visitante está dentro del trabajo. Portfolios, galleries. |

**Comandos disponibles:**

| Comando | Categoría | Descripción |
|---|---|---|
| `shape [feature]` | Build | Planificar UX/UI antes de escribir código |
| `init` | Build | Capturar contexto del producto en PRODUCT.md |
| `document` | Build | Generar DESIGN.md desde código existente |
| `extract [target]` | Build | Extraer tokens y componentes reutilizables |
| `critique [target]` | Evaluate | Review de UX con scoring heurístico |
| `audit [target]` | Evaluate | Checks técnicos (a11y, perf, responsive) |
| `polish [target]` | Refine | Paso de calidad final antes de shippear |
| `bolder [target]` | Refine | Amplificar diseños seguros o aburridos |
| `quieter [target]` | Refine | Reducir diseños agresivos |
| `distill [target]` | Refine | Reducir a la esencia |
| `harden [target]` | Refine | Production-ready: errores, i18n, edge cases |
| `onboard [target]` | Refine | Diseñar flujos de primera vez, empty states |
| `animate [target]` | Enhance | Agregar animaciones y motion |
| `colorize [target]` | Enhance | Agregar color estratégico |
| `typeset [target]` | Enhance | Mejorar jerarquía tipográfica |
| `layout [target]` | Enhance | Corregir spacing, ritmo, jerarquía visual |
| `delight [target]` | Enhance | Agregar personalidad y toques memorables |
| `adapt [target]` | Fix | Adaptar para diferentes dispositivos |
| `optimize [target]` | Fix | Diagnosticar y corregir performance UI |
| `live` | Iterate | Modo variante visual: elegir elementos en el browser |

**Setup:** Ejecutar `node .agents/skills/impeccable/scripts/context.mjs` una vez por sesión.

---

### Package 3: Leonxlnx/taste-skill (13 skills)

**Descripción:** Anti-slop frontend skill para landing pages, portfolios y redesigns. El agente lee el brief, infiere la dirección de diseño correcta, y envía interfaces que no se ven como templates.

| Skill | Descripción |
|---|---|
| `design-taste-frontend` | Skill principal: brief inference, 3 dials (DESIGN_VARIANCE, MOTION_INTENSITY, VISUAL_DENSITY), anti-default discipline, layout rules |
| `design-taste-frontend-v1` | Versión anterior del skill principal |
| `high-end-visual-design` | Diseño visual de alta gama |
| `minimalist-ui` | UI minimalista |
| `industrial-brutalist-ui` | Estilo industrial brutalista |
| `brandkit` | Kit de marca y identidad visual |
| `gpt-taste` | Design taste para GPT |
| `image-to-code` | Convertir imágenes/mockups a código frontend |
| `imagegen-frontend-web` | Generación de imágenes para web |
| `imagegen-frontend-mobile` | Generación de imágenes para móvil |
| `redesign-existing-projects` | Rediseñar proyectos existentes con auditoría primero |
| `stitch-design-taste` | Unir design taste en implementación de código |
| `full-output-enforcement` | Asegurar output completo y no truncado |

**Los 3 Dials de diseño (configuración core):**

| Dial | Rango | Default | Descripción |
|---|---|---|---|
| `DESIGN_VARIANCE` | 1-10 | 8 | 1 = Simetría perfecta, 10 = Caos artístico |
| `MOTION_INTENSITY` | 1-10 | 6 | 1 = Estático, 10 = Cinematográfico/Física |
| `VISUAL_DENSITY` | 1-10 | 4 | 1 = Galería de arte/Aire, 10 = Cockpit/Datos |

**Presets por caso de uso:**

| Caso | VARIANCE | MOTION | DENSITY |
|---|---|---|---|
| Landing SaaS mainstream | 7 | 6 | 4 |
| Landing Agency/creativa | 9 | 8 | 3 |
| Landing Premium consumer | 7 | 6 | 3 |
| Portfolio Designer/studio | 8 | 7 | 3 |
| Portfolio Developer | 6 | 5 | 4 |
| Editorial/Blog | 6 | 4 | 3 |
| Sector público | 3 | 2 | 5 |

**Reglas Anti-Slop (patrones prohibidos):**
- No gradientes púrpura de IA por defecto
- No heroes centrados con mesh oscuro
- No 3 cards de features iguales
- No glassmorphism genérico en todo
- No Inter + slate-900 como default
- No serifs como default (solo si el brief lo pide explícitamente)
- No `h-screen` para heroes (usar `min-h-[100dvh]`)
- No flexbox math complejo (usar CSS Grid)
- Máximo 1 marquee por página
- Máximo 1 eyebrow por 3 secciones

---

### Package 4: supabase/agent-skills (2 skills)

**Descripción:** Skills oficiales de Supabase para desarrollar con Supabase de forma segura y óptima.

| Skill | Descripción |
|---|---|
| `supabase` | Guía completa de Supabase: auth, RLS, MCP server, CLI, schema changes, seguridad, changelog |
| `supabase-postgres-best-practices` | Postgres best practices: query performance, connection management, RLS, schema design, locking |

**Puntos clave del skill `supabase`:**
- **Siempre verificar changelog** antes de implementar cambios de Supabase
- **Nunca usar `user_metadata`** para autorización (es user-editable)
- **RLS en todos los schemas expuestos** — tablas en `public` son accesibles vía Data API
- **Views bypass RLS por defecto** — usar `security_invoker = true` en Postgres 15+
- **UPDATE requiere SELECT policy** — sin ella, updates retornan 0 rows silenciosamente
- **`TO authenticated` solo es autenticación** — combinar con ownership predicate
- **MCP Server**: configurado en `opencode.json` con OAuth flow
  - URL: `https://mcp.supabase.com/mcp?project_ref=ffswcgrahxsczvydngrd`
  - Auth: `opencode mcp auth supabase`

**Reglas de schema changes:**
1. Para cambios en DB, usar `execute_sql` (MCP) o `supabase db query` (CLI)
2. NO usar `apply_migration` para cambios locales (crea history entries en cada call)
3. Cuando estés listo para commit: advisors -> security checklist -> `supabase db pull`
4. Siempre verificar `supabase --version` antes de usar comandos CLI

---

### Uso de Skills en el Proyecto SYMVORA

**Para el POS y dashboards (modo Operate):**
- `impeccable` con comando `critique` o `audit` para revisar UX
- `emil-design-eng` para polishear componentes interactivos
- `animate` para agregar motion al POS (botones de pago, carrito)

**Para landing page/marketing (modo Persuade):**
- `design-taste-frontend` para dirección de diseño
- `impeccable` con comando `shape` para planificar
- `prototype` para explorar variantes visuales

**Para animaciones específicas:**
- `animate` para construir desde cero
- `review-animations` para criticar lo existente
- `improve-animations` para auditoría completa
- `apple-design` para springs y física fluida

**Para elegir librerías:**
- `pick-ui-library` para Sonner (toasts), base-ui (primitivas), recharts (gráficas), etc.

---

## Plan Pendiente: Completar Módulo de Facturación (CFDI 4.0 + Suscripciones)

**Fecha del plan:** 2026-08-12
**Estado:** En progreso — módulo base implementado (schema, APIs, UI, librerías); pendiente la configuración fiscal para producción

### Lo que ya existe

1. **Suscripciones SaaS (Conekta)**: Checkout, webhooks, códigos de prueba, UI funcional (`/billing`)
2. **Facturación CFDI 4.0**: Schema de BD (migración 007), APIs (crear, timbrar, cancelar), UI de facturación (`/facturas`) con tabla, formulario de creación, filtros, timbrado y cancelación
3. **Librerías CFDI**: `catalogs.ts` (catálogos SAT), `pac-client.ts` (Finkok + SWSapien), `xml-generator.ts` (generación CFDI 4.0)

### Pendientes por implementar

#### Fase 1: Configuración Fiscal (PREREQUISITO para producción)

**1.1 UI de Configuración Fiscal**
- Archivo: `src/app/(dashboard)/[locale]/facturas/config/page.tsx`
- Formulario para configurar datos del emisor fiscal
- Campos: RFC, Razón Social, Régimen Fiscal, Código Postal
- Configuración del PAC: proveedor (finkok/swsapien), usuario, contraseña
- Certificados: CER, KEY, contraseña del certificado
- Email de envío de facturas
- Guardar en `tenant_settings.configuracion_fiscal` como `TenantConfiguracionFiscal`
- Seguir patrón de `settings/page.tsx` (Tabs, Card, toast)
- Agregar link en sidebar o en la página de facturas

**1.2 API para guardar configuración fiscal**
- Archivo: `src/app/api/facturas/config/route.ts`
- GET: obtener configuración fiscal del tenant
- POST/PUT: guardar configuración fiscal
- Validar datos requeridos antes de guardar

#### Fase 2: Descarga de XML/PDF

**2.1 API de descarga XML**
- Archivo: `src/app/api/facturas/[id]/xml/route.ts`
- GET: devuelve el XML timbrado de una factura
- Opción A: Guardar XML en Supabase Storage y servir desde ahí
- Opción B: Regenerar el XML al vuelo usando `generateCFDIXML()` + datos de la factura timbrada

**2.2 API de descarga PDF**
- Archivo: `src/app/api/facturas/[id]/pdf/route.ts`
- Usar `jsPDF` + `jspdf-autotable` (ya en package.json)
- Generar PDF con layout CFDI: emisor, receptor, conceptos, impuestos, totales, QR del CFDI
- Incluir UUID, fecha de timbrado, sello digital
- Guardar PDF en Supabase Storage

**2.3 Botones de descarga en tabla de facturas**
- Archivo: `facturas/page.tsx`
- Agregar botones "Descargar XML" y "Descargar PDF" en columna de acciones
- Solo visibles para facturas con estado TIMBRADA
- Iconos: `Download` de lucide-react

#### Fase 3: Historial de Pagos (Suscripciones)

**3.1 Consultar `payment_history` en billing page**
- Archivo: `billing/page.tsx`
- Reemplazar placeholder "No hay pagos registrados" con tabla real
- Query: `supabase.from("payment_history").select("*").eq("subscription_id", subscription.id).order("paid_at", { ascending: false })`
- Mostrar: fecha, monto, método de pago, estado, ID de orden Conekta

#### Fase 4: Cancelar Suscripción con Conekta

**4.1 API para cancelar**
- Archivo: `src/app/api/conekta/cancel-subscription/route.ts`
- POST: recibe `tenant_id`
- Busca `conekta_customer_id` en `subscriptions`
- Llama a `cancelSubscription(customerId)` de `src/lib/conekta/subscriptions.ts`
- Actualiza BD: `subscriptions.status = "canceled"`, `tenants.subscription_status = "canceled"`
- Retorna éxito/error

**4.2 Actualizar UI de cancelación**
- Archivo: `billing/page.tsx`
- Cambiar `handleCancelSubscription` para llamar a la API en vez de actualizar BD directamente
- Usar Dialog de confirmación en vez de `confirm()`

#### Fase 5: Vista de Detalle de Factura

**5.1 Página de detalle**
- Archivo: `src/app/(dashboard)/[locale]/facturas/[id]/page.tsx`
- Mostrar todos los datos: emisor, receptor, conceptos, impuestos, totales
- Datos CFDI: UUID, fecha timbrado, PAC, sello
- Botones de descarga XML/PDF
- Botón de cancelar (si TIMBRADA)
- Botón de regresar a la lista

#### Fase 6: Endpoints de Producción del PAC

**6.1 Fix `pac-client.ts`**
- Archivo: `src/lib/cfdi/pac-client.ts`
- `getEndpoint()` línea 41 retorna demo URL para producción — CORREGIR
- Finkok producción: `https://app.finkok.com/sessions/sign` (stamp) y `https://app.finkok.com/cancel/cancel` (cancel) — ya están correctos en `stamp()` pero `getEndpoint()` está mal
- Eliminar `getEndpoint()` que no se usa, o corregirlo
- Hacer que `isTest` se lea de configuración o variable de entorno

#### Fase 7: Tests

**7.1 Tests de CFDI**
- Archivo: `__tests__/cfdi.test.ts`
- Test `generateCFDIXML()` con datos mock
- Test `parseCFDIXML()` con XML de respuesta mock
- Test `createPACClient()` devuelve cliente correcto según proveedor

**7.2 Tests de APIs de facturación**
- Archivo: `__tests__/facturas.test.ts`
- Test crear factura (validación de campos requeridos)
- Test timbrar (mock PAC client)
- Test cancelar

#### Fase 8: Hardening

**8.1 Hardcode locale en redirects**
- `onboarding/page.tsx:331` → usar `router.push(\`/\${locale}/billing\`)`
- `billing/success/page.tsx:26,59` → usar locale dinámico
- `auth-forms.tsx:298` → mismo fix

**8.2 Guardar XML y PDF en la BD**
- En `stamp/route.ts`: después de timbrar, guardar `xml_url` y `pdf_url` en la factura
- Usar Supabase Storage o regenerar on-demand

### Orden de ejecución recomendado

1. **1.1 + 1.2** → Config fiscal (sin esto no se puede timbrar en producción)
2. **6.1** → Fix endpoints PAC (rápido, 5 min)
3. **8.1** → Fix locales hardcodeados (rápido)
4. **2.1 + 2.2 + 2.3** → Descarga XML/PDF
5. **3.1** → Historial de pagos
6. **4.1 + 4.2** → Cancelar con Conekta
7. **5.1** → Vista detalle factura
8. **7.1 + 7.2** → Tests
9. **8.2** → Persistencia de archivos

### Archivos clave para referencia

| Archivo | Descripción |
|---|---|
| `src/lib/cfdi/catalogs.ts` | Catálogos SAT (formas de pago, usos CFDI, etc.) |
| `src/lib/cfdi/pac-client.ts` | Clientes PAC: Finkok + SWSapien |
| `src/lib/cfdi/xml-generator.ts` | Generador XML CFDI 4.0 |
| `src/app/api/facturas/create/route.ts` | API crear factura (BORRADOR) |
| `src/app/api/facturas/stamp/route.ts` | API timbrar factura via PAC |
| `src/app/api/facturas/cancel/route.ts` | API cancelar factura via PAC |
| `src/app/api/facturas/list/route.ts` | API listar facturas |
| `src/app/(dashboard)/[locale]/facturas/page.tsx` | UI principal de facturación |
| `src/app/(dashboard)/[locale]/billing/page.tsx` | UI de suscripciones |
| `src/lib/types/database.ts` | Tipos TypeScript (línea 1084: `TenantConfiguracionFiscal`) |
| `src/lib/conekta/subscriptions.ts` | Funciones Conekta (create, cancel, pause, resume) |
| `supabase/migrations/007_facturacion.sql` | Schema de BD para facturación |
