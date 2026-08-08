# SYMVORA SaaS - Contexto del Proyecto

## Visión General

SYMVORA es un **SaaS multi-tenant ERP/POS** para negocios en México (punto de venta, inventario, finanzas, compras). Diseñado para tiendas de abarrotes, verdulerías, mascotas, ropa, ferreterías y farmacias. Stack: **Next.js 16.3 + Supabase + Tailwind v4 + TypeScript**.

---

## Estructura del Proyecto

```
symvora-saas/
├── .env.local                          # Credenciales Supabase (gitignored)
├── .env.local.example                  # Plantilla de variables de entorno
├── components.json                     # Configuración shadcn/ui v4
├── eslint.config.mjs                   # ESLint 9 flat config
├── next.config.ts                      # Next.js + next-intl plugin
├── postcss.config.mjs                  # @tailwindcss/postcss (Tailwind v4)
├── tsconfig.json                       # TypeScript, alias @/* -> ./src/*
├── opencode.json                       # Config opencode: MCP Supabase server
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql      # Schema completo + RLS + seed
│       ├── 002_rls_rbac.sql           # RBAC fix: políticas granulares por operación
│       └── 003_activity_logs.sql       # Tabla activity_logs + función log_activity()
└── src/
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
    │   │   ├── server.ts              # Cliente server (cookies)
    │   │   ├── middleware.ts          # Refresh sesión + auth guard
    │   │   └── activity-logger.ts     # Helper para registrar acciones en activity_logs
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
    │   └── ui/                        # 20+ componentes shadcn/ui (base-nova)
    │       ├── sonner.tsx             # Toaster con theme del proyecto
    │       ├── data-table-toolbar.tsx # Toolbar con botones export CSV/PDF
    │       ├── password-input.tsx     # Input contraseña con toggle + checklist
    │       ├── file-upload.tsx        # Drag & drop logo
    │       └── color-picker.tsx       # Grid 8 paletas de colores
    └── app/
        ├── layout.tsx                  # Root layout: fuentes, ThemeProvider, Toaster
        ├── page.tsx                    # Redirect a /es
        ├── [locale]/layout.tsx         # Locale wrapper: NextIntlClientProvider
        ├── api/auth/callback/route.ts  # OAuth callback
        ├── (auth)/[locale]/
        │   ├── login/page.tsx          # Login email/password
        │   ├── signup/page.tsx         # Registro mejorado: nombre split, establecimiento, logo, color, contraseña con checklist
        │   └── onboarding/page.tsx     # Wizard 4 pasos: empresa -> giro -> review -> completo
        └── (dashboard)/[locale]/
            ├── layout.tsx              # Sidebar + Header + contenido + CommandMenu
            ├── loading.tsx             # Skeleton loader general
            ├── dashboard/page.tsx      # Dashboard con Recharts: KPIs + 3 gráficas
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
| `/[locale]/products` | `(dashboard)` | Catálogo de productos con búsqueda |
| `/[locale]/pos` | `(dashboard)` | Terminal punto de venta |
| `/[locale]/purchases` | `(dashboard)` | Órdenes de compra + proveedores |
| `/[locale]/finances` | `(dashboard)` | Gestión de caja y movimientos |
| `/[locale]/users` | `(dashboard)` | Gestión de usuarios y roles |
| `/[locale]/activity` | `(dashboard)` | Bitácora de actividad |
| `/[locale]/settings` | `(dashboard)` | Configuración del tenant |
| `/api/auth/callback` | API | OAuth code exchange |

---

## Cómo funciona la Autenticación

1. **Signup**: Nombre (4 campos) + Nombre establecimiento + Logo + Color + Email + Password con checklist -> `supabase.auth.signUp()` -> crea tenant -> redirige a `/es/onboarding`
2. **Onboarding** (4 pasos):
   - Paso 1: Nombre empresa + subdominio
   - Paso 2: Seleccionar giro (ABARROTES, VERDULERIA, MASCOTAS, ROPA, FERRETERIA, FARMACIA, GENERAL)
   - Paso 3: Revisión
   - Paso 4: Crea 4 registros: `tenants`, `tenant_settings` (con config por defecto del giro), `tenant_memberships` (ORG_ADMIN), `user_roles` (ORG_ADMIN)
3. **Login**: Email/password -> `supabase.auth.signInWithPassword()` -> redirige a `/es/dashboard`
4. **Sesión**: Middleware refresca JWT en cada request via `getUser()`. El `custom_access_token_hook` inyecta `user_role` y `tenant_id` en el JWT
5. **Logout**: `supabase.auth.signOut()` -> redirige a `/es/login`
6. **Protección de rutas**: Middleware verifica autenticación; usuarios no autenticados son redirigidos a `/es/login`

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

- **Panel izquierdo**: Campo entrada código de barras + botón agregar
- **Panel derecho**: Carrito gestionado por Zustand (`useCartStore`)
  - Items con nombre, precio unitario, cantidad (+/-), eliminación
  - Cálculos: subtotal, descuento, total
- **Sección de pago**: 4 métodos (Efectivo, Tarjeta, Transferencia, Crédito)
- **Acciones**: Completar venta, vaciar carrito

**Store del carrito** (`src/stores/cart.ts`):
- `addItem` (merge si existe), `removeItem`, `updateQuantity`, `updateDiscount`, `clearCart`
- `getSubtotal()`, `getDiscount()`, `getTotal()`, `getItemCount()`

**Estado actual**: El POS tiene la UI completa pero no está conectado a la base de datos. Las páginas de productos, usuarios, etc. tienen datos placeholder.

---

## Configuración de i18n

- **Librería**: `next-intl` v4.13.5
- **Idiomas**: Español (`es`, default) e Inglés (`en`)
- **Patrón URL**: Todas las rutas con prefijo `/[locale]/`
- **Provider**: `NextIntlClientProvider` envuelve todas las páginas
- **Archivos**: `src/messages/es.json` (~260 keys) y `src/messages/en.json` (~260 keys)

---

## Base de Datos (Supabase)

### Enums (7)
| Enum | Valores |
|---|---|
| `app_role` | SUPER_ADMIN, ORG_ADMIN, CAJERO |
| `unidad_medida` | PIEZA, KG, GRAMO, LITRO, SERVICIO |
| `metodo_pago` | EFECTIVO, TARJETA, TRANSFERENCIA, CREDITO |
| `estado_venta` | COMPLETADA, CANCELADA, PENDIENTE |
| `estado_compra` | PENDIENTE, RECIBIDA, CANCELADA |
| `estado_caja` | ABIERTA, CERRADA |
| `tipo_movimiento` | ENTRADA, SALIDA |

### Tablas (13)
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

### Funciones SQL
- `user_tenant_ids()` - Retorna UUID[] de tenants del usuario actual
- `authorize(permission)` - Verifica si el rol tiene un permiso (usado en RLS policies)
- `custom_access_token_hook()` - Inyecta user_role y tenant_id en el JWT
- `log_activity()` - Registra acciones en activity_logs (CREATE/UPDATE/DELETE)

### Migraciones
- `001_initial_schema.sql` - Schema completo + RLS (políticas FOR ALL inseguras)
- `002_rls_rbac.sql` - Fix RBAC: reemplaza FOR ALL por políticas granulares por operación (SELECT/INSERT/UPDATE/DELETE) con `authorize()` en escrituras
  - **Ejecutar en Supabase SQL Editor** con opción "Without RLS"
  - Sin datos existentes, seguro para producción
- `003_activity_logs.sql` - Tabla activity_logs + RLS + función log_activity()
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

---

## Decisiones de Arquitectura

1. **Route Groups**: Auth y Dashboard usan `(auth)` y `(dashboard)` para separar layouts sin afectar URLs
2. **Layouts en capas**: Root layout -> `[locale]` layout -> `(auth)` o `(dashboard)` layout
3. **Configuración por giro**: El onboarding selecciona un tipo de negocio que pre-configura módulos activos y settings del POS
4. **JWT Authorization**: Hooks de Supabase inyectan claims en el JWT para autorización sin queries extra
5. **shadcn/ui v4 base-nova**: Usa `@base-ui/react` (no Radix) para la mayoría de componentes
6. **Sin Server Actions**: Todas las mutaciones usan cliente browser de Supabase
7. **Diseño Spanish-First**: Locale default `es`, variables en español, moneda MXN

---

## Estado Actual / TODOs

### Completado
- Dashboard: KPIs con datos reales de Supabase + 3 gráficas Recharts (ventas, top productos, métodos de pago)
- Signup: Formulario mejorado con nombre split, establecimiento, logo, paleta de colores, contraseña con checklist
- Toast notifications: Sonner integrado en root layout
- Cmd+K search: Búsqueda global con cmdk en header
- Export CSV/PDF: Utilidades reutilizables + toolbar en productos
- Activity Logs: Tabla activity_logs + página con filtros + sidebar link

### Pendiente
- Productos: `// TODO: Fetch products from Supabase` (conexión a DB)
- POS: Búsqueda de productos no conectada a DB
- Usuarios: Invite es `// TODO: Implement invite with Supabase Auth`
- Language switcher: Botón placeholder "ES" no funcional
- Sidebar: Links hardcodeados a `/en lugar de usar locale de la URL

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
