# Kit de carruseles + posts estáticos + hooks

> Tres bloques: **8 carruseles** (siguiendo frameworks probados: Brand Intro, Value-Stack, Problem-Proof, Hack List, Rant Callout, Demo Walkthrough), **11 posts estáticos** para feed, y una **biblioteca de 43 hooks** al final del documento (24 de video, 10 de portada de carrusel, 9 de post estático). Visuales generados con IA (Gemini/ChatGPT para imágenes; para slides de producto usa **capturas reales de la demo** en `https://demo.symvora.com.mx/es/demo`, superan a cualquier mockup).
>
> **URL canónica de la demo: `demo.symvora.com.mx`** — es la que usa el botón "Ver demo" de la landing en producción (`hero.tsx`) y está declarada como host propio en el middleware. Verificada en vivo (HTTP 200) el 2026-09-08. No la cambies a `app.symvora.com.mx`: aunque esa ruta también responde, el host dedicado es el que separa la sesión de demo de la sesión real por cookie.
> Reglas: slide 1 funciona solo como thumbnail; una idea por slide; mismo template visual en todo el carrusel; un solo CTA al final; imágenes sin texto (el texto va en la edición).

---

## Carrusel 1 — Framework A: Value-Stack — "5 señales de que tu negocio ya necesita un sistema"

**Cover (slide 1):** "5 señales de que tu negocio ya necesita un sistema (y no una libreta)"
**Formato:** 7 slides · 1080×1350 · Instagram/Facebook.

| Slide | Texto en pantalla |
|---|---|
| 1 | 5 señales de que tu negocio ya necesita un sistema (y no una libreta) |
| 2 | 1 · Cierras la caja y **nunca cuadra igual dos veces** |
| 3 | 2 · No sabes qué producto se vende más **hasta que ya se te acabó** |
| 4 | 3 · Le fías a un cliente y **se te olvida cuánto te debe** |
| 5 | 4 · Tu empleado vendió, pero **no sabes qué ni cuándo** |
| 6 | 5 · Revisas tus números **"a ojo"** al final del mes |
| 7 | Si te pasaron 2 o más: es hora de un sistema. → "Prueba SYMVORA gratis 7 días" |

**Caption:** "Si te identificaste con 2 o más de estas señales, no es que seas desordenado: es que le estás pidiendo a una libreta un trabajo que no puede hacer. Un sistema no es un lujo de negocio grande, es lo que evita que el dinero se te escape sin que lo notes. Prueba SYMVORA gratis 7 días, sin tarjeta." + hashtags (#NegocioLocal #Emprendedor #ControlFinanciero #PuntoDeVenta #PymesMexico)

**Prompt imagen:** "Carrusel 4:5 limpio tipo infografía, header oscuro #1a1a1a con logo chico, iconos de libreta tachada, calculadora, signo de interrogación, paleta #f8fafc con acentos #2563eb, sin texto"

---

## Carrusel 2 — Framework B: Problem-Proof — "Importé mi inventario completo en 10 minutos"

**Cover (slide 1):** "Subí 200 productos a mi sistema en 10 minutos. Sin capturar uno por uno."
**Formato:** 8 slides · 1080×1350.

| Slide | Texto en pantalla |
|---|---|
| 1 | Subí 200 productos a mi sistema en 10 minutos. Sin capturar uno por uno. |
| 2 | El problema real: dar de alta un catálogo a mano **te puede tomar días** |
| 3 | El sistema: sube tu catálogo desde un archivo de Excel o CSV |
| 4 | Paso 1 · Subes el archivo que ya tienes (el de tu libreta o tu Excel viejo) |
| 5 | Paso 2 · SYMVORA relaciona las columnas automáticamente |
| 6 | Paso 3 · Revisas la vista previa antes de confirmar nada |
| 7 | Paso 4 · Confirmas y listo: catálogo completo, sin errores de dedo |
| 8 | Resultado: de un Excel a un catálogo funcionando. → "Pruébalo gratis" |

**Caption:** "Pasar tu catálogo de un Excel viejo a un sistema nuevo suena a semanas de trabajo. Con la importación de SYMVORA fueron 10 minutos: subes el archivo, revisas la vista previa, confirmas. Nada de capturar producto por producto. Prueba gratis 7 días, sin tarjeta." + hashtags (#MigracionDeDatos #Inventario #PuntoDeVenta #NegocioLocal #PymesMexico)

**Prompt imagen:** "Carrusel 4:5 con laptop mostrando una hoja de cálculo transformándose en una lista de productos ordenada, paleta #f8fafc/#1a1a1a/#2563eb, sin texto"

---

## Carrusel 3 — Framework C: Hack List — "5 hábitos de los negocios que nunca se quedan sin dinero"

**Cover (slide 1):** "8 de cada 10 negocios no saben cuánto dinero tienen hoy"
**Formato:** 8 slides · 1080×1350.

| Slide | Texto en pantalla |
|---|---|
| 1 | 8 de cada 10 negocios no saben cuánto dinero tienen hoy |
| 2 | El problema: mezclan el dinero del negocio con el de la casa |
| 3 | Hábito #1 · **Primero paga el negocio** — separa tu gasto personal |
| 4 | Hábito #2 · **Cierra caja todos los días**, no "cuando se pueda" |
| 5 | Hábito #3 · **Registra entradas y salidas**, no solo lo que vendes |
| 6 | Hábito #4 · **Compara semana contra semana**, no mes contra mes |
| 7 | Hábito #5 · **Guarda un colchón** antes de retirar ganancias |
| 8 | Tesis: "El dinero no se pierde de un jalón, se va goteando." → "Guarda esto. SYMVORA lo controla por ti → prueba gratis" |

**Caption:** "El dinero de un negocio no desaparece de golpe: se va goteando en cosas que nunca se registran. Estos 5 hábitos son los que sí aplican los negocios que llegan a fin de mes sabiendo exactamente cuánto tienen. Guarda este carrusel y aplícalos esta semana." + hashtags (#ControlFinanciero #Caja #NegocioLocal #Emprendedor #Finanzas)

**Prompt imagen:** "Carrusel 4:5 con iconos de billetera, calendario semanal, alcancía, checklist, header oscuro #1a1a1a, acentos #2563eb, sin texto"

---

## Carrusel 4 — Framework D: Rant Callout — "Si necesitas un curso para cobrar, el problema no eres tú"

**Cover (slide 1):** "Unpopular opinion: si necesitas un tutorial de 2 horas para usar tu punto de venta, el problema no eres tú"
**Formato:** 6 slides · 1080×1350.

| Slide | Texto en pantalla |
|---|---|
| 1 | Unpopular opinion: si necesitas un tutorial de 2 horas para usar tu punto de venta, el problema no eres tú |
| 2 | Los sistemas hechos para "empresas grandes" terminan complicando lo que hace un negocio en crecimiento |
| 3 | Menús con 40 opciones… para cobrar una venta de $20 |
| 4 | Y si tu empleado no le entiende, el que pierde tiempo (y clientes) eres tú |
| 5 | No estoy en contra de los sistemas robustos. Estoy en contra de vendértelos a ti, que solo quieres cobrar rápido |
| 6 | SYMVORA se aprende en un turno, no en un curso. → "Pruébalo gratis" |

**Caption:** "Si tu cajero necesita capacitación de días para hacer una venta, no es que le falte experiencia: es que el sistema está mal diseñado para tu negocio. Vender debería ser lo más simple del sistema, no lo más complicado. En SYMVORA, cualquiera cobra desde el primer turno. Prueba gratis 7 días." + hashtags (#PuntoDeVenta #NegocioLocal #Software #PymesMexico #Emprendedor)

**Prompt imagen:** "Carrusel 4:5 editorial, pantalla saturada de botones vs pantalla limpia con un solo botón grande, header oscuro #1a1a1a, acentos #2563eb, sin texto"

---

## Carrusel 5 — Framework E: Demo Walkthrough — "De escanear a cobrar en 4 pasos"

**Cover (slide 1):** "Así se ve una venta completa en SYMVORA: del escaneo al ticket"
**Formato:** 7 slides · 1080×1350.
**Nota:** usa **capturas reales** del POS de la demo (`https://demo.symvora.com.mx/es/demo`) — no mockups.

| Slide | Texto en pantalla |
|---|---|
| 1 | Así se ve una venta completa en SYMVORA: del escaneo al ticket |
| 2 | Antes: buscar el precio a mano, sumar en la calculadora, anotar en la libreta |
| 3 | Con SYMVORA: 4 pasos, menos de 15 segundos |
| 4 | Paso 1 · Escanea o busca el producto |
| 5 | Paso 2 · Se agrega al carrito con el precio real, sin errores |
| 6 | Paso 3 · Elige cómo te pagan: efectivo, tarjeta, transferencia o crédito |
| 7 | Paso 4 · Cobra e imprime o comparte el ticket. Así de simple. → "Pruébalo gratis" |

**Caption:** "Vender no debería tomar más tiempo que hacer la fila. Escanear, agregar, cobrar: 15 segundos y la venta ya quedó registrada sola, sin que tengas que anotar nada después. Así de simple debería ser el punto de venta de tu negocio. Prueba SYMVORA gratis 7 días, sin tarjeta." + hashtags (#PuntoDeVenta #POS #NegocioLocal #VenderMas #PymesMexico)

**Prompt imagen:** "Capturas reales del POS de SYMVORA mostrando el carrito y el cobro, header oscuro #1a1a1a, acentos #2563eb — usar pantallas reales de la demo, no mockups"

---

## Carrusel 6 — Framework F: Brand Intro — "Conócenos: qué es SYMVORA"

**Cover (slide 1):** "Si nunca habías visto SYMVORA, empieza por aquí 👋"
**Formato:** 7 slides · 1080×1350 · Instagram/Facebook.
**Nota:** carrusel de bienvenida — pensado como primer contacto con audiencia nueva. Fíjalo en el perfil y úsalo como respuesta automática o de bienvenida a seguidores nuevos.

| Slide | Texto en pantalla |
|---|---|
| 1 | Si nunca habías visto SYMVORA, empieza por aquí 👋 |
| 2 | Somos un sistema para negocios como el tuyo: **punto de venta, inventario y control de tu dinero**, todo en un solo lugar |
| 3 | Lo hicimos pensando en negocios de México — abarrotes, papelerías, ferreterías, boutiques, tienditas — que hoy llevan sus ventas en libreta o en un Excel que ya nadie entiende |
| 4 | ¿Qué resolvemos? Que dejes de perder tiempo (y dinero) haciendo cuentas a mano al final del día |
| 5 | Todo en español y pensado para cómo se vende de verdad en un mostrador: rápido, sin menús complicados |
| 6 | Sin letras chiquitas: pagas una mensualidad fija, **sin comisión** por cada venta que hagas |
| 7 | Así nos ves en acción → "Prueba SYMVORA gratis 7 días, sin tarjeta" |

**Caption:** "Nueva por aquí 👋 Somos SYMVORA: un sistema de punto de venta, inventario y control financiero para negocios en México que están cansados de llevar todo a mano. Nada de facturas gigantes de software para 'empresas grandes' — esto está hecho para el negocio del día a día, del que abre la cortina y ya quiere vender. Si es tu primera vez viéndonos, prueba gratis 7 días, sin tarjeta." + hashtags (#SYMVORA #NegocioLocal #Emprendedor #PymesMexico #PuntoDeVenta)

**Prompt imagen:** "Carrusel 4:5 cálido y acogedor tipo 'bienvenida', header oscuro #1a1a1a con logo SYMVORA centrado, iconos de tiendita/mostrador/celular, paleta #f8fafc con acentos #2563eb, sin texto"

---

## Carrusel 7 — Framework A: Value-Stack — "Qué puedes hacer con SYMVORA"

**Cover (slide 1):** "5 cosas que puedes hacer con SYMVORA desde el día 1"
**Formato:** 7 slides · 1080×1350.

| Slide | Texto en pantalla |
|---|---|
| 1 | 5 cosas que puedes hacer con SYMVORA desde el día 1 |
| 2 | 1 · **Cobrar en segundos** — escanea o busca el producto y cobra en efectivo, tarjeta, transferencia o a crédito |
| 3 | 2 · **Controlar tu inventario** — cada venta descuenta tu stock sola, sin que muevas un dedo |
| 4 | 3 · **Llevar el registro de tus clientes** — nombre y teléfono, para saber a quién le fías y cuánto te debe |
| 5 | 4 · **Ver tu dinero real** — cierres de caja y reportes, sin adivinar cuánto tienes de verdad |
| 6 | 5 · **Usarlo desde tu celular** — se instala como app directo desde el navegador, sin bajar nada de una tienda de apps |
| 7 | Todo esto en un solo sistema, sin comisión extra por vender → "Pruébalo gratis 7 días" |

**Caption:** "Esto es lo que puedes hacer con SYMVORA desde que abres tu cuenta: cobrar, controlar tu inventario, llevar tus clientes y ver tu dinero real, todo desde el celular o la tablet que ya tienes. Nada de instalar cinco apps distintas para hacer lo que un solo sistema puede hacer por ti. Prueba SYMVORA gratis 7 días, sin tarjeta." + hashtags (#SYMVORA #PuntoDeVenta #Inventario #NegocioLocal #PymesMexico)

**Prompt imagen:** "Carrusel 4:5 tipo infografía de producto, iconos de escáner, caja registradora, libreta de clientes, gráfica de reporte y celular, header oscuro #1a1a1a, paleta #f8fafc con acentos #2563eb, sin texto"

---

## Carrusel 8 — Framework E: Demo Walkthrough (tutorial) — "Pruébalo sin cuenta y sin tarjeta"

**Cover (slide 1):** "Puedes usar el sistema completo ahorita mismo. Sin cuenta, sin tarjeta, sin instalar nada."
**Formato:** 8 slides · 1080×1350 · Instagram/Facebook.
**Nota:** carrusel de **tráfico frío y de objeción**. Su trabajo es eliminar la fricción de "primero regístrate": no vende el producto, elimina el pretexto para no verlo. Fíjalo en el perfil junto al Carrusel 6 (Brand Intro) y úsalo como respuesta directa a cualquier "¿y cómo lo pruebo?" en comentarios o DM. Las slides 4–7 deben ser **capturas reales** de la demo, no mockups.

| Slide | Texto en pantalla |
|---|---|
| 1 | Puedes usar el sistema completo ahorita mismo. **Sin cuenta, sin tarjeta, sin instalar nada** |
| 2 | No es un video ni una presentación: es **el sistema real**, con productos, ventas y reportes ya cargados |
| 3 | Paso 1 · Entra a **demo.symvora.com.mx** — no hay formulario, no te pide correo ni contraseña |
| 4 | Paso 2 · Se abre solo el panel de una **tienda de abarrotes de ejemplo**, con su inventario ya lleno |
| 5 | Paso 3 · Haz una venta de verdad: busca un producto, agrégalo al carrito y cobra |
| 6 | Paso 4 · Mira lo que pasó solo: **el inventario bajó** y la venta ya quedó registrada con su hora |
| 7 | Paso 5 · Abre y cierra la caja, revisa los reportes. **Rompe lo que quieras**: cada vez que entras, la demo se reinicia sola |
| 8 | Cuando quieras el tuyo, con tus productos → "Prueba 7 días gratis, sin tarjeta" |

**Caption:** "La pregunta que más nos llega es '¿y cómo lo pruebo sin comprometerme?'. Así: entras a demo.symvora.com.mx y ya estás adentro. No te pedimos correo, no te pedimos tarjeta, no tienes que crear ninguna cuenta ni pagar ninguna membresía para ver cómo funciona. Es el sistema real, con la tienda de ejemplo ya cargada, para que hagas una venta, muevas inventario y cierres una caja como lo harías un martes cualquiera. Y no tengas miedo de mover nada: cada vez que alguien entra, la demo se reinicia sola, así que no hay forma de que la descompongas. Cuando ya lo hayas visto y quieras el tuyo con tus propios productos, ahí sí empiezas tu prueba de 7 días gratis, también sin tarjeta." + hashtags (#Demo #PruebaGratis #PuntoDeVenta #NegocioLocal #PymesMexico)

**Prompt imagen:** "Carrusel 4:5 tipo tutorial paso a paso, numeración grande visible en cada slide, laptop y celular mostrando un panel de sistema limpio, header oscuro #1a1a1a, paleta #f8fafc con acentos #2563eb, sin texto"

> **Mecánica verificada contra el código** (`src/app/[locale]/demo/page.tsx`, `src/app/api/demo/start/route.ts`, `docs/demo-isolation.md`):
> - **No se pide correo.** La página genera la sesión server-side contra una cuenta demo compartida y entra sola al dashboard. El usuario solo hace clic — no hay ni un formulario que llenar, así que "sin cuenta" es literal.
> - **Se reinicia en cada entrada.** `reset_demo_tenant()` corre cada vez que alguien abre la demo, así que la promesa de "rompe lo que quieras" es real y no una figura retórica.
> - **El tenant demo es una tienda de abarrotes** (`abarrotes-don-pedro`) con datos sintéticos — por eso la slide 4 dice abarrotes y no un giro genérico.
> - **Lo que sí se puede hacer:** vender en el POS, CRUD de productos/clientes/proveedores, ajustes de inventario, variantes y lotes, abrir/cerrar caja, reportes. Es exactamente lo que promete el carrusel.
> - **Lo que está bloqueado** (devuelve `403 DEMO_MODE_RESTRICTED`): pagos reales de Conekta y MercadoPago, invitación de usuarios por correo. **No lo menciones en las slides** — nadie evaluando un POS intenta pagar la suscripción dentro del demo. Pero si alguien pregunta en comentarios, la respuesta honesta es que solo se bloquean las acciones que tocarían servicios externos con dinero real.
> - **Límite técnico:** 5 entradas por minuto por IP. Irrelevante para un usuario normal, pero si haces un video en vivo entrando y saliendo muchas veces, lo vas a topar.

---

# Posts estáticos (11)

> Formato 1080×1080 o 1080×1350, texto superpuesto en edición. Cada post: **copy** + **CTA** + **prompt imagen** + **hashtags**.

### SP1 — Cita
- **Imagen:** cita sobre fondo oscuro. **Copy:** "La libreta no es tu contador. Es el lugar donde tu dinero se pierde." — SYMVORA
- **CTA:** Comenta si te pasa. → prueba gratis en bio.
- **Prompt:** "Tarjeta 1:1 minimalista, fondo #1a1a1a, tipografía grande, acento azul #2563eb, sin texto"
- **#:** #Cita #NegocioLocal #Emprendedor #ControlFinanciero

### SP2 — Dato (sin comisiones)
- **Imagen:** comparativa "Sistema normal: mensualidad + % por venta | SYMVORA: solo mensualidad". **Copy:** "¿Sabías que muchos sistemas te cobran comisión por cada venta? En SYMVORA no: pagas una vez al mes y el resto es tuyo."
- **CTA:** Prueba gratis → bio.
- **Prompt:** "Infografía 1:1 de comparación, caja registradora vs signo de stop, paleta #f8fafc/#2563eb, sin texto"
- **#:** #SinComisiones #PuntoDeVenta #Ventas #NegocioLocal

### SP3 — Feature: POS rápido
- **Imagen:** tablet POS cobrando. **Copy:** "Vende en 10 segundos: escanea, cobra, ticket. Tu cola se mueve y tus clientes vuelven."
- **CTA:** Prueba gratis → bio.
- **Prompt:** "Tablet POS con interfaz limpia en mostrador, luz de tienda, 1:1, sin texto"
- **#:** #POS #PuntoDeVenta #VenderMas #Tiendita

### SP4 — Feature: inventario
- **Imagen:** escáner + productos. **Copy:** "¿Sabes qué tienes en tu bodega ahora mismo? Con SYMVORA, tu inventario está al día con cada venta."
- **CTA:** Prueba gratis → bio.
- **Prompt:** "Escáner de código de barras sobre productos, bodega de abarrotes, luz natural, 1:1, sin texto"
- **#:** #Inventario #CodigoDeBarras #Abarrotes #ControlDeInventario

### SP5 — Feature: app instalable (PWA)
- **Imagen:** celular mostrando el ícono de SYMVORA instalado en la pantalla de inicio. **Copy:** "Instala SYMVORA en tu celular como una app — directo desde el navegador, sin bajar nada de una tienda de apps. Revisa tus ventas desde donde estés."
- **CTA:** Prueba gratis → bio.
- **Prompt:** "Mano sosteniendo un celular con el ícono de SYMVORA en la pantalla de inicio, fondo de mostrador de tienda, 1:1, sin texto"
- **#:** #AppMóvil #NegocioLocal #PuntoDeVenta #PymesMexico

### SP6 — Antes/Después visual
- **Imagen:** split: libreta vs tablet. **Copy:** "Lunes: libreta y calculadora. Domingo: reporte y caja cuadrada. La diferencia es un sistema que se usa desde el día 1."
- **CTA:** Prueba gratis → bio.
- **Prompt:** "Composición split 1:1: lado izquierdo libreta arrugada luz fría, lado derecho tablet POS brillante luz cálida"
- **#:** #AntesYDespues #NegocioLocal #Emprendedor #PuntoDeVenta

### SP7 — Micro tips
- **Imagen:** 3 tips. **Copy:** "3 tips para cobrar mejor HOY: 1) Registra cada venta al momento. 2) Define tu margen mínimo por producto. 3) Cierra caja todos los días. La constancia mata el caos."
- **CTA:** Guarda este post.
- **Prompt:** "Tarjeta 1:1 con 3 viñetas, iconos de check, paleta #f8fafc/#1a1a1a/#2563eb, sin texto"
- **#:** #Tips #Consejos #NegocioLocal #PuntoDeVenta

### SP8 — Promo: prueba gratis
- **Imagen:** mockup de tablet + texto. **Copy:** "7 días gratis. Sin tarjeta. Sin comisiones por venta. Punto de venta, inventario y finanzas en español. Si no te gusta, cancelas."
- **CTA:** Enlace en bio → app.symvora.com.mx
- **Prompt:** "Mockup premium de tablet POS, fondo #f8fafc, header oscuro #1a1a1a, botón azul #2563eb, 1:1, sin texto"
- **#:** #PruebaGratis #Software #NegocioLocal #Oferta

### SP9 — Referidos
- **Imagen:** dos manos / regalo. **Copy:** "Invita a otro negocio con tu enlace. Cuando pague su primer mes, AMBOS ganan un mes gratis. Sin límite de invitados."
- **CTA:** Comparte tu enlace (lo encuentras en tu panel).
- **Prompt:** "Tarjeta 1:1 con icono de regalo y manos, paleta #f8fafc/#2563eb, sin texto"
- **#:** #Referidos #Recompensas #PuntoDeVenta #NegocioLocal

### SP10 — Comunidad
- **Imagen:** pregunta visual. **Copy:** "¿Qué tipo de negocio tienes? Cuéntanos 👇 (abarrotes, tienda de ropa, ferretería, papelería, otros)"
- **CTA:** Comenta tu negocio; te decimos cómo SYMVORA te ayuda.
- **Prompt:** "Ilustración limpia 1:1 de tiendas variadas (abarrotes, ropa, ferretería), paleta #f8fafc/#1a1a1a/#2563eb, sin texto"
- **#:** #Encuesta #Comunidad #NegocioLocal #Emprendedor

### SP11 — Promo: plan anual (ahorra 25%)
- **Imagen:** dos tarjetas de precio lado a lado, "Mensual" vs "Anual" con badge "Ahorra 25%" en la segunda.
- **Copy:** "SYMVORA cuesta $399 MXN al mes. Si pagas anual, baja a $299 MXN al mes — son $1,200 MXN de ahorro al año, tres meses gratis solo por planear con tiempo. Mismo sistema, mismas funciones, tú eliges cómo pagarlo."
- **CTA:** Elige "Anual" al empezar tu prueba gratis → enlace en bio.
- **Prompt:** "Infografía 1:1 comparando dos tarjetas de precio, una simple 'Mensual $399' y otra destacada 'Anual $299/mes' con badge de ahorro, header oscuro #1a1a1a, acentos #2563eb, paleta #f8fafc, sin texto"
- **#:** #Precios #AhorraDinero #PuntoDeVenta #NegocioLocal #PymesMexico

---

## Uso recomendado
- **Carruseles** → días de pilar EDU (Lun/Jue) y AD (Mié). **Posts estáticos** → Sábados (promo) y Domingos (comunidad), o como respaldo cuando falte tiempo.
- **Carruseles 6 y 7 (Brand Intro / Value-Stack de producto)** → pilar de bienvenida: fíjalos en el perfil, úsalos para dar la bienvenida a seguidores nuevos, y repite uno al mes para cubrir a la audiencia que llega después. Son el punto de entrada ideal antes de mandar tráfico frío a los carruseles 1-5, que ya asumen que el lector sabe qué es SYMVORA.
- **Carrusel 8 (tutorial de la demo)** → carrusel de objeción, no de venta. Su lugar natural es **después** de que alguien ya mostró interés: fíjalo en el perfil junto al 6, y úsalo como respuesta lista para cualquier "¿cómo lo pruebo?" en comentarios o DM. Secuencia recomendada para tráfico frío: **6 (qué es) → 8 (pruébalo sin registrarte) → 1-5 (los dolores concretos)**. Repítelo cada 3-4 semanas: siempre hay alguien nuevo que no sabe que puede entrar sin dar datos.
- Repurposing: cada carrusel genera 2–3 reels (uno por hack) y cada post estático genera una historia.
- Mide **saves** de los carruseles: si el Value-Stack o el Hack List dominan, produce más de ese framework.

---

# Biblioteca de hooks (2026-09-08)

> Construida con dos skills de marketing: **`ad-creative/hook-system`** (un hook son 3 componentes, no una frase; matriz segmento × motivación; 8 movimientos de apertura; regla del on-ramp) y **`social/short-form-video`** (librería de hooks por objetivo: curiosidad → engagement, valor → saves, historia → watch time, controversia → comentarios).
>
> **Reglas duras de esta biblioteca:**
> - **Nada de CFDI / facturación / SAT** — el módulo está oculto desde 2026-09-05. El villano es **la libreta**, no el SAT.
> - **Cero cifras inventadas.** No hay estudios ni testimonios reales que citar todavía, así que ningún hook afirma "8 de cada 10 negocios…" ni "ahorré $18,000". Los números que sí aparecen son verificables: precio ($399 / $299 al mes), prueba (7 días), referidos (1 mes ambos), y tiempos que se pueden **grabar en pantalla** (una venta real cronometrada).
> - **Regla de no-duplicación:** los 3 componentes se reparten el trabajo. Si la voz dice la frase, el texto en pantalla **no** la repite y el visual **no** la ilustra literal. Un hook con una sola columna llena es un tercio de hook.

## Cómo se usa esta biblioteca

**Un hook = 3 componentes simultáneos** (segundos 0–3):

| Componente | Trabajo |
|---|---|
| **Visual (0–3s)** | Detener el scroll |
| **Línea hablada** | Abrir el loop de curiosidad |
| **Texto en pantalla** | Anclar la promesa para quien ve sin sonido (la mayoría) |

**El on-ramp (3–15s) es tan importante como el hook.** Debe *extender* la premisa, no saltar al pitch de producto. Si el hook promete "te está costando dinero", el siguiente beat empieza a explicar *cuál* — no presenta la marca. Por eso cada hook de abajo trae su on-ramp escrito: **si cambias el hook, reescribes el on-ramp.**

**Diagnóstico cuando un video no funciona** — cada métrica señala un componente distinto:

| Métrica floja | El problema está en | Qué cambiar |
|---|---|---|
| Retención 3s baja | El **visual** de apertura | Nuevo visual, mismo guion |
| Ven 3s pero se van antes de 15s | El **on-ramp** | Reescribir 3–15s, el hook está bien |
| Ven pero no dan clic | Claridad de la promesa | Afinar CTA/prueba |
| Dan clic pero no se registran | Congruencia con la landing | Revisar la página, no el video |

Cambia **una** variable por prueba. Un buen thumbstop no es un buen anuncio: un hook clickbait sube retención de 3s y hunde todo lo demás.

---

## Bloque A — 24 hooks para video corto (Reels · TikTok · Shorts)

Matriz de **segmento × motivación × formato**, cubriendo los 8 movimientos de apertura. Generados a lo ancho de la matriz, no a lo largo de una sola celda: 24 ángulos distintos valen más que 24 versiones del mismo.

### Movimiento 1 · Relatabilidad / POV
*Mejor para: comentarios y compartidos. La especificidad es todo el mecanismo — un POV genérico es invisible.*

**H1 · Cierre de caja que no cuadra** — *Segmento: tiendita/abarrotes con caja diaria · Formato: POV mostrador, noche*
- **Visual:** manos contando billetes arrugados sobre el mostrador, cortina abajo, calculadora encendida junto a una libreta con tachones.
- **Voz:** "Son las diez de la noche y me faltan ciento veinte pesos. Otra vez."
- **Texto:** "Cerrar caja no debería tomar 40 minutos"
- **On-ramp:** no es robo — es una venta que nadie anotó. Corte a la pantalla de cierre de caja: saldo esperado vs. saldo real, diferencia explicada.

**H2 · El inventario que vive en tu cabeza** — *Segmento: boutique / tienda de ropa · Formato: POV probador*
- **Visual:** mano revolviendo un montón de blusas buscando una talla, clienta esperando desenfocada al fondo.
- **Voz:** "Ahorita te digo si me queda en mediana… creo."
- **Texto:** "Cuando tu stock solo existe en tu memoria"
- **On-ramp:** el costo real es la venta perdida, no el desorden. Corte a variantes por talla/color con stock exacto por variante.

**H3 · Fiar sin registro** — *Segmento: negocio que da crédito · Formato: primer plano de libreta*
- **Visual:** libreta abierta en la página de "los que deben", nombres tachados, un signo de interrogación a lápiz junto a uno.
- **Voz:** "Don Beto me debe algo. Ya ni sé desde cuándo."
- **Texto:** "Fiar sin registro es regalar en cámara lenta"
- **On-ramp:** cuántos "Don Beto" tienes. Corte a la ficha de cliente con saldo pendiente y el abono registrándose.

### Movimiento 2 · Confesión en primera persona
*Mejor para: watch time. Se siente falso sin detalle vivido — usa objetos y horas reales.*

**H4 · No era robo** — *Segmento: dueño con empleados · Formato: founder a cámara, tono bajo*
- **Visual:** dueño sentado en su propia tienda después de cerrar, sin música, luz cálida.
- **Voz:** "Tardé ocho meses en entender que nadie me estaba robando. Simplemente nadie anotaba nada."
- **Texto:** "La sospecha más cara del negocio"
- **On-ramp:** qué cambió cuando cada venta quedó con nombre y hora. Corte a la bitácora de actividad.

**H5 · El sistema que pagué y no usé** — *Segmento: ya probó software caro · Formato: b-roll + VO*
- **Visual:** laptop abierta con un sistema saturado de menús; la mano la cierra a media frase.
- **Voz:** "Pagué un sistema un año completo. Lo usé tres semanas."
- **Texto:** "El software más caro es el que no usas"
- **On-ramp:** por qué se abandonó (nadie del mostrador le entendía) → cómo se ve una pantalla que sí se usa en turno.

**H6 · Los mil pesos prestados** — *Segmento: mezcla dinero personal/negocio · Formato: POV caja*
- **Visual:** mano sacando billetes de la caja y guardándolos en la bolsa del pantalón.
- **Voz:** "Me agarré mil pesos de la caja. Prestados. Nunca los regresé y nunca los anoté."
- **Texto:** "El dinero no se pierde. Se saca."
- **On-ramp:** el retiro sí puede existir — pero registrado. Corte a movimiento de caja tipo SALIDA con motivo.

### Movimiento 3 · Brecha de curiosidad
*Mejor para: engagement. Debe pagarse dentro del video o envenena la conversión.*

**H7 · El producto que te cuesta dinero** — *Segmento: cualquier dueño con catálogo · Formato: dos objetos en mostrador*
- **Visual:** dos productos de apariencia y precio casi idénticos, lado a lado, cámara cenital.
- **Voz:** "Uno de estos dos te está costando dinero cada vez que lo vendes. ¿Cuál?"
- **Texto:** "El que más vendes ≠ el que más te deja"
- **On-ramp:** revelar el margen de cada uno. Corte al reporte de productos con costo vs. precio de venta.

**H8 · Lo que no te dicen al venderte un sistema** — *Segmento: a punto de migrar · Formato: screen recording*
- **Visual:** dedo scrolleando un Excel que no termina nunca.
- **Voz:** "Nadie te avisa de esto cuando te venden un sistema…"
- **Texto:** "La parte difícil no es el sistema. Es meterle tus productos."
- **On-ramp:** pagar por algo que tardas semanas en poder usar. Corte a la importación: subir archivo → mapear → vista previa → confirmar.

**H9 · Lo que tiras ya lo pagaste** — *Segmento: farmacia, abarrotes, cremería (caducidad) · Formato: b-roll anaquel*
- **Visual:** mano retirando productos de un anaquel y echándolos a una caja de merma.
- **Voz:** "Todo esto que estoy tirando ya lo había pagado. Y me va a costar otra vez."
- **Texto:** "La merma no se ve en la caja. Se ve a fin de mes."
- **On-ramp:** por qué caducó (nadie supo que estaba por vencer). Corte a lotes con fecha de caducidad y alerta.

### Movimiento 4 · Afirmación audaz
*Específica y falsable. Necesita sustento en pantalla en el mismo video.*

**H10 · La prueba de la mamá** — *Segmento: escéptico de la tecnología · Formato: demo real en mostrador*
- **Visual:** señora de 60+ cobrando en una tablet con soltura, sin dudar, ritmo natural.
- **Voz:** "Ella le tiene miedo al cajero automático. Aprendió esto en un turno."
- **Texto:** "Si usas WhatsApp, usas esto"
- **On-ramp:** mostrar la pantalla real del POS — cuántos botones hay que tocar para cobrar.

**H11 · Pagar por vender** — *Segmento: comparando sistemas/terminales · Formato: objeto + VO*
- **Visual:** tira larga de recibos de comisiones desenrollándose hasta el piso.
- **Voz:** "Si tu sistema te cobra un porcentaje por cada venta, estás pagando por vender."
- **Texto:** "Mensualidad fija. Cero comisión por venta."
- **On-ramp:** cuenta real a fin de mes: comisión variable vs. $399 fijos.

**H12 · La hora que recuperas** — *Segmento: dueño que cierra tarde · Formato: time-lapse*
- **Visual:** reloj de pared marcando 11:30 pm con la luz de la tienda todavía encendida.
- **Voz:** "Recuperé una hora diaria. No trabajando menos: dejando de hacer cuentas a mano."
- **Texto:** "Una hora al día = 15 días al año"
- **On-ramp:** qué se hacía en esa hora (sumar tickets) y qué la reemplaza (cierre de caja automático).

### Movimiento 5 · Contraste / antes y después
*La transformación debe ser visualmente honesta — mismo negocio, mismos números.*

**H13 · Mismo mes, dos formatos** — *Segmento: general · Formato: split screen*
- **Visual:** pantalla partida — izquierda, libreta con tachones; derecha, reporte limpio en tablet.
- **Voz:** "Mismo negocio, mismo mes. Lo único que cambió es dónde quedó anotado."
- **Texto:** "Tus números ya existen. Solo no los puedes leer."
- **On-ramp:** señalar el mismo dato en ambos lados: en la libreta toma 4 minutos encontrarlo, en pantalla 2 segundos.

**H14 · El pico que no supiste aprovechar** — *Segmento: papelería, jugueterías, negocios de temporada · Formato: contraste de archivo*
- **Visual:** fila larga en la tienda (agosto) → corte duro → tienda vacía (octubre).
- **Voz:** "En agosto vendí muchísimo. En octubre no sabía ni qué reponer."
- **Texto:** "Vender mucho no es saber qué vender"
- **On-ramp:** comparar periodos y ver qué sí rotó. Corte a reportes por rango de fechas.

**H15 · El precio vive en la cabeza del dueño** — *Segmento: ferretería, refaccionaria, papelería (catálogo enorme) · Formato: b-roll + VO*
- **Visual:** pared de cajones con tornillos y refacciones; mano buscando entre etiquetas escritas a mano.
- **Voz:** "Cuatro mil productos. Y el precio de todos vivía en la cabeza de una sola persona."
- **Texto:** "¿Qué pasa el día que esa persona no viene?"
- **On-ramp:** buscar por nombre o código y que el precio salga solo, lo teclee quien lo teclee.

### Movimiento 6 · Pregunta
*Usa la frase exacta que el dueño ya se dice a sí mismo.*

**H16 · El número que deberías saber de memoria** — *Segmento: general · Formato: a cámara, silencio*
- **Visual:** dueño mirando a cámara, sin música, un par de segundos de silencio incómodo.
- **Voz:** "¿Cuánto dinero tiene tu negocio hoy? No aproximado. Exacto."
- **Texto:** "Si tardas más de 5 segundos, ahí está el problema"
- **On-ramp:** abrir el dashboard y que el número esté ahí, sin calcular nada.

**H17 · La prueba de la semana libre** — *Segmento: negocio familiar, dueño sin vacaciones · Formato: POV salida*
- **Visual:** dueño saliendo por la cortina y volteando hacia adentro con cara de duda.
- **Voz:** "¿Te puedes ir una semana de tu negocio sin que se caiga?"
- **Texto:** "Un negocio que solo tú puedes operar es un empleo"
- **On-ramp:** el cajero cobra con su propio usuario, tú ves las ventas desde el celular sin estar ahí.

**H18 · Lo primero que se ordena** — *Segmento: por abrir / recién abierto · Formato: local vacío*
- **Visual:** local vacío, cortina nueva, cajas sin desempacar.
- **Voz:** "¿Vas a abrir un negocio? Lo primero que tienes que ordenar no es el inventario."
- **Texto:** "El día 1 decide los siguientes 365"
- **On-ramp:** empezar con registro desde la primera venta vs. migrar dos años de libreta después.

### Movimiento 7 · Prueba primero
*El más fuerte cuando la evidencia presume sola. Todo esto se graba en pantalla real, sin mockups.*

**H19 · Venta cronometrada** — *Segmento: general · Formato: screen recording + cronómetro*
- **Visual:** grabación real del POS con cronómetro visible: escaneo → carrito → método de pago → ticket.
- **Voz:** *(solo el sonido del escáner y el conteo)* "Once segundos."
- **Texto:** "Sin manual, sin capacitación"
- **On-ramp:** repetirlo con un producto a granel/por peso, para que no parezca el caso fácil.

**H20 · El Excel viejo sí sirve** — *Segmento: teme migrar · Formato: screen recording*
- **Visual:** Excel de 200 filas → pantalla de importación → catálogo completo funcionando.
- **Voz:** "Doscientos productos. Un archivo que ya tenías. Diez minutos."
- **Texto:** "No hay que capturar nada a mano"
- **On-ramp:** el paso que más tranquiliza — la vista previa antes de confirmar, con los errores marcados.

**H21 · Demo sin registro** — *Segmento: quiere ver antes de dar datos · Formato: screen recording*
- **Visual:** navegador abriendo la demo pública y entrando al sistema completo, sin formulario.
- **Voz:** "No te voy a pedir tarjeta. Ni tu correo. Míralo completo ahorita."
- **Texto:** "Demo abierta. Cero registro."
- **On-ramp:** recorrido de 3 módulos en 20 segundos — POS, inventario, reportes.

### Movimiento 8 · Cuenta regresiva / reto
*El premio tiene que existir de verdad; si haces trampa, la retención se cae.*

**H22 · Tu semana en 60 segundos** — *Segmento: general · Formato: screen recording con timer*
- **Visual:** cronómetro en 60 arrancando sobre la pantalla del sistema.
- **Voz:** "Sesenta segundos para saber si tu negocio ganó o perdió esta semana. Arranco."
- **Texto:** "Reto: la semana completa antes de que llegue a cero"
- **On-ramp:** dashboard → ventas por día → top productos → cierre, sin pausas ni cortes.

**H23 · Cinco pendientes, un día** — *Segmento: el desordenado · Formato: checklist animada*
- **Visual:** checklist en pantalla con 5 casillas vacías.
- **Voz:** "Cinco cosas que puedes ordenar de tu negocio antes de cerrar hoy. La quinta es la que duele."
- **Texto:** "Reto de 1 día"
- **On-ramp:** ir tachando en tiempo real; la quinta es separar tu dinero del dinero del negocio.

**H24 · Lo que la libreta nunca te dirá** — *Segmento: general / comunidad · Formato: dos columnas en pantalla*
- **Visual:** dos columnas llenándose en paralelo: "Libreta" vs. "Sistema".
- **Voz:** "Tres cosas de tu negocio que una libreta jamás te va a decir. Si adivinas la tercera, comenta."
- **Texto:** "La tercera casi nadie la dice"
- **On-ramp:** 1) tu margen real por producto, 2) qué NO se está vendiendo, 3) cuánto te deben hoy.

---

## Bloque B — 10 hooks de portada para carrusel

La slide 1 funciona sola como thumbnail: **promesa específica + razón para deslizar.** Cada uno indica el framework para desarrollarlo (ver los 8 carruseles ya escritos arriba).

| # | Movimiento | Hook de portada | Framework sugerido |
|---|---|---|---|
| C1 | Brecha de curiosidad | "Hay 3 números de tu negocio que la libreta nunca te va a dar. El tercero es el que te cuesta dinero." | Hack List |
| C2 | Pregunta | "¿Cuánto te debe la gente ahorita? Si dudaste, este carrusel es para ti." | Problem-Proof |
| C3 | Prueba primero | "De escanear a ticket, cronometrado. Te lo muestro paso a paso." | Demo Walkthrough |
| C4 | Afirmación audaz | "Tu producto más vendido puede ser el que menos te deja. Así se revisa en 2 minutos." | Value-Stack |
| C5 | Confesión | "Perdí dinero un año entero sin que nadie me robara. Aquí está exactamente en qué se fue." | Problem-Proof |
| C6 | Contraste | "Tu mes en libreta vs. tu mes en un sistema. Mismo negocio, mismos números." | Antes/Después |
| C7 | Relatabilidad | "POV: son las 10 pm, ya cerraste, y la caja no cuadra." | Rant Callout |
| C8 | Advertencia | "5 cosas que estás anotando mal en tu libreta (y lo que te cuesta cada una)." | Hack List |
| C9 | Afirmación audaz | "7 cosas que tu punto de venta debería hacer solo. Si no hace 3, estás trabajando de más." | Value-Stack |
| C10 | Segmento específico | "Si vendes por talla y color, tu inventario está mal contado. Te explico por qué." | Problem-Proof |

---

## Bloque C — 9 hooks para post estático

Aquí el hook son **2 componentes** (visual + titular) y aplica la misma regla: **el titular no describe la imagen.**

| # | Visual | Titular (texto superpuesto) | Movimiento |
|---|---|---|---|
| E1 | Libreta cerrada con una liga, sobre el mostrador | "Tu contador no es esto." | Afirmación audaz |
| E2 | Tres billetes sobre la caja registradora | "¿Cuánto de esto es ganancia? Exacto: por eso." | Pregunta |
| E3 | Cronómetro detenido en 00:11 | "Lo que tarda una venta bien registrada." | Prueba primero |
| E4 | Producto caducado saliendo del anaquel | "Esto ya lo pagaste. Y lo vas a pagar otra vez." | Brecha de curiosidad |
| E5 | Celular con el ícono de SYMVORA en la pantalla de inicio | "Tu negocio cabe aquí. Sin descargar nada de una tienda de apps." | Afirmación audaz |
| E6 | Dos tarjetas de precio, mensual vs. anual | "Mismo sistema. Tres meses gratis." | Contraste |
| E7 | Mano entregando las llaves del local a un empleado | "Delegar el mostrador sin delegar el control." | Relatabilidad |
| E8 | Navegador con la demo abierta, sin formulario | "Ábrela ahorita. No te pedimos tarjeta." | Prueba primero |
| E9 | Dos dueños de mostrador a mostrador, uno enseñándole su tablet al otro | "Ya recomendaste el sistema. Solo no te pagaron por hacerlo." | Confesión / reencuadre |

### E9 ampliado — Referidos

El ángulo: **el dueño ya recomienda lo que le funciona, gratis y por costumbre.** El hook no pide un favor ("invita a tus amigos"), le señala que ya lo hizo sin cobrar. Es un reencuadre, no una promo — por eso funciona donde el post de referidos típico se ignora.

- **Visual:** dos dueños de negocio platicando de mostrador a mostrador, uno le enseña su tablet al otro. Tienda mexicana real, luz cálida.
- **Titular:** "Ya recomendaste el sistema. Solo no te pagaron por hacerlo."
- **Copy:** "Cuando algo te funciona, lo platicas. Lo has hecho con tu proveedor, con tu compadre, con el de la tienda de enfrente — y nunca te tocó nada. Esta vez sí: compartes tu enlace, y cuando ese negocio paga su primer mes, **ustedes dos reciben un mes gratis**. No es un descuento del 10%: es una mensualidad completa que ninguno de los dos paga. Y no hay límite de negocios que puedas invitar."
- **CTA:** "Tu enlace ya está en tu panel, en Suscripción. Mándalo por WhatsApp y ya."
- **Prompt imagen:** "Ilustración 1:1 de dos dueños de negocio conversando de mostrador a mostrador, uno mostrando una tablet al otro, ambiente de tienda mexicana real, luz cálida, paleta #f8fafc con acentos #2563eb, sin texto"
- **#:** #Referidos #MesGratis #NegocioLocal #PuntoDeVenta #PymesMexico

**Dos titulares alternos para probar contra el principal** (misma imagen, una variable a la vez):

| Variante | Titular | Movimiento | Cuándo gana |
|---|---|---|---|
| E9-b | "Un negocio invitado. Dos mensualidades que nadie paga." | Prueba primero | Si la audiencia responde mejor a la matemática que a la emoción |
| E9-c | "¿A cuántos negocios ya les platicaste? Cada uno valía un mes gratis." | Pregunta | Para audiencia que ya te conoce y es más probable que sí haya recomendado |

> **Mecánica verificada contra el código** (webhook de Conekta + migración 023): el crédito se otorga **a los dos lados** cuando el negocio invitado completa su **primer pago**, no al registrarse. El referidor no tiene tope de invitados; cada negocio solo puede ser referido una vez. No prometas "un mes gratis al registrarse" — el sistema no lo hace hasta que hay pago.
>
> **Relación con SP9:** SP9 (arriba) es el post de referidos que enuncia la mecánica de frente. E9 es el ángulo emocional. Son complementarios, no duplicados — alterna entre los dos en el pilar de Promo+Referidos en vez de repetir uno.

---

## Cómo producir y probar estos hooks

**Escalera de fidelidad — no gastes producción en corazonadas:**
1. **Corazonada → barato (1 día).** Texto en pantalla, captura real, voz en off sobre b-roll. Lo que se prueba es el *ángulo*, no la producción.
2. **Ángulo validado → producción.** Solo los hooks que ya mostraron señal (aunque sea una sola métrica: un pico de retención en un video feo ya es evidencia) merecen grabación con persona real, luz y edición.

**Prioridad de rodaje** (por costo de producción vs. señal esperada):
- **Primeros, hoy mismo:** H19, H20, H21, H22 — son screen recordings de la demo real, cero costo de producción y son los que mejor prueban el producto.
- **Segundos:** H1, H3, H6, H9 — solo requieren objetos que ya existen en cualquier tienda (libreta, caja, anaquel).
- **Últimos:** H4, H10, H16, H17 — necesitan una persona frente a cámara con naturalidad; vale la pena esperar a tener el ángulo validado.

**Cadencia de prueba:** 3–5 hooks por semana, **una variable a la vez.** Si un video falla, usa la tabla de diagnóstico de arriba antes de tirar el concepto completo: casi siempre el problema es el on-ramp (3–15s), no el hook.

**Vocabulario:** las palabras de los hooks salen de cómo habla el dueño de negocio en México — "no cuadra", "le fío", "se me acabó", "a ojo", "la libreta". Cuando empiecen a llegar comentarios y mensajes reales, **reemplaza estas frases por las suyas literales**: el lenguaje del cliente siempre gana contra el lenguaje de marketing. Ese es el siguiente paso natural de esta biblioteca.
