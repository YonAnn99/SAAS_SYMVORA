@AGENTS.md

# SYMVORA SaaS — Resumen del proyecto

> Resumen de `.agents/CONTEXT.md` (actualizado al 2026-10-02). El detalle, el historial de sesiones y los
> bugs corregidos completos están ahí; consultarlo antes de tocar cobro, RBAC, RLS o migraciones.

## Qué es
- SaaS multi-tenant POS/ERP para negocios en México: punto de venta, inventario, finanzas, compras y
  sucursales. Pensado para abarrotes, ropa, ferreterías, farmacias, etc.
- **Stack:** Next.js 16 (App Router; `proxy.ts` reemplaza a `middleware.ts`), React 19, Supabase (RLS,
  RPCs), Tailwind v4, next-intl (es por defecto, en), Zustand, Zod 4, Base UI (shadcn base-nova),
  Recharts, Sentry, Resend.
- **Pagos:** Conekta (checkout hosted, suscripción recurrente con tarjeta, efectivo y SPEI de pago único)
  y Mercado Pago Point en el POS.
- **Precio** (única fuente: `src/lib/pricing.ts`): $399 MXN/mes o $3,588/año. Planes de Conekta `-v3`.
- **CFDI 4.0:** existe, pero está **oculto** por decisión de negocio. Para reactivarlo, ver
  `src/lib/feature-flags.ts` y la sesión 2026-09-05 en CONTEXT.md.

## Dominios y despliegue
- `www.symvora.com.mx` = landing (canónico SEO); `app.` = sistema; `demo.` = demo pública (host propio
  para no mezclar cookies).
- El enrutado entre hosts y el `noindex` (todo lo que no sea www) viven en `lib/supabase/middleware.ts`.
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
      `dvh` (y el shell `h-dvh`), nunca `vh`: en Chrome de Android `100vh` desplazaba la página y escondía
      "Ver carrito" detrás del dock. La cuadrícula lleva `overscroll-y-contain`.
    - **El carrito se conserva al recargar** (sessionStorage `symvora-carrito`, `persist` con
      `skipHydration`; `usePosCart` lo restaura al montar). Tiene dueño `userId:tenantId`: si cambia, se vacía.
      Se borra al cobrar y al cerrar sesión (`vaciarCarritoGuardado`). No se agrega nada hasta `restaurado`.
    - El dock usa etiquetas cortas («Vender», «Órdenes»).
  - **«Tarjeta» (manual) bloqueado sin terminal** (`tarjetaManualDisponible` en `features/pos/tarjeta-disponible.ts`):
    se habilita con Mercado Pago Point lista (`mpReady`) o con una terminal externa declarada en Configuración →
    Métodos de pago (`configuracion_json.pos_config.terminal_externa`, leída en el store de `use-modulos.ts`).
    En el demo siempre está activo. `motivoBloqueoCobro` devuelve `"sin-terminal"` como defensa.
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
  - Footer: `components/ui/footer.tsx`, con enlaces legales con locale.
  - Las páginas legales usan `LegalShell` con `AppFrame`.
- **Legal (LFPDPPP):**
  - Documentos: aviso de privacidad, términos, cookies.
  - Las aceptaciones se registran en `legal_acceptances`, con banner de actualización.
  - Versiones en `lib/legal/versions.ts`; privacidad en `v1.3-2026-10-02`.

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
  - `get_tenant_members` devuelve `user_nombre`; `listar_ventas`/`detalle_venta` devuelven `cajero_nombre`.
  - El saludo "¡Hola, {nombre}!" sale en el Dashboard y arriba del buscador del POS.
- **Cartera de clientes interna:** vista `interno.cartera_clientes` (migración 100), no expuesta por la
  API. Consulta: `select * from interno.cartera_clientes;` en el SQL Editor de Supabase.

## Cómo trabajar en este repo
- **Commits y servidor:**
  - **No hacer commit sin que el usuario lo pida.**
  - El usuario corre su propio `next dev` en `localhost:3000`: no levantar otro.
  - Probar en `localhost`, no en `127.0.0.1`.
- **Datos de prueba:** usar el tenant **"Pruebas SYMVORA"** (en la base, `tenants.nombre_comercial` =
  "Miscelanea Symvora", id `ab77a437-4493-4312-a8f1-8504d93f76d9`); las credenciales están en CONTEXT.md.
  Nunca escribir contraseñas ni resolver CAPTCHAs: Turnstile bloquea el login por script.
- **Verificación:**
  - `npx tsc --noEmit`, `npx vitest run` (943 tests al 2026-10-06) y ESLint sobre los archivos tocados.
  - `next build` usa `--webpack`.
- **Migraciones:** van numeradas en `supabase/migrations/` (hoy hasta la 110) y se aplican con el MCP
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

## Aviso de Privacidad
- [ ] Al hacer deploy, la versión v1.3-2026-10-02 (SMS/Twilio) vuelve a mostrar el aviso de cambios.
      El aviso promete 15 días de anticipación para cambios.
- [ ] Reemplazar `[Domicilio del responsable]`, que sigue sin datos.

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
- [ ] OAuth Microsoft (Azure) pendiente; exportación CSV/PDF solo conectada en `/products`.
- [ ] Peso de la landing: `motion` en 16 componentes. Es todo o nada; ver CONTEXT.md.
