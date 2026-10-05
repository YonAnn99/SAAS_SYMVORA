# Plan de rendimiento y escalabilidad — SYMVORA

> Preparado el 2026-10-04 a partir del código actual, `pg_stat_statements` y los avisos de rendimiento de
> Supabase. Objetivo: que moverse entre módulos y cobrar se sienta instantáneo, y que la app aguante horas pico
> con muchos negocios a la vez, **sin cambiar el comportamiento actual**.

## 1. Situación actual (medida, no supuesta)

| Dato | Valor |
|---|---|
| Negocios / usuarios / ventas | 8 / 8 / 32 (uso todavía bajo) |
| Supabase | plan **Free**: `max_connections` 60, pool de PostgREST de **4** conexiones |
| Conexiones abiertas (en reposo) | 26, 1 activa |
| Peticiones a la API de Supabase | ~12 mil en 24 h |
| Realtime | sin uso (0 tablas publicadas) |
| Consulta propia más cara | `reset_demo_tenant()`: 250 ms de media (máx. 814 ms) por cada visitante de la demo |
| Avisos de índices | solo informativos: 19 llaves foráneas sin índice (sobre todo `sucursal_id`) |

**Conclusión.** Con el volumen actual la base está holgada. El problema real son las **idas y vueltas por
pantalla** y lo que **se repite sin necesidad**. En hora pico esas repeticiones se multiplican por cada cajero y
chocan con el techo de 4 conexiones del pool.

### Dónde se va el tiempo hoy

| Acción del usuario | Peticiones a Supabase | Idas y vueltas en serie |
|---|---|---|
| Cambiar de módulo (cada navegación, incluidas las precargas de `next/link`) | middleware: `auth.getUser()` + RPC `get_middleware_context` | 2 antes de pintar nada |
| Abrir el POS | `getUser()` → caja activa → stock de sucursal → 6 en paralelo | **4** (más las 2 del middleware) |
| **Después de cada venta** | recarga el catálogo completo del POS (9 peticiones, 6 a la vez) | 4 |
| Abrir Productos | `useProducts` + `useVariants`; el stock de sucursal y los productos se piden **dos veces** | 1–2 |
| Volver a un módulo ya visitado | todo se descarga otra vez (no hay caché entre pantallas) | igual que la primera vez |

### Hora pico, cuenta rápida
Supuesto: 30 cajeros (de distintos negocios) cobrando 1 venta por minuto.

- **Solo la recarga tras cobrar:** 30 × 9 = **270 peticiones por minuto**, en ráfagas de 6 simultáneas por
  cajero. Con un pool de 4 conexiones, las peticiones **hacen fila** y el POS se siente lento justo cuando hay
  clientes esperando.
- **Además:** el middleware de cada navegación y la caché que no existe entre módulos.
- **Con las fases 1 y 2 de este plan:** la recarga tras cobrar baja a ~2 peticiones (solo existencias) y las
  pantallas ya visitadas no vuelven a pedir nada al entrar. Es del orden de **3–4 veces menos carga en hora
  pico** con el mismo plan de Supabase.

## 2. Reglas para no romper nada

- **Sin cambios de comportamiento:**
  - las ventas y sus precios se siguen calculando en el servidor (`complete_sale`);
  - el stock siempre lo confirma la base;
  - **nada de "UI optimista" en stock, inventario ni cobro**.
- **Sin Server Actions ni caché en memoria del servidor** (reglas del proyecto). La caché de datos va en el
  **cliente**, por usuario y por negocio.
- **Seguridad multi-tenant intacta:**
  - no se toca RLS, `authorize()` ni `requireTenantAccess`;
  - toda caché se indexa por `tenant_id` (y `sucursal_id`) y se **vacía al cerrar sesión o cambiar de
    negocio**.
- **Cada fase va por separado**, con `tsc` + `vitest` + ESLint + `next build --webpack` y una prueba manual en
  "Pruebas SYMVORA" antes de la siguiente. Se despliega una fase a la vez; si algo falla, se usa *Instant
  Rollback* en Vercel (ninguna fase cambia la base salvo los índices de la fase 3).

## 3. Fases

### Fase 1 — Quitar esperas sin cambiar nada visible (riesgo bajo) — ✅ HECHA (2026-10-04)

> **Resultado:**
> - **POS al abrir:** pasa de 4 idas y vueltas en serie a 1 con un local elegido, o 2 sin local.
> - **POS tras cobrar:** de 9 peticiones a 3 (stock, productos y variantes, en paralelo).
> - **Productos:** sin el stock duplicado (peticiones en vuelo compartidas) ni la segunda consulta de productos.
> - **Carga diferida:** jsPDF, xlsx y papaparse se descargan al usarse. El escáner (zxing) y las gráficas ya
>   eran diferidos.
> - **Medición:** Speed Insights montado; falta activarlo en Vercel → Speed Insights.

1. **POS: cascada de arranque** (`src/features/pos/hooks/use-pos-catalog.ts`).
   - Usar el `userId` que ya trae `useCurrentTenant()` en vez de `supabase.auth.getUser()`, que es una ida a la
     red.
   - Pedir la caja activa y el stock de sucursal **en paralelo** y, cuando el stock no dependa de la caja,
     dentro del mismo `Promise.all`.
   - **Ahorro:** 2–3 idas y vueltas al abrir el POS.
2. **POS: recarga tras cobrar** (`pos/page.tsx`, `onSaleCompleted` / `clearCart`).
   - Hoy recarga todo: productos, variantes, clientes, listas de precios, favoritos y variantes favoritas.
   - Una venta solo cambia **existencias**. Separar `refetchStock()` (productos + variantes con su stock de
     sucursal) del `refetch()` completo, y llamar solo al primero tras cobrar.
   - Clientes, listas y favoritos se recargan solo cuando cambian: alta de cliente, foco en la ventana o
     evento `catalogo-cambio`.
   - **Ahorro:** de 9 a ~3 peticiones por venta.
3. **Productos: consultas duplicadas** (`products/page.tsx`, `use-products.ts`, `use-variants.ts`).
   - Pedir el stock de sucursal una sola vez y pasarlo a los dos hooks.
   - `useVariants.products` (`fetchVariantProducts`) se puede derivar de los productos ya cargados en vez de
     volver a consultarlos.
   - **Ahorro:** 2 peticiones por visita.
4. **Carga diferida de piezas pesadas** con `next/dynamic` (solo se descargan al abrirlas):
   - escáner con cámara (`components/escaner/`, `barcode-detector` + zxing);
   - configuración de impresora ESC/POS (`impresora-config.tsx`);
   - ventanas de crear o editar producto y variantes;
   - quitar fondo (PhotoRoom);
   - gráficas de Recharts en Dashboard, Reportes y Finanzas.
   - **Ahorro:** menos JavaScript al entrar a cada módulo, lo que mejora el INP y el TBT en celulares de gama
     baja.
5. **Medición antes/después.** Se agrega `@vercel/speed-insights` (Core Web Vitals reales por ruta: INP, LCP,
   TTFB). Se anota el antes con el POS y Productos.

### Fase 2 — Caché entre módulos (la mejora que más se siente; riesgo medio) — ✅ HECHA (2026-10-04)

> **Resultado:** caché propia mínima (`src/lib/cache-datos.ts`), sin dependencias nuevas. Se eligió en vez de SWR
> para no reescribir los hooks: cada uno sigue consultando exactamente igual y solo arranca con lo último que
> cargó.
> - **Módulos:** POS (catálogo, clientes, listas, favoritos), Productos, Variantes, Clientes y Compras.
> - **Alcance:** usuario + negocio. Se vacía al cambiar de usuario o negocio, al cerrar sesión (también desde
>   otra pestaña, vía `SIGNED_OUT`) y al recargar.
> - **Seguridad del cobro:** la caja no se cachea. Mientras el catálogo del POS no está confirmado no se cobra
>   ni se agrega al carrito; dura menos de un segundo.
> - **Tests:** 5 nuevos (`cache-datos.test.ts`).

- **Qué es:** una caché ligera en el cliente con el patrón *stale-while-revalidate*. Al volver a un módulo se
  pinta **al instante** lo último cargado y se actualiza por detrás.
  - **Recomendado: SWR** (~4 kB). Encaja con los hooks actuales (`useProducts`, `useVariants`, `usePosCatalog`,
    clientes, compras…).
  - La alternativa es una caché propia mínima sobre los mismos hooks.
- **Llaves:** `[recurso, tenantId, sucursalId]`. Al cerrar sesión o cambiar de negocio o sucursal se vacía todo
  (`mutate(() => true, undefined)`).
- **Frescura:**
  - **Existencias** (POS y Productos): se revalidan al montar la pantalla, al volver el foco y tras cada
    escritura propia.
  - **Datos que casi no cambian** (categorías, listas de precios, clientes, configuración del negocio): se
    reutilizan hasta 5 min o hasta una escritura propia.
- **`dedupingInterval`:** si dos componentes piden lo mismo a la vez, sale **una sola** petición. Esto ataca
  directamente el techo del pool.
- **Orden de migración**, un módulo por despliegue: POS → Productos → Clientes → Compras → el resto.
- **Qué NO se cachea:** el estado de caja abierta para cobrar, el acceso o suscripción y los permisos. Siguen
  como hoy, siempre frescos.

### Fase 3 — Base de datos (riesgo bajo; una migración)

> **1 — ✅ HECHO (2026-10-04):** migración 105 aplicada, con 19 índices (4 parciales en columnas casi siempre
> nulas). Antes se probó con una transacción revertida. El aviso "unindexed foreign keys" de Supabase quedó en 0.

1. **Migración `105_indices_llaves_foraneas.sql`** con `CREATE INDEX IF NOT EXISTS` para las 19 llaves foráneas
   señaladas por Supabase.
   - **Prioridad:**
     - `ventas.sucursal_id`, `stock_sucursal.variante_id`, `cajas.sucursal_id`, `compras.sucursal_id`;
     - `productos_favoritos(tenant_id, producto_id)`, `variantes_favoritas.tenant_id`,
       `precios_lista.variante_id`.
   - Solo agrega índices: no cambia datos ni políticas. Se prueba con transacción revertida y se aplica con el
     MCP `apply_migration`.
2. **Revisar `complete_sale` / `_crear_venta_desde_items` bajo concurrencia.**
   - Confirmar que bloquea las filas de stock en un orden fijo (`ORDER BY id ... FOR UPDATE`), para que dos
     cajeros vendiendo los mismos productos a la vez no choquen en *deadlock*.
   - Si ya lo hace, solo se documenta.
3. **Demo pública.**
   - `reset_demo_tenant()` cuesta 250–800 ms por visita y comparte un único negocio demo. Ya tiene rate limit.
   - Si crece el tráfico de marketing, cambiar a "reiniciar solo si el último reinicio tiene más de N minutos"
     para no ejecutarlo en cada visita.
4. **Índices sin uso** (21): **no se borran todavía**, porque con 32 ventas no hay estadísticas
   representativas. Se reevalúan con datos reales.

### Fase 4 — ✅ HECHA SIN `getClaims` (2026-10-04)

> **Medido antes**, logs de Supabase, 24 h: de 13,433 peticiones, 5,106 eran `auth/v1/user` y 1,962
> `get_middleware_context`. Más de la mitad del tráfico era verificación de sesión.
>
> **Cambios:**
> 1. **Enlaces con idioma** (`Link` de `@/i18n/navigation`) en el sidebar, el dock, el header, el Dashboard y el
>    resumen de sucursales. Antes cada clic en `/products` pasaba por el middleware completo, se redirigía a
>    `/es/products` y volvía a pasar.
> 2. **Middleware:** una ruta sin idioma ya no verifica sesión ni permisos; next-intl la redirige y se verifica
>    una sola vez.
> 3. **`matcher` de `proxy.ts`:** se saltan las precargas de `next/link`. El build confirma que todas las rutas
>    del panel son dinámicas (`ƒ`), así que la navegación real siempre pasa por el middleware.
> 4. **Navegador:** `getSession()` (sin red) en `useOpenRegister` (que además consultaba en cada foco de
>    ventana), en el aviso diario de caja, `useIsDemo`, el sidebar y el dock.
>
> **Pendiente:** `getClaims()` cuando se activen las JWT signing keys. Para medir el después, repetir la
> consulta de logs una semana después del despliegue.

### Fase 4 (plan original) — Middleware y navegación (la de más impacto por navegación; riesgo medio-alto; al final)

- **Hoy:** cada navegación hace `auth.getUser()` (ida al servidor de Auth) + `get_middleware_context` (ida a
  Postgres con service role) antes de responder.
- **Opción A (recomendada):** cambiar `getUser()` por `getClaims()`, que verifica la firma del JWT
  **localmente**.
  - Requiere que el proyecto use **llaves JWT asimétricas** (Supabase → Auth → Signing Keys).
  - Ahorra una ida y vuelta por navegación.
  - Las rutas API siguen autenticando por cookie con `requireTenantAccess` (regla del proyecto, sin cambios).
- **Opción B, complementaria:** que las **precargas** de `next/link` (cabecera `Next-Router-Prefetch`) no
  ejecuten `get_middleware_context`. La navegación real sí lo ejecuta, así que el control de acceso no se
  debilita.
- Es la fase más delicada porque toca autenticación y control de suscripción. Necesita pruebas específicas:
  - usuario sin negocio;
  - prueba vencida (solo lectura);
  - cajero con permisos recortados;
  - sesión expirada;
  - host demo.

### Fase 5 — Infraestructura para crecer (decisiones del dueño, no código)

| Disparador | Acción |
|---|---|
| Primeros negocios pagando o ~10 negocios activos en horario comercial | **Supabase Pro** (25 USD/mes): más cómputo, pool de PostgREST mayor, backups diarios, sin pausa por inactividad. Es el pendiente n.º 1 de CLAUDE.md. |
| Siempre | **Verificar que la región de Vercel coincida con la de Supabase.** Si no coinciden, cada ida y vuelta del middleware cruza el continente. La región de funciones se ve en Vercel → Settings → Functions. |
| Picos con colas en el pool (lo dirá Supabase → Reports → API) | Subir el tamaño de cómputo de Supabase (Small/Medium) o el `db-pool` de PostgREST |
| Más de ~50 negocios activos | Réplica de lectura para reportes e historial (Supabase Pro + add-on) |
| Crons | `trial-notices` (15:00 UTC = 9:00 MX) y `avisos-cobro` (15:30 UTC) caen a la hora de apertura de los negocios. Moverlos a horario valle (ej. 13:00 UTC) cuando haya volumen. |

## 3b. Estado al cierre del 2026-10-04

| Punto | Estado |
|---|---|
| Fase 1 (incl. ventanas de Productos con `next/dynamic`) | ✅ |
| Fase 2 (POS, Productos, Variantes, Clientes, Compras, Dashboard, Reportes, Órdenes, Usuarios, Listas, Lotes, Ajustes, resumen de Sucursales) | ✅ — Finanzas fuera a propósito (caja) |
| Fase 3.1 índices (migración 105) | ✅ |
| Fase 3.2 ventas simultáneas (migración 107 + reintento 40P01/40001) | ✅ |
| Fase 3.3 reinicio de la demo | ⏸ No aplicada: con el tráfico actual no compensa que un visitante vea los cambios del anterior. Si crece, limitar con `consumirRateLimit("demo-reset", 1, 600)` en `/api/demo/start`. |
| Fase 3.4 índices sin uso | ⏸ Reevaluar con datos reales |
| Fase 4 (sin `getClaims`) | ✅ — `getClaims` pendiente de signing keys |
| Fase 5 infraestructura | Decisiones del dueño (Pro, región, crons, Speed Insights) |
| Seguridad `log_activity` (migración 106) | ✅ |

## 4. Qué se descartó del prompt genérico y por qué

| Propuesta | Motivo |
|---|---|
| `useOptimistic` en inventario y cobro | El servidor puede rechazar (stock insuficiente, solo lectura). Mostrar algo que no pasó es peor que esperar 200 ms. El carrito ya es local e instantáneo. |
| `revalidatePath` / `revalidateTag` / caché en memoria del servidor | Las páginas son de cliente, sin Server Actions. Una caché en memoria en Vercel no es compartida ni confiable (igual que el rate limit, que por eso vive en Postgres). |
| `useMemo` / `useCallback` / `React.memo` masivos | El React Compiler ya memoriza. Agregarlos a mano es ruido. |
| Prefetch más agresivo | Hoy cada precarga cuesta 2 idas a Supabase en el middleware. Primero la fase 4, luego se evalúa. |
| Skeletons / `loading.tsx` | Ya existen en los 8 módulos principales. |

## 5. Orden recomendado y criterio de éxito

1. **Fase 1** (1–2 sesiones): el POS abre y cobra con menos idas y vueltas; Productos sin duplicados.
2. **Fase 3.1** (índices): una migración pequeña y segura.
3. **Fase 2** (caché), módulo por módulo: volver a un módulo visitado se pinta al instante.
4. **Fase 4** (middleware), con su batería de pruebas de acceso.
5. **Fase 5**, según los disparadores.

**Cómo se mide:**
- Speed Insights (INP < 200 ms y TTFB de navegación);
- Supabase → Reports (peticiones por minuto, tiempo de respuesta de la API);
- `pg_stat_statements`.

Se compara una semana antes y una después de cada fase.

## 6. Verificación por fase
- `npx tsc --noEmit`, `npx vitest run`, ESLint de los archivos tocados y `next build --webpack`.
- **Prueba manual en "Pruebas SYMVORA"** (nunca en HUEVO ROCA):
  - abrir el POS;
  - cobrar 3 ventas seguidas y ver que el stock baja bien;
  - cambiar de sucursal;
  - ir y volver entre Productos, POS y Clientes;
  - cerrar sesión y entrar con otro usuario: no debe ver datos del anterior.
- **En el navegador** (DevTools → Network): contar las peticiones a `supabase.co` por acción y comparar con la
  tabla de la sección 1.
