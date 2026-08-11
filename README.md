# SYMVORA — ERP Multi-Tenant SaaS

Plataforma SaaS Multi-Tenant basada en Mini-ERP modular para negocios en México.

## Tech Stack

- **Framework:** Next.js 16 + React 19
- **Database:** Supabase (PostgreSQL + RLS + RBAC)
- **Auth:** Supabase Auth (email/password + JWT custom claims)
- **State:** Zustand
- **UI:** shadcn/ui + Tailwind CSS 4
- **i18n:** next-intl (ES/EN)
- **Charts:** Recharts
- **Export:** jsPDF + CSV

## Getting Started

### 1. Clonar e instalar

```bash
git clone https://github.com/YonAnn99/SAAS_SYMVORA.git
cd saas-symvora
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales de Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

### 3. Base de datos

Las migraciones están en `supabase/migrations/`. Ejecútalas en orden:

1. `001_initial_schema.sql` — Tablas, enums, funciones
2. `002_rls_rbac.sql` — Políticas RLS y permisos
3. `003_activity_logs.sql` — Logging de auditoría

### 4. Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

### 5. Tests

```bash
npm run test          # Unit tests (Vitest)
npm run test:e2e      # E2E tests (Playwright)
```

### 6. Build

```bash
npm run build
npm start
```

## Estructura del proyecto

```
src/
├── app/
│   ├── (auth)/          # Login, signup, onboarding
│   └── (dashboard)/     # POS, productos, finanzas, etc.
├── components/          # UI components (shadcn/ui)
├── lib/
│   ├── supabase/        # Client, server, sales logic
│   ├── types/           # TypeScript types (database schema)
│   ├── validations/     # Zod schemas
│   └── export/          # CSV/PDF export
├── stores/              # Zustand stores (cart)
└── i18n/                # Internationalization
```

## Módulos

- **Dashboard** — KPIs, gráficas de ventas, productos top, métodos de pago
- **POS** — Punto de venta con búsqueda de productos, carrito, IVA 16%, múltiples métodos de pago
- **Productos** — CRUD completo con código de barras, SKU, control de stock
- **Compras** — Órdenes de compra y gestión de proveedores
- **Finanzas** — Control de caja (apertura/cierre), movimientos de entrada/salida
- **Usuarios** — Gestión de roles y permisos (SUPER_ADMIN, ORG_ADMIN, CAJERO)
- **Configuración** — Datos de empresa, apariencia, módulos activos
- **Actividad** — Log de auditoría de acciones

## Licencia

Privado — © SYMVORA
