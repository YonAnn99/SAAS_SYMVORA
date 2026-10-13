# Script de venta en frío cara a cara — SYMVORA

> **Para qué:** visitar negocios sin cita (abarrotes, farmacias, ferreterías, tiendas de ropa…) y salir con el
> dueño **probando SYMVORA en su propio celular**. La meta de la primera visita no es cobrar: es que cree su cuenta
> (14 días gratis, sin tarjeta) o que acepte una segunda visita con fecha.
>
> **Regla de oro: solo se promete lo que el sistema hace HOY.** Lo que hace está en las guías de Aprende
> (`src/features/marketing/aprende.ts`, www.symvora.com.mx/es/aprende). Hoy **NO**:
> - timbra facturas (CFDI);
> - funciona sin internet;
> - manda avisos por WhatsApp o SMS (los avisos llegan en la campana y por correo).
>
> Una promesa falsa cierra una venta y pierde un cliente; además, en un barrio todos se conocen.
>
> **Precios** (fuente única: `src/lib/pricing.ts`, verificados el 2026-10-12):
> - $399 al mes, o $3,588 al año (sale a $299 al mes).
> - **Promoción de lanzamiento:** los primeros 3 meses a $199 (50 % de descuento), solo en el plan mensual.
>   ⚠️ Antes de salir, revisa que siga activa (`PROMO_LANZAMIENTO.activa`).

---

## Índice
1. [Antes de salir](#1-antes-de-salir)
2. [La visita en 5 minutos](#2-la-visita-en-5-minutos)
3. [Preguntas para encontrar el dolor](#3-preguntas-para-encontrar-el-dolor)
4. [Adapta la demo al giro](#4-adapta-la-demo-al-giro)
5. [Objeciones y respuestas](#5-objeciones-y-respuestas)
6. [Cierres](#6-cierres)
7. [Seguimiento](#7-seguimiento)
8. [Registro de visitas](#8-registro-de-visitas)
9. [Hoja de bolsillo](#9-hoja-de-bolsillo)

---

## 1. Antes de salir

**Qué llevar**
- Tu celular con batería y datos, y una cuenta de prueba **con productos y fotos** ya cargados. Con la tienda vacía
  no se vende nada. La alternativa es la demo: «Probar demo» en symvora.com.mx crea un negocio de ejemplo en
  segundos, sin registrarse.
- Si puedes, una tablet: en pantalla grande se ve como un punto de venta de verdad.
- Tarjetas de presentación o un volante con un QR a symvora.com.mx.
- Esta hoja y la tabla de registro (sección 8).

**Cuándo visitar**
- En las horas sin clientes: media mañana (10:00–12:00) o media tarde (16:00–18:00).
- Nunca en la hora pico, en la quincena ni cuando haya fila. Si entras y hay clientes, compra algo, pregunta a qué
  hora está más tranquilo y regresa.

**A quién hablarle**
- Al **dueño o a la dueña**: es quien decide y quien sufre la caja que no cuadra.
- Si te atiende un empleado: «¿A qué hora puedo encontrar al dueño? Es algo para su negocio, no vendo
  mercancía». Anota el nombre del dueño y la hora.

**Tu postura**
- Vienes a **ayudar a ordenar su negocio**, no a «vender un software».
- Hablas poco, preguntas mucho y enseñas en el celular en vez de explicar.
- Tutea si el ambiente es relajado. Si el dueño es mayor o formal, háblale de usted desde el principio.

---

## 2. La visita en 5 minutos

### Paso 1 · Apertura (10 segundos)
Entra, saluda y respeta su tiempo. Si es tienda, compra algo pequeño: ya eres cliente, no un vendedor más.

> «¡Buenas tardes! Me llamo **[tu nombre]**, soy de SYMVORA, un sistema de punto de venta para negocios como el
> tuyo, pensado para negocios en México. No vengo a venderte mercancía. ¿Me regalas dos minutos? Si no te sirve, me voy y no
> te quito más tiempo.»

Si dice que no: «Va, sin problema. ¿A qué hora te queda mejor, mañana a esta hora o en la tarde?». Anótalo y
vete con una sonrisa.

### Paso 2 · Diagnóstico (1 minuto)
**No enseñes nada todavía.** Pregunta y escucha. Elige 2 o 3 preguntas de la sección 3 según lo que veas: una
libreta en el mostrador, una calculadora, anaqueles con productos que caducan, ropa con tallas…

> «Oye, una pregunta: ¿cómo llevas hoy tus ventas, en libreta, en la caja registradora o con algún sistema?»
>
> «¿Y al final del día cómo sabes si la caja te cuadró?»

### Paso 3 · Repite el dolor (15 segundos)
Repite con sus palabras lo que te dijo. Es lo que más convence, porque oye que lo entendiste.

> «O sea que, si entendí bien, el fiado lo llevas en la libreta y a veces no sabes bien quién te debe cuánto,
> ¿cierto?»

Espera el «sí». Sin dolor confirmado no hay demo: vuelve a preguntar.

### Paso 4 · Mini demo en tu celular (60–90 segundos)
Enseña **solo lo que resuelve su dolor**. El recorrido base:

1. **Escanea un producto con la cámara** («Escanear productos»): entra al carrito con su precio.
   > «¿Ves? Sin lector, con la cámara del celular. Si después quieres lector, sirve cualquiera de los comunes.»
2. **Cobra** en efectivo: toca un monto rápido y desliza «Desliza para cobrar». Se ve el cambio.
   > «Te calcula el cambio y ya se descontó del inventario.»
3. **Enseña la respuesta a SU dolor**: la caja, el fiado, el stock bajo, las caducidades… Ver sección 4.
   > «Y en la noche, al cerrar caja, te dice cuánto debería haber y cuánto contaste. Si falta, lo ves al momento.»

Luego **dale el celular**: que escanee algo de su propio anaquel y cobre. Que lo toque él vale más que cualquier
explicación.

### Paso 5 · Oferta y cierre (1 minuto)
> «Lo puedes usar **14 días gratis, completo, sin tarjeta**. Si te sirve, son $399 al mes, y ahorita hay una
> promoción de lanzamiento: los primeros 3 meses a $199. Sin comisiones por venta y con los usuarios que quieras.
> ¿Te la dejo creada de una vez? Son dos minutos, con tu celular.»

Si dice que sí, **créala con él, en su celular**:
- symvora.com.mx → «Prueba gratis».
- Captura su nombre, celular, negocio y giro, o entra con su cuenta de Google.

Antes de irte, déjale **5 productos dados de alta** y enséñale a abrir la caja.

### Paso 6 · Siguiente paso concreto
Nunca te vayas con un «luego te busco». Siempre con fecha:

> «Te escribo mañana por WhatsApp para ver cómo vas, y el **[día]** paso a cargar contigo el resto de tus
> productos. ¿Te queda bien a esta misma hora?»

---

## 3. Preguntas para encontrar el dolor

Elige según lo que veas. **Abiertas primero**, después las que miden cuánto le cuesta el problema.

| Dolor | Pregunta abierta | Pregunta que mide | Qué enseñar |
|---|---|---|---|
| **Fiado / crédito** | «¿Fías? ¿Cómo llevas quién te debe?» | «¿Alguna vez se te ha olvidado cobrar a alguien o te han dicho que ya te pagaron?» | Venta con «Crédito / Fiado», saldo por cliente y «Registrar abono» |
| **Caja que no cuadra** | «¿Cómo haces tu corte al final del día?» | «¿Cuánto te ha faltado en una semana mala?» | Abrir caja, corte con saldo esperado contra contado y la diferencia |
| **No sabe qué se acaba** | «¿Cómo sabes qué te falta pedir al proveedor?» | «¿Cuántas veces te ha pasado que un cliente pide algo y ya no hay?» | Stock mínimo, «Stock bajo», la campana y el correo de aviso |
| **Empleados** | «¿Te ayuda alguien en el mostrador?» | «Cuando no estás, ¿cómo sabes cuánto se vendió?» | Usuarios ilimitados con clave de empleado, cada venta con quién la hizo, aviso de corte al dueño |
| **Ganancia** | «¿Sabes cuánto le ganas a cada producto?» | «¿Y al mes, cuánto te queda limpio de lo que vendes?» | Reportes: ganancia sobre productos y lo que más deja |
| **Varias sucursales** | «¿Tienes otro local?» | «¿Cómo mueves mercancía de uno a otro y cómo sabes cuánto hay en cada uno?» | Existencias por sucursal, traspasos y reportes por sucursal |
| **Caducidades** | «¿Se te llega a caducar mercancía?» | «¿Cuánto tiras al mes por caducado?» | Lotes con caducidad: se vende primero lo que vence antes, aviso 15 días antes y no deja vender lo caducado |
| **Lentitud en la fila** | «¿En la hora pico se te hace fila?» | «¿Se te ha ido algún cliente por esperar?» | Escanear y cobrar deslizando, en segundos |

**Escucha más de lo que hablas.** Si el dueño se queja de algo que no está en la tabla, anótalo y no inventes que
el sistema lo resuelve.

---

## 4. Adapta la demo al giro

| Giro | Gancho de apertura | Lo que enseñas en la demo |
|---|---|---|
| **Abarrotes, miscelánea, cremería** | «¿El fiado lo sigues llevando en libreta?» | Escanear refrescos y botanas, fiado con saldo y abonos, stock bajo, corte de caja |
| **Verdulería, carnicería, dulcería a granel** | «¿Cómo calculas cuando te piden $50 de jitomate?» | «¿Cuánto?»: por kilo o por importe ($50 → 0.278 kg), atajos ¼ y ½, mermas |
| **Farmacia, veterinaria** | «¿Cómo controlas las caducidades?» | Lotes y caducidades, aviso «Por caducar», bloqueo de lo caducado. En veterinaria, servicios (consulta, vacuna) que descuentan sus insumos solos |
| **Ropa, zapatería** | «¿Cómo sabes qué tallas te quedan de cada modelo?» | Producto con variantes (talla, color), cada una con su stock, foto y precio |
| **Ferretería, refaccionaria, papelería** | «¿Cuántos productos manejas? ¿Los tienes en Excel?» | «Importar catálogo» desde Excel, búsqueda rápida, lista de precios de mayoreo |
| **Mascotas, cosméticos, regalos, florería** | «¿Tienes clientes que vienen cada semana?» | Tarjetas de lealtad: sellos en el celular del cliente y premio al completarlos |
| **Cualquiera con empleados** | «Cuando no estás, ¿quién cobra?» | Usuarios ilimitados, ventas por cajero y aviso de corte de caja al dueño |
| **Cualquiera con 2+ locales** | «¿Cómo sabes cuánto hay en cada local?» | Existencias por sucursal y traspasos |

> **Tip:** antes de la ruta, carga en tu cuenta de prueba 5 o 6 productos típicos de los giros que vas a visitar
> (un refresco, un kilo de tortilla, un medicamento con lote, una playera con tallas). La demo se siente suya.

---

## 5. Objeciones y respuestas

Fórmula: **reconoce → responde corto → regresa con una pregunta.** Nunca discutas.

**«Ya tengo sistema.»**
> «Qué bueno, entonces ya sabes lo que vale. ¿Qué es lo que más te gusta del que tienes? ¿Y qué le cambiarías?»

Si menciona algo que SYMVORA hace mejor (precio, usuarios, celular, fiado), enséñalo. Si está contento: «Perfecto,
te dejo mi tarjeta por si algún día lo quieres comparar». Retírate bien: te recomendará.

**«Uso libreta y me funciona.»**
> «La libreta funciona, sí. La pregunta es cuánto te cuesta lo que no anota: el fiado que se olvida, lo que falta en
> la caja, el producto que se acabó y no pediste. ¿Cuánto crees que se te va en un mes?»

**«Está caro.» / «No tengo para eso.»**
> «Te entiendo. Son $399 al mes, unos $13 al día, menos que un refresco, y ahorita los primeros 3 meses están a
> $199. Si en un mes te ayuda a cobrar un fiado olvidado o a que no te falte dinero en la caja, ya se pagó. Además,
> los 14 días son gratis y sin tarjeta: pruébalo y decide con números.»

Si paga anual: $3,588, que sale a $299 al mes. Ofrécelo solo si el dueño pregunta por un descuento a largo plazo.

**«No sé de computadoras.» / «Soy malo para eso.»**
> «No necesitas computadora: es como usar WhatsApp. Mira, cóbralo tú.» *(Dale el celular.)*
> «¿Viste? Además, en la página hay guías y videos de cada cosa, y yo vengo a dejártelo listo.»

**«No tengo computadora ni lector.»**
> «No los necesitas para empezar. Funciona en tu celular o en una tablet, y la cámara lee los códigos. Si después
> quieres lector, sirve cualquiera de los comunes que se conectan por USB.»

**«¿Y si se va el internet?»** *(Respuesta honesta: hoy necesita internet.)*
> «Necesita internet, sí. Pero los datos de tu celular bastan: si se va el internet del local, compartes datos del
> celular y sigues cobrando.»

**No digas que funciona sin conexión.**

**«¿Me da factura?» / «¿Timbra?»** *(Respuesta honesta.)*
> «Hoy no timbra facturas. Te da tus tickets, tu control de ventas, de inventario y de caja. Si alguien te pide
> factura, la sigues haciendo como hasta ahora.»

**«Déjame pensarlo.»**
> «Claro. Para que lo pienses con algo en la mano: ¿te la dejo creada? Son 14 días gratis y sin tarjeta, y si no te
> convence simplemente no pagas. ¿Qué es lo que te hace dudar?»

Escucha la duda real: casi siempre es precio, tiempo o miedo a no saber usarlo.

**«Ahorita no tengo tiempo.»**
> «Va, no te quito más. ¿Qué día a esta hora te queda bien para pasar 15 minutos y dejarte tus productos
> cargados?»

Agenda con fecha y hora y anótalo.

**«¿Qué pasa con mis datos? ¿Quién los ve?»**
> «Tus datos son tuyos: cada negocio solo ve lo suyo, y tus empleados entran con su propia clave y solo ven lo que tú
> les permites. Tu catálogo lo puedes descargar en CSV o PDF cuando quieras.»

**«¿Y si quiero cancelar?»**
> «Cancelas cuando quieras desde el mismo sistema, sin llamar a nadie ni pagar penalización. Sigues usándolo hasta
> que termine el mes que pagaste, y tu información se conserva.»

**«¿Cobran comisión por venta?»**
> «No. Pagas la mensualidad y ya: sin comisión por venta, sin límite de productos ni de usuarios.»

**«¿Con qué terminal cobro tarjeta?»**
> «Con la que ya tengas (la de tu banco, Clip, Getnet…): la registras en el sistema y la venta queda anotada como
> tarjeta. O conectas una Mercado Pago Point y el cobro se manda directo desde el punto de venta.»

---

## 6. Cierres

Usa **uno**, el que encaje con la conversación. Después de preguntar, **cállate** y espera la respuesta.

- **Alternativo** (no preguntes «sí o no», pregunta «cuál»):
  > «¿Empezamos con los 10 productos que más vendes, o tienes tu lista en Excel y la subimos completa?»
- **Sin riesgo:**
  > «Son 14 días gratis y sin tarjeta. Lo peor que puede pasar es que no te guste y no pagues nada. ¿La creamos?»
- **Promoción** (verifica antes que siga activa):
  > «La promoción de los 3 meses a $199 es de lanzamiento. Si arrancas la prueba hoy, te toca.»
- **Por el dolor:**
  > «Me dijiste que el fiado se te pierde. Hoy mismo puedes dar de alta a tus clientes que te deben y empezar a
  > llevar sus abonos aquí. ¿Arrancamos con ellos?»
- **Segunda visita** (si no hay tiempo hoy):
  > «Te propongo esto: el jueves a las 11 vengo, la creamos juntos y te dejo tus productos cargados. ¿Te late?»

**Si dice que sí**, antes de irte deja hecho esto:
1. La cuenta creada en **su** celular, con su giro.
2. Unos productos dados de alta, o el Excel listo para importar.
3. La caja abierta y una venta de prueba cobrada.
4. Tu número guardado en su WhatsApp.

---

## 7. Seguimiento

La venta se cierra en el seguimiento, no en la visita. Ponte los recordatorios en el momento.

**El mismo día, por WhatsApp** (si creó su cuenta):
> «¡Hola [nombre]! Soy [tu nombre] de SYMVORA, gracias por tu tiempo hoy en [negocio]. Aquí tienes las guías por si
> se te ofrece algo: symvora.com.mx/es/aprende. Cualquier duda me escribes. El [día] paso como quedamos para
> cargar tus productos 🙌»

**El mismo día** (si no la creó):
> «¡Hola [nombre]! Soy [tu nombre] de SYMVORA, gracias por recibirme. Si quieres verlo con calma, aquí puedes probar
> la demo sin registrarte: symvora.com.mx (botón «Probar demo»). Paso el [día] como quedamos.»

**Día 3 de la prueba:**
> «¡Hola [nombre]! ¿Cómo vas con SYMVORA? ¿Ya hiciste tu primer corte de caja? Si quieres, paso 15 minutos y
> cargamos lo que falte.»

**Día 12 de la prueba** (2 días antes de que termine):
> «¡Hola [nombre]! Tu prueba termina en 2 días. ¿Te ha servido? Si quieres seguir, la promoción de los 3 meses a
> $199 sigue en pie. Te ayudo a activarla en un minuto desde Suscripción.»

**Si no contesta:** un solo mensaje más a los 3 días, y una visita en persona. Después de eso, sigue con otro
negocio: siempre con buena cara, porque el barrio habla.

---

## 8. Registro de visitas

Copia esta tabla en una hoja de cálculo o en tu libreta. Al final de la semana revisa qué giro y qué dolor
convierten más, y enfoca tu ruta ahí.

| Fecha | Negocio | Giro | Dueño / contacto | Dolor principal | Resultado | Siguiente paso | Fecha siguiente |
|---|---|---|---|---|---|---|---|
| 2026-10-13 | Abarrotes Lupita | Abarrotes | Lupita · 55 0000 0000 | Fiado en libreta | Creó cuenta | Cargar productos | 2026-10-15 11:00 |
| | | | | | | | |

**Resultados posibles:** No estaba · No interesado · Agendó visita · Probó demo · Creó cuenta · Pagó.

**Números a vigilar cada semana:**
- Visitas hechas.
- Conversaciones con dueño.
- Cuentas creadas.
- Clientes que pagaron.

Una meta razonable para empezar: de cada 10 dueños con los que hablas, que 3 creen su cuenta y que 1 pague.

---

## 9. Hoja de bolsillo

> **Antes de entrar:** ¿hay clientes? Regresa luego. ¿Está el dueño? Pregunta su nombre.

1. **Abre** (10 s): nombre, «SYMVORA, sistema para negocios como el tuyo, no vendo mercancía, ¿dos minutos?».
2. **Pregunta** (1 min): «¿Cómo llevas tus ventas? ¿Te cuadra la caja? ¿Fías? ¿Sabes qué se te acaba?».
3. **Repite su dolor** y espera el «sí».
4. **Demo** (90 s): escanea con la cámara → cobra deslizando → enseña SU dolor → **dale el celular**.
5. **Oferta:** 14 días gratis, sin tarjeta · $399/mes · promo de 3 meses a $199 · sin comisiones · usuarios
   ilimitados.
6. **Cierra:** «¿Empezamos con tus 10 productos más vendidos o con tu Excel?», y **cállate**.
7. **Siguiente paso con fecha.** WhatsApp el mismo día.

**Nunca prometas:** facturas, que funcione sin internet, ni avisos por WhatsApp. Si no sabes algo: «No te quiero
decir algo que no es; lo checo y te escribo hoy».
