@AGENTS.md

# SYMVORA SaaS — Resumen del proyecto

> Resumen de `.agents/CONTEXT.md` (actualizado al 2026-10-02). El detalle, el historial de sesiones y los
> bugs corregidos completos están ahí; consultarlo antes de tocar cobro, RBAC, RLS o migraciones.

## Qué es
- SaaS multi-tenant POS/ERP para negocios en México: punto de venta, inventario, finanzas, compras y
  sucursales. Pensado para abarrotes, ropa, ferreterías, farmacias, etc.
- **Stack:** Next.js 16 (App Router; `proxy.ts` reemplaza a `middleware.ts`), React 19, Supabase (RLS,
  RPCs), Tailwind v4, next-intl (es por defecto, en), Zustand, Zod 4, Base UI (shadcn base-nova),
  Chart.js (react-chartjs-2; base en `components/charts/`: `registro.ts`, `use-tema-grafica.ts`, `opciones.ts`),
  Sentry, Resend.
- **Pagos:** Conekta (checkout hosted) y Mercado Pago Point en el POS. En /billing hay dos botones:
  «Pagar con tarjeta» = suscripción recurrente (Conekta solo acepta TARJETA en suscripciones: ese checkout
  nunca mostrará otros métodos) y «Otros métodos de pago» (`type: "unico"`) = orden de pago único con efectivo,
  SPEI, Pago Directo BBVA y Aplazo (`features/payments/metodo-pago-conekta.ts`). El webhook normaliza el
  método del cargo al enum `payment_method` con `metodoDePagoConekta` (tarjeta llega como "credit"/"debit").
- **Precio** (única fuente: `src/lib/pricing.ts`): $399 MXN/mes o $3,588/año. Planes de Conekta `-v3`.
- **CFDI 4.0:** existe, pero está **oculto** por decisión de negocio. Para reactivarlo, ver
  `src/lib/feature-flags.ts` y la sesión 2026-09-05 en CONTEXT.md.

## ⚠️ HAY NEGOCIOS REALES EN PRODUCCIÓN (desde octubre de 2026)
Clientes reales ya venden con SYMVORA a diario. Un error ya no es una prueba fallida: es una venta que no
se cobra, un corte de caja mal cuadrado o datos de un cliente perdidos. Todo cambio va con más precaución:
- **Una sola base de datos**: el Supabase de `localhost` ES el de producción. Lo que se escribe o se borra
  desde el dev server, desde un script o con el MCP, pasa en los negocios reales.
- **Migraciones aditivas y probadas**:
  - Siempre con transacción revertida (`begin; …; rollback;`) antes de `apply_migration`.
  - Preferir `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE` y columnas nuevas con default o NULL.
  - **Nunca** `DROP`/renombrar columnas o tablas, ni cambiar tipos, sin un plan de transición en dos pasos:
    primero el código deja de usarlas y se despliega; después se quitan.
- **Datos**:
  - Nada de `UPDATE`/`DELETE` sin `WHERE` acotado y un `count(*)` previo con el mismo filtro.
  - No tocar negocios ajenos al de pruebas: solo «Miscelanea Symvora» (ver «Datos de prueba»).
    «HUEVO ROCA» es un cliente real.
  - Un borrado de datos de un negocio real solo con OK explícito del usuario.
- **Compatibilidad con pestañas abiertas**: tras un deploy, los navegadores siguen con el código anterior
  un rato.
  - Una API que cambia debe aceptar también la forma anterior.
  - Una columna nueva no puede ser obligatoria para el cliente viejo.
- **Cambios que ve todo el mundo**: avisar al usuario antes de desplegar lo que interrumpe a todos.
  - Ejemplos: subir una versión legal (vuelve a mostrar el aviso), cambiar el flujo de cobro o la caja.
  - Los cambios grandes van con plan aprobado.
- **Cobros**: las llaves de Conekta son de producción; nunca pagar «para probar».
- **Verificar antes de dar por hecho**: tsc + vitest + ESLint, y en la base, comprobar con SQL que el
  resultado es el esperado.

## Dominios y despliegue
- `www.symvora.com.mx` = landing (canónico SEO); `app.` = sistema; `demo.` = demo pública (host propio
  para no mezclar cookies).
- El enrutado entre hosts y el `noindex` (todo lo que no sea www) viven en `lib/supabase/middleware.ts`.
- **Demo privada por visitante** (migración 112, `lib/demo.ts`): «Probar demo» crea un usuario propio
  (`app_metadata.is_demo`, correo `demo-<uuid>@demo.symvora.com.mx`, sin contraseña) y SU negocio sembrado
  (`crear_negocio_demo`). Nadie ve lo de otro. Se borra al salir (X de la franja → `/api/demo/salir` →
  `borrar_mi_demo`) o a las 2 h (`borrar_demos_vencidas`: en cada entrada y cron diario `/api/cron/limpiar-demos`).
  Tope de 300 demos vivas. La migración 119 (2026-10-15) arregló `crear_negocio_demo`: la IP de la aceptación legal
  iba como texto a una columna `inet` y, desde que existe `legal_acceptances` (2026-10-07), ninguna demo se creaba. **REGLA:** `tenants.demo_expira_en IS NOT NULL` = negocio demo; todo cron, conteo o
  vista interna sobre negocios debe ignorarlos. `_borrar_negocio_demo` se niega a tocar un negocio real.
  `reset_demo_tenant()` y el «Abarrotes Don Pedro» compartido (`demo@symvora.com`) quedan sin uso como respaldo.
- **Vercel:** proyecto `saas-symvora`, build `next build --webpack`, despliegue por Git desde `main`.
  - Cambiar una variable de entorno **requiere redeploy**.
  - `vercel --prod` despliega el working tree local: deja `git status` limpio antes.
- **Las llaves de Conekta en `.env.local` son de PRODUCCIÓN**: un pago con tarjeta desde localhost cobra
  de verdad.
- **Supabase:** plan Free (pool de PostgREST de 4 conexiones). Subir a Pro es el pendiente principal de
  escalabilidad.

## Reglas de arquitectura (no romper)
- **Seguridad multi-tenant:**
  - `requireTenantAccess(permission)` en toda API; autentica por cookie, nunca por claims del JWT.
    Decide con el permiso EFECTIVO (`tienePermisoEfectivo`): la excepción por usuario del negocio gana
    sobre el rol, igual que `authorize()`. No volver a consultar solo `role_permissions`.
  - Nunca usar `user_metadata` para autorización.
  - Las ~75 políticas de escritura usan `authorize()`, que considera las excepciones por usuario
    (`user_permission_overrides`).
  - **Toda tabla nueva con RLS** necesita su política de escritura con `authorize()` desde el día uno.
    Este error ya se repitió 4 veces; el barrido de auditoría está al final de la migración 054.
  - Una escalada de privilegios puede estar en tres sitios a la vez: la ruta HTTP, la política RLS y el
    RPC `SECURITY DEFINER`. Cierra los tres.
- **Funciones SQL:**
  - Al redefinir con `DROP` + `CREATE`, reaplica los `REVOKE`/`GRANT` y revisa los overloads huérfanos.
  - Si solo cambia el cuerpo, usa `CREATE OR REPLACE`.
- **Hook del JWT:** `custom_access_token_hook` inyecta `user_role`/`tenant_id` y debe seguir dado de alta
  en Supabase Auth. Si fallan escrituras en varias tablas a la vez, decodifica el token antes de revisar
  las políticas.
- **Ventas:** las ventas y sus precios se calculan en el servidor (`complete_sale` /
  `_crear_venta_desde_items`), nunca se confía en el precio que manda el cliente.
- **Fuentes únicas:**

  | Archivo | Qué define |
  |---|---|
  | `lib/pricing.ts` | precio de la suscripción |
  | `lib/modules.ts` | módulo → permiso → rutas |
  | `features/inventory/stock-status.ts` | estado de stock |
  | `lib/profit.ts` | ganancia: sin IVA; costo nulo se excluye |
  | `lib/http/timeout.ts` | timeouts de todo proveedor externo |
  | `lib/periodo.ts` | rangos de fecha de reportes |
  | `lib/money.ts` | formato de dinero por moneda (`formatMoneda`; `useMoneda()` en el panel) |

- **Rendimiento** (plan en `docs/plan-rendimiento-escalabilidad.md`; fase 1 hecha el 2026-10-04):
  - El POS carga todo en paralelo y usa el `userId` del contexto (sin `auth.getUser()`). Tras cobrar llama
    `refetchStock()` (solo existencias), no `refetch()`; alta de cliente → `refetchCustomers()`.
  - `fetchStockSucursal` comparte las peticiones iguales EN VUELO (nunca sirve stock viejo).
  - Productos: `useVariants(..., { cargarProductos: false })`; la lista sale de `useProducts`.
  - jsPDF, xlsx y papaparse se cargan con `import()` al usarse (`generarPdfOrdenCompra` y `exportToPDF` son async).
  - Speed Insights (`@vercel/speed-insights`) en el layout raíz: activarlo en Vercel para ver datos.
  - Web Analytics (`@vercel/analytics`, 2026-11-04) en el layout raíz vía `components/analitica-vercel.tsx`, sin cookies.
    `limpiarEvento` quita query/hash y los códigos de `/tarjeta/<codigo>` y `/tarjeta/unirse/<codigo>`. **REGLA:** toda
    ruta nueva con un código secreto en la URL se agrega ahí y a `analitica-vercel.test.ts`.
  - **Caché entre módulos** (fase 2, `lib/cache-datos.ts`): en memoria de la pestaña, por usuario+negocio
    (`fijarAlcanceCache` en el contexto del tenant; `vaciarCache` al cerrar sesión). POS, Productos, Variantes,
    Clientes y Compras pintan lo último cargado y SIEMPRE vuelven a consultar. La caja/acceso/permisos no se
    cachean; en el POS no se cobra ni se agrega al carrito hasta tener el catálogo fresco (`loadingProducts`).
    Un hook nuevo que use la caché debe incluir en la clave todo lo que cambie el dato (ej. la sucursal).
    También en Dashboard (clave con el día), Reportes (por periodo), Órdenes de compra, Usuarios, Listas de
    precios, Lotes, Ajustes y el resumen de Sucursales. Finanzas NO (es la caja). Productos carga sus ventanas y
    pestañas con `next/dynamic` y ya no importa del índice `@/features/inventory`.
  - **Navegación** (fase 4, sin signing keys): enlaces internos con `Link`/`useRouter` de `@/i18n/navigation`,
    NUNCA `next/link` con rutas sin idioma (cada clic pasaba dos veces por el middleware). El `matcher` de
    `src/proxy.ts` salta las precargas de `next/link`; es seguro porque el panel es `force-dynamic` (si una ruta del
    panel se vuelve estática, revisarlo). Rutas sin `/es|/en` no se verifican en el middleware: next-intl las
    redirige y la verificación ocurre en la ruta con idioma. En el navegador, `getSession()` (local) cuando solo se
    necesita id/correo; `getUser()` queda en el contexto del tenant, el middleware y las rutas API.
  - **Ventas simultáneas** (fase 3.2, migración 107): `_crear_venta_desde_items` bloquea productos/variantes del
    carrito ORDENADOS POR ID antes del bucle y mueve el stock en ese mismo orden (sin deadlocks entre cajas).
    `completeSale` reintenta hasta 2 veces ante 40P01/40001 (`esChoqueDeConcurrencia`): la transacción se revierte
    entera, así que es seguro. Una función nueva que bloquee varios productos debe seguir el mismo orden.
  - **Catálogos grandes en Productos** (2026-11-12, medido con 1,000 productos: 152 mil elementos y la pestaña
    congelada): la tabla y la lista de celular pintan por tramos de 60 (`hooks/use-lista-por-partes.ts`, «Mostrar más»
    o al acercarse al final); buscar, filtrar, marcar todos, etiquetas y exportar usan la lista COMPLETA. Solo se monta
    la vista visible (`useEsTabla`). `ProductsTable` lleva `memo`: la página le pasa funciones y conjuntos ESTABLES
    (`useCallback`/`useMemo`); una función en línea nueva anula el `memo`. La búsqueda filtra con `useDeferredValue`
    (`busquedaAplicada`). El `Select` de unidad por fila se monta al tocarlo. `HoldButton` usa UNA hoja de estilos
    (`<style href precedence>`), no una por botón. **REGLA:** una lista que puede pasar de cientos de filas se pinta
    por tramos. El POS hace lo mismo en `product-grid.tsx` (tarjetas por tramos; la clave cambia con la búsqueda, la categoría o la vista, no al cobrar).
  - Migración 105 (fase 3.1, aplicada el 2026-10-04): índices para las 19 llaves foráneas sin índice. Los
    nuevos salen como "unused" en el linter hasta que haya tráfico; no borrarlos por eso.
- **Otras reglas:**
  - Sin Server Actions: las mutaciones van por el cliente de Supabase o por rutas API.
  - Rate limit durable en Postgres (`consumirRateLimit`); nunca un `Map` en memoria.
  - Los correos en webhooks van con `after()`.
  - **Turnstile del login/registro/olvidé contraseña/clave de colaborador** (2026-11-21, `components/auth/turnstile-resiliente.tsx`;
    una clienta con Safari no podía entrar: «No se pudo completar la verificación de seguridad»): invisible primero
    (`interaction-only`); si falla, 2 reintentos silenciosos (1.5 s y 3 s); si sigue, widget VISIBLE (`always`) + aviso con el
    CÓDIGO del error + «Reintentar verificación». Cada fallo se reporta a Sentry (`Turnstile fallo`, tags `turnstile_codigo`
    y `turnstile_widget`, una vez por carga). Al recuperarse se quita solo el aviso del captcha. **Un widget nuevo usa
    `TurnstileResiliente`, nunca `<Turnstile>` suelto.** El captcha NO se puentea. Códigos útiles: `200100` reloj del
    equipo mal o página en caché, `110620` sin interacción a tiempo, `300xxx`/`600xxx` fallo genérico del reto.
  - **El modo sin conexión está RETIRADO.** No reintroducirlo; se hará con una app nativa. La PWA sigue
    siendo instalable: no borres `sw.ts`.
  - **Tablet en horizontal = escritorio** (2026-11-27, `lib/viewport-tablet.ts` + `components/ajuste-tablet-horizontal.tsx`, solo en el panel y el login): una tablet táctil de lado corto ≥ 600 px y lado largo < 1024 en horizontal cambia el `viewport` a `width=1024` (el navegador escala). `viewportDeseado` y `aplicarViewport` se SERIALIZAN: no pueden usar nada de fuera. La landing y el catálogo público NO lo montan.
  - CSS global: `html, body { overflow-x: clip }`. **No volver a `hidden`**: crea un segundo scroll.

## Módulos y piezas clave
- **Roles:** SUPER_ADMIN (dueño) > ORG_ADMIN > CAJERO.
  - Billing y escritura de usuarios: solo SUPER_ADMIN.
  - El catálogo `/products` está abierto a todo el equipo; variantes, lotes y ajustes exigen
    `inventory.manage`.
- **POS:**
  - Carrito Zustand con descuento manual (con tope) e IVA opcional.
  - Venta por variante: la variante es parte de la identidad de la línea.
  - Servicios sin stock; ticket HTML y ESC/POS (impresora USB/Bluetooth) con descuento.
  - **Granel** (kg, g, l, ml, m): el precio se captura POR UNIDAD (los formularios dicen "por kg" vía
    `porUnidad`/`enUnidad` de `lib/unidades.ts`). En el POS, «¿Cuánto?» vende por cantidad o por importe
    (`cantidadPorImporte`: $50 a $180/kg = 0.278 kg); siempre se manda la cantidad, el servidor cobra cantidad × precio.
  - **Contenido del envase ≠ unidad de venta** (migración 114): `unidad_medida` es CÓMO SE VENDE (el formulario
    dice «¿Cómo se vende?»); lo que trae un empaquetado (Coca Cola 2.5 L, Sabritas 45 g) va en
    `contenido_cantidad`/`contenido_unidad` de `productos` y `variantes_producto` (NULL en la variante = el del
    producto). Solo descriptivo: no toca cobro ni stock. Helpers en `lib/unidades.ts` (`contenidoDe`,
    `textoContenido`, `contenidoDesdeTexto`, `contenidoCapturado`); UI compartida en
    `features/inventory/components/unidad-y-contenido.tsx`, con aviso si eligen granel y el nombre o un atributo
    trae una medida. Antes se usaba la unidad para el contenido y el POS ofrecía «¼ l» de un refresco.
  - **Escáner con la cámara del celular**: `components/escaner/`, `lib/escaner/`, `barcode-detector` +
    `public/zxing/*.wasm`.
  - Favoritos por producto y por variante.
  - **POS en celular** (rediseño del 2026-10-06):
    - Por debajo de `sm`: una fila con buscar/escanear y el botón Ajustes (`pos-ajustes-hoja.tsx`: sucursal, lista
      de precios y vista) y las categorías como chips. Desde `sm` la barra sigue como antes (`sm:contents`).
    - Cuadrícula de 2 columnas bajo `@md` con «×N» de lo que ya va en el carrito (`enCarrito`).
    - `MobileCartBar` azul con conteo y total.
    - Hoja del carrito con líneas deslizables (`FilaDeslizable`), métodos de pago de 48 px, montos rápidos
      (`montosRapidos`).
    - **Se cobra deslizando en el carrito** (`DeslizarParaConfirmar` en `checkout-panel.tsx`), sin ventana de
      confirmación: el resumen ya está a la vista. Bloqueado, el deslizador dice por qué (`motivoBloqueo`). Tras la
      venta, `ventasCobradas` lo reinicia (`key`). Con «Tarjeta (terminal)» va un botón, porque la confirma la
      terminal.
    - El pie legal se oculta en `/pos` por debajo de `lg`; el POS mide `ALTO_PANEL_POS`. Las alturas usan
      `dvh`, nunca `vh`: en Chrome de Android `100vh` desplazaba la página y escondía "Ver carrito" detrás
      del dock. Además restan `--alto-avisos`: el shell mide los avisos de arriba (franja de la demo, fin de
      prueba, pago vencido) y publica su alto; sin eso, con un aviso visible pasaba lo mismo (y el aviso se iba
      con el scroll). Su envoltorio es `sticky top-0`: siempre a la vista. El menú lateral de escritorio no desplaza:
      sus opciones se encogen de 40 a 32 px según el alto (`CLASE_OPCION` en `sidebar.tsx`), sin barra de scroll. La cuadrícula lleva `overscroll-y-contain`.
    - **El carrito se conserva al recargar** (sessionStorage `symvora-carrito`, `persist` con
      `skipHydration`; `usePosCart` lo restaura al montar). Tiene dueño `userId:tenantId`: si cambia, se vacía.
      Se borra al cobrar y al cerrar sesión (`vaciarCarritoGuardado`). No se agrega nada hasta `restaurado`.
    - El dock usa etiquetas cortas («Vender», «Órdenes»).
  - **Vuelo al carrito** (`features/pos/vuelo-al-carrito.ts`, 2026-10-12): al agregar desde una tarjeta, una copia
    de su foto (`data-foto-pos`) vuela en arco a su línea (`data-linea-carrito`, escritorio) o a la barra
    (`data-barra-carrito`/`data-destino-carrito`, celular). Solo visual (WAAPI, sin librerías): el carrito cambia
    antes. Variantes y «¿Cuánto?» despegan de la tarjeta al confirmar (`origenVueloRef` en la página); escáner y
    Enter sin vuelo, solo aterrizaje. La barra muestra el conteo viejo hasta aterrizar (`useVuelosAlCarrito`); su
    `aria-label` siempre dice lo real. `prefers-reduced-motion`: solo un destello.
  - **«Tarjeta» (manual) bloqueado sin terminal** (`tarjetaManualDisponible` en `features/pos/tarjeta-disponible.ts`):
    se habilita con Mercado Pago Point lista (`mpReady`) o con una terminal externa declarada en Configuración →
    Métodos de pago (`configuracion_json.pos_config.terminal_externa`, leída en el store de `use-modulos.ts`).
    En el demo siempre está activo. `motivoBloqueoCobro` devuelve `"sin-terminal"` como defensa.
  - **Cobro con terminal Mercado Pago Point** (migración 127, 2026-10-31): el monto lo calcula
    `cotizar_venta_terminal`, que ensaya `_crear_venta_desde_items` y lo deshace (savepoint). Así variantes, stock por
    sucursal, insumos, tope de descuento e IVA del carrito son los del cobro directo. `pagos_terminal.include_iva` guarda el IVA
    con que se cotizó; `confirm_terminal_payment` registra con él y con `p_permitir_stock_negativo` (el cliente ya pagó:
    si falta stock, `requiere_revision`). Antes la terminal no conocía variantes y cobraba SIEMPRE el 16 % de IVA.
    El webhook traduce el status con `estadoTerminal` (solo estados finales). Cancelar: si Mercado Pago no deja (ya está
    en la terminal), la ruta responde 409 `en_terminal` y el POS sigue esperando; nunca se marca pagada por error.
  - **Ticket personalizable** (pestaña «Ticket» en Configuración, 2026-11-27): `configuracion_json.ticket_config`, lógica pura en
    `features/pos/ticket-config.ts` (defaults = el ticket de siempre; topes de largo; `ticketConfigEfectiva` fuerza «Generado con
    SYMVORA» en Básico). Un solo cuerpo de ticket (`features/pos/components/ticket-cuerpo.tsx`) para pantalla, impresión y vista
    previa; el ESC/POS lo recibe en `ticket-escpos.ts`. **REGLA:** nada de lo que sigue es configurable: nombre del negocio, totales,
    método de pago, «SIN VALIDEZ FISCAL» ni los distintivos de reimpresión y venta cancelada.
- **Variantes:**
  - Atributos libres en `variantes_producto.atributos` jsonb (migración 097). `talla`/`color` se siguen
    llenando como resumen compatible.
  - Se gestionan dentro del Catálogo; `/variants` redirige. Cada variante puede tener foto propia.
  - Descripción y stock mínimo propios (migración 103); el estado de stock de la variante usa su mínimo.
  - Unidad de medida propia opcional (migración 104; NULL = la del producto). Resolver siempre con
    `unidadDeVenta(producto, variante)` de `lib/unidades.ts`: el POS decide con ella si pide cantidad (granel).
  - "Producto con variantes" se crea en `crear-variantes-dialog.tsx`: producto general
    (precio/stock 0, `crearProductoConVariantes`) + una tarjeta desplegable por variante con todos sus datos
    (lógica pura en `features/inventory/tarjetas-variante.ts`). La misma ventana agrega variantes a un producto
    existente ("+ Agregar variante" en la tabla y en la hoja del celular). `variant-dialog.tsx` solo edita.
    Afuera solo va el nombre general; la unidad y la categoría (compartida, es del producto) van en las tarjetas,
    y la unidad del producto es la de la Variante 1. Cada tarjeta tiene secciones desplegables (Datos · Precio y
    costo · Inventario · Códigos · Imagen) como "Producto único"; "Es servicio" y "Maneja lotes" van en Inventario
    y son del producto (compartidos, sin migración).
  - En el POS el producto general nunca se vende solo (`seVendeComoGeneral` en `features/sucursales/stock.ts`):
    en Agrupado abre sus variantes; en Desglosado sale como encabezado sobre sus tarjetas de variante. La fila del padre muestra el resumen de
    sus variantes (`resumenConVariantes`: rango de precio, stock total, estado) y el POS lo ofrece si alguna
    variante tiene stock (`vendibleEnPos`).
- **Caja / Finanzas:**
  - Apertura y cierre con saldo esperado contra real. Cierre automático de madrugada (cron
    `auto-close-registers`).
  - Aviso de corte al dueño por correo + WhatsApp/SMS.
- **Compras:** compra directa que suma stock (`registrar_compra_directa`), cancelación que lo revierte,
  órdenes de compra con PDF.
- **Reportes:** historial de ventas con reimpresión (la regla de visibilidad vive en los RPC
  `listar_ventas`/`detalle_venta`), ganancia bruta. Filtro por cliente (`p_cliente_id`, migración 129: la firma se
  cambió con DROP + CREATE porque un parámetro nuevo crea un overload que PostgREST no sabe elegir).
- **Cancelar y corregir ventas** (migración 137, 2026-11-17, pedido de una clienta): botones «Cancelar venta» y
  «Corregir» en el detalle de venta (`sale-detail-dialog.tsx`), con permiso `sales.void` (ya existía: SUPER_ADMIN y
  ORG_ADMIN; ahora es el módulo concedible `salesVoid` de `lib/modules.ts`, sin ruta).
  - **Nunca se borra una venta:** `cancelar_venta(p_venta_id, p_motivo)` la deja `CANCELADA` con `cancelada_en`,
    `cancelada_por` y `motivo_cancelacion`. `_cancelar_venta` (interna) regresa:
    - el stock directo y los insumos a la sucursal de la venta, con candados por id (107);
    - los lotes a los MISMOS lotes (`DEVOLUCION_VENTA`, después del stock);
    - el crédito, sin dejar el saldo negativo (`credito_excedente` avisa lo ya abonado);
    - el sello o canje de lealtad, con un `ajuste`.
  - **Caja:** si la caja de la venta (la del cajero en esa sucursal, abierta antes de la venta) sigue abierta, nada:
    `fetchVentasTotal` ya filtra `COMPLETADA`. Si cerró y fue EFECTIVO, `SALIDA` con concepto `CANCELACION_VENTA`
    (`movimientos_caja.venta_id`) en la caja abierta de quien cancela; sin caja, aviso `sin_caja_para_devolucion`.
    Tarjeta y transferencia se devuelven por su medio (`devolucion_fuera_de_caja`). Terminal: `reembolso_en_terminal`
    (se devuelve en Mercado Pago). Facturada: se rechaza.
  - **Corregir** = `corregir_venta(...)`: cancela la original y cobra la nueva con `_crear_venta_desde_items` en UNA
    transacción, y las liga (`corrige_venta_id` / `corregida_por_venta_id`). Sin lealtad. Con terminal no se corrige.
    El detalle guarda la corrección pendiente en `sessionStorage` (`features/sales/correccion.ts`) y lleva al POS;
    `useCorreccionVenta` carga el carrito (precios de hoy, cliente, forma de pago, lista, IVA) y muestra la franja.
  - Avisos con códigos en `features/sales/cancelar-venta.ts` (`bloqueoCancelar`, `bloqueoCorregir`, `avisosPrevios`,
    `avisosCancelacion`). El motivo se guarda en español. El ticket reimpreso dice «VENTA CANCELADA».
  - Campana: tipo `venta_cancelada` cuando cancela un colaborador (no el dueño), permiso `sales.void`.
  - **Migración 138:** `ventas` y `detalle_ventas` ya no tienen políticas de INSERT/UPDATE/DELETE: `authenticated` solo
    lee. Antes un cajero podía crear ventas o cambiar renglones directo, y `sales.void` editar o borrar ventas sin
    revertir nada. Toda escritura va por funciones `SECURITY DEFINER`. **REGLA:** no reabrir esas políticas; si una
    pantalla necesita escribir ahí, una función nueva.
  - **Anuncio:** campana con la migración **139** (`permiso = 'sales.void'`, negocios nuevos hasta el 2026-12-17 vía
    `_novedades_negocio_nuevo`) y correo con `/api/cron/anuncio-novedad?novedad=cancelar-ventas` (sin `enviar=1` es
    simulacro). Los dos van DESPUÉS del deploy.
- **Estado de cuenta del cliente** (migración 129, sugerencia de un cliente real): botón en Clientes (en celular,
  acción «Cuenta» del cajón; tocar la pastilla si no puede editar) → `estado-cuenta-dialog.tsx` con
  `estado_cuenta_cliente`: saldo, ventas a crédito (abren `SaleDetailDialog`) y abonos de `pagos_credito`. Misma
  visibilidad que el Historial (`sales.view_all` o solo las propias; avisa con `ventas_parciales`).
- **Productos archivados** (migración 102): un producto con historial no se puede borrar (FKs `NO ACTION`
  desde ventas, compras, ajustes, órdenes y traspasos). Al intentarlo se ofrece **archivarlo**
  (`productos.archivado_en`): sale del catálogo, del POS y de los selectores. También se archiva a mano
  (botón en la fila; en celular, **deslizando a la DERECHA** —`accionInicio` de `FilaDeslizable`—, el cajón
  izquierdo queda en Eliminar | Editar; `handleArchive` de `use-products.ts`). Se restaura desde la
  pestaña **Archivados** de Productos (`productos-archivados.tsx`, solo `inventory.manage`). Los índices únicos de código de barras y SKU solo cuentan activos.
  - **Variantes archivadas** (migración 110, `variantes_producto.archivado_en`): mismo gesto en la hoja de
    variantes y botón en la fila de escritorio (`handleArchive` de `use-variants.ts`); eliminar una con
    historial ofrece archivarla. Archivar la **última variante activa archiva el producto completo**
    (`features/inventory/archivar-variante.ts`): un padre sin variantes activas se vendería como general a $0.
    Se restauran en la misma pestaña (tarjeta "Variantes archivadas").
  - Archivar el **producto padre** NO marca sus variantes: se ocultan con él (toda consulta operativa filtra el
    producto) y al restaurarlo vuelven juntas; las archivadas una por una siguen archivadas. La confirmación y la
    pestaña Archivados muestran cuántas variantes van con él (`contarVariantesDeArchivados`).
  **Toda consulta nueva de productos o variantes para operar debe filtrar `.is("archivado_en", null)`**
  (en variantes también `productos.archivado_en` si se une al producto); el historial no se filtra.
- **Producto:** foto con la cámara, quitar fondo con PhotoRoom (`PHOTOROOM_API_KEY`, permiso
  `inventory.manage`, rate limit por presupuesto).
- **Códigos de barras y etiquetas** (2026-11-11, pedido de un cliente; sin migración):
  - `lib/codigo-barras.ts` (puro):
    - Los códigos generados son EAN-13 **«200…»** (prefijo GS1 de uso interno) con verificador, al azar.
    - `generateNextBarcode`/`generarCodigosDeBarras` (`product-service.ts`) revisan que no existan en productos ni en
      variantes activos.
    - Antes era «750» + consecutivo sin verificador; esos códigos viejos se quedan y se imprimen como Code 128.
  - «Generar» en el código de: producto (al editar), tarjeta de variante y `variant-dialog` (`boton-generar-codigo.tsx`).
  - **Etiquetas en PDF:** botón «Etiquetas» en Productos (toma los marcados) → `features/inventory/etiquetas/`.
    - Formatos: hoja carta 3×10 y 4×20; rollo 50×25, 40×30 y 58×40.
    - Barras vectoriales en jsPDF; se imprime al 100 %.
    - «Generar código a los que no tienen» solo con `inventory.manage` y solo llena los vacíos.
    - Verificado decodificando con `zxing-wasm` a 203 dpi.
- **Cobro:**
  - **Fin de prueba / pago vencido** (migración 096, aplicada el 2026-10-04): acceso completo, gracia de 3
    días o solo lectura (ve y exporta; no vende ni edita), calculado en vivo por `acceso_tenant()`.
    Espejo en `lib/acceso-suscripcion.ts`.
  - Avisos de la prueba: correo 2 días antes y al vencer (`trial-notices`). Además, un banner en el panel los
    últimos 3 días (`avisoPrueba`, en `aviso-estado-pago.tsx`).
  - Trial de 14 días creado en el servidor (`complete_onboarding`).
  - Códigos promocionales (`codigos_promocionales`, generación manual por SQL).
  - Webhook de Conekta firmado (fail-closed, idempotente).
  - Cancelación con encuesta.
- **Landing:**
  - **Narración (audios):** al cambiar un `.mp3` de `public/audio/landing/`, renombrarlo a otra versión (`.v3`) y actualizar `audio-config.ts`. El service worker guarda los audios con CacheFirst: con el mismo nombre, los navegadores que ya los escucharon siguen con la voz vieja.
  - Header: Precios · Aprende · Nosotros · Contáctanos (`components/ui/app-frame.tsx`).
  - Secciones: Scroll Stack de módulos, guías en `/aprende`, página Nosotros con carrusel.
  - **Aprende** (`features/marketing/aprende.ts`): cada guía lleva `videos` (YouTube; portada ligera
    `video-guia.tsx`, que carga el iframe solo al dar play, con pestañas si hay varios) y, por paso, `captura`
    (computadora) y `capturaMovil` (celular), que la página alterna por ancho de pantalla. Las capturas son WebP
    generadas con `node scripts/capturas-aprende.mjs` desde `~/Imágenes/MODULOS`: la lista vive en el script.
    No publicar capturas con correos, celulares, nombres del equipo, claves o el precio promocional.
  - **Instalar en la computadora** (PWA, sin .exe por decisión del usuario: Electron pedía firma de código, rompía el
    login con Google y las impresoras): sección `instalar-computadora.tsx` antes del CTA y enlace en el footer →
    `app.symvora.com.mx/es/instalar` (`(auth)/[locale]/instalar`, pública por `isPublicRoute`, NO en
    `MARKETING_SEGMENTS`: instalada desde `www` sería otra app de otro origen). `CapturaInstalacion` (layout raíz)
    guarda `beforeinstallprompt`; `useInstalarApp` lo usa; sin él, pasos por navegador (`plataforma.ts`).
  - **Splash de entrada** (2026-11-05, `components/marketing/splash-entrada.tsx`, CSS en `styles/splash-entrada.css`,
    tiempos en `splash-logica.ts`): solo en la landing (`[locale]/page.tsx`).
    - Una vez por sesión (`sessionStorage` `symvora-splash`); nunca a bots ni Lighthouse, ni con reduced-motion. Lo
      decide un script en línea (`decidirSplash`, serializado con `toString()`: no puede usar nada de fuera de su cuerpo).
    - Tiempos medidos: `/es` pesa ~400 KB y `load` llega a ~2.4 s en escritorio.
    - La salida se ancla a la ANIMACIÓN, nunca a relojes: `splash-control.tsx` espera el `finished` de todas las
      animaciones de entrada (~2.25 s), luego una pausa de 0.6 s con el logo completo, luego la carga (`load` +
      fuentes) con 2 s de tope, y la salida dura 1.1 s. Total típico ≈ 4 s.
    - Con un reloj desde el parser, en navegadores que pintan tarde la salida llegaba con la entrada a medias y el
      splash «pasaba muy rápido».
    - Pestaña abierta en segundo plano: las animaciones se pausan y arrancan desde cero al hacerse visible.
    - Clic o toque solo saltan el splash después de la entrada; Esc, siempre.
    - Respaldos: salida forzada a los 7 s; CSS a los 8 s si el JS no llega.
    - Antes de medir el vuelo se terminan las animaciones de entrada (`dejarListoParaVolar`); si no, el logo llegaba
      corrido.
    - La salida es un FLIP: `splash-control.tsx` mide los `data-splash-*` de `app-frame.tsx` (logo y marca en
      escritorio, logo de la píldora en celular). **Si cambia el header, revisar el vuelo.**
  - **Mockups del hero** (2026-11-20, `components/marketing/hero-mockups.tsx`): laptop, tablet y celular en bucle (12 s, CSS
    puro en `.hero-mockup`, sin JS; con reduced-motion solo el primero). El modo va por CSS (`dark:hidden` /
    `hidden dark:block`), nunca leyendo el tema en JS. Solo desde `lg`, como antes. Los WebP viven en
    `public/landing/hero/{claro,oscuro}-{laptop,tablet,movil}.webp` y salen de `node scripts/mockups-hero.mjs`
    (origen `~/Imágenes/mockup_landing_page`, fuera del repo): el claro son los PNG con marco; el OSCURO se compone
    pegando las capturas oscuras DENTRO de esos mismos marcos (rectángulos de pantalla medidos en el script) y tapa el
    correo de la cuenta de pruebas. **Si cambia el tamaño de un WebP, cambiar `MOCKUPS_HERO`** (lo vigila
    `hero-mockups.test.tsx`). Nunca capturas con correos, celulares o nombres del equipo.
  - **H1 del hero** (2026-11-20): eslogan fijo «Controla tu inventario, evita fugas en caja y vende más rápido desde
    cualquier» + la pastilla giratoria (`palabra-giratoria.tsx`, recibe `palabras`) con celular, tablet, computadora y
    dispositivo (`landing.hero.dispositivos`, en ese orden). La pastilla va SIEMPRE en su propio renglón para que el alto
    del título no cambie al rotar. Los 20 giros ya no están en el H1: viven en la franja de giros y en
    `/punto-de-venta/[giro]`.
  - **Promoción de lanzamiento en la landing** (2026-11-20): se ve como la pastilla roja «−50%» junto a «Precios» en el
    header de escritorio y en el menú del celular (`etiqueta-promo.tsx`; `BubbleMenu` acepta `etiqueta` por ítem) y en el
    selector Mensual/Anual de precios. Las dos salen con `promoAplica("monthly")` (`PROMO_LANZAMIENTO.activa`): al apagarla
    se van juntas. El sello giratorio «−50% OFF» (`promo-badge.tsx`) se retiró.
  - **Botones con llenado** (`CAPSULA` / `.btn-llenado`): NO llevan `whileHover`/`whileTap` de motion en el MISMO elemento
    (2026-11-21). El llenado pone `transition: transform 0.6s` y motion escribe el `transform` en línea: pelean y el botón
    rebota al hacer scroll con el cursor encima (le pasó al WhatsApp de preguntas frecuentes). Si hace falta animarlo, un
    `<m.div>` envoltorio; hover y apretado por CSS (`hover:shadow-md active:scale-[0.97]`). Lo vigila
    `boton-llenado-sin-motion.test.ts`.
  - **Logos de clientes** («Equipos que construyen el futuro», `components/ui/logo-carousel.tsx`, archivos en
    `public/enterprises/`): el carrusel los vuelve silueta con CSS (`brightness-0`, blanca en oscuro), así que cada logo va
    como **WebP de una sola tinta con fondo transparente y recortado**. Un JPG/PNG con fondo sólido saldría como cuadro
    negro: quitarle el fondo antes (Armada Nutrition y Clarabella se hicieron así, 2026-11-20).
  - Footer: `components/ui/footer.tsx`, con enlaces legales con locale.
  - Las páginas legales usan `LegalShell` con `AppFrame`.
- **Legal (LFPDPPP):**
  - Documentos: aviso de privacidad, términos, cookies.
  - Las aceptaciones se registran en `legal_acceptances`, con banner de actualización. **La tabla (migración
    010) no existía en producción hasta el 2026-10-07**: no hay evidencia de aceptaciones anteriores a esa
    fecha. Al aplicarla, todo usuario existente ve una vez el aviso y su aceptación queda guardada.
    `/api/legal/accept` solo registra las versiones vigentes (409 si no). RLS: cada quien ve e inserta solo
    las suyas; nadie modifica ni borra.
  - Versiones en `lib/legal/versions.ts`; privacidad en `v1.6-2026-11-08` (la 1.5 sumó eliminar cuenta, conservar nombre
    y celular para comunicaciones comerciales y la app de Android; la 1.6, Google Wallet: al guardar su tarjeta, el cliente
    manda a Google su primer nombre, el código y sus sellos). **Cada versión nueva de privacidad necesita una migración
    que cambie el literal en `ejecutar_baja`** (como la 132; lo vigila `eliminar-cuenta.test.ts`). Términos en `v1.3-2026-10-06`
    (mayoría de edad: la casilla del registro dice «Declaro ser mayor de 18 años…» y la sección 2 de los
    Términos lo exige; los invitados no la aceptan, responde el titular). Sin fecha de nacimiento: no se recaba; la **edad** es opcional y se captura en Mi perfil (`user_metadata.edad`, 18-120).

## Niveles de suscripción Básico · Pro · Premium (migración 140, 2026-11-24) — APAGADOS
- **Interruptor:** `NEXT_PUBLIC_NIVELES_ACTIVOS=1` (`nivelesActivos()` en `lib/niveles.ts`; cambiarlo requiere redeploy). Apagado,
  la landing, `/billing` y el checkout venden el plan único de siempre ($399 / $3,588), igual que hoy. **No encenderlo** hasta
  alinear los reels de Meta Ads («de $399 a $199»; los cambia el dueño). Con el interruptor encendido la landing, el selector de `/billing` y el FAQ (`features/marketing/faq-claves.ts`: claves `3n`, `5n`, `9n`, `10`, `11`) ya hablan de niveles.
- **Tabla** (única fuente en código: `lib/niveles.ts`; espejo en la base: `plan_funciones`, y `niveles.test.ts` los compara leyendo la
  migración): Básico $249/mes · $2,244/año, 1 sucursal, sin Sucursales, sin lealtad, sin catálogo, sin pedidos; Pro $449 · $4,044, hasta
  3 sucursales + lealtad + catálogo + pedidos; Premium $599 · $5,388, sucursales ilimitadas (ancla). Usuarios y productos ilimitados en
  todos. **Premium se diferencia en la landing (`cta-niveles.tsx`, `caracteristicas()`) por sucursales ilimitadas + soporte prioritario por WhatsApp + migración asistida del catálogo (2026-11-25): los dos últimos son COMPROMISOS DE SERVICIO del dueño; si dejan de cumplirse, quitar sus claves `planes.selector.prioritySupport`/`assistedMigration` y del FAQ 11.** El selector de `/billing` es compacto a propósito: solo nombre, precio y etiquetas «Más popular» y «−50 %». Anual = mensual × 0.75 redondeado × 12.
- **`nivel` NULL = heredado** (clientes de antes y la prueba de 14 días): todo permitido y sin tope; nunca se les cambia nada.
  `nivel_pendiente` guarda lo elegido en el checkout MIENTRAS no se paga; solo `asignar_nivel` (service_role, lo llama el webhook
  `subscription.paid`/`order.paid` vía `confirmarNivelPagado`) lo confirma, y rechaza si hay más sucursales activas que el tope.
- **La regla vive en la base** (triggers aditivos, no se reescribió ninguna función de cobro): `limite_sucursales`, `plan_sin_lealtad`,
  `plan_sin_catalogo`. La interfaz solo esconde: `usePlan()` (`hooks/use-plan.ts`, store con `info_plan`, **falla abierto**: sin red =
  heredado), `filterNavigation`/`puedeVerRuta`/`accionesDisponibles`/`pasosParaUsuario` reciben el plan, `PlanGate` («Disponible en
  Pro») envuelve `/branches` y `/online-catalog`, Clientes quita la pestaña de lealtad, `usePosLealtad` apaga la tarjeta, y
  `SucursalesCard` avisa del tope. **Bajar de nivel nunca borra datos.**
- **Promo −50 % de lanzamiento en niveles:** SOLO Pro y Premium y SOLO mensual (`promoAplicaANivel` en `lib/niveles.ts`; Básico y el anual
  van a lista). 6 cobros (`PROMO_LANZAMIENTO.cobros`): Pro $225 y Premium $299, redondeados por el dueño (`PRECIOS_PROMO_NIVEL_CENTS`). Planes paralelos
  `symvora-pro-monthly-promo50-v1` / `symvora-premium-monthly-promo50-v1` (claves `proMonthlyPromo`/`premiumMonthlyPromo`); `create-checkout`
  siembra `promo_cobros_restantes`/`promo_plan` y al agotarse el contador el webhook (`avanzarPromocion`) devuelve al mensual del NIVEL, no al plan
  único. Manda el contador de la suscripción, no `activa` (`precioNivelCobroCents(nivel, periodo, cobros)`); `/billing` pinta el precio con
  `preciosPromoEnCurso(promo_plan)`. Con la promo el primer año mensual cuesta casi igual que el anual (Pro $4,041 vs $4,044).
- **Quien ya paga** (decisión 2026-11-24): los 4 negocios con pago completado pasan a Pro SIN tocar su cobro (migración 143, lista explícita;
  «Abarrotes Don Pedro» es el demo viejo, no entra). La prueba de 14 días y quien aún no paga siguen heredados. El cambio de nivel de quien ya paga
  se hace en Suscripción → «Cambiar de plan» (`components/plan/cambiar-plan.tsx` → `POST /api/conekta/cambiar-plan`, reglas puras en
  `features/payments/cambio-de-plan.ts`). SUBIR: `cambiarPlan` en Conekta y el nivel cambia YA (`asignar_nivel`); BAJAR y pagos únicos: `nivel_pendiente`
  que confirma el siguiente cobro (webhook). Sin promo al cambiar (cierra `promo_*`), sin prorrateo, nunca borra datos; falla cerrado (la base solo se
  toca si Conekta respondió bien). **Anual y cambio de periodo: por SOPORTE** (409 `cambio_por_soporte`; WhatsApp o soporte@symvora.com.mx). Ojo: el
  endpoint de Conekta que cambia el plan de una suscripción está marcado *deprecated* y su prorrateo no está documentado; no se puede probar sin cobrar
  de verdad (las pruebas lo simulan), así que vigilar el primer cambio real en el panel de Conekta. `pruebas@symvora.com.mx` es cuenta de desarrollo y
  se queda SIN nivel (heredado).
- **La prueba no tiene tope de sucursales (heredada) y NO se elige plan al registrarse** (decisión 2026-11-25: el registro es el paso a facilitar). Para que nadie choque
  al pagar: el registro dice «durante la prueba tienes todo; al terminar eliges tu plan»; Sucursales avisa en la prueba cuánto incluye cada plan; y en `/billing` y
  «Cambiar de plan» `AvisoAjustePlan` (con `nivelQueCabe`/`nivelSugerido`/`funcionesQueSeApagan` de `lib/niveles.ts`) marca y BLOQUEA el pago si el plan elegido no le cabe
  (sucursales activas de más), propone el nivel sugerido y avisa qué se apaga (catálogo, lealtad, pedidos; nunca se borra nada). El servidor sigue siendo la autoridad
  (409 `demasiadas_sucursales`). Si `asignar_nivel` falla DESPUÉS del pago, el webhook manda alerta a hola@ (`features/payments/fallo-nivel.ts`).
- **Conekta:** un plan por nivel y periodo (`symvora-<nivel>-<monthly|yearly>-v1`, claves `proMonthly`…; montos inmutables: si una cifra
  de `PRECIOS_NIVEL_CENTS` cambia, versionar el id). `create-checkout` acepta `nivel` solo con el interruptor encendido; sin él o con
  pestañas viejas cobra como siempre. Rechaza con 409 `demasiadas_sucursales` y `cambio_de_nivel_no_disponible` (quien YA paga no
  cambia de nivel por aquí: crearía una segunda suscripción; el cambio con `cambiarPlan` está pendiente). Los planes se crean en el
  primer checkout real: **nunca pagar para probar**; la primera compra real es la prueba de verdad.
- **Anuncio de los planes:** SOLO por correo (sin campana ni ventana, decisión del dueño): `/api/cron/anuncio-novedad?novedad=nuevos-planes` (sin `enviar=1` es simulacro; con él manda, una vez por persona), a dueños activos y en prueba (`construirCorreoNovedadPlanes` en `lib/email.ts`). También `?novedad=pedidos-catalogo` (`construirCorreoNovedadPedidos`: catálogo con pedidos + módulo Pedidos, solo correo). Se corre a mano con `CRON_SECRET` (no está en `.env.local`, solo en Vercel).
- **Hecho:** 143 aplicada, `NEXT_PUBLIC_NIVELES_ACTIVOS=1` en Vercel y desplegado. Suscripción muestra «Plan: …» (`planes.current.*`).
  Usuarios y productos siguen ilimitados en los tres niveles (el FAQ de «límites» se reescribió, no se quitó). Fase 2 resuelta sin
  búsqueda en servidor (20 mil productos cargan en ~4.5 s; ver «Lecturas de listas grandes»); Pedidos: ver su sección.

## Pedidos del catálogo en línea (migraciones 141-142, 2026-11-24) — APAGADO por negocio
- **Qué es:** el cliente final manda su pedido desde `/catalogo/<slug>` (nombre, celular, recoger o domicilio, nota) y el negocio le da
  seguimiento en `/orders` (módulo «Pedidos», permiso `orders.manage`, concedible a un cajero; solo Pro/Premium: `plan_funciones.pedidos`,
  `rutaPermitidaPorPlan('/orders')` y `PlanGate`). **`catalogos_en_linea.recibir_pedidos` nace en `false`**: nada cambia para ningún
  catálogo hasta que su dueño lo active (Catálogo en línea → Personalizar). Sin él (o sin el plan) la página sigue con el envío por
  WhatsApp de siempre; `_catalogo_encabezado` lo expone como `recibir_pedidos` (ausente = `false`, compatible con pestañas viejas).
- **Es la primera escritura anónima del catálogo** (patrón de `alta_publica_lealtad`): `crear_pedido_publico` es **solo de `service_role`**;
  la única puerta es `POST /api/catalogo/[slug]/pedido` (zod, honeypot `sitio`, rate limit 5/10 min por IP, Turnstile en el servidor,
  falla cerrado sin `TURNSTILE_SECRET_KEY`). La base **recalcula los precios** con `_catalogo_productos` (el cliente solo manda ids y
  cantidades), exige producto visible/no archivado/disponible, y topa: 50 renglones, 9,999 por renglón, 100 pedidos/día y negocio (CDMX),
  5 «nuevos» por celular; rechaza demo, solo-lectura y Básico. `anon` NO toca las tablas; `pedido_publico(codigo)` (anon) solo devuelve
  folio, estado, renglones, total, negocio y WhatsApp: nunca teléfono, dirección ni notas. El código de seguimiento (12 caracteres) ES el
  acceso: la URL `/catalogo/<slug>/pedido/<codigo>` está en `limpiarUrl` (analítica) y es `noindex`.
- **Las tablas** (`pedidos_catalogo`, `pedido_items`, `pedido_eventos`) tienen SOLO `SELECT` por RLS (`authorize('orders.manage')`); toda
  escritura va por `SECURITY DEFINER`: `cambiar_estado_pedido`, `confirmar_pedido`, `cancelar_pedido`. **REGLA:** no reabrir políticas de
  escritura (lección de la 138). Estados: `nuevo → confirmado → pago · en_produccion · listo · en_camino · entregado` y `cancelado`
  (`features/pedidos/transiciones.ts` es el espejo de la base; la base manda).
- **Stock y dinero:** «Confirmar» crea una VENTA real con `_crear_venta_desde_items` (`p_include_iva => false`, un pedido = una venta:
  `venta_id` único + `idempotency_key = id del pedido`). El stock baja ahí, con lotes y por sucursal; la sucursal es la de la caja abierta de
  quien confirma o la por defecto. **Ojo:** el motor registra la venta en la caja abierta de quien confirma, y con «Efectivo» entra a su
  corte aunque el dinero llegue después; la pantalla lo avisa. Si el total del POS difiere del que vio el cliente (precio especial del
  catálogo, cambio de precio), `confirmar_pedido` lanza `diferencia_de_precio:<pedido>:<venta>` y TODO se revierte (sirve de ensayo); el
  negocio lo acepta explícitamente. Cancelar un pedido confirmado usa `_cancelar_venta` (regresa stock, lotes y caja como «Cancelar venta»).
- **El cliente da seguimiento** en `/catalogo/<slug>/pedido/<codigo>` (se refresca solo cada 30 s). «Avisar por WhatsApp» del panel ya incluye ese enlace en el mensaje
  (`mensajeAlCliente`, `urlSeguimiento`). **«Mis pedidos»** (`features/catalogo/mis-pedidos.ts`): el navegador del cliente recuerda por negocio (`localStorage`
  `symvora-pedidos:<slug>`, máx. 20) solo código, folio y fecha, nunca datos personales; se guarda al enviar el pedido y al abrir el seguimiento
  (`GuardarPedido`), y el catálogo muestra el botón «Mis pedidos (N)» solo si ese negocio recibe pedidos. Sin cuenta: otro navegador no lo ve.
- **Modelo al estilo Kyte** (migración 146, 2026-11-26): `pedido_estados` = estados PROPIOS del negocio (máx. 15), cada uno apunta a un
  ESTADO BASE del motor (`confirmado`|`en_curso`|`entregado`|`cancelado`; `nuevo` es virtual). El motor (stock, caja, cancelar) solo mira la base; lo que se
  ve es `estado_nombre`/`estado_color` (copia en el pedido, sobrevive a renombrar). Los del sistema (Confirmado, Entregado, Cancelado) se renombran y
  recolorean, no cambian de función ni se borran. Los que ya usó un pedido solo se desactivan.
  - **Aceptar** (`aceptar_pedido`) NO cobra: ensaya la venta y la deshace para validar existencias. **Marcar pagado** (`registrar_pago_pedido`) es lo que
    crea la VENTA (stock + caja, una vez; un reintento devuelve `ya_pagado`). Un pedido pagado ya no se edita.
  - **Editar productos** (`editar_pedido`) solo sin pagar ni cerrar; el precio sale de `_catalogo_productos` (el mismo del cliente). El panel edita
    productos SIN variante; los que la tienen se conservan.
  - **Mensajes**: `mensaje_cliente` sale en el seguimiento; `nota_interna` solo la ve el equipo. **Pedido del POS**: `crear_pedido_interno`
    (botón «Guardar pedido» en el cobro, `GuardarPedidoPos`): nace confirmado con `origen = 'pos'`, sin stock ni caja hasta pagar; el descuento del POS no viaja.
  - **Seguimiento** (`/catalogo/<slug>/pedido/<codigo>`, estilo «Progreso del pedido»): estado propio con color, línea de tiempo con fechas
    (`pedido_eventos.etiqueta`), «Plazo para retirar» + «Cómo llegar» (`catalogos_en_linea.plazo_retiro_dias`, se edita en Personalizar), mensaje del negocio,
    fotos. Nunca teléfono, dirección del cliente ni nota interna.
  - **Avisos**: correo INMEDIATO al dueño y admins por cada pedido del catálogo (`construirCorreoPedidoNuevo`, `after()` en la ruta, 20/h por negocio) y
    toast + sonido en la app al llegar el `pedido_nuevo` por Realtime (`features/notificaciones/pedido-aviso.ts`; sonido apagable en el navegador).
  - Funciones viejas `confirmar_pedido`/`cambiar_estado_pedido` ahora responden «recarga la página»: pestañas con el código anterior ven ese aviso.
  - Pendiente: edición de productos con variante, avisos automáticos al cliente, reserva de stock al aceptar, pagos parciales.
- **Envío a domicilio** (migración 144, 2026-11-25): el admin fija `catalogos_en_linea.costo_envio` en Catálogo en línea → Personalizar (NULL = «el negocio
  lo confirma», 0 = gratis, n = costo, 0–99,999). Un trigger BEFORE INSERT (`_pedido_copiar_costo_envio`) lo COPIA a `pedidos_catalogo.costo_envio` en pedidos a
  domicilio (los hechos conservan el que vio su cliente); recoger lo deja NULL. **El envío NO entra a la venta** (el motor solo conoce productos y la comparación
  con el POS no cambia): el cliente lo ve en el formulario y en su seguimiento (`features/catalogo/envio.ts`), el panel lo muestra «cóbralo aparte» y el mensaje de
  WhatsApp lo incluye. El diálogo de confirmar avisa en pedidos a domicilio que el efectivo llega al entregar pero la venta cuenta hoy en la caja abierta.
- **Campana:** tipo `pedido_nuevo` (sin actor, permiso `orders.manage`); el CHECK de `notificaciones.tipo` se escribe ahora como
  `= ANY (ARRAY[...])` (la prueba `notificaciones-tipos.test.ts` acepta las dos formas).
- **Pendiente:** novedad/anuncio (campana + correo + ventana) **después del deploy y con OK del usuario** (interrumpe a todos los dueños),
  guía en Aprende, estados propios del negocio, WhatsApp automático, pago en línea, edición de renglones tras confirmar. La interfaz
  pública y el panel se probaron por servidor y en SQL con rollback; el envío completo desde el navegador (Turnstile real) falta
  probarlo a mano en `localhost` con «Pruebas SYMVORA».

## Activación de cuentas nuevas (2026-11-25)
- **Por qué:** 12 de 13 pruebas vigentes no tenían productos ni ventas (y 8 de 18 vencidas nunca hicieron nada). Antes no salía NINGÚN mensaje entre el registro y el
  aviso de fin de prueba; WhatsApp sigue apagado, el correo sí funciona. La Misión de 3 pasos, los catálogos de muestra por giro y el embudo
  (`140_cartera_clientes_funnel.sql`, **sin aplicar y con número repetido: renumerarla antes de aplicarla**) ya existían.
- **Correos por etapa** (`/api/cron/activacion`, diario 16:00 UTC, `?dry=1` = simulacro; reglas puras en `lib/activacion-correos.ts`): `primer_producto` (≥20 h, 0
  productos), `primera_venta` (≥2 días, con productos), `ayuda` (≥4 días); solo pruebas vigentes de negocios reales sin ventas ni pagos, con VENTANAS de edad (nunca a
  cuentas viejas), máx. 3 por cuenta y ≥36 h entre uno y otro. Marca por (etapa, negocio) en `rate_limits` (`activacion:<etapa>:<tenant>`) ANTES de enviar. Las plantillas
  (`construirCorreoActivacion`) nombran solo lo que existe en la Misión del dashboard: si esos textos cambian, cambiar el correo (lo vigila `correos-activacion.test.ts`).
- **+7 días de prueba a la PRIMERA venta** (migración 145): `subscriptions.trial_bono_en` + disparador en `ventas` (solo la primera venta del negocio con `total > 0`,
  dentro de `EXCEPTION WHEN OTHERS`: un bono nunca tumba una venta). Una sola vez, solo en `trial` vigente, no en demos ni pagadas; limpia las marcas de aviso de fin de
  prueba y deja un aviso de campana (`novedad`, `datos.novedad = 'bono-primera-venta'`). Quien ya vendió antes no recibe nada.
- **Reactivar vencidas** (`/api/cron/reactivar-pruebas`, MANUAL, fuera de `vercel.json`; sin `?enviar=1` es simulacro): pruebas vencidas, nunca pagaron, 0 productos y 0
  ventas, ≤ 90 días → `trial_end = ahora + 7 días` + correo (`construirCorreoReactivarPrueba`); una vez por cuenta (`reactivar-prueba:<tenant>`).

## Lecturas de listas grandes (2026-11-24)
- PostgREST corta en **1,000 filas** (`max-rows`): una consulta sin paginar devuelve el corte en silencio. **REGLA:** toda lectura de una
  lista que puede pasar de mil filas (productos, variantes, stock por sucursal, clientes, lotes, ajustes, ventas del reporte) usa
  `leerPorTramos` (`lib/leer-por-tramos.ts`) con `.order(...).order("id").range(desde, hasta)` y una consulta NUEVA por tramo (el
  builder se muta). Los errores lanzan en vez de devolver una lista vacía.
- **Medido el 2026-11-24 con 20,190 productos** (dev, Supabase remoto): el catálogo completo carga en ~4.5 s, búsqueda y escaneo en el POS de
  140-320 ms, ~100 MB de memoria. `fetchPosProducts` y `fetchProducts` comparten la lectura EN VUELO (arrancaban dos recargas y pedían todo
  dos veces); nunca sirven datos viejos. No hizo falta búsqueda en el servidor.

## Moneda del negocio (migración 133, 2026-11-12)
- Pedido de un cliente de España. `tenants.moneda` (`MXN` por defecto, `USD`, `EUR`; CHECK) se elige en Configuración →
  General (permiso `org.manage_settings`, el mismo del nombre del negocio). **Solo formato: NO convierte montos.** Si ya
  hay ventas, se confirma antes de cambiarla.
- Fuente única `lib/money.ts`: `formatMoneda`, `formatMonedaCompacto`, `formatMonedaEntero`, `monedaDe`; MXN en `es-MX`,
  USD en `en-US`, EUR en `es-ES` («1234,50 €»). En el panel, `useMoneda()` (`formatear`, `entero`, `compacto`, `simbolo`)
  lee la moneda del contexto del negocio (`useMonedaDelNegocio`, MXN fuera del proveedor). **REGLA:** nada de
  `` `$${n.toFixed(2)}` `` ni `formatMXN` en pantallas del negocio; `formatMXN` queda para la suscripción de SYMVORA
  (siempre en pesos), correos internos y la landing.
- Lo puro recibe la moneda o un `formatear` con MXN por defecto (`rangoDePrecio`, `TextosResumen.precio`, `montosRapidos`
  con billetes por moneda, gráficas, `exportar-reporte`, PDF de orden, mensaje al proveedor, etiquetas, `pedido.ts`).
  `ContadorAnimado` usa la prop `dinero`. Los mensajes con monto lo reciben ya formateado (`{monto}`, sin `$`).
- Ticket: HTML con «$»/«€»; ESC/POS escribe «EUR» (muchas térmicas no traen «€»). Correos y avisos del corte leen
  `tenants.moneda` en el servidor. El catálogo público la recibe en `_catalogo_encabezado` (contexto `MonedaCatalogo`).
- **Mercado Pago Point solo con MXN:** con otra moneda, Configuración muestra un aviso y el POS no ofrece «Tarjeta
  (terminal)» (`mpReady` falso en `use-cash-drawer`); la tarjeta manual sigue con terminal externa.
- **Pendiente (fase 2):** tasa de IVA por negocio (hoy 16 % fijo en el POS y en `_crear_venta_desde_items`,
  `registrar_compra_directa`, órdenes de compra y terminal). España usa 21 %.

## Tarjetas de lealtad (migración 115, 2026-10-09)
- **Vive dentro de Clientes** (`/customers`, pestaña «Tarjetas de lealtad», `?tab=lealtad`): configuración del
  programa con vista previa, resumen del mes, lista de tarjetas, ajustar sellos y «Nueva tarjeta». En la pestaña
  «Clientes», cada fila tiene «Tarjeta / Crear tarjeta» si el programa está activo. No hay ruta ni módulo aparte.
- **Modelo:** `programas_lealtad` (uno por negocio; nace con `activo`), `tarjetas_lealtad` (código de 12 caracteres
  aleatorios que va en el QR) y `movimientos_lealtad` (sello / canje / ajuste). Un sello por venta: índice único
  `(venta_id, tipo)`, así un reintento no duplica.
- **Escrituras:** el programa por tabla con RLS `authorize('loyalty.manage')` (SUPER_ADMIN, ORG_ADMIN). Tarjetas y
  sellos SOLO por RPC: `emitir_tarjeta_lealtad` (`sales.create`), `ajustar_sellos_lealtad` (`loyalty.manage`) y
  `complete_sale_lealtad`. Las tres tablas tienen el trigger de solo lectura (096).
- **Cobro:** con tarjeta, el POS llama `complete_sale_lealtad` (mismos argumentos que `complete_sale` más
  `p_tarjeta_id` y `p_canjear`), que valida el tope del descuento manual, calcula el premio en el servidor
  (producto: una unidad; monto; porcentaje), crea la venta con `_crear_venta_desde_items` y suma el sello o canjea.
  La venta del canje no suma sello. `complete_sale` no se tocó. El POS anticipa el premio con `aplicarPremio`
  (`features/lealtad/lealtad.ts`), que es el MISMO algoritmo: si cambia uno, cambia el otro. Con «Tarjeta
  (terminal)» la lealtad no aplica (se confirma sin sesión).
- **POS:** escanear el QR (o teclear el código) adjunta la tarjeta y su cliente (`codigoDesdeEscaneo`; un código
  de producto gana si coincide con el catálogo). Elegir un cliente con tarjeta la adjunta. La tira va bajo el
  selector de cliente (`TiraLealtadPos`); el ticket imprime «Sellos: 9/10» o «Premio canjeado».
- **Tarjeta pública:** `/[locale]/tarjeta/[codigo]` sin login (ruta pública en el middleware), con cliente
  anónimo, `tarjeta_publica` (la ÚNICA función de lealtad para `anon`: solo primer nombre del cliente, sin
  teléfono, correo ni montos) y rate limit de 60/min por IP. Manifest propio
  (`/api/tarjeta/[codigo]/manifest`) para «Agregar a pantalla de inicio». QR con `qrcode` (SVG).
- **Correo:** `POST /api/lealtad/enviar-tarjeta` (`sales.create`, 20/h por usuario, no en demo); el destino sale de
  la base, nunca de la petición.
- **Personalización (migración 120, 2026-10-16):** `programas_lealtad.icono_sello` (dibujo del sello lleno; la lista
  `ICONOS_SELLO` de `features/lealtad/lealtad.ts` es la misma que el CHECK: si cambia una, cambia la otra, lo vigila
  `lealtad.test.ts`) y `color_fondo` (NULL = paleta clara/oscura; con fondo propio, `paletaDeTarjeta` saca el texto del
  fondo y corrige el acento si no contrasta). `tarjeta_publica` devuelve las dos.
- **Panel** (`panelLealtad`, sin migración): a un sello, premios por canjear, días promedio entre visitas, sin venir
  30 días (`esInactiva`) y sellos por semana (8, `grafica-sellos.tsx` con `next/dynamic`). Las métricas filtran la
  lista. Una "visita" = un sello.
- **Tarjeta pública viva** (`tarjeta-viva.tsx`): recuerda en `localStorage` (`symvora-tarjeta:<codigo>`) los sellos
  vistos; los nuevos rebotan y al completar hay confeti (`cambioDeTarjeta`). Se actualiza con el botón o al volver a
  la pestaña (máx. una vez cada 10 s). `prefers-reduced-motion`: solo destello.
- **Registro con QR del local (migración 121, 2026-10-16):** el cliente escanea un cartel del mostrador
  (`/[locale]/tarjeta/unirse/<codigo_alta>`, público por estar bajo `/tarjeta/`), deja nombre y celular y obtiene su
  tarjeta. Es la PRIMERA escritura anónima sobre datos de un negocio:
  - `alta_publica_lealtad` es **solo de `service_role`**; la única puerta es `POST /api/lealtad/unirse`, que valida
    rate limit (10/10 min por IP) y **Turnstile en el servidor** (`lib/turnstile.server.ts`, `TURNSTILE_SECRET_KEY`;
    sin la llave no hay altas: 503). No darle `EXECUTE` a `anon`.
  - Un celular que ya existe en el negocio (últimos 10 dígitos) NO recibe tarjeta ni la suya (`ya_registrado`): así
    nadie se queda con el código y el premio de otro. Tope de 100 altas con QR por negocio y día (CDMX), con el
    programa bloqueado. Revisa `acceso_tenant` a mano (el trigger 096 deja pasar a service_role) y rechaza demos.
  - `programas_lealtad.alta_publica` (interruptor en la configuración), `codigo_alta` (lo genera un trigger al
    activar; solo cambia con `regenerar_codigo_alta_lealtad`, que invalida los carteles) y `aviso_privacidad_url`
    opcional del negocio. La 122 hizo `SECURITY DEFINER` ese trigger: corría como quien guarda y authenticated no
    tiene el generador (`permission denied for function _codigo_alta_lealtad`). **Probar las migraciones también
    como usuario** (`set local role authenticated` + `request.jwt.claims`), no solo como postgres. `tarjetas_lealtad.origen` ('equipo'|'qr') y `acepto_aviso_en` (evidencia LFPDPPP; el
    negocio es responsable, SYMVORA encargado, sección 4 del aviso).
  - `programa_alta_publica` (anon) solo da lo que pinta la página. Aviso `lealtad_alta` en la campana (sin actor,
    agrupado por día, permiso `sales.create`). Cartel PDF carta en `features/lealtad/cartel-pdf.ts`; «QR para tu
    mostrador» en la pestaña (`qr-mostrador.tsx`); insignia «QR» y filtro en la lista. El celular guarda en
    `localStorage` (`symvora-mis-tarjetas`) las tarjetas que sacó, para ofrecer «Abrir mi tarjeta».
- **Google Wallet** (2026-11-08, `features/lealtad/google-wallet/`; guía en
  `~/Documentos/symvora_data/docs/google-wallet-setup.md`):
  - SYMVORA es el único emisor (`GOOGLE_WALLET_ISSUER_ID`, `_CLIENT_EMAIL` y `_PRIVATE_KEY`). Sin ellas el botón no sale y
    no se llama a Google.
  - Clase = hash del id del PROGRAMA (`idClaseWallet`), nunca el nombre del negocio. Objeto = el código de la tarjeta.
  - Enlace de guardar: `GET /api/tarjeta/[codigo]/google-wallet`, público con el rate limit de `obtenerTarjetaPublica`.
  - Sincronización: `POST /api/lealtad/sync-wallet` con `sales.create`; recibe solo `tenantId` y `tarjetaId` y relee los
    sellos de la base. **Nunca aceptar sellos del cliente** (la primera versión los aceptaba sin sesión). La llama
    `completeSale` sin `await` (`keepalive`).
  - El saldo va por `PATCH`; el aviso al teléfono por `addMessage` con `TEXT_AND_NOTIFY` (un `PATCH` de `messages` no
    notifica; Google da ~3 avisos por pase al día).
  - Botón: el badge OFICIAL de Google en español de Latinoamérica (`public/google-wallet/agregar-a-google-wallet.svg`,
    paquete «es419»); no se recolorea ni se recorta. En iPhone se oculta (no hay Google Wallet). El aviso de privacidad
    v1.6 lo menciona (sección 4 y transferencias). Pendiente: completar el perfil y pedir el acceso de publicación en la
    consola de Wallet.
- **Pendiente:** lealtad con terminal Mercado Pago.

## Lotes por sucursal (116) e insumos por servicio (117), 2026-10-12
- **Regla central:** la existencia sigue siendo `stock_sucursal.cantidad`. Los lotes la REPARTEN:
  `existencias_lote(lote_id, sucursal_id, cantidad)` con Σ ≤ stock; lo que sobra es stock «sin lote».
  - `lotes.cantidad` = Σ existencias (trigger); nadie la escribe a mano (otro trigger la protege).
  - `lotes.variante_id`: un producto con variantes tiene lotes por variante.
  - `movimientos_lote` es el kárdex: COMPRA, VENTA, INSUMO, TRASPASO_*, AJUSTE, CUADRE…
  - Tablas solo con SELECT por RLS; se escribe por RPC.
- **Consumo FEFO** (`_consumir_lotes`): primero el lote que caduca antes, luego lo sin lote.
  - **Las piezas de lotes caducados NO se venden** (decisión de negocio): la venta falla con «hay piezas de lotes
    caducados (lote X)». Caducado = `fecha_caducidad < hoy` en CDMX (`_hoy_mx`).
  - El traspaso mueve los mismos lotes al destino (vigentes, luego sin lote, al final caducados).
  - Compras (directa y recepción de OC) aceptan `numero_lote`/`fecha_caducidad` por renglón (opcional).
  - Un ajuste con lote mueve ese lote en esa sucursal.
  - **Cuadre:** trigger en `stock_sucursal`: si el stock baja por una ruta que no sabe de lotes, consume el
    excedente FEFO. Nunca hay más lotes que stock.
- Alta manual: `registrar_lote` («ya está en mi inventario» reparte stock sin lote; «mercancía nueva» suma con
  un `ajustes_inventario` OTRO). Un lote con ventas o traspasos no se borra.
- **Insumos por servicio:** `insumos_servicio` (receta por unidad), editada en el producto con
  `guardar_insumos_servicio` (sobre un servicio ya guardado).
  - Al cobrar, `_crear_venta_desde_items` los descuenta con sus lotes (INSUMO).
  - En el POS la línea puede traer `insumos` (TOTALES de la línea, `CartItem.insumos`). Sin la clave: la receta.
    Al cambiar la cantidad, los ajustados se escalan.
  - **Si un insumo no alcanza, NO se bloquea el cobro:** baja hasta 0 y queda `faltante` en
    `detalle_venta_insumos`. El costo del servicio suma el de sus insumos.
- `_crear_venta_desde_items` (117) valida lo vendido directo AGREGADO por producto/variante: dos renglones del
  mismo producto ya no pasan del stock. Los candados incluyen los insumos, en el mismo orden por id (107).
- Frontend:
  - Lógica pura en `features/inventory/lotes.ts` e `insumos.ts`.
  - Pestaña Lotes con existencias por sucursal y kárdex (`lote-movimientos-dialog.tsx`).
  - Vista previa de lotes en Traspasos.
  - Detalle de venta con lotes e insumos.
- **Avisos (migración 118):**
  - `lote_por_caducar` (15 días antes) y `lote_caducado`: los crea `revisar_caducidades`. La campana la llama al abrir
    la app, una vez por pestaña; el cron `avisos-stock` (8:00) la corre para todos los negocios, sin demos. Hay un
    aviso por lote, estado y fecha.
  - `lote`: un colaborador registró, editó o eliminó un lote.
  - `insumo_faltante`: aviso por venta, desde un trigger por sentencia en `detalle_venta_insumos`.
- El costo unitario del lote es solo informativo: la ganancia usa el costo del producto o variante.
- Pendiente: expediente clínico.

## Catálogo en línea (migraciones 124-125, 2026-10-28)
- **Qué es:** página pública por negocio, `www.symvora.com.mx/es/catalogo/<slug>` (indexable), con productos, precio
  y disponibilidad. El cliente arma un carrito y lo manda al WhatsApp del negocio. **No cobra, no guarda pedidos y no
  mueve inventario**: no hay ninguna escritura anónima. Incluido en el plan.
- **Módulo propio `/online-catalog`** (menú, después de Clientes; excepción pedida por el usuario a «funciones dentro
  de módulos existentes»). Permiso `catalog.manage`: SUPER_ADMIN y ORG_ADMIN, concedible a un cajero (CHECK de la 125;
  la ruta está en `ADMIN_ONLY_PATHS` del middleware).
  - Arriba: interruptor Publicar + compartir (enlace, QR, WhatsApp).
  - Pestañas:
    - **Productos:** ocultar, destacar y precio especial; acciones en grupo.
    - **Personalizar:** color, portada, enlace, WhatsApp, mensaje, mostrar precios y agotados.
    - **Vista previa:** `CatalogoVista` en un marco con `transform` para que lo `fixed` quede dentro.
  - En `localhost` el enlace apunta al servidor local (`useBaseCatalogo`).
- **Modelo:**
  - `catalogos_en_linea`: uno por negocio. Slug único con el patrón de `slugValido` (si cambia uno, cambia el otro).
    Columnas `color` y `portada_url` (la portada va en `product-images/<tenant>/catalogo/`).
  - `catalogo_productos` (125): sin fila = publicado, sin destacar y a precio normal. Columnas `oculto`, `destacado`
    y `precio_especial`, este solo para productos sin variantes; **el POS cobra el normal**.
  - Va aparte de `productos` para no disparar los avisos de «editó N productos» ni exigir `inventory.manage`.
  - RLS con `authorize('catalog.manage')` y un `EXISTS` de producto del mismo negocio; trigger 096.
- **TRANSICIÓN PENDIENTE:** `productos.oculto_en_catalogo` (124) se desplegó en el formulario de producto, que la
  manda en cada guardado.
  - La 125 la conserva, con los triggers `trg_productos_oculto_a_catalogo(_upd)` que copian sus cambios a
    `catalogo_productos`.
  - Ya nada la lee. Después del deploy del módulo, otra migración quita los triggers y la columna.
- **Lectura pública:** `catalogo_publico(slug)` y `catalogo_publico_productos(...)` son las ÚNICAS funciones para `anon`.
  - Envuelven `_catalogo_encabezado` y `_catalogo_pagina`, que son internas.
  - Devuelven NULL si el catálogo está apagado, el negocio es demo o está en solo lectura.
  - Nada de costos, códigos ni existencias exactas.
  - Vista previa: `catalogo_vista_previa*` (authenticated, `catalog.manage`, aunque el catálogo esté apagado).
- **Página pública:** `app/[locale]/catalogo/[slug]` (`/catalogo` está en `MARKETING_SEGMENTS`: en www y sin sesión).
  - Carga con `catalogo-publico.server.ts`: cliente anónimo y rate limit `catalogo:<ip>` 120/min.
  - Búsqueda y «Cargar más» por `GET /api/catalogo/[slug]/productos`.
  - Arriba, la fila «Destacados».
  - Precio especial con el normal tachado.
  - Carrito puro en `pedido.ts` (`precioDeLinea` usa el especial), guardado en `localStorage` (`symvora-catalogo:<slug>`).
  - El sitemap incluye los catálogos activos (`revalidate` diario).

## Novedades del producto (2026-10-30)
- **Fuente única** `lib/novedades.ts` (`NOVEDADES`: id, ruta, permiso, `desde`/`hasta` en días CDMX). Hoy: el Catálogo en
  línea y las Etiquetas con código de barras. Solo la ve quien tiene el permiso del módulo (`null` = todo el equipo);
  nunca en demo.
- **Novedad de una función dentro de un módulo** (campo `funcion`, p. ej. `"etiquetas"` en Productos): la pastilla
  «Nuevo»/«New» va en ESE botón (`funcionNueva`/`usarFuncion` de `useNovedades`), no en el menú; entrar al módulo no la
  marca vista (se marca al usarla) y no abre la ventana. `EtiquetaNuevo` se traduce (`news.new`).
- **Cuatro vías:**
  - **Etiqueta «Nuevo»** en el menú lateral, en el panel «Más» y un punto en el botón (+) del dock
    (`features/novedades/`: `use-novedades.ts`, `etiqueta-nuevo.tsx`). Se quita al abrir el módulo.
  - **Ventana** `ventana-novedad.tsx` (en `dashboard-shell`): sale una vez, pero no durante el tutorial ni en el POS.
  - Lo visto se guarda en `localStorage` `symvora-novedades:<userId>` (cortesía, sin tabla).
  - **Campana:** tipo `novedad`. La **migración 126** suma el tipo al CHECK y siembra un aviso por negocio real
    (`permiso = 'catalog.manage'`). Aplicada el 2026-10-30.
  - **Correo** a los dueños: `/api/cron/anuncio-novedad`. Fuera de `vercel.json`, se corre a mano. Sin parámetros es
    simulacro; `?enviar=1` manda, una vez por persona (`consumirRateLimit`). Destinatarios en
    `lib/anuncio-novedad.ts`: sin demos, sin solo lectura y sin quien ya tiene catálogo.
- **Migración 134 (Etiquetas):** aviso en la campana a todo negocio real (`permiso` NULL) y trigger
  `trg_tenants_novedades` → `_novedades_negocio_nuevo()`: los negocios que se registren hasta el 2026-12-03 también lo
  reciben (demos no; atrapa sus errores).
- **Correo de una novedad:** `/api/cron/anuncio-novedad?novedad=<id>` elige el anuncio (`ANUNCIOS` en la ruta:
  `catalogo-en-linea`, que excluye a quien ya tiene catálogo, y `cancelar-ventas`). Plantillas en `lib/email.ts`
  (`construirCorreoNovedad*`), envío común `sendCorreoNovedad`.
- Para una novedad futura: agrégala a `NOVEDADES`; para la campana, una migración que siembre los avisos y haga
  `CREATE OR REPLACE` de `_novedades_negocio_nuevo()` con el texto y la fecha nuevos; para el correo, una plantilla.

## App de Android en Google Play (TWA) y eliminar cuenta (migración 128, 2026-10-31)
- **La app es una TWA** (Trusted Web Activity, con Bubblewrap): abre `app.symvora.com.mx` en Chrome a pantalla completa.
  No es Capacitor/WebView: ahí no funcionan el login con Google ni las impresoras WebUSB/Bluetooth. Cada deploy
  actualiza la app; Play solo se resube si cambia el contenedor. `output: 'export'` NO sirve (API, proxy, sesiones).
  - `/.well-known/assetlinks.json` (`src/app/.well-known/assetlinks.json/route.ts`) con `ANDROID_APP_PACKAGE`
    (default `com.symvoramx.app`) y `ANDROID_APP_SHA256` (huella de la firma de Play App Signing; coma si hay varias).
    El paquete es `com.symvoramx.app`: `com.symvora.app` ya lo usa otro desarrollador en Play (2026-11-11). Huellas:
    firma de Google `5D:F9:08:…:2B:3F` (la que importa) y clave de subida `1C:0B:12:…:6F:7A` (solo para APK local).
  - **Cobro:** Google Play exige su facturación para lo que se vende DENTRO de la app. La app no vende: se reconoce
    con `?app=android` en el start URL o el referrer `android-app://` → `sessionStorage` `symvora_app=android`
    (`lib/app-android.ts`, `features/app-android/`, montado en el layout RAÍZ: el panel y el login son otros árboles
    de rutas). NUNCA cookie: la TWA comparte el perfil de Chrome y Chrome también perdía los botones de pago. Con la
    marca, `/billing` oculta precios y pagos, y `aviso-estado-pago.tsx` no invita a pagar. Se paga desde Chrome: los
    correos de prueba y cobro llevan a `/es/billing`.
  - `manifest.ts` lleva `id` fijo (`/es/dashboard`, igual al calculado: no cambia las PWA instaladas).
  - **Splash animado al abrir la PWA instalada** (2026-11-05): el mismo de la landing con `variante="app"`, montado en
    los layouts `(dashboard)` y `(auth)`.
    - Solo sale como PWA instalada: `display-mode` standalone/ventana/pantalla completa o `navigator.standalone`
      (iOS). En el navegador nunca. Una vez por arranque.
    - **NUNCA en la APK de Play (TWA)**, aunque también sea standalone: con cualquier marca de la TWA (`?app=android`,
      referrer `android-app://`, `symvora_app`) no sale. Ahí va SOLO el splash nativo con el logo blanco (decisión del
      2026-11-05: con los dos se veían dos splash seguidos).
    - Va todo sobre azul, para empalmar con el splash nativo azul (`background_color` #1E3A8A); si cambia ese color,
      cambiarlo también en `.sp-app`.
    - Sin vuelo al header: al final el logo se aleja y el azul se vuelve vidrio.
    - Las pantallas de arranque de iOS (`public/splash/*.png`, `generate-pwa-icons.mjs`) son azul liso, porque ahí sí
      sigue el animado. La PWA instalada desde Chrome Android trae su propio splash con ícono y nombre (no se controla).
  - Proyecto Android FUERA del repo: `~/Documentos/symvora-android` (keystore `android.keystore,symvora android`, alias
    `symvora`; `minSdkVersion` 24, `splashScreenFadeOutDuration` 900). Tras cada `bubblewrap update` correr
    `node scripts/preparar-android.mjs ~/Documentos/symvora-android`: pone el logo blanco chico en el splash nativo
    (fuente `scripts/assets/splash-logo-symvora.png`, la pantalla de iOS original) y QUITA el
    intent-filter App Link (`autoVerify`) del manifest, para que los enlaces (correos de pago, WhatsApp) abran Chrome
    y no la app. En la app NO hay botón para pagar en el navegador: la política de pagos de Play
    lo prohíbe en México (solo programas de EE. UU., UE, Japón, Brasil…).
- **Eliminar cuenta** (lo exige Play): «Eliminar mi cuenta» en Mi perfil (`features/cuenta/eliminar-cuenta.tsx`) y
  página pública `/es/eliminar-cuenta` (en `MARKETING_SEGMENTS`).
  - `POST /api/cuenta/eliminar` → `solicitar_baja` (30 días para arrepentirse; si es el dueño, cancela hoy la
    suscripción en Conekta) y avisa a hola@. `DELETE` → `cancelar_baja`. El panel queda tapado por
    `BajaPendiente` (el dueño puede descargar sus datos ahí).
  - Cron `/api/cron/ejecutar-bajas` (9:30 UTC, `?dry=1`): borra los archivos del negocio en Storage
    (`archivos_de_negocio`) y llama `ejecutar_baja`. Para el dueño se borra el negocio con la secuencia de
    `_borrar_negocio_demo` y las cuentas que solo vivían ahí. Un colaborador sale y su cuenta se cierra.
    `_cerrar_usuario` borra de `auth.users` o, si lo apuntan ventas/compras/cajas de otro negocio, anonimiza.
    `ejecutar_baja` limpia `request.jwt.claims`: si no, la Bitácora registra la cascada contra un negocio borrado y
    falla la llave.
  - **Se conserva** (aviso de privacidad v1.5): nombre y celular para comunicaciones comerciales salvo que el
    titular marque que no → `interno.contactos_conservados` (salen en `interno.cartera_clientes` como
    «Cuenta cerrada»); los pagos de la suscripción → `interno.bajas`.

## Notificaciones (migraciones 108-109, 2026-10-05)
- **Tonos** (2026-11-27, `features/notificaciones/sonidos.ts`, generados con `node scripts/generar-tonos.mjs`): `SONIDO_POR_TIPO` es un `Record` completo. Pedido nuevo = 3 notas ascendentes; agotado = 2 descendentes graves; stock bajo = 2 suaves; novedad = arpegio; caja cerrada, venta cancelada, lote caducado e insumo faltante = «ping» neutro. El resto calla. Solo suena un tono a la vez (gana la prioridad) y no más de uno cada 2 s; el interruptor es la bocina de la campana (`localStorage`). **REGLA:** al cambiar un tono, subir la versión del archivo (`.v2`) por la caché del service worker.
- **Campana del header** (`features/notificaciones/`): `use-notificaciones.ts` carga las 30 más recientes, se entera
  por **Realtime** (`notificaciones` es la única tabla en `supabase_realtime`) y vuelve a consultar al recuperar el
  foco. Al abrir el panel se llama `marcar_notificaciones_leidas` (`notificaciones_lectura.leido_hasta`). La lógica
  pura está en `lib/notificaciones.ts`.
- **Las generan triggers en las tablas de origen**, no la Bitácora:
  - **Stock:** `productos`/`variantes_producto`, cuando el estado EMPEORA (misma regla que `stockStatus`). Se saltan
    los servicios, los archivados y el producto general con variantes. No repite el mismo aviso en 12 h. Lo ve todo
    el equipo (`permiso` NULL).
  - **Acciones de un colaborador** (actor ≠ SUPER_ADMIN), cada una con su permiso:

    | Acción | Permiso |
    |---|---|
    | Cierre de caja | `finances.manage` |
    | Productos y variantes | `inventory.manage` |
    | Compras y órdenes | `purchases.manage` |
    | Ajustes y traspasos | `inventory.manage` |

    La RLS además exige `activity.view`: el cajero trae `purchases.manage` de fábrica y sin esto vería las compras de
    sus compañeros. El mismo actor y la misma acción dentro de 10 min se agrupan («Ana creó 12 productos»).
  - **REGLA:** todo trigger de notificación atrapa sus errores (`EXCEPTION WHEN OTHERS`); un aviso nunca puede tumbar
    una venta, un cierre o una compra. Un evento nuevo se agrega con un trigger que llame `_notif_accion` y un tipo
    nuevo en el CHECK de `notificaciones.tipo`.
  - El negocio demo no genera avisos (`_notif_tenant_activo`).
  - Tipos de lotes y caducidades (118): ver «Lotes por sucursal». Un tipo nuevo va en el CHECK, en
    `TIPOS_NOTIFICACION` (`lib/notificaciones.ts`) y en `ESTILO` de la campana; `notificaciones-tipos.test.ts` compara
    la lista con el CHECK.
- **Expandir** (2026-11-17): si el título o el mensaje no caben (`estaRecortado`: `scrollHeight`/`scrollWidth` contra
  lo visible), el clic o toque EXPANDE el aviso y muestra «Abrir» (`notifications.open`) para ir al módulo; otro toque
  lo recoge. Si el texto cabe, va directo al módulo como antes. Escritorio: `AvisoEscritorio`. Celular: `AvisoMovil`
  mide el texto y le pasa el alto a `FilaDeslizable` (alto fijo por diseño), que anima el cambio.
- **Descartar** (migración 109): es POR USUARIO, nunca borra la fila compartida. `ocultar_notificacion(id)` guarda
  en `notificaciones_ocultas` y la RLS de `notificaciones` esconde las que tengan `oculta_en >= creado_en`. Así una
  agrupada que se actualiza después reaparece con el conteo nuevo. En escritorio (`useEsEscritorio`) es la X al
  pasar el mouse; en celular y tablet, deslizar a la izquierda con `FilaDeslizable` (una sola acción, sin confirmar).
- **Correo inmediato de stock** al SUPER_ADMIN y los ORG_ADMIN:
  - La campana lo pide a `POST /api/notificaciones/correo-stock` cuando ve un aviso de stock con
    `correo_enviado_en` NULL.
  - `reclamar_avisos_stock` (solo `service_role`) marca los avisos de forma atómica, con un candado por negocio.
    Máximo un correo cada 15 min; si toca esperar, devuelve `esperar` y la campana reintenta.
  - Si Resend falla, `liberar_avisos_stock` los deja pendientes otra vez.
  - Cron de respaldo `/api/cron/avisos-stock` (8:00 CDMX): manda lo que haya quedado pendiente y borra
    notificaciones de más de 30 días.

## Alertas internas a hola@ (migración 123, 2026-10-26)
- **Aviso al momento:** `/api/email/welcome` (lo llama `crearNegocio`, registro con correo y con Google), con `after()`,
  manda «Nuevo negocio: …» a `HELLO_EMAIL`. Una vez por negocio (`consumirRateLimit("aviso-alta:<tenant>", 1, 30 días)`).
- **Resumen diario:** cron `/api/cron/resumen-interno` (13:00 UTC = 7:00 CDMX, `?dry=1` sin enviar). Datos de
  `resumen_interno_diario()` (solo `service_role`): nuevos 24 h, incompletos 3 días (borradores + usuarios sin
  negocio, p. ej. Google), sin productos (>2 días), inactivos (7 días sin vender o nunca tras 3), pruebas por vencer
  (3 días), pagos y vencidos/cancelados 24 h. Excluye demos, incluido el compartido viejo (miembro `is_demo`).
- Contenido en `lib/resumen-interno.ts` (puro, `__tests__/resumen-interno.test.ts`); envío `sendCorreoInterno`.
- **Termómetro de carga** (migración 130): la clave `carga` (ventas 24 h, negocios que vendieron, pico de ventas por
  minuto y de cajeros por hora) abre el correo. Con `cajeros_pico_hora ≥ 50` o `ventas_pico_minuto ≥ 60`
  (`UMBRAL_CARGA`, ~30 % del primer techo del plan Free) el asunto empieza con «⚠️ Carga alta». Capacidad medida el
  2026-11-03: pico real de 3 ventas/min y 2 cajeros/hora; techos en orden: 200 conexiones de Realtime (Free), CPU de
  la Nano con muchos paneles abriendo a la vez, y ~1,500 ventas/min.

## Celular del cliente y avisos (2026-10-01/02)
- **Captura del celular:**
  - Obligatorio en el signup, con lada (MX +52 por defecto): `lib/telefono.ts`,
    `components/ui/telefono-input.tsx`.
  - Se edita en Mi perfil (`celular-perfil.tsx`), con el interruptor "avisos al celular"
    (`contacto_usuarios.avisos_whatsapp`).
- **Tablas** (migración 099):
  - `contacto_usuarios`.
  - `registros_pendientes`: borradores del signup, guardados vía `POST /api/registro/borrador`.
- **WhatsApp** (`lib/whatsapp-api.ts`, `lib/whatsapp-plantillas.ts`):
  - APAGADO hasta tener `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`.
  - Avisos: fin de prueba, cobro, corte de caja y seguridad.
  - Cron `/api/cron/seguimiento-whatsapp` con 3 flujos de abandono; apagado no envía ni marca nada.
- **SMS por Twilio**, solo para el corte de caja:
  - Archivos: `lib/sms-api.ts`, `lib/sms-texto.ts` (GSM-7, ≤160 caracteres) y `lib/avisos-celular.ts`
    (WhatsApp primero, SMS de respaldo).
  - APAGADO hasta tener `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` y `TWILIO_FROM`.
- **Nombre de los usuarios** (migración 101, 2026-10-04):
  - Fuente única: `nombreCompleto()` / `primerNombre()` en `lib/nombre-usuario.ts` y, en SQL,
    `nombre_de_usuario(meta)`. Orden de lectura: `nombre_completo` → `nombre` → `full_name`.
  - La invitación pide Nombre y Apellido (opcional), guardados en `user_invite_keys.nombre/apellido`.
    `key-login` los copia a `user_metadata.nombre`.
  - El dueño edita el nombre desde Usuarios con `PATCH /api/users/[userId]/nombre`.
  - El registro con correo solo pide **Nombre y Apellido**; el nombre por partes (`primer_nombre`, `segundo_nombre`,
    `apellido_paterno`, `apellido_materno`) y la edad se completan en Mi perfil. `nombre`/`nombre_completo`/`full_name`
    siguen con el nombre armado (`armarNombre`); `partesDelNombre` ignora partes que ya no formen el nombre vigente.
  - `get_tenant_members` devuelve `user_nombre`; `listar_ventas`/`detalle_venta` devuelven `cajero_nombre`.
  - El saludo "¡Hola, {nombre}!" sale en el Dashboard y arriba del buscador del POS.
- **Cartera de clientes interna:** vista `interno.cartera_clientes` (migraciones 100 y 111), no expuesta por la
  API. Consulta: `select * from interno.cartera_clientes;` en el SQL Editor, o Table Editor → esquema `interno`.
  La 111 agrega al final `productos`, `variantes` (activos), `primer_producto`, `ventas` y `ultima_venta`.
- **Ingresos de SYMVORA por mes** (migración 131): `select * from interno.ingresos_mensuales;` (mismo esquema, no
  expuesta). Pagos `completed` de `payment_history` sin demos, por mes en CDMX: pagos, negocios, total, `base_sin_iva`
  (total/1.16: el precio al público incluye IVA), `iva` y `por_metodo`. La contabilidad formal de la empresa va con
  contador/programa contable, no dentro de la app (decisión del 2026-11-03).

## Cómo trabajar en este repo
- **Commits y servidor:**
  - **No hacer commit sin que el usuario lo pida.**
  - El usuario corre su propio `next dev` en `localhost:3000`: no levantar otro.
  - Probar en `localhost`, no en `127.0.0.1`.
- **Datos de prueba:** usar el tenant **"Pruebas SYMVORA"** (en la base, `tenants.nombre_comercial` =
  "Miscelanea Symvora", id `ab77a437-4493-4312-a8f1-8504d93f76d9`); las credenciales están en CONTEXT.md.
  Nunca escribir contraseñas ni resolver CAPTCHAs: Turnstile bloquea el login por script.
- **Verificación:**
  - `npx tsc --noEmit`, `npx vitest run` (1153 tests al 2026-10-16) y ESLint sobre los archivos tocados.
  - `next build` usa `--webpack`.
- **Migraciones:** van numeradas en `supabase/migrations/` (hoy hasta la 146 —141-142 pedidos, 146 estados propios del pedido, 143 nivel Pro de los 4 clientes que ya pagaban, 144 costo de envío y 145 bono de primera venta, aplicadas—; la 139 se aplica tras el deploy; ojo: la 010 se aplicó hasta el 2026-10-07) y se aplican con el MCP
  `apply_migration`. Antes de dar algo por aplicado, prueba con transacción revertida.
- **Turbopack en bucle `FATAL`:** detén el dev server y borra `.next/cache/turbopack`.
- **Inglés del sistema (por fases, desde el 2026-11-12):**
  - **Estado de las fases:**
    - Fase 1 hecha: encabezado (bandera con `useLocale`), menús, Dashboard, POS y abrir caja.
    - Fase 2 hecha (2026-11-12): Productos completo (catálogo, formulario, variantes, etiquetas, archivados, lotes,
      ajustes, listas de precios, exportar CSV/PDF). Errores de inventario por código (`codigoDeError` en
      `error-message.ts`); los de `price-list.ts` se traducen con `CLAVE_ERROR_PRECIO`. Siguen en español a propósito:
      validaciones de zod, la plantilla y los mensajes del importador por renglón, y la Bitácora.
    - Fase 3 hecha (2026-11-12): Clientes (lista, celular, alta/edición, abono, estado de cuenta) y la pestaña
      Tarjetas de lealtad (panel, gráfica, programa, QR del mostrador, ventana de la tarjeta, tira del POS). Siguen en
      español a propósito: lo que ve el cliente final (tarjeta pública, alta con QR, mensaje de WhatsApp, cartel PDF,
      nombre y premio por defecto del programa) y los datos fiscales (CFDI oculto).
    - Fase 4 hecha (2026-11-12): Finanzas (caja: abrir, cerrar, movimientos, avisos de «abre tu caja», tiempo abierta
      con `duracionAbierta`) y Compras (compras directas, proveedores, órdenes de compra, recepción, detalles). `abrirCaja`
      no es hook: recibe sus avisos con `useTextosAbrirCaja()` (POS y Finanzas). Siguen en español a propósito: el PDF
      de la orden y el mensaje de WhatsApp al proveedor, los correos del corte y el cierre automático.
    - Fase 5 hecha (2026-11-12): Reportes (pestañas, periodos, calendario, tarjetas, ganancia, gráficas, clientes
      frecuentes, historial de ventas, detalle de venta, «Compras del periodo»). Las etiquetas de las gráficas se arman
      ya traducidas (`series-graficas.ts` recibe `locale`; `ventasPorDiaSemana` y `ventasPorCategoria`, sus textos), así
      que la clave de caché del reporte lleva el idioma. El Excel/PDF exportado sigue en español (encabezados), pero
      sus fechas y nombres de método/día salen como se ven en pantalla.
    - Fase 6 hecha (2026-11-12): Configuración (general, módulos, Mercado Pago Point, impresora), Sucursales (resumen,
      existencias, traspasos, alta y cierre, selector), Usuarios (invitar, roles, permisos con los módulos de
      `lib/modules.ts` traducidos por `key`, sucursales, nombre, claves), Suscripción (`/billing`, aviso de prueba o pago
      vencido, descarga de datos), Catálogo en línea (panel: estado, productos, personalizar, vista previa;
      `mensajeErrorCatalogo` acepta traductor), campana de notificaciones (`tiempoTranscurrido`), eliminar cuenta y baja
      pendiente (la palabra de confirmación es «ELIMINAR»/«DELETE»), escáner, aviso de documentos legales, sugerencias,
      instalar la app, ventana de novedades (`news.<id>.*`, con respaldo al texto de `NOVEDADES`) y piezas compartidas
      (`FilaDeslizable`, `useTextoPistaDeslizar`, subir archivo, contraseña).
    - Siguen en español a propósito: la página pública del catálogo y la tarjeta de lealtad, la landing y páginas
      legales, CFDI (oculto), la Bitácora, tickets/PDF/correos, y los textos que llegan del servidor (errores de RPC).
  - **Reglas:**
    - Texto visible nuevo SIEMPRE con `useTranslations` y la clave en `es.json` y `en.json`; `mensajes-es-en.test.ts`
      exige paridad.
    - Lógica pura devuelve códigos, no frases. Ejemplo: `errorDescuento` en `features/pos/descuento-ticket.ts`.
    - Fechas con `localeIntl(locale)` de `lib/idioma.ts`.
    - Lo impreso (tickets, PDFs, correos) y los datos del negocio se quedan en español.
  - **`next dev` no relee los JSON de mensajes:** reinícialo o saldrán las claves crudas.
  - **Pruebas que renderizan componentes con `useTranslations`:** los envuelven en `NextIntlClientProvider` con
    `@/messages/es.json`.

# Pendientes

## SMS de cierre de caja (Twilio)
Código listo y apagado hasta tener las variables (`src/lib/sms-api.ts`, `src/lib/sms-texto.ts`,
`src/lib/avisos-celular.ts`). Solo el aviso de corte de caja usa SMS; WhatsApp tiene prioridad si está activo.

- [ ] Twilio → Phone Numbers → Manage → Buy a number (el trial regala uno; con SMS).
- [ ] Twilio → Messaging → Settings → Geo permissions: activar **México**.
- [ ] Twilio → Phone Numbers → Verified Caller IDs: verificar los celulares de prueba.
  - En trial solo llega a números verificados.
  - Cada SMS lleva el texto "Sent from your Twilio trial account".
- [ ] Poner `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` y `TWILIO_FROM` (E.164, `+1…`) en `.env.local` y en
      Vercel (Production). El Auth Token nunca va a git.
- [ ] Probar en "Pruebas SYMVORA":
  - un cajero cierra su caja → SMS al celular del dueño;
  - en Twilio (Monitor → Logs → Messaging) debe salir como 1 segmento;
  - el dueño cerrando su propia caja no genera aviso.
- [ ] Upgrade de Twilio antes de usarlo con clientes reales.
- [ ] Al activar WhatsApp o SMS, poner `NEXT_PUBLIC_AVISOS_CELULAR=1` en `.env.local` y en Vercel, y hacer
      redeploy. Mientras falte, la interfaz pide el celular pero oculta las leyendas de avisos y el
      interruptor "Recibir avisos" (`src/lib/avisos-celular-flag.ts`).

## WhatsApp (Cloud API de Meta)
Código listo y apagado (`src/lib/whatsapp-api.ts`, plantillas en `src/lib/whatsapp-plantillas.ts`).

- [ ] Cuenta de Meta Business + número de WhatsApp. Para probar sirve el número de prueba de
      developers.facebook.com (token de 24 h, hasta 5 destinatarios).
- [ ] Dar de alta y aprobar las plantillas tal cual están en `whatsapp-plantillas.ts`.
- [ ] Poner `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` (opcional `WHATSAPP_API_VERSION`) en Vercel.
      El token permanente se saca con un usuario del sistema en Meta Business.
- [ ] Con plan Pro de Vercel: cambiar el cron `/api/cron/seguimiento-whatsapp` a cada hora (`"0 * * * *"`).

## Registro con QR de la tarjeta de lealtad
- [ ] Poner `TURNSTILE_SECRET_KEY` (la secreta del mismo sitio de Turnstile del login) en `.env.local` y en Vercel
      (Production) y hacer redeploy. Sin ella, `/api/lealtad/unirse` responde 503 y nadie se registra con el cartel.
      En local sirven las llaves de prueba de Cloudflare (siempre aprueban).

## Aviso de Privacidad
- [ ] Al hacer deploy, privacidad v1.5-2026-10-31 (eliminar cuenta y conservación de nombre/celular) y términos v1.3-2026-10-06 (mayoría de edad) vuelven a mostrar el aviso de cambios.
      El aviso promete 15 días de anticipación para cambios.
- [ ] Reemplazar `[Domicilio del responsable]`, que sigue sin datos.

## App de Android (Google Play)
- [ ] Cuenta de Play Console PERSONAL (aún sin RFC de empresa para el D-U-N-S): exige una prueba cerrada con ≥12 testers
      dentro 14 días seguidos antes de pedir producción (usar 15-20: clientes actuales + conocidos, con Grupo de Google).
      Con RFC: cuenta de organización y transferir la app (conserva paquete, reseñas e instalaciones).
- [x] Bubblewrap: paquete `com.symvoramx.app` (versión 3), start URL `/es/dashboard?app=android`. Respaldar el keystore
      de subida fuera de git.
- [x] `ANDROID_APP_PACKAGE` y `ANDROID_APP_SHA256` en Vercel (2026-11-11; la huella está en Play Console → Protegido con
      Play → Firma de apps). Prueba cerrada enviada a revisión con el Grupo `symvora_test_01`.
- [ ] Ficha: política de privacidad, URL de eliminación `https://www.symvora.com.mx/es/eliminar-cuenta`,
      «Seguridad de los datos», cuenta de prueba (negocio de pruebas) en «Acceso a la app».

## Armada Pass dentro de Symvora (ARMADA NUTRICIÓN, exclusivo) — EN ESPERA
Tienda de suplementos para gimnasio. Tiene su propio sistema de lealtad («Armada Pass», `~/Documentos/ARMADA NUTRICION`,
otro proyecto con otra base: solo se LEE como referencia, nunca se editan ni se usan sus llaves o su Supabase aquí) y
se pasa al POS de Symvora. Hay que agregar a las tarjetas de lealtad de Symvora lo que les falta, **solo para ese negocio**.

- [ ] **Estado:** esperando a que el negocio se registre en Symvora. No crear el negocio a mano ni empezar antes.
- **Decisiones tomadas (2026-11-20):**
  - Exclusivo para UN negocio: interruptor «solo este negocio»; los demás no ven nada distinto. Sin interruptor por
    `if (tenant === X)` en el código: va por configuración del negocio (columna aditiva, a decidir al empezar).
  - Se pasan al POS de Symvora (dejan KYTE): NO se construye el validador de caja `/caja` de Armada.
  - Arrancan desde cero: sin migrar clientes ni saldos. Los pases de Armada Pass dejan de servir (avisarles con cartel/QR nuevo).
  - Ya pagaron un anticipo. El mantenimiento mensual se cobra FUERA de Conekta (sin plan especial: los planes son
    inmutables y no hay precio por negocio).
- **Alcance:** niveles por gasto histórico (Principiante 5 % / Atleta 10 % / Culturista 15 %, editables); cashback en
  puntos (tasa por peso, canje parcial, bienvenida); cumpleaños (una vez al año, hora de México); promo relámpago con
  fechas; tarjeta compartida (el amigo recibe el descuento de nivel y el titular un bono; no cuenta para su gasto, sellos
  ni cashback); reactivación de inactivos con cupón de un solo uso; regla VIP por cliente; interruptor de cada dinámica
  (global y por cliente). **Fuera:** Google Wallet, dinámicas nuevas (se cotizan aparte) y migración de clientes.
- **Referencia técnica:** en el proyecto fuente, `supabase/migrations/20261111000001_lealtad.sql` y
  `20261116000001_cambios_sistema.sql`, `src/features/lealtad/motor.ts` (`calcularCompra`, espejo de la RPC
  `registrar_compra`) y `src/features/admin/components/dinamicas.tsx`. **Prioridad del beneficio:** VIP > cupón > nivel >
  promociones vigentes. En Symvora se integra en `complete_sale_lealtad` / `_crear_venta_desde_items` y en
  `features/lealtad/lealtad.ts` (`aplicarPremio` es el MISMO algoritmo que el servidor: si cambia uno, cambia el otro).
- **Reglas al ejecutar:**
  - Toca el cobro de negocios reales: plan aprobado antes de desplegar; migraciones aditivas, probadas con transacción
    revertida y también como `authenticated`.
  - Lo que mueve saldos se escribe solo por RPC `SECURITY DEFINER` (como las tarjetas de lealtad actuales).
  - Probar en «Pruebas SYMVORA», nunca en el negocio real; ninguna base ni llave de Armada dentro de Symvora.
  - Cada cambio futuro al cobro o a la lealtad debe probarse también con sus reglas encendidas.
- **Comercial (resumen):** cotización «Completo» ≈ $59,000 MXN (sin migración de clientes) menos el anticipo, pago 50/50;
  $399 del plan + $700–$900 mensuales de mantenimiento aparte; 3–4 semanas desde el anticipo.

## Seguridad
- [x] `log_activity` ya no confía en el cliente (migración 106, 2026-10-04): con sesión exige
      `p_user_id = auth.uid()` y toma el correo de `auth.users`; sin sesión solo `service_role`. De paso se arregló
      el registro del cierre automático de caja, que nunca llegaba a la Bitácora (firma equivocada).
- [ ] Higiene (no explotable hoy): el linter marca funciones `SECURITY DEFINER` ejecutables por `anon`
      (`cancelar_compra` exige `auth.uid()`; las `_...` son de triggers). Revocar `EXECUTE` a `anon` en una migración.
- [ ] Activar "Leaked password protection" en Supabase Auth.

## Otros abiertos
- [ ] `public/aprende/primeros-pasos/crear-producto` (sin extensión, duplicado de `crear-producto.webp`).
- [ ] Subir Supabase a Pro (techo de 4 conexiones en Free).
- [ ] Fotos de producto reemplazadas quedan huérfanas en Storage.
- [ ] OAuth Microsoft (Azure) pendiente; exportación CSV/PDF conectada en `/products` y Excel/PDF en Reportes (`features/reports/exportar-reporte.ts`).
- [ ] Peso de la landing: `motion` en 16 componentes. Es todo o nada; ver CONTEXT.md.
