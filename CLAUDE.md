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

- **Rendimiento** (plan en `docs/plan-rendimiento-escalabilidad.md`; fase 1 hecha el 2026-10-04):
  - El POS carga todo en paralelo y usa el `userId` del contexto (sin `auth.getUser()`). Tras cobrar llama
    `refetchStock()` (solo existencias), no `refetch()`; alta de cliente → `refetchCustomers()`.
  - `fetchStockSucursal` comparte las peticiones iguales EN VUELO (nunca sirve stock viejo).
  - Productos: `useVariants(..., { cargarProductos: false })`; la lista sale de `useProducts`.
  - jsPDF, xlsx y papaparse se cargan con `import()` al usarse (`generarPdfOrdenCompra` y `exportToPDF` son async).
  - Speed Insights (`@vercel/speed-insights`) en el layout raíz: activarlo en Vercel para ver datos.
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
  - Migración 105 (fase 3.1, aplicada el 2026-10-04): índices para las 19 llaves foráneas sin índice. Los
    nuevos salen como "unused" en el linter hasta que haya tráfico; no borrarlos por eso.
- **Otras reglas:**
  - Sin Server Actions: las mutaciones van por el cliente de Supabase o por rutas API.
  - Rate limit durable en Postgres (`consumirRateLimit`); nunca un `Map` en memoria.
  - Los correos en webhooks van con `after()`.
  - **El modo sin conexión está RETIRADO.** No reintroducirlo; se hará con una app nativa. La PWA sigue
    siendo instalable: no borres `sw.ts`.
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
  `listar_ventas`/`detalle_venta`), ganancia bruta.
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
  - Header: Precios · Aprende · Nosotros · Contáctanos (`components/ui/app-frame.tsx`).
  - Secciones: Scroll Stack de módulos, guías en `/aprende`, página Nosotros con carrusel.
  - **Aprende** (`features/marketing/aprende.ts`): cada guía lleva `videos` (YouTube; portada ligera
    `video-guia.tsx`, que carga el iframe solo al dar play, con pestañas si hay varios) y, por paso, `captura`
    (computadora) y `capturaMovil` (celular), que la página alterna por ancho de pantalla. Las capturas son WebP
    generadas con `node scripts/capturas-aprende.mjs` desde `~/Imágenes/MODULOS`: la lista vive en el script.
    No publicar capturas con correos, celulares, nombres del equipo, claves o el precio promocional.
  - Footer: `components/ui/footer.tsx`, con enlaces legales con locale.
  - Las páginas legales usan `LegalShell` con `AppFrame`.
- **Legal (LFPDPPP):**
  - Documentos: aviso de privacidad, términos, cookies.
  - Las aceptaciones se registran en `legal_acceptances`, con banner de actualización. **La tabla (migración
    010) no existía en producción hasta el 2026-10-07**: no hay evidencia de aceptaciones anteriores a esa
    fecha. Al aplicarla, todo usuario existente ve una vez el aviso y su aceptación queda guardada.
    `/api/legal/accept` solo registra las versiones vigentes (409 si no). RLS: cada quien ve e inserta solo
    las suyas; nadie modifica ni borra.
  - Versiones en `lib/legal/versions.ts`; privacidad en `v1.5-2026-10-31` (eliminar cuenta, conservar nombre y celular
    para comunicaciones comerciales, app de Android); términos en `v1.3-2026-10-06`
    (mayoría de edad: la casilla del registro dice «Declaro ser mayor de 18 años…» y la sección 2 de los
    Términos lo exige; los invitados no la aceptan, responde el titular). Sin fecha de nacimiento: no se recaba; la **edad** es opcional y se captura en Mi perfil (`user_metadata.edad`, 18-120).

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
  línea. Solo la ve quien tiene el permiso del módulo; nunca en demo.
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
- Para una novedad futura: agrégala a `NOVEDADES`; para la campana y el correo, haz una migración y una plantilla
  nuevas.

## App de Android en Google Play (TWA) y eliminar cuenta (migración 128, 2026-10-31)
- **La app es una TWA** (Trusted Web Activity, con Bubblewrap): abre `app.symvora.com.mx` en Chrome a pantalla completa.
  No es Capacitor/WebView: ahí no funcionan el login con Google ni las impresoras WebUSB/Bluetooth. Cada deploy
  actualiza la app; Play solo se resube si cambia el contenedor. `output: 'export'` NO sirve (API, proxy, sesiones).
  - `/.well-known/assetlinks.json` (`src/app/.well-known/assetlinks.json/route.ts`) con `ANDROID_APP_PACKAGE`
    (default `com.symvora.app`) y `ANDROID_APP_SHA256` (huella de la firma de Play App Signing; coma si hay varias).
  - **Cobro:** Google Play exige su facturación para lo que se vende DENTRO de la app. La app no vende: se reconoce
    con `?app=android` en el start URL o el referrer `android-app://` → cookie `symvora_app=android`
    (`lib/app-android.ts`, `features/app-android/`). Con ella `/billing` oculta precios y pagos, y
    `aviso-estado-pago.tsx` no invita a pagar ni menciona la oferta.
  - `manifest.ts` lleva `id` fijo (`/es/dashboard`, igual al calculado: no cambia las PWA instaladas).
  - Proyecto Android FUERA del repo: `~/Documentos/symvora-android` (keystore `android.keystore,symvora android`, alias
    `symvora`; `minSdkVersion` 24, `splashScreenFadeOutDuration` 900). El splash (logo chico como el de iOS) sale de
    `node scripts/generate-android-splash.mjs ~/Documentos/symvora-android`: repetirlo tras cada `bubblewrap update`,
    que lo regenera desde el ícono. En la app NO hay botón para pagar en el navegador: la política de pagos de Play
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
- **Migraciones:** van numeradas en `supabase/migrations/` (hoy hasta la 128; ojo: la 010 se aplicó hasta el 2026-10-07) y se aplican con el MCP
  `apply_migration`. Antes de dar algo por aplicado, prueba con transacción revertida.
- **Turbopack en bucle `FATAL`:** detén el dev server y borra `.next/cache/turbopack`.

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
- [ ] Bubblewrap: `npx @bubblewrap/cli init --manifest https://app.symvora.com.mx/manifest.webmanifest`, paquete
      `com.symvora.app`, start URL `/es/dashboard?app=android`. Respaldar el keystore de subida fuera de git.
- [ ] Poner `ANDROID_APP_SHA256` (Play Console → Integridad de la app) en Vercel y redeploy; revisar
      `https://app.symvora.com.mx/.well-known/assetlinks.json` y el de `www.`.
- [ ] Ficha: política de privacidad, URL de eliminación `https://www.symvora.com.mx/es/eliminar-cuenta`,
      «Seguridad de los datos», cuenta de prueba (negocio de pruebas) en «Acceso a la app».

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
