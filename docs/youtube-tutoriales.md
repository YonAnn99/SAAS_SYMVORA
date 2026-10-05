# Serie de tutoriales de YouTube — SYMVORA

> **12 videos, uno por módulo, más el video 0 para instalar el sistema como app.** Cada capítulo de este documento es la escaleta completa de un video: qué grabar
> clic por clic, qué texto poner en pantalla y la **narración exacta lista para pegar en ElevenLabs**.
>
> **Fuente de verdad:** los pasos y nombres de botones salen de las guías de "Aprende"
> (`src/features/marketing/aprende.ts`) y de las pantallas reales. Si al grabar un botón se llama distinto,
> **manda la pantalla**: corrige aquí y avisa para corregir la guía.
>
> Skills usadas: `video` (producción y formato), `copywriting` (guion), `content-strategy` (orden y búsquedas)
> y `marketing-psychology` (hooks y CTA).

---

## Índice

| # | Video | Duración | Para quién |
|---|---|---|---|
| — | [Antes de grabar](#antes-de-grabar) | — | Tú |
| 0 | [Instala SYMVORA como app](#0--instala-symvora-como-app) | 2–3 min | Todos (dueño y equipo) |
| 1 | [Primeros pasos](#1--primeros-pasos) | 9–11 min | Dueño nuevo o evaluando |
| 2 | [Punto de venta](#2--punto-de-venta) | 10–12 min | Dueño y cajeros |
| 3 | [Productos e inventario](#3--productos-e-inventario) | 11–13 min | Dueño / encargado |
| 4 | [Caja y finanzas](#4--caja-y-finanzas) | 8–10 min | Dueño y cajeros |
| 5 | [Compras y órdenes de compra](#5--compras-y-órdenes-de-compra) | 8–10 min | Dueño / encargado |
| 6 | [Clientes y crédito](#6--clientes-y-crédito) | 6–8 min | Dueño y cajeros |
| 7 | [Usuarios y permisos](#7--usuarios-y-permisos) | 8–10 min | Dueño |
| 8 | [Reportes y dashboard](#8--reportes-y-dashboard) | 6–8 min | Dueño / administrador |
| 9 | [Sucursales](#9--sucursales) | 8–10 min | Dueño con 2+ locales |
| 10 | [Configuración y métodos de pago](#10--configuración-y-métodos-de-pago) | 6–8 min | Dueño |
| 11 | [Bitácora](#11--bitácora) | 4–6 min | Dueño / administrador |
| 12 | [Suscripción](#12--suscripción) | 5–7 min | Dueño |
| — | [Anexos](#anexos) | — | Pronunciación, checklist, Shorts |

**Orden de publicación:** el de la tabla, empezando por el **video 0** (instalar como app): los demás lo
enlazan en su cápsula de instalación. Después del 0, los primeros cuatro son los que más se buscan y los que necesita
quien está probando el sistema; publícalos juntos para que el canal arranque con una ruta completa
("crear cuenta → vender → inventario → corte de caja").

---

## Antes de grabar

### Reglas duras (no negociables)

1. **Nada de facturación, CFDI ni SAT.** El módulo está apagado. Si se ve en pantalla, regraba.
2. **Nada de "modo sin conexión".** Se retiró del producto.
3. **Precio solo el oficial:** $399 al mes o $3,588 al año (sale a $299 al mes). Prueba de **14 días, sin tarjeta**.
   La promoción de lanzamiento (3 meses a mitad de precio) es un interruptor que se puede apagar: **no la
   menciones en la voz**; si sale en pantalla al grabar, déjala solo en imagen.
4. **Nada de datos reales:** ni correos de clientes, ni teléfonos, ni la contraseña de la cuenta de pruebas.
5. **Nunca mockups:** siempre pantallas reales. Promete solo lo que el sistema hace hoy.

### Estándares de producción

| Aspecto | Estándar |
|---|---|
| Formato | 16:9, 1920×1080, 60 fps (el cursor se ve fluido) |
| Cuenta | **Pruebas SYMVORA** en `localhost` o `app.symvora.com.mx` |
| Navegador | Ventana limpia: sin pestañas, marcadores ni extensiones visibles. Zoom del navegador al 110 % |
| Tema | Elige claro **u** oscuro y úsalo en toda la serie (recomendado: claro, contrasta mejor en miniaturas) |
| Cursor | Resaltado de clic activado. Muévelo despacio; pausa 1 s antes de cada clic |
| Zoom en edición | 125–150 % sobre botones pequeños y campos que se llenan |
| Voz | ElevenLabs, voz es-MX, **la misma en los 12 videos** |
| Música | Sin copyright, ducking −18 dB bajo la voz. Sin música en las partes de "errores comunes" |
| Subtítulos | Siempre (sube el `.srt` que genera ElevenLabs o YouTube y revísalo) |
| Paleta de textos en pantalla | Fondo `#f8fafc`, texto `#1a1a1a`, acento `#2563eb` (igual que los reels) |
| Capítulos | Los timestamps de cada capítulo van en la descripción (YouTube los convierte en capítulos) |

### Cómo usar la narración con ElevenLabs

- Cada escena tiene su **bloque de VO**. Genéralos por separado: si cambias algo, regeneras solo esa escena.
- Las pausas van como `<break time="0.8s" />` (ElevenLabs las respeta). No pases de 2 s por pausa.
- Las cifras y siglas están escritas **como se dicen** ("trescientos noventa y nueve pesos"). Revisa el
  [glosario de pronunciación](#glosario-de-pronunciación-para-elevenlabs).
- Ajustes sugeridos: estabilidad 45–55 %, similitud 75 %, estilo bajo. Velocidad normal: los tutoriales se
  ven con la app abierta al lado, no apures.
- **Graba primero la voz y después la pantalla** siguiendo el audio: es más fácil que sincronizar al revés.

### Preparar la cuenta (una vez, antes del primer video)

- [ ] 8–10 productos de ejemplo **con foto**: uno con variantes (talla/color), uno a granel (kg), un servicio
      y uno con stock bajo.
- [ ] Un proveedor, un cliente con crédito y una lista de precios de mayoreo.
- [ ] Dos sucursales (para el video 9) y un cajero invitado con nombre (para el video 7).
- [ ] Caja **cerrada** al empezar cada video donde se abre caja.
- [ ] Tu nombre en Mi perfil (el sistema saluda "¡Hola, …!").
- [ ] El tutorial interno marcado como visto, para que no aparezca solo a mitad de la grabación.

### Plantilla de cada video

| Bloque | Duración | Para qué |
|---|---|---|
| **Hook** | 0–15 s | El problema del dueño en una frase. Sin "hola, bienvenidos" |
| **Promesa** | 15–30 s | "Al terminar este video vas a saber…" (3 cosas concretas) |
| **Cápsula de instalación** | 30–45 s | "Instálalo como app" — **el mismo clip y audio en los 12 videos** (ver abajo) |
| **Demostración** | El grueso | Bloques cortos de 1–2 min, uno por tarea |
| **Errores comunes** | 30–60 s | Lo que confunde a los clientes de verdad |
| **Resumen** | 15–20 s | Las 3 cosas de la promesa, en una línea cada una |
| **CTA** | 10–15 s | Probar 14 días gratis + el siguiente video de la serie |

**Cápsula de instalación (escena 2b de cada video):** grábala **una vez** y pégala igual en los 12. Es el
menú ⋮ de Chrome con "Instalar SYMVORA" resaltado y una **tarjeta de YouTube** (i) que enlaza al video 0. Por
eso todas las escaletas tienen esa escena en 0:30–0:45 y el capítulo "Instálalo como app".

**Regla del hook (de los reels):** la voz, el texto en pantalla y la imagen se reparten el trabajo. Si la voz
dice la frase, el texto en pantalla **no** la repite.

---

## 0 · Instala SYMVORA como app

| Ficha | |
|---|---|
| **Título** | Instala tu punto de venta como app en tu computadora \| SYMVORA |
| **Duración** | 2–3 min |
| **Para quién** | Dueño y equipo: todos los que usan el sistema a diario |
| **Pantallas** | Chrome de escritorio en `app.symvora.com.mx` |
| **Preparar** | Sesión iniciada en `app.symvora.com.mx` (no en la landing). **Desinstala antes la app** si ya la tenías, para grabar la instalación desde cero (en Chrome: ⋮ dentro de la app → Desinstalar SYMVORA). Antes de grabar, confirma que el menú dice "Instalar SYMVORA"; si Chrome cambió el texto, usa el que aparezca |

| # | Tiempo | Qué grabar | Texto en pantalla | VO (ElevenLabs) |
|---|---|---|---|---|
| 1 | 0:00 | Escritorio: abrir Chrome, escribir la dirección, buscar entre pestañas | *¿Cada vez lo mismo?* | ¿Cada vez que vas a vender abres el navegador y buscas la página? |
| 2 | 0:10 | El ícono de SYMVORA en el escritorio; doble clic y abre en su ventana | *Ícono · ventana propia · sin pestañas* | Instálalo como app: <break time="0.3s" /> un ícono en tu escritorio, su propia ventana y sin pestañas que estorben. Toma diez segundos. |
| 3 | 0:25 | Chrome en `app.symvora.com.mx`, con la sesión iniciada (Dashboard) | *app.symvora.com.mx* | Entra a app punto symvora punto com punto em equis con tu cuenta. |
| 4 | 0:40 | ⋮ (tres puntos, arriba a la derecha) → **Transmitir, guardar y compartir** → **Instalar SYMVORA…** → **Instalar** | *⋮ → Transmitir, guardar y compartir → Instalar* | Toca los tres puntos de arriba a la derecha, <break time="0.3s" /> "Transmitir, guardar y compartir", <break time="0.3s" /> y "Instalar Simvora". <break time="0.3s" /> Confirma con "Instalar". |
| 5 | 1:05 | El ícono de instalar en la barra de direcciones (a la derecha) | *Atajo: el ícono de la barra* | Otra forma: <break time="0.3s" /> el ícono de instalar que aparece en la barra de direcciones hace lo mismo. |
| 6 | 1:20 | Si no aparece "Instalar": ⋮ → **Transmitir, guardar y compartir** → **Crear acceso directo…** → marcar **Abrir como ventana** → **Crear** | *Marca "Abrir como ventana"* | ¿No te aparece "Instalar"? <break time="0.3s" /> En el mismo menú elige "Crear acceso directo", <break time="0.3s" /> marca "Abrir como ventana" <break time="0.3s" /> y pulsa "Crear". |
| 7 | 1:45 | Se abre la app en su ventana, directo en el Dashboard; clic derecho al ícono de la barra de tareas → **Anclar** | *Ánclala a tu barra de tareas* | Listo: se abre directo en tu panel, en su propia ventana. <break time="0.3s" /> Ánclala a tu barra de tareas y la tienes a un clic. |
| 8 | 2:05 | Celular Android con Chrome: ⋮ → **Instalar app** (o **Agregar a la pantalla principal**) | *En el celular, también* | En tu celular Android es igual: en Chrome, los tres puntos, <break time="0.3s" /> "Instalar app". |
| 9 | 2:20 | — | **Errores comunes** | Dos detalles. <break time="0.3s" /> Instálala desde app punto symvora, no desde la página de inicio. <break time="0.3s" /> Y recuerda que necesita internet, igual que en el navegador. |
| 10 | 2:40 | Pantalla final con el video 1 | *Prueba 14 días gratis* | Ya la tienes como app. <break time="0.3s" /> En el siguiente video, tus primeros pasos con Symvora. |

**Capítulos**

```
0:00 Deja de buscar la página
0:25 Entra a tu cuenta
0:40 Instalar desde el menú de Chrome
1:05 Atajo en la barra de direcciones
1:20 Si no aparece "Instalar"
1:45 Ánclala a tu barra de tareas
2:05 En el celular
2:20 Errores comunes
```

**Descripción**

```
Instala SYMVORA como app en tu computadora con Chrome: un ícono en tu escritorio, su propia ventana y directo a tu punto de venta. Sin descargas de tiendas de apps.
Prueba 14 días gratis 👉 https://www.symvora.com.mx

Pasos: entra a app.symvora.com.mx → ⋮ → Transmitir, guardar y compartir → Instalar SYMVORA.
¿No aparece? ⋮ → Transmitir, guardar y compartir → Crear acceso directo → marca "Abrir como ventana".
```

**Etiquetas:** instalar punto de venta, punto de venta en computadora, app punto de venta, acceso directo chrome,
instalar app desde chrome

**Miniatura:** el ícono de SYMVORA en el escritorio con un cursor encima + **"Tu POS como app"**.

---

## 1 · Primeros pasos

| Ficha | |
|---|---|
| **Título** | Cómo empezar con tu punto de venta en 10 minutos \| SYMVORA |
| **Duración** | 9–11 min |
| **Para quién** | El dueño que acaba de crear su cuenta o la está evaluando |
| **Pantallas** | Registro → Configuración → Compras → Productos → Finanzas → Punto de Venta |
| **Preparar** | Una cuenta nueva en blanco para el registro (correo de pruebas tuyo) y luego "Pruebas SYMVORA" para el resto |

| # | Tiempo | Qué grabar | Texto en pantalla | VO (ElevenLabs) |
|---|---|---|---|---|
| 1 | 0:00 | Una libreta de ventas real o una caja registradora; corte a la pantalla del dashboard | *De la libreta al sistema* | Si todavía anotas tus ventas en una libreta, <break time="0.5s" /> este video es para ti. |
| 2 | 0:10 | Dashboard de Pruebas SYMVORA con datos | *En este video:* 1. Crear cuenta 2. Configurar tu negocio 3. Tu primera venta | En los próximos diez minutos vas a crear tu cuenta, <break time="0.3s" /> configurar tu negocio <break time="0.3s" /> y hacer tu primera venta real. Sin instalar nada y sin tarjeta. |
| 2b | 0:30 | **Cápsula de instalación** (la misma en los 12 videos): Chrome → ⋮ → "Transmitir, guardar y compartir" → **Instalar SYMVORA** resaltado. Tarjeta de YouTube al video 0 | *Instálalo como app* | Antes de empezar: <break time="0.3s" /> si todavía entras desde el navegador, instala Simvora como app. <break time="0.3s" /> Tres puntos, "Transmitir, guardar y compartir", "Instalar Simvora". <break time="0.3s" /> Te dejo el video completo arriba. |
| 3 | 0:45 | `symvora.com.mx` → **Prueba gratis** → formulario de registro: nombre, apellidos, celular, empresa, giro, contraseña | *14 días gratis · sin tarjeta* | Entra a symvora punto com punto em equis y elige "Prueba gratis". <break time="0.5s" /> Escribe tu nombre, tu celular, el nombre de tu negocio y tu giro. <break time="0.5s" /> Tienes catorce días de prueba con todas las funciones, y no te pedimos tarjeta. |
| 4 | 1:45 | Botón "Continuar con Google" (solo mostrarlo) | *¿Con Google? También* | Si prefieres, entra directo con tu cuenta de Google. <break time="0.3s" /> La primera vez te pediremos los datos de tu negocio, y quedas como dueño de la cuenta. |
| 5 | 2:15 | Primer ingreso: el dashboard con "¡Hola, {nombre}!" y el tutorial que aparece solo | *Tu panel* | Al entrar, el sistema te saluda por tu nombre y te ofrece un recorrido rápido. <break time="0.5s" /> Lo puedes repetir cuando quieras desde "Ver tutorial", en la barra de arriba. |
| 6 | 2:55 | **Configuración → General**: nombre comercial, teléfono, dirección, correo y logo | *Esto sale en tus tickets* | Primero, tu negocio. <break time="0.3s" /> En Configuración, en la pestaña General, captura tu nombre comercial, teléfono, dirección y correo, <break time="0.3s" /> y sube tu logo. Todo esto aparece en los tickets que entregas. |
| 7 | 3:55 | **Configuración → Módulos**: encender y apagar interruptores (peso o medida, variantes, lotes, mermas, servicios, crédito) | *Activa solo lo que usas* | En Módulos enciende solo lo que tu negocio necesita: <break time="0.3s" /> venta por peso, tallas y colores, caducidades, servicios o ventas a crédito. <break time="0.5s" /> Apagar uno no borra nada, y puedes cambiarlo cuando quieras. |
| 8 | 4:55 | **Compras → Proveedores → Agregar proveedor** | *Primero el proveedor* | Ahora tu primer proveedor. <break time="0.3s" /> En Compras, en Proveedores, pulsa "Agregar proveedor" y escribe su nombre y teléfono. |
| 9 | 5:35 | **Productos → Agregar producto**: nombre, precio de venta, costo, unidad, stock, stock mínimo, código de barras. Señalar el margen que se calcula | *Con el costo, ves tu margen* | En Productos pulsa "Agregar producto". <break time="0.5s" /> Escribe el nombre, el precio de venta y lo que te cuesta. <break time="0.3s" /> Con el costo, el sistema calcula cuánto ganas en cada pieza. <break time="0.5s" /> Agrega el código de barras y tu stock. |
| 10 | 6:45 | Botón **Importar** (solo mostrarlo, sin subir archivo) | *¿Ya tienes tu lista en Excel?* | Si ya tienes tu lista en Excel, no la captures a mano: <break time="0.3s" /> impórtala. Lo vemos a fondo en el video de productos. |
| 11 | 7:05 | **Finanzas → Abrir caja** → capturar fondo inicial | *Sin caja abierta no se vende* | Antes de vender, abre tu caja. <break time="0.3s" /> En Finanzas pulsa "Abrir caja" y escribe el efectivo con el que empiezas. |
| 12 | 7:45 | **Punto de Venta**: escanear o buscar el producto → efectivo → monto recibido → cambio → **Completar venta** → ticket | *Tu primera venta* | Y ahora sí: <break time="0.3s" /> en Punto de Venta escanea o busca tu producto, <break time="0.3s" /> elige efectivo, escribe con cuánto te pagan y el sistema te dice el cambio. <break time="0.5s" /> Pulsa "Completar venta". <break time="0.5s" /> El inventario se descontó solo. |
| 13 | 8:55 | Volver a Productos: el stock ya bajó | *El stock bajó solo* | Si regresas a Productos, ese stock ya bajó. Sin anotar nada. |
| 14 | 9:15 | Pantalla de Usuarios (solo mostrar) | **Errores comunes** | Dos consejos. <break time="0.3s" /> Uno: invita a tu equipo desde Usuarios antes de vender, así cada venta queda con el nombre de quien la hizo. <break time="0.5s" /> Dos: si no puedes cobrar, revisa que tengas la caja abierta. |
| 15 | 9:45 | Dashboard | *Cuenta · Negocio · Primera venta* | Ya creaste tu cuenta, configuraste tu negocio y cobraste tu primera venta. |
| 16 | 10:00 | Pantalla final con el video 2 | *Prueba 14 días gratis* | Pruébalo catorce días gratis, sin tarjeta. <break time="0.3s" /> Y en el siguiente video te enseño a cobrar como un profesional. |

**Capítulos**

```
0:00 De la libreta al sistema
0:30 Instálalo como app
0:45 Crea tu cuenta
2:15 Tu primer ingreso
2:55 Configura tu negocio
4:55 Tu primer proveedor y producto
7:05 Abre la caja
7:45 Tu primera venta
9:15 Consejos
10:00 Siguiente paso
```

**Descripción**

```
Aprende a empezar con SYMVORA, el punto de venta en la nube para tiendas en México: crea tu cuenta, configura tu negocio y haz tu primera venta en 10 minutos.
Prueba 14 días gratis, sin tarjeta 👉 https://www.symvora.com.mx

En este video:
• Crear tu cuenta (o entrar con Google)
• Datos del negocio, logo y módulos
• Alta de proveedor y producto
• Abrir caja y cobrar tu primera venta

Guía escrita paso a paso: https://www.symvora.com.mx/es/aprende/primeros-pasos
```

**Etiquetas:** punto de venta, sistema punto de venta, punto de venta para tienda, sistema para abarrotes,
inventario, control de ventas, POS México, SYMVORA

**Miniatura:** captura del ticket recién cobrado + texto **"Tu 1ª venta en 10 min"**.

---

## 2 · Punto de venta

| Ficha | |
|---|---|
| **Título** | Cómo cobrar rápido en tu tienda con punto de venta \| SYMVORA |
| **Duración** | 10–12 min |
| **Para quién** | Dueño y cajeros |
| **Pantallas** | Punto de Venta (escritorio y celular) |
| **Preparar** | Caja abierta, lector de códigos conectado, un producto con variantes, uno a granel, una lista de mayoreo y un cliente con crédito |

| # | Tiempo | Qué grabar | Texto en pantalla | VO (ElevenLabs) |
|---|---|---|---|---|
| 1 | 0:00 | Escaneo con lector: el producto entra al carrito al instante | *Escaneo → carrito* | ¿Cuánto tarda una venta en tu mostrador? <break time="0.5s" /> Con lector de códigos, menos de lo que tardas en decir el total. |
| 2 | 0:10 | Pantalla completa del POS | *Escanear · Cobrar · Ticket* | En este video vas a aprender a armar una venta, cobrar con cualquier método de pago <break time="0.3s" /> y entregar tu ticket, incluso desde el celular. |
| 2b | 0:30 | **Cápsula de instalación** (la misma en los 12 videos): Chrome → ⋮ → "Transmitir, guardar y compartir" → **Instalar SYMVORA** resaltado. Tarjeta de YouTube al video 0 | *Instálalo como app* | Antes de empezar: <break time="0.3s" /> si todavía entras desde el navegador, instala Simvora como app. <break time="0.3s" /> Tres puntos, "Transmitir, guardar y compartir", "Instalar Simvora". <break time="0.3s" /> Te dejo el video completo arriba. |
| 3 | 0:45 | Buscador: escribir nombre; luego filtrar por categoría y por favoritos (estrella) | *Busca o filtra* | Sin lector, escribe el nombre o el código en el buscador. <break time="0.3s" /> También puedes filtrar por categoría, o por tus favoritos: marca con la estrella lo que más vendes y lo encuentras con un toque. |
| 4 | 1:45 | Producto con variantes → se abre la selección de talla/color | *Cada variante, su precio y stock* | Si el producto tiene tallas o colores, al elegirlo te pregunta cuál. <break time="0.3s" /> Cada variante tiene su propio precio y su propio stock. |
| 5 | 2:35 | Producto a granel → "¿Cuánto?" → escribir 0.750 o usar ¼ ½ 1 2 | *Kilo, litro o metro* | Para lo que se vende por kilo, litro o metro, se abre "¿Cuánto?". <break time="0.3s" /> Escribe la cantidad, por ejemplo cero punto setecientos cincuenta, <break time="0.3s" /> o usa los atajos de un cuarto, medio, uno y dos. Ves el importe antes de agregarlo. |
| 6 | 3:35 | Carrito: tocar la cantidad y escribir 24; usar + y −; quitar con el bote de basura | *Cantidades rápidas* | En el carrito toca la cantidad para escribirla, <break time="0.3s" /> por ejemplo veinticuatro piezas, <break time="0.3s" /> o usa más y menos. Con el bote de basura quitas el producto. |
| 7 | 4:25 | Elegir la lista de mayoreo antes de cobrar | *Precio de mayoreo* | Si vendes a mayoreo, elige tu lista de precios antes de cobrar. <break time="0.5s" /> Al terminar la venta, el sistema regresa solo a precios normales, para que el siguiente cliente no se lleve el descuento por error. |
| 8 | 5:15 | Métodos de pago: efectivo (monto recibido → cambio), tarjeta, transferencia | *Efectivo · Tarjeta · Transferencia* | Ahora el cobro. <break time="0.3s" /> En efectivo escribe con cuánto te pagan y el sistema calcula el cambio. <break time="0.3s" /> También puedes cobrar con tarjeta, transferencia, <break time="0.3s" /> o con terminal de cobro si la conectaste. |
| 9 | 6:15 | Crédito / Fiado: elegir cliente → método Crédito / Fiado | *Fiado, pero ordenado* | Para fiar, elige al cliente y el método "Crédito o Fiado". <break time="0.3s" /> El importe se suma a su saldo, y los abonos los registras después. |
| 10 | 6:55 | **Completar venta** → ticket → imprimir | *Inventario y caja, al instante* | Pulsa "Completar venta". <break time="0.5s" /> En ese momento se descuenta el inventario, el dinero entra a tu caja <break time="0.3s" /> y puedes imprimir el ticket. |
| 11 | 7:45 | Vista celular: el dock de abajo, el POS y escanear con la cámara del celular | *¿Sin lector? Usa tu celular* | En el celular el punto de venta funciona igual. <break time="0.3s" /> Los módulos están abajo, en la barra, <break time="0.3s" /> y si no tienes lector, escanea el código de barras con la cámara del celular. |
| 12 | 8:55 | Selector de sucursal del dueño en el POS | *Dueño con varios locales* | Si tienes varias sucursales, como dueño puedes cambiar de local desde aquí. <break time="0.3s" /> Cada venta entra en la caja del local donde cobras. |
| 13 | 9:35 | — | **Errores comunes** | Tres errores comunes. <break time="0.3s" /> Uno: no tener la caja abierta. <break time="0.3s" /> Dos: olvidar regresar a precio normal; tranquilo, el sistema lo hace solo. <break time="0.3s" /> Tres: al cambiar de sucursal con productos en el carrito, la venta se vacía, porque esos productos pueden no existir en el otro local. |
| 14 | 10:25 | POS | *Armar · Cobrar · Ticket* | Ya sabes armar una venta, cobrar con cualquier método y entregar tu ticket. |
| 15 | 10:40 | Pantalla final con el video 3 | *Prueba 14 días gratis* | Pruébalo catorce días gratis. <break time="0.3s" /> En el siguiente video, tu catálogo y tu inventario, a fondo. |

**Capítulos**

```
0:00 Cobra en segundos
0:30 Instálalo como app
0:45 Busca y filtra productos
1:45 Variantes (talla y color)
2:35 Venta a granel
3:35 Cantidades en el carrito
4:25 Precios de mayoreo
5:15 Métodos de pago
6:15 Venta a crédito
6:55 Completa la venta y el ticket
7:45 Desde el celular
8:55 Varias sucursales
9:35 Errores comunes
```

**Descripción**

```
Cómo cobrar en tu tienda con el punto de venta de SYMVORA: lector de códigos, variantes, venta a granel, mayoreo, crédito y ticket, también desde el celular.
Prueba 14 días gratis 👉 https://www.symvora.com.mx

Guía escrita: https://www.symvora.com.mx/es/aprende/punto-de-venta
```

**Etiquetas:** cómo cobrar en punto de venta, lector de código de barras, punto de venta celular, venta a granel,
precio de mayoreo, ticket de venta, POS tienda

**Miniatura:** carrito con 3 productos y el botón "Completar venta" resaltado + **"Cobra en segundos"**.

---

## 3 · Productos e inventario

| Ficha | |
|---|---|
| **Título** | Cómo controlar el inventario de tu tienda (con Excel) \| SYMVORA |
| **Duración** | 11–13 min |
| **Para quién** | Dueño o encargado de inventario |
| **Pantallas** | Productos (pestañas Catálogo, Lotes, Ajustes), Importar, Configuración → Módulos |
| **Preparar** | Un archivo CSV/Excel de 10 productos, módulos de variantes, lotes y mermas encendidos |

| # | Tiempo | Qué grabar | Texto en pantalla | VO (ElevenLabs) |
|---|---|---|---|---|
| 1 | 0:00 | Un anaquel con un producto agotado; corte a la tabla con "Stock bajo" | *¿Te enteras cuando ya no hay?* | Enterarte de que se acabó un producto cuando el cliente ya lo pidió <break time="0.3s" /> cuesta una venta. |
| 2 | 0:10 | Tabla de Productos | *Catálogo · Stock · Importar* | En este video vas a dar de alta tu catálogo, controlar tu stock <break time="0.3s" /> y subir tu lista completa desde Excel. |
| 2b | 0:30 | **Cápsula de instalación** (la misma en los 12 videos): Chrome → ⋮ → "Transmitir, guardar y compartir" → **Instalar SYMVORA** resaltado. Tarjeta de YouTube al video 0 | *Instálalo como app* | Antes de empezar: <break time="0.3s" /> si todavía entras desde el navegador, instala Simvora como app. <break time="0.3s" /> Tres puntos, "Transmitir, guardar y compartir", "Instalar Simvora". <break time="0.3s" /> Te dejo el video completo arriba. |
| 3 | 0:45 | **Agregar producto** completo: nombre, precio, costo, unidad, stock, mínimo, código; foto con la cámara | *Margen calculado* | Pulsa "Agregar producto". <break time="0.3s" /> Nombre, precio de venta, costo, unidad, stock actual, stock mínimo y código de barras. <break time="0.5s" /> Con el costo, el sistema te muestra tu margen. Y puedes tomarle foto al producto con la cámara. |
| 4 | 2:05 | Quitar el fondo a la foto del producto | *Fondo blanco en un clic* | Si la foto quedó con un fondo desordenado, el sistema se lo quita y deja tu producto limpio. |
| 5 | 2:45 | Producto marcado como **servicio** | *Se cobra, no descuenta stock* | Si vendes servicios, como copias o reparaciones, márcalo como servicio: <break time="0.3s" /> se cobra, pero no descuenta inventario. |
| 6 | 3:25 | Producto llegando a su mínimo → etiqueta de stock bajo | *Resurte a tiempo* | Cuando un producto llega a su mínimo, aparece como stock bajo, para que lo resurtas antes de que se acabe. |
| 7 | 4:05 | Variantes: crear tallas y colores con stock, precio y código propios | *Talla · Color · Stock propio* | Con variantes encendidas, un producto puede tener tallas y colores. <break time="0.3s" /> Cada combinación lleva su propio stock, su precio y su código. |
| 8 | 5:15 | Pestaña **Lotes**: registrar entrada con caducidad | *Vende primero lo que vence* | Con lotes registras cada entrada con su fecha de caducidad, <break time="0.3s" /> para vender primero lo que vence antes. |
| 9 | 6:05 | Unidad kilogramo / litro / metro; también caja, paquete, par, docena | *Granel y cerrado* | Para granel elige kilogramo, litro o metro. <break time="0.3s" /> Y para lo que se vende cerrado tienes caja, paquete, par y docena. |
| 10 | 6:45 | **Importar** → subir archivo → asignar columnas → códigos repetidos: omitir, actualizar o generar | *De Excel al sistema* | Tu lista en Excel: pulsa "Importar", sube el archivo <break time="0.3s" /> e indica qué columna es el nombre, el precio, el costo y el código. <break time="0.5s" /> Si hay códigos repetidos, tú decides: omitir, actualizar o generar uno nuevo. |
| 11 | 8:15 | Pestaña **Ajustes**: ajuste con motivo; merma | *Quién, cuándo y por qué* | Si al contar el anaquel no coincide con el sistema, registra un ajuste con su motivo. <break time="0.3s" /> Queda guardado quién lo hizo y cuándo. <break time="0.5s" /> Y lo que se echa a perder, regístralo como merma. |
| 12 | 9:25 | Editar precio y stock directo en la tabla | *Sin abrir el producto* | Un truco: puedes cambiar el precio y el stock directo en la tabla, sin abrir el producto. |
| 13 | 9:55 | Lista de precios (botón desde Productos) | *Mayoreo* | Desde aquí también armas tus listas de precios de mayoreo, que luego eliges en el punto de venta. |
| 14 | 10:35 | Selector de sucursal arriba de Productos | **Errores comunes** | Ojo con esto: <break time="0.3s" /> si tienes varias sucursales, el stock que ves depende de la sucursal elegida arriba. <break time="0.3s" /> En "Todas" ves la suma de tu negocio. |
| 15 | 11:05 | Tabla | *Catálogo · Stock · Excel* | Ya sabes dar de alta productos, controlar tu stock e importar desde Excel. |
| 16 | 11:20 | Pantalla final con el video 4 | *Prueba 14 días gratis* | Siguiente video: la caja y el corte del día, sin diferencias. |

**Capítulos**

```
0:00 El producto que se acabó
0:30 Instálalo como app
0:45 Agregar producto y margen
2:05 Foto sin fondo
2:45 Servicios
3:25 Stock mínimo
4:05 Variantes
5:15 Lotes y caducidades
6:05 Granel y unidades
6:45 Importar desde Excel
8:15 Ajustes y mermas
9:25 Edición rápida
9:55 Listas de precios
10:35 Errores comunes
```

**Descripción**

```
Cómo llevar el inventario de tu tienda con SYMVORA: alta de productos, margen, stock mínimo, variantes, caducidades y cómo importar tu lista desde Excel.
Prueba 14 días gratis 👉 https://www.symvora.com.mx

Guía escrita: https://www.symvora.com.mx/es/aprende/productos-e-inventario
```

**Etiquetas:** control de inventario, inventario en excel, inventario tienda de abarrotes, stock mínimo,
caducidades, variantes talla y color, importar productos

**Miniatura:** tabla con la etiqueta roja "Stock bajo" + **"Inventario sin sorpresas"**.

---

## 4 · Caja y finanzas

| Ficha | |
|---|---|
| **Título** | Cómo hacer el corte de caja sin diferencias \| SYMVORA |
| **Duración** | 8–10 min |
| **Para quién** | Dueño y cajeros |
| **Pantallas** | Finanzas |
| **Preparar** | Caja cerrada al inicio; hacer 2–3 ventas a mitad del video |

| # | Tiempo | Qué grabar | Texto en pantalla | VO (ElevenLabs) |
|---|---|---|---|---|
| 1 | 0:00 | Manos contando billetes; corte al corte con diferencia en cero | *¿Te cuadra la caja?* | Contar el dinero al final del día y que no cuadre, <break time="0.3s" /> sin saber por qué. Vamos a acabar con eso. |
| 2 | 0:10 | Pantalla de Finanzas | *Abrir · Movimientos · Corte* | Vas a aprender a abrir tu caja, registrar entradas y salidas, <break time="0.3s" /> y hacer un corte que te diga exactamente qué pasó. |
| 2b | 0:30 | **Cápsula de instalación** (la misma en los 12 videos): Chrome → ⋮ → "Transmitir, guardar y compartir" → **Instalar SYMVORA** resaltado. Tarjeta de YouTube al video 0 | *Instálalo como app* | Antes de empezar: <break time="0.3s" /> si todavía entras desde el navegador, instala Simvora como app. <break time="0.3s" /> Tres puntos, "Transmitir, guardar y compartir", "Instalar Simvora". <break time="0.3s" /> Te dejo el video completo arriba. |
| 3 | 0:45 | **Abrir caja** → fondo inicial; con sucursales, elegir la sucursal | *Fondo inicial* | En Finanzas pulsa "Abrir caja" y escribe el efectivo con el que empiezas. <break time="0.3s" /> Si tienes varias sucursales, elige en cuál abres: todas las ventas del turno se cuentan ahí. |
| 4 | 1:45 | Pasar el cursor sobre el título: "abierta desde…" | *Desde cuándo está abierta* | Arriba ves desde cuándo está abierta tu caja. |
| 5 | 2:05 | **Agregar movimiento**: una entrada (cambio) y una salida (pago a proveedor) con descripción | *Entradas y salidas* | ¿Te trajeron cambio o le pagaste a un proveedor con dinero de la caja? <break time="0.3s" /> Pulsa "Agregar movimiento" y regístralo con su descripción. Así el corte no te sorprende. |
| 6 | 3:15 | Hacer 2 ventas rápidas en el POS; regresar a Finanzas | *Las ventas entran solas* | Cada venta que cobras entra sola a tu caja. |
| 7 | 3:45 | **Cerrar caja**: fondo, ventas, entradas, salidas, saldo esperado | *Saldo esperado* | Al terminar tu turno pulsa "Cerrar caja". <break time="0.3s" /> Ves el fondo inicial, las ventas, las entradas, las salidas <break time="0.3s" /> y cuánto debería haber. |
| 8 | 4:45 | Capturar el saldo real; ver la diferencia (cuadra / falta / sobra) y dejar una nota | *Cuadra · Falta · Sobra* | Cuenta el efectivo y escríbelo. <break time="0.3s" /> El sistema te dice si cuadra, si falta o si sobra, <break time="0.3s" /> y puedes dejar una nota explicando por qué. |
| 9 | 5:55 | El correo del corte en la bandeja del dueño (captura real, sin datos sensibles) | *El dueño se entera* | Si cierra un cajero o un administrador, al dueño le llega un correo con el corte completo, <break time="0.3s" /> y de qué sucursal fue. |
| 10 | 6:35 | Texto en pantalla sobre el cierre automático | *4:30 a.m.* | ¿Y si alguien olvida cerrar? <break time="0.3s" /> El sistema cierra las cajas olvidadas a las cuatro y media de la mañana, hora del centro de México, <break time="0.3s" /> con el saldo esperado, y avisa por correo. |
| 11 | 7:15 | — | **Errores comunes** | Dos cosas que conviene saber. <break time="0.3s" /> Cada usuario ve y cierra solo su propia caja. <break time="0.3s" /> Y las ventas a crédito no suman al efectivo: ese dinero entra cuando registras el abono. |
| 12 | 7:55 | Finanzas | *Abrir · Registrar · Cortar* | Ya sabes abrir caja, registrar movimientos y hacer tu corte. |
| 13 | 8:10 | Pantalla final con el video 5 | *Prueba 14 días gratis* | En el siguiente video: compras y proveedores. |

**Capítulos**

```
0:00 ¿Te cuadra la caja?
0:30 Instálalo como app
0:45 Abrir caja
2:05 Entradas y salidas
3:15 Las ventas entran solas
3:45 Cerrar caja
4:45 Saldo real y diferencia
5:55 Aviso al dueño
6:35 Cierre automático
7:15 Errores comunes
```

**Descripción**

```
Cómo hacer el corte de caja de tu tienda con SYMVORA: abrir caja, registrar entradas y salidas, cerrar con saldo esperado vs. real y recibir el corte por correo.
Prueba 14 días gratis 👉 https://www.symvora.com.mx

Guía escrita: https://www.symvora.com.mx/es/aprende/caja-y-finanzas
```

**Etiquetas:** corte de caja, cómo hacer corte de caja, cuadrar caja, control de caja, apertura y cierre de caja,
caja chica

**Miniatura:** pantalla del corte con la diferencia en $0.00 + **"Caja cuadrada"**.

---

## 5 · Compras y órdenes de compra

| Ficha | |
|---|---|
| **Título** | Cómo registrar compras y pedidos a proveedores \| SYMVORA |
| **Duración** | 8–10 min |
| **Para quién** | Dueño o encargado |
| **Pantallas** | Compras (pestañas Compras y Proveedores), Órdenes de Compra |
| **Preparar** | Un proveedor con teléfono y 2 productos con stock bajo |

| # | Tiempo | Qué grabar | Texto en pantalla | VO (ElevenLabs) |
|---|---|---|---|---|
| 1 | 0:00 | Cajas de mercancía llegando; corte al stock que sube | *Llegó el pedido* | Llega el pedido del proveedor <break time="0.3s" /> y alguien tiene que subir todo al inventario, una por una. O no. |
| 2 | 0:10 | Pantalla de Compras | *Proveedor · Compra · Orden* | Vas a dar de alta proveedores, registrar compras que suben tu inventario <break time="0.3s" /> y mandar pedidos por WhatsApp. |
| 2b | 0:30 | **Cápsula de instalación** (la misma en los 12 videos): Chrome → ⋮ → "Transmitir, guardar y compartir" → **Instalar SYMVORA** resaltado. Tarjeta de YouTube al video 0 | *Instálalo como app* | Antes de empezar: <break time="0.3s" /> si todavía entras desde el navegador, instala Simvora como app. <break time="0.3s" /> Tres puntos, "Transmitir, guardar y compartir", "Instalar Simvora". <break time="0.3s" /> Te dejo el video completo arriba. |
| 3 | 0:45 | Pestaña **Proveedores → Agregar proveedor** | *Sin proveedor no hay compra* | Primero tu proveedor: en la pestaña Proveedores pulsa "Agregar proveedor", con su nombre y teléfono. <break time="0.3s" /> Sin proveedor no se pueden registrar compras. |
| 4 | 1:35 | Pestaña **Compras → Nueva compra**: proveedor, productos, cantidad y costo → guardar | *El stock sube al guardar* | Para una compra directa pulsa "Nueva compra", <break time="0.3s" /> elige el proveedor y agrega los productos con cantidad y costo. <break time="0.5s" /> Al guardar, el stock sube y el costo del producto se actualiza. |
| 5 | 3:05 | Elegir sucursal destino (si hay varias) | *¿A qué local llegó?* | Con varias sucursales, elige a dónde llega la mercancía: el stock sube solo ahí. |
| 6 | 3:35 | Cancelar una compra → el inventario regresa | *¿Te equivocaste?* | ¿Te equivocaste? Cancela la compra y el sistema regresa al inventario lo que había sumado. |
| 7 | 4:15 | **Órdenes de Compra → Nueva orden** → armar pedido → **Crear orden** | *El pedido, por escrito* | Para pedirle a tu proveedor, ve a Órdenes de Compra y pulsa "Nueva orden". <break time="0.3s" /> Arma el pedido con productos y cantidades. |
| 8 | 5:25 | Enviar por WhatsApp con el mensaje ya escrito; descargar PDF | *WhatsApp · PDF* | Si tu proveedor tiene teléfono, mándale el pedido por WhatsApp con el mensaje ya escrito, <break time="0.3s" /> o descárgalo en PDF. |
| 9 | 6:25 | Marcar la orden como recibida y capturar lo que realmente llegó | *Lo que llegó de verdad* | Cuando llegue, marca la orden como recibida y captura lo que realmente llegó. <break time="0.3s" /> En ese momento sube tu inventario. |
| 10 | 7:35 | Tabla de Productos con stock bajo | **Consejo** | Antes de armar tu orden, revisa los productos con stock bajo: ya sabes qué pedir. |
| 11 | 8:05 | Compras | *Proveedor · Compra · Orden* | Ya sabes registrar proveedores, compras y órdenes de compra. |
| 12 | 8:20 | Pantalla final con el video 6 | *Prueba 14 días gratis* | Siguiente video: clientes y ventas a crédito. |

**Capítulos**

```
0:00 Llegó el pedido
0:30 Instálalo como app
0:45 Alta de proveedor
1:35 Compra directa
3:05 Compra por sucursal
3:35 Cancelar una compra
4:15 Orden de compra
5:25 Enviar por WhatsApp y PDF
6:25 Recibir la mercancía
7:35 Consejo
```

**Descripción**

```
Cómo registrar compras y hacer pedidos a tus proveedores con SYMVORA: alta de proveedores, compra directa que sube tu inventario y órdenes de compra por WhatsApp o PDF.
Prueba 14 días gratis 👉 https://www.symvora.com.mx

Guía escrita: https://www.symvora.com.mx/es/aprende/compras-y-ordenes
```

**Etiquetas:** orden de compra, registrar compras, control de proveedores, pedido a proveedor whatsapp,
entrada de mercancía, inventario

**Miniatura:** orden de compra con el botón de WhatsApp + **"Pide por WhatsApp"**.

---

## 6 · Clientes y crédito

| Ficha | |
|---|---|
| **Título** | Cómo llevar el fiado de tus clientes sin libreta \| SYMVORA |
| **Duración** | 6–8 min |
| **Para quién** | Dueño y cajeros |
| **Pantallas** | Configuración → Módulos, Clientes, Punto de Venta |
| **Preparar** | Módulo "Ventas a crédito / fiado" apagado al inicio (para encenderlo en cámara) |

| # | Tiempo | Qué grabar | Texto en pantalla | VO (ElevenLabs) |
|---|---|---|---|---|
| 1 | 0:00 | Una libreta de fiado con nombres tachados | *La libreta del fiado* | La libreta del fiado: <break time="0.3s" /> nombres tachados, sumas a lápiz y la duda de cuánto te deben de verdad. |
| 2 | 0:10 | Pantalla de Clientes | *Clientes · Crédito · Abonos* | En este video vas a registrar clientes, venderles a crédito y llevar sus abonos al centavo. |
| 2b | 0:30 | **Cápsula de instalación** (la misma en los 12 videos): Chrome → ⋮ → "Transmitir, guardar y compartir" → **Instalar SYMVORA** resaltado. Tarjeta de YouTube al video 0 | *Instálalo como app* | Antes de empezar: <break time="0.3s" /> si todavía entras desde el navegador, instala Simvora como app. <break time="0.3s" /> Tres puntos, "Transmitir, guardar y compartir", "Instalar Simvora". <break time="0.3s" /> Te dejo el video completo arriba. |
| 3 | 0:45 | **Configuración → Módulos** → encender "Ventas a crédito / fiado" | *Actívalo una vez* | Primero activa el crédito: en Configuración, Módulos, enciende "Ventas a crédito o fiado". |
| 4 | 1:15 | **Clientes → Agregar cliente** (nombre y contacto); mostrar también el alta desde el POS | *Desde Clientes o al cobrar* | En Clientes pulsa "Agregar cliente" con su nombre y contacto. <break time="0.3s" /> También lo puedes dar de alta desde el punto de venta, al momento de cobrar. |
| 5 | 2:15 | POS: elegir cliente → método **Crédito / Fiado** → completar | *Se suma a su saldo* | Al cobrar, elige al cliente y el método "Crédito o Fiado". <break time="0.3s" /> El importe se suma a su saldo. |
| 6 | 3:15 | Clientes: columna de saldo pendiente | *Lo que te deben, a la vista* | En la tabla de Clientes ves cuánto te debe cada uno. |
| 7 | 3:45 | Botón de abono en la fila → monto y método → el saldo baja | *El abono baja el saldo* | Cuando te pague, usa el botón de abono en su fila, <break time="0.3s" /> escribe el monto y cómo te pagó. Su saldo baja al momento. |
| 8 | 4:55 | Finanzas: el abono en efectivo entra a la caja | **Importante** | Importante: <break time="0.3s" /> la venta a crédito no suma al efectivo de tu caja. El dinero entra cuando registras el abono. |
| 9 | 5:35 | Clientes | *Clientes · Crédito · Abonos* | Ya sabes registrar clientes, fiar y cobrar abonos sin libreta. |
| 10 | 5:50 | Pantalla final con el video 7 | *Prueba 14 días gratis* | En el siguiente video: tu equipo, con usuarios y permisos. |

**Capítulos**

```
0:00 La libreta del fiado
0:30 Instálalo como app
0:45 Activa el crédito
1:15 Alta de clientes
2:15 Vender a crédito
3:15 Saldos pendientes
3:45 Registrar abonos
4:55 El crédito y tu caja
```

**Descripción**

```
Cómo llevar el fiado y los créditos de tus clientes con SYMVORA: alta de clientes, venta a crédito, saldos y abonos, sin libreta.
Prueba 14 días gratis 👉 https://www.symvora.com.mx

Guía escrita: https://www.symvora.com.mx/es/aprende/clientes-y-credito
```

**Etiquetas:** control de fiado, ventas a crédito, cuentas por cobrar tienda, abonos clientes, libreta de fiado

**Miniatura:** libreta tachada vs. la tabla de saldos + **"Adiós libreta del fiado"**.

---

## 7 · Usuarios y permisos

| Ficha | |
|---|---|
| **Título** | Cómo dar acceso a tus empleados (cajeros y admins) \| SYMVORA |
| **Duración** | 8–10 min |
| **Para quién** | Dueño |
| **Pantallas** | Usuarios, pantalla de acceso con clave, Punto de Venta del cajero |
| **Preparar** | Correo de prueba tuyo para el cajero, una ventana de incógnito para entrar como cajero, 2 sucursales |

| # | Tiempo | Qué grabar | Texto en pantalla | VO (ElevenLabs) |
|---|---|---|---|---|
| 1 | 0:00 | Un mostrador con dos personas; corte a la tabla de usuarios con nombres | *¿Quién vendió qué?* | Si todos usan la misma cuenta, <break time="0.3s" /> nunca sabes quién hizo cada venta. |
| 2 | 0:10 | Pantalla de Usuarios | *Invitar · Roles · Permisos* | Vas a invitar a tu equipo, darle a cada quien lo que necesita <break time="0.3s" /> y saber siempre quién hizo qué. |
| 2b | 0:30 | **Cápsula de instalación** (la misma en los 12 videos): Chrome → ⋮ → "Transmitir, guardar y compartir" → **Instalar SYMVORA** resaltado. Tarjeta de YouTube al video 0 | *Instálalo como app* | Antes de empezar: <break time="0.3s" /> si todavía entras desde el navegador, instala Simvora como app. <break time="0.3s" /> Tres puntos, "Transmitir, guardar y compartir", "Instalar Simvora". <break time="0.3s" /> Te dejo el video completo arriba. |
| 3 | 0:45 | **Agregar usuario**: Nombre, Apellido (opcional), correo, rol (Cajero o Administrador), sucursales → **Confirmar** | *Nombre · Correo · Rol* | En Usuarios pulsa "Agregar usuario". <break time="0.3s" /> Escribe su nombre, su correo y elige el rol: cajero o administrador. <break time="0.3s" /> Si tienes varias sucursales, marca en cuáles trabaja. |
| 4 | 1:55 | La clave generada en "Claves de acceso" y el correo que le llega | *Le llega su clave* | Al confirmar, a tu empleado le llega su clave por correo. <break time="0.3s" /> También la ves aquí, por si necesitas compartirla. |
| 5 | 2:35 | Incógnito: acceso → **"¿Eres empleado o colaborador? Ingresa tu clave"** → correo + casillas de la clave → **Ingresar** | *Entra con su clave* | Tu empleado entra desde la pantalla de inicio de sesión, en "¿Eres empleado o colaborador? Ingresa tu clave". <break time="0.3s" /> Escribe su correo y su clave, y listo. |
| 6 | 3:45 | Vista del cajero: POS con "¡Hola, {nombre}!", menú reducido, su tutorial de 9 pasos | *Ve solo lo suyo* | El cajero ve solo lo que necesita: <break time="0.3s" /> punto de venta, productos, clientes, compras y su propia caja. <break time="0.3s" /> Hasta el tutorial se adapta a lo que puede hacer. |
| 7 | 4:55 | De vuelta como dueño: botón de permisos → encender "Reportes" para un encargado | *Permisos por persona* | ¿Tienes un encargado de confianza? <break time="0.3s" /> Con el botón de permisos de cada usuario enciendes módulos solo para esa persona, por ejemplo los reportes. |
| 8 | 6:05 | Botón de sucursales del usuario | *Solo sus locales* | Y con el botón de sucursales lo limitas a los locales donde trabaja. Sin asignación, trabaja en todas. |
| 9 | 6:45 | Lápiz para editar el nombre; cambiar el rol tocando la etiqueta | *Nombre y rol* | Con el lápiz corriges su nombre, <break time="0.3s" /> y tocando su rol lo cambias de cajero a administrador. |
| 10 | 7:25 | Historial de ventas con el nombre del cajero | *Cada venta, con nombre* | Desde ahora, cada venta aparece con el nombre de quien la cobró. |
| 11 | 7:55 | — | **Bueno saber** | Puedes agregar todos los usuarios que necesites, sin costo extra. <break time="0.3s" /> Y solo tú, como dueño, manejas usuarios y suscripción. |
| 12 | 8:25 | Usuarios | *Invitar · Roles · Permisos* | Ya sabes invitar a tu equipo, darle permisos y limitar sus sucursales. |
| 13 | 8:40 | Pantalla final con el video 8 | *Prueba 14 días gratis* | Siguiente video: tus números, en reportes y dashboard. |

**Capítulos**

```
0:00 ¿Quién vendió qué?
0:30 Instálalo como app
0:45 Invita a un empleado
1:55 Su clave de acceso
2:35 Cómo entra tu empleado
3:45 Lo que ve un cajero
4:55 Permisos por persona
6:05 Sucursales por usuario
6:45 Editar nombre y rol
7:25 Ventas con nombre
7:55 Bueno saber
```

**Descripción**

```
Cómo dar acceso a tus empleados en SYMVORA: invitar cajeros y administradores con su clave, permisos por persona y sucursales asignadas. Usuarios ilimitados sin costo extra.
Prueba 14 días gratis 👉 https://www.symvora.com.mx

Guía escrita: https://www.symvora.com.mx/es/aprende/usuarios-y-permisos
```

**Etiquetas:** usuarios punto de venta, permisos empleados, cajero, control de empleados tienda, roles y permisos

**Miniatura:** tabla de usuarios con nombres y roles + **"Cada quien, su acceso"**.

---

## 8 · Reportes y dashboard

| Ficha | |
|---|---|
| **Título** | Cuánto ganas de verdad: reportes de tu tienda \| SYMVORA |
| **Duración** | 6–8 min |
| **Para quién** | Dueño y administradores |
| **Pantallas** | Dashboard, Reportes, historial de ventas |
| **Preparar** | Ventas de varios días, productos con costo capturado, 2 sucursales |

| # | Tiempo | Qué grabar | Texto en pantalla | VO (ElevenLabs) |
|---|---|---|---|---|
| 1 | 0:00 | Dashboard con la tarjeta de ganancia | *Vender ≠ ganar* | Vender mucho no es lo mismo que ganar. <break time="0.3s" /> Aquí ves las dos cosas. |
| 2 | 0:10 | Dashboard completo | *Día · Mes · Ganancia* | En este video vas a leer tu dashboard, filtrar por sucursal y sacar reportes por periodo. |
| 2b | 0:30 | **Cápsula de instalación** (la misma en los 12 videos): Chrome → ⋮ → "Transmitir, guardar y compartir" → **Instalar SYMVORA** resaltado. Tarjeta de YouTube al video 0 | *Instálalo como app* | Antes de empezar: <break time="0.3s" /> si todavía entras desde el navegador, instala Simvora como app. <break time="0.3s" /> Tres puntos, "Transmitir, guardar y compartir", "Instalar Simvora". <break time="0.3s" /> Te dejo el video completo arriba. |
| 3 | 0:45 | Tarjetas: ventas hoy, mes, ganancia, ticket promedio, clientes atendidos, productos vendidos | *Tus números al entrar* | Al entrar ves las ventas de hoy y del mes, tu ganancia, el ticket promedio, <break time="0.3s" /> los clientes atendidos y los productos vendidos. |
| 4 | 1:55 | Señalar "sin costo" en la tarjeta de ganancia | *Captura tus costos* | La ganancia se calcula sin IVA y con el costo de cada producto. <break time="0.3s" /> Si a un producto le falta el costo, el sistema te lo dice para que lo captures. |
| 5 | 2:45 | Filtro de sucursal junto a **Actualizar** | *Un local o todos* | Con varias sucursales, usa el filtro junto a "Actualizar" para ver un local o todos juntos. |
| 6 | 3:25 | **Reportes**: elegir rango de fechas → ventas, más vendidos, métodos de pago | *Por periodo* | En Reportes elige el rango de fechas <break time="0.3s" /> y ves tus ventas, tus productos más vendidos y cómo te pagan tus clientes. |
| 7 | 4:35 | Historial de ventas: abrir una venta → detalle → **Reimprimir ticket** | *Reimprime cualquier ticket* | En el historial de ventas abres cualquier venta, ves quién la cobró <break time="0.3s" /> y puedes reimprimir el ticket. |
| 8 | 5:35 | — | **Bueno saber** | De fábrica, los cajeros no ven el dashboard ni los reportes. <break time="0.3s" /> Si quieres dárselos a un encargado, hazlo desde Usuarios. |
| 9 | 6:05 | Dashboard | *Dashboard · Sucursal · Reportes* | Ya sabes leer tus números y sacar reportes. |
| 10 | 6:20 | Pantalla final con el video 9 | *Prueba 14 días gratis* | Siguiente video: cómo manejar varias sucursales. |

**Capítulos**

```
0:00 Vender no es ganar
0:30 Instálalo como app
0:45 Tu dashboard
1:55 Cómo se calcula la ganancia
2:45 Por sucursal
3:25 Reportes por periodo
4:35 Historial y reimpresión
5:35 Bueno saber
```

**Descripción**

```
Cómo saber cuánto ganas en tu tienda con SYMVORA: dashboard del día y del mes, ganancia real, ticket promedio, reportes por periodo y por sucursal.
Prueba 14 días gratis 👉 https://www.symvora.com.mx

Guía escrita: https://www.symvora.com.mx/es/aprende/reportes-y-dashboard
```

**Etiquetas:** reporte de ventas, cuánto gana mi tienda, ganancia real, ticket promedio, productos más vendidos

**Miniatura:** tarjeta de ganancia del mes + **"¿Cuánto ganas?"**.

---

## 9 · Sucursales

| Ficha | |
|---|---|
| **Título** | Cómo manejar varias sucursales e inventario por local \| SYMVORA |
| **Duración** | 8–10 min |
| **Para quién** | Dueño con dos o más locales (o que planea abrir el segundo) |
| **Pantallas** | Sucursales (resumen, existencias, traspasos), Productos, Finanzas, Usuarios |
| **Preparar** | 2 sucursales con existencias distintas de un mismo producto |

| # | Tiempo | Qué grabar | Texto en pantalla | VO (ElevenLabs) |
|---|---|---|---|---|
| 1 | 0:00 | Dos locales (fotos o video); corte a la comparación entre sucursales | *Dos locales, un sistema* | Abrir tu segundo local no debería significar llevar dos libretas. |
| 2 | 0:10 | Pantalla de Sucursales | *Locales · Existencias · Traspasos* | Vas a dar de alta tus sucursales, ver cuánto hay en cada una y mover mercancía entre ellas. |
| 2b | 0:30 | **Cápsula de instalación** (la misma en los 12 videos): Chrome → ⋮ → "Transmitir, guardar y compartir" → **Instalar SYMVORA** resaltado. Tarjeta de YouTube al video 0 | *Instálalo como app* | Antes de empezar: <break time="0.3s" /> si todavía entras desde el navegador, instala Simvora como app. <break time="0.3s" /> Tres puntos, "Transmitir, guardar y compartir", "Instalar Simvora". <break time="0.3s" /> Te dejo el video completo arriba. |
| 3 | 0:45 | Sucursales con un solo local → alta del segundo | *Tu segunda sucursal* | El módulo Sucursales siempre está en tu menú. <break time="0.3s" /> Con un solo local te invita a dar de alta el segundo. |
| 4 | 1:35 | Comparación entre locales | *Compara tus locales* | Con dos o más, ves la comparación entre locales, las existencias de cada uno y los traspasos. |
| 5 | 2:25 | Productos: cambiar la sucursal arriba; "Todas" suma | *Mismo catálogo, distinto stock* | Tus productos son los mismos para todo el negocio. <break time="0.3s" /> Lo que cambia por sucursal es cuánto hay en cada una. Elige la sucursal arriba para verlo y ajustarlo. |
| 6 | 3:35 | **Traspasos**: origen, destino, productos → enviar; caso en que no alcanza | *O pasa todo o nada* | Para mover mercancía, en Traspasos elige origen, destino y productos. <break time="0.3s" /> O pasa todo o no pasa nada: si en el origen no alcanza, el sistema te dice de qué producto y cuánto queda. |
| 7 | 5:05 | Finanzas: abrir caja eligiendo sucursal; POS con selector de sucursal | *Una caja por local* | Cada sucursal tiene su caja. <break time="0.3s" /> Como dueño puedes tener una caja abierta en cada local, y cada corte cuadra por separado. |
| 8 | 6:05 | Usuarios: asignar sucursales a un cajero | *Cada quien, su local* | Desde Usuarios asignas a cada empleado las sucursales donde trabaja: solo opera y ve esas. |
| 9 | 6:55 | Cerrar una sucursal | *El historial se queda* | Si cierras un local, deja de ofrecerse para vender, pero su historial se conserva. |
| 10 | 7:35 | Sucursales | *Locales · Existencias · Traspasos* | Ya sabes manejar varias sucursales desde un solo sistema. |
| 11 | 7:50 | Pantalla final con el video 10 | *Prueba 14 días gratis* | Siguiente video: la configuración de tu negocio. |

**Capítulos**

```
0:00 Dos locales, un sistema
0:30 Instálalo como app
0:45 Alta de sucursales
1:35 Compara tus locales
2:25 Existencias por sucursal
3:35 Traspasos
5:05 Una caja por local
6:05 Empleados por sucursal
6:55 Cerrar un local
```

**Descripción**

```
Cómo manejar varias sucursales con SYMVORA: inventario por local, traspasos de mercancía, una caja por sucursal y empleados asignados a cada local.
Prueba 14 días gratis 👉 https://www.symvora.com.mx

Guía escrita: https://www.symvora.com.mx/es/aprende/sucursales
```

**Etiquetas:** punto de venta varias sucursales, inventario por sucursal, traspaso de mercancía, multisucursal

**Miniatura:** dos tarjetas de sucursal con una flecha de traspaso + **"2 locales, 1 sistema"**.

---

## 10 · Configuración y métodos de pago

| Ficha | |
|---|---|
| **Título** | Configura tu punto de venta: ticket, módulos y terminal \| SYMVORA |
| **Duración** | 6–8 min |
| **Para quién** | Dueño |
| **Pantallas** | Configuración (General, Módulos, Mercado Pago Point), Mi perfil |
| **Preparar** | Un ticket impreso de antes/después del logo (opcional) |

| # | Tiempo | Qué grabar | Texto en pantalla | VO (ElevenLabs) |
|---|---|---|---|---|
| 1 | 0:00 | Un ticket con el logo del negocio | *Tu ticket, tu marca* | Tu ticket es lo último que tu cliente se lleva de tu tienda. <break time="0.3s" /> Que lleve tu nombre. |
| 2 | 0:10 | Configuración | *General · Módulos · Pagos* | En este video configuras los datos de tu negocio, los módulos que usas y tu terminal de cobro. |
| 2b | 0:30 | **Cápsula de instalación** (la misma en los 12 videos): Chrome → ⋮ → "Transmitir, guardar y compartir" → **Instalar SYMVORA** resaltado. Tarjeta de YouTube al video 0 | *Instálalo como app* | Antes de empezar: <break time="0.3s" /> si todavía entras desde el navegador, instala Simvora como app. <break time="0.3s" /> Tres puntos, "Transmitir, guardar y compartir", "Instalar Simvora". <break time="0.3s" /> Te dejo el video completo arriba. |
| 3 | 0:45 | **General**: nombre comercial, teléfono, dirección, correo y logo | *Sale en tus tickets* | En General captura tu nombre comercial, teléfono, dirección y correo, y sube tu logo. <break time="0.3s" /> Aparecen en tus tickets. |
| 4 | 1:45 | **Módulos**: recorrer cada interruptor y mostrar cómo aparece/desaparece una opción en Productos o el POS | *Muestra solo lo que usas* | En Módulos enciendes lo que tu negocio necesita: <break time="0.3s" /> peso o medida, tallas y colores, caducidades, mermas, servicios y crédito. <break time="0.5s" /> Cada interruptor muestra u oculta sus opciones en todo el sistema, y apagarlo no borra nada. |
| 5 | 3:25 | Pestaña de la terminal → conectar → en el POS aparece "Tarjeta (terminal)" | *Cobra con terminal* | Si tienes terminal de cobro, conéctala aquí <break time="0.3s" /> y en el punto de venta podrás cobrar con el método "Tarjeta, terminal". |
| 6 | 4:35 | Impresora de tickets: configuración desde el POS (USB o Bluetooth) | *Impresora térmica* | ¿Impresora de tickets? Conéctala por USB o Bluetooth y el ticket sale directo, con tu descuento y tu logo. |
| 7 | 5:25 | Mi perfil: nombre, celular, contraseña (dueño) | *Tu perfil* | Y en Mi perfil actualizas tu nombre, tu celular y tu contraseña. |
| 8 | 5:55 | Configuración | *General · Módulos · Pagos* | Tu negocio ya está configurado a tu medida. |
| 9 | 6:10 | Pantalla final con el video 11 | *Prueba 14 días gratis* | Siguiente video: la bitácora, para saber quién hizo qué. |

**Capítulos**

```
0:00 Tu ticket, tu marca
0:30 Instálalo como app
0:45 Datos del negocio
1:45 Módulos
3:25 Terminal de cobro
4:35 Impresora de tickets
5:25 Mi perfil
```

**Descripción**

```
Cómo configurar SYMVORA: datos y logo para tus tickets, módulos que se adaptan a tu giro, terminal de cobro e impresora térmica.
Prueba 14 días gratis 👉 https://www.symvora.com.mx

Guía escrita: https://www.symvora.com.mx/es/aprende/configuracion
```

**Etiquetas:** configurar punto de venta, ticket con logo, impresora térmica, terminal punto de venta

**Miniatura:** el panel de módulos con interruptores + **"A la medida de tu giro"**.

---

## 11 · Bitácora

| Ficha | |
|---|---|
| **Título** | Quién hizo qué en tu tienda: la bitácora \| SYMVORA |
| **Duración** | 4–6 min |
| **Para quién** | Dueño y administradores |
| **Pantallas** | Bitácora, Usuarios |
| **Preparar** | Actividad reciente: un producto editado, una venta, un ajuste, un corte |

| # | Tiempo | Qué grabar | Texto en pantalla | VO (ElevenLabs) |
|---|---|---|---|---|
| 1 | 0:00 | Un precio cambiado en Productos; corte a la bitácora mostrando quién lo cambió | *¿Quién cambió el precio?* | ¿Alguien cambió un precio y nadie sabe quién? <break time="0.3s" /> La bitácora sí sabe. |
| 2 | 0:10 | Bitácora | *Qué · Quién · Cuándo* | En este video vas a revisar todo lo que pasa en tu negocio, con nombre y hora. |
| 2b | 0:30 | **Cápsula de instalación** (la misma en los 12 videos): Chrome → ⋮ → "Transmitir, guardar y compartir" → **Instalar SYMVORA** resaltado. Tarjeta de YouTube al video 0 | *Instálalo como app* | Antes de empezar: <break time="0.3s" /> si todavía entras desde el navegador, instala Simvora como app. <break time="0.3s" /> Tres puntos, "Transmitir, guardar y compartir", "Instalar Simvora". <break time="0.3s" /> Te dejo el video completo arriba. |
| 3 | 0:45 | Recorrer la lista: altas, ediciones y eliminaciones de productos, ventas, cajas, compras, traspasos y usuarios | *Todo queda registrado* | Aquí queda registrado cada alta, cambio o eliminación: <break time="0.3s" /> productos, ventas, cajas, compras, traspasos y usuarios, <break time="0.3s" /> con quién lo hizo y cuándo. |
| 4 | 1:55 | Filtro por módulo | *Filtra por módulo* | Usa el filtro para ver solo productos, solo ventas, solo cajas o el módulo que te interese. |
| 5 | 2:45 | Usuarios → permisos → conceder Bitácora a un encargado | *Compártela con quien confíes* | De fábrica la ven tú y tus administradores. <break time="0.3s" /> Si quieres, se la concedes a un encargado desde Usuarios. |
| 6 | 3:35 | Bitácora | *Qué · Quién · Cuándo* | Ya sabes revisar quién hizo qué, y cuándo. |
| 7 | 3:50 | Pantalla final con el video 12 | *Prueba 14 días gratis* | Último video de la serie: tu suscripción. |

**Capítulos**

```
0:00 ¿Quién cambió el precio?
0:30 Instálalo como app
0:45 Qué se registra
1:55 Filtrar por módulo
2:45 Quién la puede ver
```

**Descripción**

```
La bitácora de SYMVORA registra quién creó, editó o eliminó productos, ventas, cajas, compras y usuarios, y cuándo.
Prueba 14 días gratis 👉 https://www.symvora.com.mx

Guía escrita: https://www.symvora.com.mx/es/aprende/bitacora
```

**Etiquetas:** bitácora de cambios, control de empleados, auditoría punto de venta, historial de cambios

**Miniatura:** una fila de la bitácora con nombre y hora resaltados + **"¿Quién fue?"**.

---

## 12 · Suscripción

| Ficha | |
|---|---|
| **Título** | Prueba gratis, planes y pagos de SYMVORA explicados |
| **Duración** | 5–7 min |
| **Para quién** | Dueño que está por terminar la prueba o quiere pagar |
| **Pantallas** | Suscripción |
| **Preparar** | Grabar la pantalla de Suscripción de una cuenta en prueba (por ejemplo, la cuenta "testr"), **sin completar ningún pago** |

| # | Tiempo | Qué grabar | Texto en pantalla | VO (ElevenLabs) |
|---|---|---|---|---|
| 1 | 0:00 | Suscripción con "Tu prueba termina en N días" | *¿Y después de la prueba?* | Tus catorce días de prueba se acaban. <break time="0.3s" /> Esto es lo que pasa, y cómo seguir sin perder nada. |
| 2 | 0:10 | Suscripción | *Prueba · Planes · Pago* | En este video vemos la prueba gratis, los planes y las formas de pago. |
| 2b | 0:30 | **Cápsula de instalación** (la misma en los 12 videos): Chrome → ⋮ → "Transmitir, guardar y compartir" → **Instalar SYMVORA** resaltado. Tarjeta de YouTube al video 0 | *Instálalo como app* | Antes de empezar: <break time="0.3s" /> si todavía entras desde el navegador, instala Simvora como app. <break time="0.3s" /> Tres puntos, "Transmitir, guardar y compartir", "Instalar Simvora". <break time="0.3s" /> Te dejo el video completo arriba. |
| 3 | 0:45 | Contador de días; el aviso del panel los últimos 3 días | *14 días completos* | Tu cuenta empieza con catorce días de prueba con todas las funciones. <break time="0.3s" /> En Suscripción ves cuántos te quedan, y los últimos tres días te avisamos en tu panel y por correo. |
| 4 | 1:35 | Planes mensual y anual | *$399/mes · $3,588/año* | El plan mensual cuesta trescientos noventa y nueve pesos. <break time="0.3s" /> El anual, tres mil quinientos ochenta y ocho, <break time="0.3s" /> que sale a doscientos noventa y nueve al mes. |
| 5 | 2:35 | **Pagar con tarjeta** (sin completar) | *Cobro automático* | "Pagar con tarjeta" activa el cobro automático: tu tarjeta se carga sola cada periodo. |
| 6 | 3:05 | **Pagar en efectivo en tienda** (sin completar) | *Pago único* | "Pagar en efectivo en tienda" genera un pago único. <break time="0.3s" /> No se renueva solo: tendrás que volver a pagar cada periodo. |
| 7 | 3:45 | Estado de suscripción: último pago y próximo cobro | *Tus fechas* | En Estado de suscripción ves tu último pago y tu próximo cobro. |
| 8 | 4:15 | Texto en pantalla (sin grabar una cuenta vencida real) | *Nada se borra* | ¿Y si no pagas a tiempo? <break time="0.3s" /> Tu cuenta queda en solo lectura: puedes entrar, ver y descargar tu información, pero no vender ni editar. <break time="0.5s" /> En cuanto pagas, todo regresa tal como lo dejaste. |
| 9 | 5:05 | Botón de cancelar (sin pulsarlo) | *Cancela cuando quieras* | Y puedes cancelar cuando quieras desde aquí. Tus datos se conservan. |
| 10 | 5:35 | Suscripción | *Prueba · Planes · Pago* | Eso es todo sobre tu suscripción. |
| 11 | 5:50 | Lista de reproducción completa | *Toda la serie* | Con esto terminas la serie. <break time="0.3s" /> Si te quedó una duda, déjala en los comentarios: la contesto. Y si no lo has probado, son catorce días gratis, sin tarjeta. |

**Capítulos**

```
0:00 ¿Y después de la prueba?
0:30 Instálalo como app
0:45 La prueba gratis
1:35 Planes y precios
2:35 Pago con tarjeta
3:05 Pago en efectivo
3:45 Tus fechas
4:15 Si no pagas a tiempo
5:05 Cancelar
```

**Descripción**

```
Todo sobre la suscripción de SYMVORA: 14 días gratis sin tarjeta, plan mensual de $399 o anual de $3,588, pago con tarjeta o en efectivo, y qué pasa si no pagas a tiempo.
Prueba 14 días gratis 👉 https://www.symvora.com.mx

Guía escrita: https://www.symvora.com.mx/es/aprende/suscripcion
```

**Etiquetas:** precio punto de venta, sistema punto de venta precio, punto de venta mensual, prueba gratis POS

**Miniatura:** los dos planes lado a lado + **"$399 al mes, sin sorpresas"**.

---

## Anexos

### Glosario de pronunciación para ElevenLabs

Escribe en la VO la forma de la columna derecha; en pantalla sí puede ir la sigla.

| En pantalla | En la VO |
|---|---|
| SYMVORA | Simvora |
| PWA | (no la nombres: "como app") |
| app.symvora.com.mx | app punto symvora punto com punto em equis |
| POS | punto de venta |
| IVA | i va |
| SKU | código del producto |
| ESC/POS | impresora térmica |
| SPEI | transferencia |
| OXXO | Oxxo |
| PhotoRoom | (no lo nombres: "el sistema le quita el fondo") |
| symvora.com.mx | symvora punto com punto em equis |
| $399 | trescientos noventa y nueve pesos |
| $3,588 | tres mil quinientos ochenta y ocho pesos |
| 0.750 kg | cero punto setecientos cincuenta kilos |
| 4:30 a. m. | cuatro y media de la mañana |

### Checklist antes de publicar cada video

- [ ] Sin CFDI, SAT, facturación ni "sin conexión" en voz o pantalla.
- [ ] Sin correos, teléfonos o datos reales visibles (difumina si se coló alguno).
- [ ] Subtítulos revisados (nombres de botones bien escritos).
- [ ] Capítulos en la descripción (el primero en `0:00`).
- [ ] Miniatura con texto de máximo 4 palabras, legible en celular.
- [ ] Pantalla final con el siguiente video y botón de suscribirse (últimos 20 s).
- [ ] Cápsula de instalación en 0:30–0:45 y su tarjeta de YouTube enlazando al video 0.
- [ ] Agregado a la lista de reproducción "Aprende SYMVORA".
- [ ] Comentario fijado con el link de prueba y el de la guía escrita.
- [ ] **Pegar la URL del video en `videoYoutube` de su guía** en `src/features/marketing/aprende.ts`: la página
      `/es/aprende/<guía>` lo muestra solo (acepta la URL tal cual la copias de YouTube).

### Shorts que salen de cada video

Corta estos momentos en 9:16 (20–40 s) con subtítulos; mismos estándares de [`social-reels.md`](social-reels.md).

| Video | Short | Momento |
|---|---|---|
| 1 | "Tu primera venta en 60 segundos" | Escenas 11–13 |
| 2 | "Escanea con tu celular, sin lector" | Escena 11 |
| 2 | "El mayoreo que regresa solo a precio normal" | Escena 7 |
| 3 | "De Excel al sistema en un minuto" | Escena 10 |
| 3 | "Fondo blanco a tu producto en un clic" | Escena 4 |
| 4 | "Corte de caja: cuadra, falta o sobra" | Escenas 7–8 |
| 5 | "Pide a tu proveedor por WhatsApp" | Escena 8 |
| 6 | "Adiós libreta del fiado" | Escenas 5–7 |
| 7 | "Tu empleado entra con su clave" | Escena 5 |
| 8 | "Vender no es ganar" | Escenas 3–4 |
| 9 | "Traspaso entre sucursales" | Escena 6 |
| 11 | "¿Quién cambió el precio?" | Escenas 1–3 |
