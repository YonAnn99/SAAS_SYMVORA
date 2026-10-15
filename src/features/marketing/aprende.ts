import {
  ArrowRightLeft,
  Bell,
  BookOpen,
  CalendarClock,
  ChartColumn,
  ClipboardList,
  CreditCard,
  Package,
  Rocket,
  Settings,
  ShoppingCart,
  Stamp,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * "Aprende": guias publicas de uso de SYMVORA, una por modulo, en
 * /es/aprende/[slug]. Tambien se abren desde el sistema (boton "Aprende" junto
 * a "Ver tutorial"), en la guia del modulo donde esta el usuario.
 *
 * FUENTE UNICA: el indice, cada pagina, el sitemap, el enlace del sistema y los
 * tests leen de aqui.
 *
 * ⚠️ SOLO SE DOCUMENTA LO QUE EXISTE HOY. Nada de facturacion (el modulo CFDI
 * esta apagado). Una guia que describe un boton que no esta hace perder mas
 * confianza que no tener guia. `aprende.test.ts` vigila las palabras prohibidas.
 * Las etiquetas entre «» son las que ve el usuario en pantalla: si cambian en
 * el sistema, cambian aqui (revision completa del 2026-10-12).
 *
 * VIDEO: pega en `videoYoutube` la URL tal cual la copias de YouTube (watch,
 * youtu.be, shorts o embed). `idYoutube` la entiende; si no es valida, la guia
 * se muestra sin video.
 *
 * CAPTURAS: `captura.src` es la ruta dentro de /public (por ejemplo
 * "/aprende/punto-de-venta/cobrar.webp"), con su tamaño real en pixeles: una
 * ventana pequeña se muestra a su tamaño, sin estirarse. Si no hay, el paso va
 * sin imagen. Una captura que ya no coincide con la pantalla se quita.
 */

export interface CapturaGuia {
  src: string;
  ancho: number;
  alto: number;
}

export interface PasoGuia {
  titulo: string;
  texto: string;
  captura?: CapturaGuia;
}

export interface SeccionGuia {
  id: string;
  titulo: string;
  pasos: PasoGuia[];
}

export interface Guia {
  slug: string;
  titulo: string;
  icono: LucideIcon;
  resumen: string;
  /** Pantallas del sistema que cubre: desde ahi, "Aprende" abre esta guia. */
  rutasApp: string[];
  videoYoutube?: string;
  secciones: SeccionGuia[];
  consejos?: string[];
  relacionadas: string[];
}

export const GUIAS: Guia[] = [
  {
    slug: "primeros-pasos",
    titulo: "Primeros pasos",
    icono: Rocket,
    resumen: "Crea tu cuenta, configura tu negocio y haz tu primera venta en minutos.",
    rutasApp: [],
    secciones: [
      {
        id: "crear-cuenta",
        titulo: "Crea tu cuenta",
        pasos: [
          {
            titulo: "Regístrate",
            texto: "Entra a symvora.com.mx y pulsa «Prueba gratis». Captura tu nombre, tu celular, el nombre de tu negocio y tu giro, o entra directo con tu cuenta de Google. Tienes 14 días de prueba con todas las funciones, sin tarjeta. Si tienes un código promocional, escríbelo en «¿Tienes un código promocional?».",
            captura: { src: "/aprende/primeros-pasos/crear-cuenta-2.webp", ancho: 1919, alto: 915 },
          },
          { titulo: "Si entraste con Google", texto: "La primera vez te pedimos los datos de tu negocio en «Completa tu registro». Al terminar quedas como dueño (Super Administrador) de la cuenta." },
        ],
      },
      {
        id: "configurar",
        titulo: "Configura tu negocio",
        pasos: [
          {
            titulo: "Datos y logo",
            texto: "En Configuración → General captura nombre de la empresa, correo, teléfono y dirección, y sube tu logo. Se usan en tus tickets.",
            captura: { src: "/aprende/primeros-pasos/configura-tu-negocio.webp", ancho: 1698, alto: 914 },
          },
          { titulo: "Activa solo lo que usas", texto: "En Configuración → Módulos enciende lo que tu negocio necesita: venta por peso o medida, variantes de talla y color, lotes y caducidades, mermas, servicios o ventas a crédito. Puedes cambiarlo cuando quieras." },
        ],
      },
      {
        id: "primera-venta",
        titulo: "Tu primera venta",
        pasos: [
          {
            titulo: "Da de alta un proveedor",
            texto: "En Compras → Proveedor pulsa «Agregar proveedor» y captura su nombre y su celular (con él le mandas tus pedidos por WhatsApp).",
            captura: { src: "/aprende/primeros-pasos/agregar-proveedor.webp", ancho: 387, alto: 371 },
          },
          { titulo: "Agrega tus productos", texto: "En Productos pulsa «Agregar producto» (si usas variantes, elige «Producto único»): nombre, «¿Cómo se vende?», precio de venta, costo, existencias y código de barras." },
          {
            titulo: "¿Ya tienes tu lista en Excel?",
            texto: "Pulsa «Importar catálogo» y sube tu archivo CSV o Excel; el sistema te ayuda a acomodar las columnas.",
            captura: { src: "/aprende/primeros-pasos/importar-catalogo.webp", ancho: 388, alto: 364 },
          },
          { titulo: "Abre la caja", texto: "En Finanzas pulsa «Abrir caja» y captura el efectivo con el que empiezas (fondo inicial). Sin caja abierta no se puede vender." },
          { titulo: "Cobra", texto: "En Punto de Venta escanea o busca el producto (en el celular también puedes escanear con la cámara), elige el método de pago y desliza «Desliza para cobrar». El inventario se descuenta solo." },
          {
            titulo: "Entrega el ticket",
            texto: "Al terminar ves el ticket de la venta y puedes imprimirlo. Si conectas una impresora de tickets, sale solo al cobrar.",
            captura: { src: "/aprende/primeros-pasos/venta-completa.webp", ancho: 385, alto: 498 },
          },
        ],
      },
    ],
    consejos: [
      "Invita a tu equipo desde Usuarios antes de empezar a vender: así cada venta queda registrada con quién la hizo.",
      "El botón «Iniciar tutorial» de la barra superior te lleva por los módulos principales en unos minutos, y «Aprende» abre la guía del módulo en el que estás.",
      "La campana de la barra superior te avisa cuando un producto se está acabando.",
    ],
    relacionadas: ["punto-de-venta", "productos-e-inventario", "caja-y-finanzas", "notificaciones"],
  },
  {
    slug: "punto-de-venta",
    titulo: "Punto de venta",
    icono: ShoppingCart,
    resumen: "Cobra rápido con lector o con la cámara, variantes, granel, descuentos, listas de precios, crédito y varios métodos de pago.",
    rutasApp: ["/pos"],
    secciones: [
      {
        id: "armar-venta",
        titulo: "Arma la venta",
        pasos: [
          { titulo: "Escanea o busca", texto: "Con un lector de código de barras el producto entra directo al carrito. Sin lector, escribe el nombre o el código en el buscador, o usa «Escanear productos» para leer el código con la cámara del celular o la tablet. También puedes filtrar por categoría o por tus favoritos." },
          { titulo: "Productos con variantes", texto: "En la vista «Agrupado», al elegir el producto se abre la selección de variante; en «Desglosado», cada variante aparece como su propia tarjeta. Cada una tiene su propio precio y stock." },
          { titulo: "Productos por peso o medida", texto: "Si el producto se vende por kilo, litro o metro, al agregarlo se abre «¿Cuánto?»: escribe la cantidad (por ejemplo 0.750) o el importe que pide el cliente (por ejemplo $50), o usa los atajos ¼, ½, 1 y 2, y ves el importe antes de agregarlo." },
          { titulo: "Cantidades y quitar productos", texto: "En el carrito toca la cantidad para escribirla (sirve también para 24 piezas) o usa + y −. Con el bote de basura quitas el producto. El total se actualiza al momento." },
          { titulo: "Servicios con insumos", texto: "Si un servicio usa materiales (por ejemplo una vacuna o un tinte), en su línea del carrito ves «Usa: …». Tócalo para ajustar lo que se usó en esta venta; al cobrar se descuenta del inventario." },
          { titulo: "Precios de mayoreo", texto: "Si tienes listas de precios, elige la lista antes de cobrar y se aplica a los productos que incluye. Al terminar la venta vuelve a «Precios normales», para que el siguiente cliente no se lleve el precio de mayoreo por error." },
          { titulo: "Descuento e IVA", texto: "Con «Agregar descuento» das un descuento a toda la compra, en porcentaje o en monto fijo. Un cajero puede descontar hasta el 10 % del ticket; el dueño y los administradores, sin tope. Marca «Incluir IVA» si quieres desglosarlo en la venta." },
        ],
      },
      {
        id: "cobrar",
        titulo: "Cobra",
        pasos: [
          { titulo: "Elige el método de pago", texto: "Efectivo, Tarjeta, Transferencia, Crédito / Fiado o Tarjeta (terminal). En efectivo captura con cuánto te pagan o toca un monto rápido («Exacto», $100, $200…) y el sistema calcula el cambio." },
          { titulo: "Pagos con tarjeta", texto: "«Tarjeta» registra un cobro que hiciste en tu propia terminal (Banco, Clip, Getnet…): se habilita cuando declaras tu terminal en Configuración. «Tarjeta (terminal)» manda el cobro a una terminal de Mercado Pago Point conectada, y la venta se completa cuando la terminal lo confirma." },
          { titulo: "Venta a crédito", texto: "Elige al cliente y el método «Crédito / Fiado». El importe se suma a su saldo; los abonos se registran después en Clientes." },
          { titulo: "Desliza para cobrar", texto: "Revisa el resumen del carrito y desliza «Desliza para cobrar» hasta el final. Si el deslizador está bloqueado, te dice por qué: «Agrega productos», «Elige un método de pago», «Captura el monto recibido» o «Tarjeta sin terminal». Con Tarjeta (terminal) es un botón: «Cobrar en terminal»." },
          { titulo: "Entrega el ticket", texto: "Al cobrar se descuenta el inventario, el dinero entra a tu caja y ves el ticket para imprimirlo. Con una impresora de tickets conectada (Configuración → Impresora), sale solo." },
        ],
      },
      {
        id: "celular",
        titulo: "En el celular",
        pasos: [
          { titulo: "Ajustes del mostrador", texto: "El botón junto al buscador abre «Ajustes del mostrador»: ahí eliges la sucursal, la lista de precios y la vista de productos con variantes (Agrupado o Desglosado)." },
          { titulo: "El carrito abajo", texto: "Toca un producto para agregarlo: su tarjeta muestra «×2» con lo que ya llevas, y la barra azul de abajo el número de artículos y el total. Toca «Ver carrito» para revisar y cobrar." },
          { titulo: "Quitar con un gesto", texto: "En el carrito, desliza una línea a la izquierda para quitarla." },
          { titulo: "Si se recarga la página", texto: "El carrito se conserva al recargar o al volver a la pestaña; se vacía al cobrar o al cerrar sesión." },
        ],
      },
      {
        id: "sucursal",
        titulo: "Cobrar en otra sucursal (dueño)",
        pasos: [
          { titulo: "Cambia de sucursal", texto: "Si tu negocio tiene varias sucursales, el dueño ve un selector de sucursal en el punto de venta. Al elegir otra, el POS muestra las existencias de ese local." },
          { titulo: "Abre tu caja ahí", texto: "Si no tienes caja abierta en esa sucursal, el sistema te pide abrirla en ese momento. Cada venta entra en la caja del local donde cobras, así cada corte cuadra por separado." },
        ],
      },
    ],
    consejos: [
      "Marca como favoritos los productos que más vendes: los encuentras con un toque.",
      "Si el cliente trae su tarjeta de lealtad, escanea su QR con «Escanear tarjeta de lealtad» o elige al cliente: el sello se suma solo al cobrar.",
      "Al cambiar de sucursal con productos en el carrito, la venta en curso se vacía, porque esos productos pueden no existir en el otro local.",
    ],
    relacionadas: ["caja-y-finanzas", "productos-e-inventario", "tarjetas-de-lealtad", "clientes-y-credito"],
  },
  {
    slug: "productos-e-inventario",
    titulo: "Productos e inventario",
    icono: Package,
    resumen: "Da de alta tu catálogo con fotos, variantes y precios, importa desde Excel, ajusta existencias y archiva lo que ya no vendes.",
    rutasApp: ["/products"],
    secciones: [
      {
        id: "alta",
        titulo: "Alta de productos",
        pasos: [
          { titulo: "Agregar producto", texto: "En Productos pulsa «Agregar producto». Si usas variantes, elige «Producto único» (un solo precio y existencia) o «Producto variante». Captura nombre, precio de venta, costo de compra, stock actual, stock mínimo y código de barras. Con el costo, el sistema calcula tu ganancia por unidad." },
          { titulo: "¿Cómo se vende?", texto: "Elige «Pieza» (o caja, paquete, par, docena) para lo que se vende cerrado, o kilogramo, gramo, litro, mililitro o metro para lo que se vende suelto: en ese caso el punto de venta pregunta «¿Cuánto?». Lo que trae el envase (600 ml, 2.5 L, 45 g) va en «Contenido (opcional)»: solo se muestra, no cambia cómo se cobra." },
          { titulo: "Foto del producto", texto: "Sube una foto o, en el celular, pulsa «Tomar foto». Con «Quitar fondo» el producto queda sobre fondo blanco; si no te gusta, «Restaurar original»." },
          { titulo: "Servicios", texto: "Si activaste los servicios, marca «Es servicio»: se cobra pero no descuenta existencias (copias, reparaciones, consultas). Un servicio puede descontar los insumos que usa." },
          { titulo: "Stock mínimo y favoritos", texto: "Cuando un producto llega a su mínimo aparece como «Stock bajo» y te llega un aviso, para que lo resurtas a tiempo. Con la estrella lo marcas como favorito." },
        ],
      },
      {
        id: "variantes-lotes",
        titulo: "Variantes, lotes y granel",
        pasos: [
          { titulo: "Producto con variantes", texto: "Con «Producto variante» escribes el nombre general (por ejemplo Coca Cola) y agregas una tarjeta por variante. En cada una eliges el «Tipo de atributo» y su «Valor» (talla, color, sabor, presentación…) y capturas su precio, costo, stock, stock mínimo, códigos y foto propios." },
          { titulo: "Agregar variantes después", texto: "En la fila del producto pulsa «+ Agregar variante» para sumarle más. En el punto de venta, el producto general nunca se vende solo: se elige una de sus variantes." },
          { titulo: "Lotes y caducidades", texto: "Con el módulo de lotes encendido, marca «Maneja lotes y fecha de caducidad» en el producto y registra sus lotes en la pestaña «Lotes»: al vender sale primero el que caduca antes. Todo el detalle está en la guía de lotes." },
          { titulo: "Venta por peso o medida", texto: "Con el módulo «Venta por peso o medida» encendido, elige como unidad kilogramo, gramo, litro, mililitro o metro. En el punto de venta, al agregar el producto capturas la cantidad (por ejemplo 0.750 kg o 3.5 m) o el importe, y el sistema calcula lo demás." },
        ],
      },
      {
        id: "importar",
        titulo: "Importar desde Excel",
        pasos: [
          { titulo: "Sube tu archivo", texto: "En Productos pulsa «Importar catálogo» y sube tu lista en CSV o Excel." },
          { titulo: "Asigna las columnas", texto: "Indica qué columna es el nombre, el precio, el costo, el código, etc. El sistema detecta los códigos de barras repetidos y te deja omitir, actualizar o generar uno nuevo." },
        ],
      },
      {
        id: "precios",
        titulo: "Listas de precios",
        pasos: [
          { titulo: "Precios de mayoreo o especiales", texto: "Con el botón «Lista de precios» crea listas con otros precios (mayoreo, distribuidores) para elegirlas al cobrar en el punto de venta." },
        ],
      },
      {
        id: "ajustes",
        titulo: "Ajustes y mermas",
        pasos: [
          { titulo: "Ajuste de inventario", texto: "Si al contar el anaquel no coincide con el sistema, en la pestaña «Ajustes» pulsa «Nuevo ajuste» y elige el motivo: Conteo físico, Devolución, Daño u Otro. Queda guardado quién y cuándo lo hizo." },
          { titulo: "Mermas", texto: "Con el módulo de mermas encendido aparece el motivo «Merma» en los ajustes, para registrar lo que se echa a perder. Sale del inventario y la pérdida queda registrada." },
        ],
      },
      {
        id: "archivar",
        titulo: "Archivar lo que ya no vendes",
        pasos: [
          { titulo: "Archivar un producto", texto: "Un producto con ventas o compras no se puede eliminar, para no alterar tus reportes. Archívalo con el botón «Archivar» de su fila (en el celular, deslizándolo a la derecha): deja de aparecer en el catálogo y en el punto de venta, y su historial se conserva." },
          { titulo: "Archivar una variante", texto: "Las variantes se archivan igual, una por una. Si archivas la última variante activa de un producto, se archiva el producto completo." },
          { titulo: "Restaurar", texto: "En la pestaña «Archivados» pulsa «Restaurar» y vuelve al catálogo y al punto de venta. Al restaurar un producto vuelven con él sus variantes; las que archivaste una por una se restauran aparte." },
        ],
      },
    ],
    consejos: [
      "Con varias sucursales, el stock que ves en Productos depende de la sucursal elegida arriba; en «Todas» ves la suma del negocio.",
      "Puedes editar precio y stock directo en la tabla sin abrir el producto: clic para editar, Enter guarda, Esc cancela.",
      "En el celular, desliza un producto a la izquierda para editarlo o eliminarlo, y a la derecha para archivarlo.",
    ],
    relacionadas: ["lotes-caducidades-e-insumos", "compras-y-ordenes", "sucursales", "punto-de-venta"],
  },
  {
    slug: "lotes-caducidades-e-insumos",
    titulo: "Lotes, caducidades e insumos",
    icono: CalendarClock,
    resumen: "Controla lotes y fechas de caducidad por sucursal, vende primero lo que vence antes y descuenta los insumos de tus servicios.",
    rutasApp: [],
    secciones: [
      {
        id: "activar",
        titulo: "Activa los lotes",
        pasos: [
          { titulo: "Enciende el módulo", texto: "En Configuración → Módulos enciende «Lotes y caducidades». Aparece la pestaña «Lotes» en Productos." },
          { titulo: "Marca los productos", texto: "En cada producto que lo necesite (medicamentos, alimentos, cosméticos) enciende «Maneja lotes y fecha de caducidad». Los demás productos funcionan igual que siempre." },
        ],
      },
      {
        id: "registrar",
        titulo: "Registra un lote",
        pasos: [
          { titulo: "Registrar lote", texto: "En Productos → Lotes pulsa «Registrar lote». Elige el producto (y la variante, si tiene), escribe el número de lote, la cantidad, la sucursal donde está y su fecha de caducidad. El costo unitario es opcional e informativo." },
          { titulo: "¿De dónde salen estas piezas?", texto: "«Ya están en mi inventario» solo les pone número de lote y caducidad a piezas que ya contaste. «Es mercancía nueva» además las suma a tus existencias." },
          { titulo: "Al comprar", texto: "En «Nueva compra» y al recibir una orden de compra («Recibir mercancía»), cada renglón tiene «Lote» y «Caducidad» opcionales: la mercancía entra directo con su lote." },
        ],
      },
      {
        id: "vender",
        titulo: "Así se venden",
        pasos: [
          { titulo: "Primero lo que caduca antes", texto: "Al cobrar, el sistema descuenta solo del lote que vence primero y después lo que no tiene lote. No tienes que elegir el lote en el punto de venta." },
          { titulo: "Los caducados no se venden", texto: "Si en la sucursal hay piezas de un lote caducado, la venta se detiene y te dice qué lote es y cuánto hay disponible para vender. Retíralas con un ajuste (por ejemplo Merma o Daño) indicando el lote." },
          { titulo: "Entre sucursales", texto: "Al hacer un traspaso ves qué lotes van a salir («Salen: lote … ×N»); llegan al destino con el mismo lote y la misma caducidad." },
          { titulo: "Historial del lote", texto: "En la tabla de lotes ves la existencia de cada uno, por sucursal, y cuántos días le quedan. El icono de movimientos abre su historial: compras, ventas, traspasos, ajustes y uso en servicios." },
        ],
      },
      {
        id: "insumos",
        titulo: "Insumos por servicio",
        pasos: [
          { titulo: "Indica qué usa cada servicio", texto: "Guarda primero el servicio y vuelve a abrirlo: en «Insumos que usa» agrega los productos y la cantidad que consume cada servicio vendido (por ejemplo, una consulta usa una jeringa y 2 ml de vacuna) y pulsa «Guardar insumos»." },
          { titulo: "Se descuentan al cobrar", texto: "Cada vez que vendes el servicio, sus insumos salen del inventario de la sucursal, primero del lote que caduca antes. En el carrito, «Usa: …» abre «Insumos de esta venta» para ajustar lo que realmente se usó." },
          { titulo: "Si falta un insumo", texto: "La venta no se detiene: se descuenta lo que haya, queda anotado en el detalle de la venta y te llega un aviso de los insumos que faltaron." },
        ],
      },
    ],
    consejos: [
      "La campana te avisa 15 días antes de que un lote caduque y el día que caduca.",
      "El detalle de cada venta, en Reportes, muestra de qué lote salió cada producto y qué insumos usó cada servicio.",
      "Un lote que ya tiene ventas o traspasos no se puede eliminar: así su historial queda completo.",
    ],
    relacionadas: ["productos-e-inventario", "compras-y-ordenes", "notificaciones"],
  },
  {
    slug: "clientes-y-credito",
    titulo: "Clientes y crédito",
    icono: Users,
    resumen: "Registra a tus clientes, vende a crédito y lleva sus abonos y saldos.",
    rutasApp: ["/customers"],
    secciones: [
      {
        id: "clientes",
        titulo: "Tus clientes",
        pasos: [
          { titulo: "Alta de cliente", texto: "En Clientes pulsa «Agregar cliente» y captura su nombre, teléfono y correo (opcional). También puedes darlo de alta desde el punto de venta con «Nuevo cliente» al cobrar." },
          { titulo: "Consulta su saldo", texto: "En la tabla de Clientes ves el saldo pendiente de cada uno." },
        ],
      },
      {
        id: "credito",
        titulo: "Crédito y abonos",
        pasos: [
          { titulo: "Activa el crédito", texto: "En Configuración → Módulos enciende «Ventas a crédito / fiado»." },
          { titulo: "Vende a crédito", texto: "En el punto de venta elige al cliente y el método «Crédito / Fiado». El importe se suma a su saldo." },
          { titulo: "Registra abonos", texto: "Cuando el cliente paga, pulsa «Registrar abono» en su fila y captura el monto y el método de pago: su saldo baja al momento." },
        ],
      },
      {
        id: "lealtad",
        titulo: "Tarjetas de lealtad",
        pasos: [
          { titulo: "Premia a tus clientes frecuentes", texto: "En la pestaña «Tarjetas de lealtad» creas tu programa de sellos. Con el programa activo, cada cliente de la tabla tiene el botón «Crear tarjeta» (o «Tarjeta», si ya la tiene). Todo el detalle está en la guía de tarjetas de lealtad." },
        ],
      },
    ],
    consejos: [
      "Las ventas a crédito no suman al efectivo de tu caja: el dinero entra cuando se registra el abono.",
      "Un cliente con saldo pendiente no se puede eliminar: registra su abono primero.",
    ],
    relacionadas: ["tarjetas-de-lealtad", "punto-de-venta", "caja-y-finanzas"],
  },
  {
    slug: "tarjetas-de-lealtad",
    titulo: "Tarjetas de lealtad",
    icono: Stamp,
    resumen: "Programa de sellos digital: tu cliente junta sellos con cada compra, los ve en su celular y canjea su premio en el punto de venta.",
    rutasApp: [],
    secciones: [
      {
        id: "programa",
        titulo: "Crea tu programa",
        pasos: [
          { titulo: "Actívalo", texto: "En Clientes abre la pestaña «Tarjetas de lealtad» y pulsa «Activar programa»." },
          { titulo: "Define el premio", texto: "Ponle nombre al programa, elige cuántos sellos se necesitan (de 2 a 50) y el premio: «Producto gratis», «$ de descuento» o «% de descuento». Mientras lo configuras, «Así lo verá tu cliente» te muestra la tarjeta." },
          { titulo: "Reglas opcionales", texto: "Con «Compra mínima para sumar sello» evitas sellos por compras muy pequeñas. Elige la «Paleta de la tarjeta» (Clara u Oscura). Con «Programa activo» lo pausas o lo reanudas cuando quieras." },
        ],
      },
      {
        id: "entregar",
        titulo: "Entrega la tarjeta",
        pasos: [
          { titulo: "Crea la tarjeta del cliente", texto: "Pulsa «Nueva tarjeta» y elige al cliente, o usa «Crear tarjeta» en su fila de la tabla de Clientes." },
          { titulo: "Compártela", texto: "En la tarjeta usa «Copiar enlace», «Compartir» (por WhatsApp, por ejemplo), «Abrir» o «Por correo», si el cliente tiene correo. Es una página con su QR y sus sellos; no necesita descargar ninguna app." },
          { titulo: "El cliente la guarda", texto: "En su tarjeta, «Guárdala en tu celular» le explica cómo agregarla a la pantalla de inicio de su Android o iPhone." },
        ],
      },
      {
        id: "sellos",
        titulo: "Sellos y premios al cobrar",
        pasos: [
          { titulo: "Adjunta la tarjeta", texto: "En el punto de venta escanea el QR del cliente con «Escanear tarjeta de lealtad», escribe el código en el buscador, o simplemente elige al cliente: su tarjeta se adjunta sola." },
          { titulo: "Se suma el sello", texto: "Abajo del cliente ves sus sellos y si esta compra suma uno («Esta compra suma 1 sello») o cuánto le falta para la compra mínima. Al cobrar se suma un sello por venta, y el ticket imprime los sellos que lleva." },
          { titulo: "Canjea el premio", texto: "Cuando completa sus sellos aparece «Tiene premio»: pulsa «Aplicar» (o «Agregar y aplicar», si el premio es un producto que aún no está en el carrito). El sistema calcula el descuento y descuenta de la tarjeta los sellos del premio." },
        ],
      },
      {
        id: "seguimiento",
        titulo: "Ajustes y resumen",
        pasos: [
          { titulo: "Ajustar sellos", texto: "Si te equivocaste o quieres regalar sellos, usa «Ajustar sellos» en la tarjeta: escribe cuántos sumar o quitar y el motivo." },
          { titulo: "Cómo va tu programa", texto: "Arriba de la pestaña ves las tarjetas activas, los sellos y los premios del mes." },
        ],
      },
    ],
    consejos: [
      "Al cobrar con «Tarjeta (terminal)» de Mercado Pago, la lealtad no aplica: usa otro método si el cliente quiere su sello o su premio.",
      "Si pausas el programa, no se crean tarjetas ni se suman sellos, pero las tarjetas existentes se conservan.",
      "El programa y los ajustes de sellos los manejan el dueño y los administradores; cualquier cajero puede crear tarjetas y sumar sellos al cobrar.",
    ],
    relacionadas: ["clientes-y-credito", "punto-de-venta"],
  },
  {
    slug: "compras-y-ordenes",
    titulo: "Compras y órdenes de compra",
    icono: Truck,
    resumen: "Registra proveedores, compras directas y órdenes que suben tu inventario al recibirlas.",
    rutasApp: ["/purchases", "/purchase-orders"],
    secciones: [
      {
        id: "proveedores",
        titulo: "Proveedores",
        pasos: [
          { titulo: "Alta de proveedor", texto: "En Compras → Proveedor pulsa «Agregar proveedor» y captura su nombre y su celular. Sin proveedor no se pueden registrar compras." },
        ],
      },
      {
        id: "compra-directa",
        titulo: "Compra directa",
        pasos: [
          { titulo: "Registra lo que te llegó", texto: "En Compras pulsa «Nueva compra», elige el proveedor y agrega los productos con cantidad y costo. Al guardar, el stock sube y el costo del producto se actualiza." },
          { titulo: "Lotes y caducidades", texto: "Si el producto maneja lotes, cada renglón tiene «Lote» y «Caducidad» opcionales: la mercancía entra con su lote." },
          { titulo: "Pagada con la caja", texto: "Si le pagas al proveedor con dinero del cajón, marca «Pagada con efectivo de la caja»: se registra la salida en tu caja abierta y tu corte cuadra." },
          { titulo: "Con varias sucursales", texto: "Elige a qué sucursal llega la mercancía; el stock sube solo en esa." },
          { titulo: "Si te equivocaste", texto: "Cancela la compra: el sistema devuelve al inventario lo que había sumado." },
        ],
      },
      {
        id: "ordenes",
        titulo: "Órdenes de compra",
        pasos: [
          { titulo: "Crea la orden", texto: "En Órdenes de Compra arma el pedido a tu proveedor. Si tiene celular, puedes mandarle el pedido por WhatsApp con el mensaje ya escrito." },
          { titulo: "Recibe la mercancía", texto: "Cuando llegue, abre «Recibir mercancía» y captura lo que realmente llegó (con lote y caducidad, si aplica). En ese momento sube el inventario. También puedes marcarla como pagada con la caja." },
        ],
      },
    ],
    consejos: ["Revisa los productos con stock bajo antes de armar tu orden de compra."],
    relacionadas: ["productos-e-inventario", "lotes-caducidades-e-insumos", "sucursales"],
  },
  {
    slug: "caja-y-finanzas",
    titulo: "Caja y finanzas",
    icono: Wallet,
    resumen: "Abre caja, registra entradas y salidas, haz tu corte y entiende el cierre automático.",
    rutasApp: ["/finances"],
    secciones: [
      {
        id: "abrir",
        titulo: "Abre la caja",
        pasos: [
          { titulo: "Fondo inicial", texto: "En Finanzas pulsa «Abrir caja» y captura el efectivo con el que empiezas. Con varias sucursales, elige en cuál abres: todas las ventas del turno se cuentan en esa sucursal." },
        ],
      },
      {
        id: "movimientos",
        titulo: "Entradas y salidas",
        pasos: [
          { titulo: "Registra movimientos", texto: "Pulsa «Agregar movimiento» para registrar dinero que entra (un cambio que te traen) o que sale (un gasto) con su descripción." },
          { titulo: "Pagos a proveedores", texto: "Si al registrar una compra marcas «Pagada con efectivo de la caja», la salida se registra sola en tu caja: no la captures dos veces." },
        ],
      },
      {
        id: "corte",
        titulo: "Corte de caja",
        pasos: [
          { titulo: "Cierra la caja", texto: "Al terminar tu turno pulsa «Cerrar caja». Verás el fondo inicial, las ventas, las entradas, las salidas y el saldo esperado." },
          { titulo: "Cuenta y captura el saldo real", texto: "Cuenta el efectivo y captúralo. El sistema muestra la diferencia: si cuadra, si falta o si sobra. Puedes dejar una nota." },
          { titulo: "Aviso al dueño", texto: "Si quien cierra es un cajero o un administrador, al dueño le llega un correo con el corte completo y, si hay varias sucursales, de cuál fue. También lo ve en la campana de notificaciones." },
        ],
      },
      {
        id: "cierre-automatico",
        titulo: "Cierre automático",
        pasos: [
          { titulo: "Cajas olvidadas", texto: "Si una caja se queda abierta, el sistema la cierra a las 4:30 a. m. (hora del centro de México), para darte tiempo de cuadrar si cierras pasada la medianoche, con el saldo esperado, y avisa por correo al usuario y al dueño." },
        ],
      },
    ],
    consejos: ["Cada usuario ve y cierra solo su propia caja; con varias sucursales, el dueño puede tener una caja abierta en cada local."],
    relacionadas: ["punto-de-venta", "reportes-y-dashboard", "notificaciones"],
  },
  {
    slug: "reportes-y-dashboard",
    titulo: "Reportes y dashboard",
    icono: ChartColumn,
    resumen: "Consulta ventas, ganancia, gráficas, productos más vendidos y el detalle de cada venta por periodo y sucursal.",
    rutasApp: ["/reports", "/dashboard"],
    secciones: [
      {
        id: "dashboard",
        titulo: "Dashboard",
        pasos: [
          { titulo: "Tus cifras del día y del mes", texto: "Al entrar ves las ventas de hoy y del mes, la ganancia del mes con su margen, el ticket promedio, los clientes atendidos, los productos vendidos y las ventas del mes anterior, con gráficas de ventas recientes, productos más vendidos y métodos de pago." },
          { titulo: "Por sucursal", texto: "Con varias sucursales, usa el filtro junto a «Actualizar» para ver un local o todos juntos." },
        ],
      },
      {
        id: "reportes",
        titulo: "Reportes",
        pasos: [
          { titulo: "Elige el periodo", texto: "En Reportes elige «Última semana», «Este mes», «Último trimestre», «Último año» o un «Día específico». Ves el total de ventas, las transacciones, el ticket promedio y los productos vendidos." },
          { titulo: "Ganancia sobre productos", texto: "Ves los ingresos sin IVA, el costo de lo vendido y la ganancia, y los productos que más te dejan. Es margen bruto: no descuenta renta, sueldos ni otros gastos. Los productos sin costo capturado no entran en el cálculo." },
          { titulo: "Gráficas", texto: "Ingresos contra ganancia, ventas por periodo comparadas con el periodo anterior, métodos de pago, ventas por hora y por día de la semana, los 10 productos más vendidos y las categorías que más venden. También ves las compras del periodo y tus clientes más frecuentes." },
          { titulo: "Exporta tu reporte", texto: "Con «Exportar» descargas en Excel o PDF el periodo y la sucursal que estás viendo: el resumen, la ganancia, los productos, los clientes y la lista de ventas una por una. El reporte se divide en pestañas (Resumen, Ventas, Productos, Clientes e Historial) para ver una parte a la vez." },
        ],
      },
      {
        id: "ventas",
        titulo: "Ventas del periodo",
        pasos: [
          { titulo: "Historial de ventas", texto: "Al final de Reportes, «Ventas del periodo» lista cada venta con fecha, quién atendió, cliente, forma de pago y total. Puedes filtrar por cajero." },
          { titulo: "Detalle y reimpresión", texto: "Abre una venta para ver sus productos, descuento, IVA, lo recibido y el cambio; si maneja lotes o insumos, también de qué lote salió cada cosa. Con «Reimprimir ticket» lo vuelves a imprimir." },
        ],
      },
    ],
    consejos: [
      "Dashboard y Reportes muestran las cifras del negocio: de fábrica los cajeros no los ven. El dueño puede concederlos desde Usuarios.",
      "Un cajero ve en el historial solo las ventas que él cobró; el dueño y los administradores ven todas.",
    ],
    relacionadas: ["caja-y-finanzas", "sucursales"],
  },
  {
    slug: "sucursales",
    titulo: "Sucursales",
    icono: ArrowRightLeft,
    resumen: "Da de alta tus locales, lleva existencias por sucursal y traspasa mercancía entre ellos.",
    rutasApp: ["/branches"],
    secciones: [
      {
        id: "alta",
        titulo: "Alta de sucursales",
        pasos: [
          { titulo: "Tu segunda sucursal", texto: "El módulo Sucursales siempre está en el menú. Con un solo local te invita a dar de alta el segundo; con dos o más muestra la comparación entre locales, las existencias de cada uno y los traspasos." },
          { titulo: "Cerrar un local", texto: "Una sucursal cerrada deja de ofrecerse para vender, pero su historial se conserva." },
        ],
      },
      {
        id: "existencias",
        titulo: "Existencias por sucursal",
        pasos: [
          { titulo: "El catálogo es común", texto: "Los productos son los mismos para todo el negocio; lo que cambia por sucursal es cuánto hay en cada una y si se vende ahí." },
          { titulo: "Consulta y ajusta", texto: "En Productos elige la sucursal arriba para ver y editar sus existencias." },
        ],
      },
      {
        id: "traspasos",
        titulo: "Traspasos",
        pasos: [
          { titulo: "Mueve mercancía", texto: "En Sucursales → «Nuevo traspaso» elige origen, destino y productos, y pulsa «Registrar traspaso». O pasa todo o no pasa nada: si en el origen no alcanza, el sistema te dice de qué producto y cuánto queda." },
          { titulo: "Con lotes", texto: "Si el producto maneja lotes, antes de registrar ves cuáles van a salir («Salen: lote … ×N»), primero los que caducan antes." },
        ],
      },
    ],
    consejos: ["Puedes asignar a cada usuario las sucursales donde trabaja desde Usuarios: solo opera y ve esas."],
    relacionadas: ["usuarios-y-permisos", "productos-e-inventario", "caja-y-finanzas"],
  },
  {
    slug: "usuarios-y-permisos",
    titulo: "Usuarios y permisos",
    icono: ClipboardList,
    resumen: "Invita a tu equipo con clave de empleado, asigna roles, permisos y sucursales.",
    rutasApp: ["/users"],
    secciones: [
      {
        id: "invitar",
        titulo: "Invita a tu equipo",
        pasos: [
          { titulo: "Agrega al usuario", texto: "En Usuarios pulsa «Agregar usuario» y captura su nombre, su apellido (opcional), su correo, el rol (Cajero o Administrador) y, si tienes varias sucursales, en cuáles trabajará. Se genera su clave de acceso, que ves en «Claves de acceso»." },
          { titulo: "El empleado entra con su clave", texto: "En la pantalla de inicio de sesión elige «¿Eres empleado o colaborador? Ingresa tu clave»." },
          { titulo: "Corrige su nombre", texto: "El nombre aparece en Usuarios, en el historial de ventas y en su saludo. Si hay que corregirlo, usa «Editar nombre» en su fila (en el celular, desliza la fila y toca «Nombre»)." },
        ],
      },
      {
        id: "roles",
        titulo: "Roles y permisos",
        pasos: [
          { titulo: "Qué ve cada rol", texto: "De fábrica, el cajero usa Punto de Venta, Productos, Clientes, Compras, Órdenes de Compra y su propia caja en Finanzas. El administrador además ve reportes, configuración y bitácora." },
          { titulo: "Permisos por usuario", texto: "Con el botón de permisos de cada usuario enciendes o apagas módulos solo para esa persona, por ejemplo darle Reportes a un encargado. Son excepciones sobre lo que da su rol; «Restablecer» lo regresa a lo de fábrica." },
          { titulo: "Sucursales asignadas", texto: "Limita a cada usuario a las sucursales donde trabaja: solo opera y ve esas. Sin asignación, trabaja en todas." },
        ],
      },
    ],
    consejos: [
      "Puedes agregar todos los usuarios que necesites, sin costo extra.",
      "Usuarios y Suscripción solo los maneja el dueño: son los módulos que reparten poder y cobran.",
    ],
    relacionadas: ["sucursales", "bitacora"],
  },
  {
    slug: "notificaciones",
    titulo: "Notificaciones",
    icono: Bell,
    resumen: "La campana te avisa cuando un producto se acaba, cuando tu equipo cierra caja o hace cambios, y cuando un lote está por caducar.",
    rutasApp: [],
    secciones: [
      {
        id: "campana",
        titulo: "La campana",
        pasos: [
          { titulo: "Dónde está", texto: "En la barra superior del sistema. El número indica cuántas notificaciones no has leído; al abrirla se marcan como leídas. Llegan al momento, sin recargar la página." },
          { titulo: "Descartar", texto: "En la computadora, pasa el mouse sobre una notificación y pulsa la X. En el celular o la tablet, deslízala a la izquierda. Solo desaparece para ti; tu equipo la sigue viendo." },
        ],
      },
      {
        id: "avisos",
        titulo: "Qué te avisa",
        pasos: [
          { titulo: "Inventario", texto: "«Stock bajo» cuando un producto llega a su mínimo y «Se agotó» cuando se termina. Estos avisos los ve todo el equipo." },
          { titulo: "Lo que hace tu equipo", texto: "Cierres de caja, productos creados o editados, compras, órdenes de compra, ajustes de inventario, traspasos y lotes. Si alguien hace varias cosas seguidas, llegan juntas («Ana creó 12 productos»). Nadie recibe avisos de sus propias acciones." },
          { titulo: "Lotes e insumos", texto: "«Por caducar» 15 días antes de que venza un lote, «Lote caducado» el día que vence, y un aviso cuando faltaron insumos al cobrar un servicio." },
        ],
      },
      {
        id: "correo",
        titulo: "Aviso por correo",
        pasos: [
          { titulo: "Stock por correo", texto: "Cuando un producto se está acabando, al dueño y a los administradores les llega también un correo. Si se acaban varios productos a la vez, llegan juntos en un solo correo, como máximo uno cada 15 minutos." },
        ],
      },
    ],
    consejos: [
      "Los avisos de lo que hace tu equipo los ven quienes tienen acceso a la Bitácora y al módulo correspondiente; el dueño puede concederlo desde Usuarios.",
      "Las notificaciones se guardan 30 días.",
    ],
    relacionadas: ["productos-e-inventario", "lotes-caducidades-e-insumos", "bitacora"],
  },
  {
    slug: "bitacora",
    titulo: "Bitácora",
    icono: BookOpen,
    resumen: "Revisa quién creó, editó o eliminó qué y cuándo.",
    rutasApp: ["/activity"],
    secciones: [
      {
        id: "consultar",
        titulo: "Consulta la actividad",
        pasos: [
          { titulo: "Qué se registra", texto: "Altas, ediciones y eliminaciones de productos, ventas, cajas, compras, traspasos y usuarios, con quién lo hizo y cuándo. También las reimpresiones de tickets." },
          { titulo: "Filtra por módulo", texto: "Usa el filtro para ver solo lo relacionado con productos, ventas, cajas, compras u otro módulo." },
        ],
      },
    ],
    consejos: ["De fábrica la ven el dueño y los administradores; puedes concederla a otro usuario desde Usuarios."],
    relacionadas: ["usuarios-y-permisos", "notificaciones"],
  },
  {
    slug: "configuracion",
    titulo: "Configuración y métodos de pago",
    icono: Settings,
    resumen: "Datos del negocio, logo, módulos que se activan, cobro con tarjeta, impresora de tickets y tu perfil.",
    rutasApp: ["/settings"],
    secciones: [
      {
        id: "general",
        titulo: "General",
        pasos: [
          { titulo: "Datos del negocio", texto: "En la pestaña «General»: nombre de la empresa, correo, teléfono, dirección y logo. Aparecen en tus tickets." },
        ],
      },
      {
        id: "modulos",
        titulo: "Módulos",
        pasos: [
          { titulo: "Enciende lo que necesitas", texto: "En la pestaña «Módulos»: «Venta por peso o medida», «Variantes de talla y color», «Lotes y caducidades», «Mermas», «Servicios» y «Ventas a crédito / fiado». Cada interruptor muestra u oculta sus opciones en todo el sistema (unidades, pestañas, métodos de pago). Apagar uno no borra nada: lo que ya lo usa sigue funcionando." },
        ],
      },
      {
        id: "pagos",
        titulo: "Cobro con tarjeta",
        pasos: [
          { titulo: "Si ya tienes terminal", texto: "En la pestaña «Mercado Pago Point» enciende «Tengo una terminal de tarjeta externa» si cobras con la terminal de tu banco, Clip, Getnet u otra. Así se habilita el método «Tarjeta» en el punto de venta; sin terminal queda bloqueado." },
          { titulo: "Terminal Mercado Pago Point", texto: "En la misma pestaña captura el Access Token y la clave del webhook de tu aplicación de Mercado Pago, pulsa «Probar conexión», elige la terminal y enciende «Habilitar terminal». Desde el punto de venta cobras con «Tarjeta (terminal)» y la venta se completa cuando la terminal confirma el pago. «Cómo configurarlo» te guía paso a paso." },
        ],
      },
      {
        id: "impresora",
        titulo: "Impresora de tickets",
        pasos: [
          { titulo: "Conecta tu impresora", texto: "En la pestaña «Impresora» elige cómo se conecta: Bluetooth, USB (cable) o puerto serie, y el ancho del papel (58 o 80 mm). Con «Imprimir al cobrar» el ticket sale solo al terminar cada venta. Prueba con «Imprimir prueba»." },
          { titulo: "Se guarda en cada equipo", texto: "La impresora queda conectada en ese equipo: para la caja de un cajero, inicia sesión una vez en esa computadora o celular y conéctala ahí. Funciona en Chrome o Edge en Android y PC; en iPhone, iPad y Firefox se imprime con la ventana de impresión." },
        ],
      },
      {
        id: "perfil",
        titulo: "Tu perfil",
        pasos: [
          { titulo: "Mi perfil", texto: "Desde tu foto o iniciales abre «Perfil»: ahí corriges tu nombre completo y tu número celular. El dueño también cambia ahí su contraseña y el nombre del negocio." },
        ],
      },
    ],
    relacionadas: ["primeros-pasos", "punto-de-venta"],
  },
  {
    slug: "suscripcion",
    titulo: "Suscripción",
    icono: CreditCard,
    resumen: "Prueba gratuita, planes mensual y anual, pago con tarjeta o en efectivo, códigos promocionales y fechas de cobro.",
    rutasApp: ["/billing"],
    secciones: [
      {
        id: "prueba",
        titulo: "Prueba gratuita",
        pasos: [
          { titulo: "14 días completos", texto: "Tu cuenta empieza con 14 días de prueba con todas las funciones. En Suscripción ves cuántos días te quedan, y los últimos días un aviso en el sistema te lo recuerda." },
          { titulo: "Código promocional", texto: "Si tienes un código, escríbelo en «Código promocional» y pulsa «Aplicar»: se suman días a tu prueba. También puedes usarlo al registrarte." },
        ],
      },
      {
        id: "pagar",
        titulo: "Planes y pago",
        pasos: [
          { titulo: "Mensual o anual", texto: "Elige el plan mensual o el anual, que sale más barato por mes." },
          { titulo: "Con tarjeta", texto: "«Pagar con tarjeta» activa el cobro automático: tu tarjeta se carga sola cada periodo." },
          { titulo: "Otros métodos", texto: "«Otros métodos de pago» genera un pago único con efectivo en tienda, transferencia SPEI, Pago Directo BBVA o a plazos con Aplazo; no se renueva solo y tendrás que volver a pagar cada periodo." },
        ],
      },
      {
        id: "acceso",
        titulo: "Si no se paga a tiempo",
        pasos: [
          { titulo: "Al terminar la prueba", texto: "Si la prueba termina sin un plan activo, la cuenta queda en solo lectura: puedes ver y consultar tu información, pero no registrar ventas ni cambios. Al pagar continúas donde te quedaste." },
          { titulo: "Si un cobro falla", texto: "Si no pudimos cobrar tu mensualidad o tu periodo pagado venció, tienes 3 días para pagar sin perder el acceso. Un aviso en el sistema te dice cuántos días quedan, con el botón «Pagar ahora»." },
        ],
      },
      {
        id: "fechas",
        titulo: "Fechas y cancelación",
        pasos: [
          { titulo: "Último pago y próximo cobro", texto: "En Estado de suscripción ves tu último pago y el próximo cobro. Si pagaste en efectivo o cancelaste, verás hasta cuándo está vigente." },
          { titulo: "Cancelar", texto: "Puedes cancelar cuando quieras desde Suscripción con «Cancelar suscripción». Conservas el acceso hasta el fin del periodo que ya pagaste; después la cuenta queda en solo lectura y tus datos se conservan." },
        ],
      },
    ],
    relacionadas: ["primeros-pasos"],
  },
];

export function guiaPorSlug(slug: string): Guia | undefined {
  return GUIAS.find((g) => g.slug === slug);
}

/** Ruta publica de una guia (solo existe en español). */
export function rutaGuia(slug?: string): string {
  return slug ? `/es/aprende/${slug}` : "/es/aprende";
}

/**
 * La guia del modulo en el que esta el usuario dentro del sistema, para el
 * boton "Aprende" del panel. Acepta la ruta con o sin idioma (`/es/pos/...`).
 * Sin coincidencia, `undefined`: el boton abre el indice.
 */
export function guiaParaRuta(pathname: string): Guia | undefined {
  const limpia = pathname.replace(/^\/(es|en)(?=\/|$)/, "") || "/";
  // La ruta mas larga primero, por si algun dia hay rutas anidadas.
  const candidatas = GUIAS.flatMap((g) => g.rutasApp.map((ruta) => ({ ruta, g }))).sort(
    (a, b) => b.ruta.length - a.ruta.length
  );
  return candidatas.find(({ ruta }) => limpia === ruta || limpia.startsWith(`${ruta}/`))?.g;
}

/**
 * El id de un video a partir de la URL que se copia de YouTube: watch?v=,
 * youtu.be/, /shorts/ o /embed/. `null` si no es de YouTube o no trae un id
 * valido: mejor no mostrar video que incrustar algo que no es.
 */
export function idYoutube(url: string | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = u.pathname.slice(1).split("/")[0] || null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?#]+)/);
      id = m ? m[2] : null;
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
