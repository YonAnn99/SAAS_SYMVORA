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
  - **Escáner con la cámara del celular**: `components/escaner/`, `lib/escaner/`, `barcode-detector` +
    `public/zxing/*.wasm`.
  - Favoritos por producto y por variante.
- **Variantes:**
  - Atributos libres en `variantes_producto.atributos` jsonb (migración 097). `talla`/`color` se siguen
    llenando como resumen compatible.
  - Se gestionan dentro del Catálogo; `/variants` redirige. Cada variante puede tener foto propia.
- **Caja / Finanzas:**
  - Apertura y cierre con saldo esperado contra real. Cierre automático de madrugada (cron
    `auto-close-registers`).
  - Aviso de corte al dueño por correo + WhatsApp/SMS.
- **Compras:** compra directa que suma stock (`registrar_compra_directa`), cancelación que lo revierte,
  órdenes de compra con PDF.
- **Reportes:** historial de ventas con reimpresión (la regla de visibilidad vive en los RPC
  `listar_ventas`/`detalle_venta`), ganancia bruta.
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
- **Datos de prueba:** usar el tenant **"Pruebas SYMVORA"**; las credenciales están en CONTEXT.md.
  Nunca escribir contraseñas ni resolver CAPTCHAs: Turnstile bloquea el login por script.
- **Verificación:**
  - `npx tsc --noEmit`, `npx vitest run` (886 tests al 2026-10-04) y ESLint sobre los archivos tocados.
  - `next build` usa `--webpack`.
- **Migraciones:** van numeradas en `supabase/migrations/` (hoy hasta la 101) y se aplican con el MCP
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

## Otros abiertos
- [ ] `public/aprende/primeros-pasos/crear-producto` (sin extensión, duplicado de `crear-producto.webp`).
- [ ] Subir Supabase a Pro (techo de 4 conexiones en Free).
- [ ] Fotos de producto reemplazadas quedan huérfanas en Storage.
- [ ] OAuth Microsoft (Azure) pendiente; exportación CSV/PDF solo conectada en `/products`.
- [ ] Peso de la landing: `motion` en 16 componentes. Es todo o nada; ver CONTEXT.md.
