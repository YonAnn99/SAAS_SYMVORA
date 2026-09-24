import {
  Apple,
  ArrowRightLeft,
  Beef,
  CalendarClock,
  Candy,
  ChartColumn,
  Cog,
  FileSpreadsheet,
  Flower2,
  Footprints,
  Gem,
  Gift,
  HandCoins,
  Milk,
  Package,
  PawPrint,
  PencilRuler,
  Percent,
  Pill,
  Printer,
  Croissant,
  Scale,
  ScanBarcode,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Stethoscope,
  Store,
  Tags,
  Truck,
  Wallet,
  Wine,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Giros comerciales de la landing: la franja bajo los logos, el catalogo
 * `#giros` y una pagina por giro en `/es/punto-de-venta/[slug]`.
 *
 * FUENTE UNICA. La franja, el catalogo, las paginas, el sitemap y los tests
 * leen de aqui; asi un giro no puede existir en el menu y no tener pagina.
 *
 * ⚠️ SOLO SE PROMETE LO QUE SYMVORA HACE HOY. Cada funcion de `FUNCIONES`
 * corresponde a algo que existe en el sistema (modulo, interruptor de
 * Configuracion -> Modulos, o pantalla). Nada de facturacion (el modulo CFDI
 * esta apagado), recetas medicas, expedientes clinicos ni citas: un cliente
 * que se registra por una promesa que no se cumple cancela en la primera
 * semana. `giros.test.ts` vigila una lista de palabras prohibidas.
 *
 * El texto largo va aqui en español y no en `messages`: es contenido de
 * marketing para el mercado mexicano, y meterlo en `messages` obligaria a
 * traducir cientos de frases para pasar el test de paridad es/en. En ingles
 * solo se traduce el nombre corto (franja y catalogo).
 */

/** Configuraciones de registro que existen (`giro_comercial` de `tenants`). */
export const CONFIGS_REGISTRO = [
  "ABARROTES",
  "VERDULERIA",
  "MASCOTAS",
  "ROPA",
  "FERRETERIA",
  "FARMACIA",
  "GENERAL",
] as const;
export type ConfigRegistro = (typeof CONFIGS_REGISTRO)[number];

/** Interruptores de Configuracion -> Modulos que conviene encender por giro. */
export const MODULOS = {
  granel: "Venta a granel (por peso o volumen)",
  variantes: "Variantes de talla y color",
  lotes: "Lotes y fechas de caducidad",
  mermas: "Registro de mermas y pérdidas",
  servicios: "Productos de tipo servicio",
  credito: "Ventas a crédito / fiado",
} as const;
export type ModuloClave = keyof typeof MODULOS;

/** Lo que SYMVORA hace, con su icono y una descripcion general. */
export const FUNCIONES = {
  ventaRapida: { icono: ScanBarcode, titulo: "Venta rápida con lector de códigos" },
  granel: { icono: Scale, titulo: "Venta por peso" },
  variantes: { icono: Tags, titulo: "Tallas, colores y variantes" },
  lotes: { icono: CalendarClock, titulo: "Lotes y caducidades" },
  credito: { icono: HandCoins, titulo: "Crédito y fiado a clientes" },
  servicios: { icono: Sparkles, titulo: "Venta de servicios" },
  mermas: { icono: Package, titulo: "Control de mermas" },
  listasPrecio: { icono: Percent, titulo: "Precios de mayoreo" },
  sucursales: { icono: ArrowRightLeft, titulo: "Sucursales y traspasos" },
  compras: { icono: Truck, titulo: "Compras y órdenes a proveedores" },
  caja: { icono: Wallet, titulo: "Cortes de caja" },
  reportes: { icono: ChartColumn, titulo: "Reportes de ventas y ganancias" },
  importacion: { icono: FileSpreadsheet, titulo: "Importa tu catálogo desde Excel" },
  tickets: { icono: Printer, titulo: "Tickets impresos" },
  terminal: { icono: Smartphone, titulo: "Cobro con terminal" },
} as const satisfies Record<string, { icono: LucideIcon; titulo: string }>;
export type FuncionClave = keyof typeof FUNCIONES;

export interface Giro {
  /** Segmento de la URL: `/es/punto-de-venta/{slug}`. */
  slug: string;
  nombre: { es: string; en: string };
  /** Para el H1: "Punto de venta para {plural}". */
  plural: string;
  /** Para frases: "Software para {tu}". */
  tu: string;
  icono: LucideIcon;
  /** Configuracion con la que se registra desde su pagina. */
  config: ConfigRegistro;
  /** Frase bajo el H1 y descripcion para buscadores. */
  resumen: string;
  queEs: string;
  beneficios: { titulo: string; texto: string }[];
  funciones: { clave: FuncionClave; texto: string }[];
  modulos: ModuloClave[];
  faqs: { pregunta: string; respuesta: string }[];
}

export const GIROS: Giro[] = [
  {
    slug: "abarrotes",
    nombre: { es: "Abarrotes", en: "Grocery store" },
    plural: "Abarrotes",
    tu: "tu tienda de abarrotes",
    icono: Store,
    config: "ABARROTES",
    resumen:
      "Cobra rápido con lector de códigos, controla tu inventario y lleva el fiado de tus clientes sin libreta.",
    queEs:
      "Un punto de venta para abarrotes es el sistema con el que cobras en el mostrador, descuentas del inventario cada producto vendido y sabes al final del día cuánto vendiste y cuánto ganaste. En una tienda de la esquina, donde se venden cientos de productos distintos y muchos clientes compran fiado, reemplaza la calculadora, la libreta y el conteo a ojo.",
    beneficios: [
      { titulo: "Filas más cortas", texto: "Escanea el código de barras y el producto entra al ticket con su precio. Sin buscar en listas ni teclear precios." },
      { titulo: "Sabes qué se está acabando", texto: "Cada venta descuenta existencias y el sistema te avisa qué productos llegaron a su mínimo para resurtir a tiempo." },
      { titulo: "El fiado en orden", texto: "Cada cliente tiene su saldo; registras abonos y sabes quién te debe y cuánto, sin perder la libreta." },
      { titulo: "La caja cuadra", texto: "Al cerrar, el sistema compara lo que debería haber contra lo que contaste y te muestra la diferencia." },
    ],
    funciones: [
      { clave: "ventaRapida", texto: "Escanea refrescos, botanas y abarrotes; también buscas por nombre cuando el producto no trae código." },
      { clave: "credito", texto: "Vende fiado a tus clientes de confianza y registra sus abonos." },
      { clave: "granel", texto: "Vende frijol, azúcar o queso por kilo con el precio calculado al momento." },
      { clave: "lotes", texto: "Registra lácteos y embutidos por lote para vender primero lo que caduca antes." },
      { clave: "compras", texto: "Registra lo que te surte cada proveedor y el stock sube solo." },
      { clave: "caja", texto: "Abre caja con tu fondo, registra entradas y salidas y haz tu corte al final del día." },
    ],
    modulos: ["credito", "granel", "lotes", "mermas"],
    faqs: [
      { pregunta: "¿Necesito lector de código de barras?", respuesta: "No es obligatorio: puedes buscar productos por nombre. Pero con un lector USB cobras mucho más rápido; SYMVORA funciona con los lectores comunes que se conectan como teclado." },
      { pregunta: "¿Puedo llevar el fiado de mis clientes?", respuesta: "Sí. Activa las ventas a crédito en Configuración → Módulos, registra a tus clientes y cada venta a crédito se suma a su saldo. Los abonos lo van descontando." },
      { pregunta: "¿Puedo cargar todos mis productos de una vez?", respuesta: "Sí. Sube tu lista en Excel o CSV, eliges qué columna es el nombre, el precio y el código, y el sistema detecta duplicados antes de importar." },
    ],
  },
  {
    slug: "verdulerias",
    nombre: { es: "Verdulería", en: "Produce store" },
    plural: "Verdulerías",
    tu: "tu verdulería",
    icono: Apple,
    config: "VERDULERIA",
    resumen:
      "Vende frutas y verduras por kilo, registra lo que se echa a perder y conoce tu ganancia real.",
    queEs:
      "Un punto de venta para verdulerías calcula el precio de lo que se vende por peso, lleva el control de mercancía que se maltrata o se echa a perder y te dice cuánto ganaste realmente después de las mermas. En un negocio de productos frescos, donde el margen se pierde en lo que no se vende a tiempo, esa información hace la diferencia.",
    beneficios: [
      { titulo: "Precio exacto por kilo", texto: "Capturas el peso y el sistema calcula el importe. Sin redondeos ni errores de cuenta." },
      { titulo: "Las mermas a la vista", texto: "Registra lo que se echa a perder y deja de ser una pérdida invisible en tu ganancia." },
      { titulo: "Compras mejor", texto: "Con los reportes sabes qué se vende más y qué se queda, y ajustas tu pedido a la central." },
      { titulo: "Cada peso en su lugar", texto: "Cortes de caja por turno con entradas, salidas y diferencia." },
    ],
    funciones: [
      { clave: "granel", texto: "Jitomate, aguacate, papa o limón por kilo, con precio calculado al momento." },
      { clave: "mermas", texto: "Registra lo que se maltrata o se echa a perder para que tu inventario sea real." },
      { clave: "lotes", texto: "Si manejas productos empacados con caducidad, regístralos por lote." },
      { clave: "listasPrecio", texto: "Precio de mayoreo para fondas y restaurantes que te compran por caja." },
      { clave: "reportes", texto: "Productos más vendidos y ganancia por periodo." },
    ],
    modulos: ["granel", "mermas", "lotes", "credito"],
    faqs: [
      { pregunta: "¿Puedo vender por kilo y por pieza?", respuesta: "Sí. Activa la venta a granel en Configuración → Módulos; cada producto se configura por kilo, por litro o por pieza." },
      { pregunta: "¿Cómo registro lo que se echa a perder?", respuesta: "Con el módulo de mermas registras la cantidad y el motivo; el inventario se ajusta y la pérdida queda registrada." },
      { pregunta: "¿Puedo dar precio especial a mis clientes de mayoreo?", respuesta: "Sí, con listas de precios: creas una lista de mayoreo y la eliges al cobrar." },
    ],
  },
  {
    slug: "tiendas-de-mascotas",
    nombre: { es: "Mascotas", en: "Pet store" },
    plural: "Tiendas de Mascotas",
    tu: "tu tienda de mascotas",
    icono: PawPrint,
    config: "MASCOTAS",
    resumen:
      "Alimento a granel y en bulto, accesorios y servicios como baño y estética en un solo sistema.",
    queEs:
      "Un punto de venta para tiendas de mascotas combina la venta de alimento —en bulto o a granel—, accesorios con distintas tallas y servicios como baño o corte de pelo. SYMVORA lleva el inventario de lo físico y cobra los servicios sin que descuenten existencias.",
    beneficios: [
      { titulo: "Alimento por kilo o por bulto", texto: "Vende croquetas sueltas por kilo y el bulto cerrado por pieza, cada uno con su precio." },
      { titulo: "Servicios en el mismo ticket", texto: "Cobra el baño o la estética junto con el shampoo o la correa." },
      { titulo: "Accesorios por talla", texto: "Collares, arneses y ropa con su talla y color, cada variante con su propio stock." },
      { titulo: "Clientes frecuentes", texto: "Registra a tus clientes y consulta qué compran." },
    ],
    funciones: [
      { clave: "granel", texto: "Croquetas y alimento a granel con precio por kilo." },
      { clave: "servicios", texto: "Baño, corte y estética como servicios, sin inventario." },
      { clave: "variantes", texto: "Accesorios por talla y color con existencias independientes." },
      { clave: "lotes", texto: "Alimentos y medicamentos con fecha de caducidad por lote." },
      { clave: "compras", texto: "Órdenes de compra a tus distribuidores." },
    ],
    modulos: ["granel", "servicios", "variantes", "lotes"],
    faqs: [
      { pregunta: "¿Puedo cobrar el baño de la mascota?", respuesta: "Sí. Crea el baño como producto de tipo servicio: se cobra en el ticket y no descuenta inventario." },
      { pregunta: "¿Puedo vender croquetas sueltas?", respuesta: "Sí, con la venta a granel las vendes por kilo; el bulto cerrado puede ser otro producto por pieza." },
      { pregunta: "¿Maneja tallas de ropa y accesorios?", respuesta: "Sí, con variantes: cada talla y color tiene su propio stock." },
    ],
  },
  {
    slug: "tiendas-de-ropa",
    nombre: { es: "Tienda de Ropa", en: "Clothing store" },
    plural: "Tiendas de Ropa",
    tu: "tu tienda de ropa",
    icono: Shirt,
    config: "ROPA",
    resumen:
      "Cada talla y color con su propio stock, apartados a crédito y precios de mayoreo para revendedoras.",
    queEs:
      "Un punto de venta para tiendas de ropa lleva el inventario por modelo, talla y color. Así sabes que te quedan dos blusas rojas talla M y ninguna talla S, en lugar de un total que no dice nada. También te ayuda con ventas a crédito y precios especiales para quien compra para revender.",
    beneficios: [
      { titulo: "Stock por talla y color", texto: "Cada variante tiene sus existencias; al vender una M roja, solo baja la M roja." },
      { titulo: "Sabes qué resurtir", texto: "Detectas qué tallas se agotan primero y cuáles se quedan en el anaquel." },
      { titulo: "Crédito y apartados", texto: "Vende a crédito a tus clientas y registra sus abonos." },
      { titulo: "Mayoreo sin cuentas a mano", texto: "Lista de precios para revendedoras que se aplica al cobrar." },
    ],
    funciones: [
      { clave: "variantes", texto: "Modelos con tallas y colores, cada combinación con su stock y su código." },
      { clave: "credito", texto: "Ventas a crédito con saldo por clienta." },
      { clave: "listasPrecio", texto: "Precio de mayoreo para revendedoras." },
      { clave: "ventaRapida", texto: "Etiquetas con código de barras para cobrar escaneando." },
      { clave: "sucursales", texto: "Si tienes dos locales, traspasa prendas de uno a otro." },
      { clave: "reportes", texto: "Productos más vendidos y ventas por periodo." },
    ],
    modulos: ["variantes", "credito"],
    faqs: [
      { pregunta: "¿Cómo manejo tallas y colores?", respuesta: "Activa las variantes en Configuración → Módulos. Cada producto puede tener tallas y colores, y cada combinación lleva su propio stock y código." },
      { pregunta: "¿Puedo vender a crédito?", respuesta: "Sí, con el módulo de crédito: la venta se suma al saldo de la clienta y registras sus abonos." },
      { pregunta: "Tengo dos tiendas, ¿funciona?", respuesta: "Sí. Cada sucursal tiene su inventario y puedes traspasar mercancía entre ellas." },
    ],
  },
  {
    slug: "ferreterias",
    nombre: { es: "Ferretería", en: "Hardware store" },
    plural: "Ferreterías",
    tu: "tu ferretería",
    icono: Wrench,
    config: "FERRETERIA",
    resumen:
      "Miles de artículos bajo control, venta por metro o kilo, crédito a contratistas y precios de mayoreo.",
    queEs:
      "Un punto de venta para ferreterías maneja catálogos grandes —tornillería, plomería, electricidad, pinturas— con artículos que se venden por pieza, por metro o por kilo. Además lleva el crédito de contratistas y los precios especiales para clientes que compran volumen.",
    beneficios: [
      { titulo: "Encuentras todo al instante", texto: "Busca por nombre o código entre miles de artículos sin recorrer pasillos." },
      { titulo: "Por pieza, metro o kilo", texto: "Cable por metro, clavo por kilo y la llave por pieza, cada uno con su unidad." },
      { titulo: "Crédito a contratistas", texto: "Lleva el saldo de cada cliente y registra sus pagos." },
      { titulo: "Sabes qué pedir", texto: "Alertas de stock mínimo y compras a proveedores que suben el inventario." },
    ],
    funciones: [
      { clave: "granel", texto: "Cable, manguera o clavo por metro o kilo." },
      { clave: "credito", texto: "Crédito a contratistas y clientes frecuentes." },
      { clave: "listasPrecio", texto: "Precio especial para quien compra volumen." },
      { clave: "importacion", texto: "Carga tu catálogo completo desde Excel." },
      { clave: "compras", texto: "Órdenes de compra a proveedores y recepción de mercancía." },
      { clave: "sucursales", texto: "Varias sucursales con existencias propias y traspasos." },
    ],
    modulos: ["granel", "credito"],
    faqs: [
      { pregunta: "Tengo miles de productos, ¿cómo los cargo?", respuesta: "Con la importación desde Excel o CSV: subes tu lista, asignas las columnas y el sistema detecta duplicados por código de barras." },
      { pregunta: "¿Puedo vender cable por metro?", respuesta: "Sí, con la venta a granel cada producto se vende en su unidad: metro, kilo o litro." },
      { pregunta: "¿Puedo dar crédito a contratistas?", respuesta: "Sí, con el módulo de crédito cada cliente tiene su saldo y registras sus abonos." },
    ],
  },
  {
    slug: "farmacias",
    nombre: { es: "Farmacia", en: "Pharmacy" },
    plural: "Farmacias",
    tu: "tu farmacia",
    icono: Pill,
    config: "FARMACIA",
    resumen:
      "Medicamentos por lote con fecha de caducidad, alertas de stock y cortes de caja claros.",
    queEs:
      "Un punto de venta para farmacias controla los medicamentos por lote y fecha de caducidad, para vender primero lo que vence antes y no perder producto caducado. También lleva el inventario de perfumería y artículos de higiene, y te da cortes de caja y reportes de lo más vendido.",
    beneficios: [
      { titulo: "Menos producto caducado", texto: "Cada lote con su fecha; sabes qué vence pronto y lo vendes primero." },
      { titulo: "Nunca te quedas sin lo básico", texto: "Alertas cuando un medicamento llega a su existencia mínima." },
      { titulo: "Cobro rápido", texto: "Escanea la caja del medicamento y cobra." },
      { titulo: "Control por turno", texto: "Cada cajero abre y cierra su caja; el corte muestra si cuadra." },
    ],
    funciones: [
      { clave: "lotes", texto: "Lotes con fecha de caducidad por medicamento." },
      { clave: "ventaRapida", texto: "Cobro con lector de código de barras." },
      { clave: "compras", texto: "Compras a laboratorios y distribuidores con recepción por lote." },
      { clave: "mermas", texto: "Registra el producto caducado o dañado que se retira." },
      { clave: "caja", texto: "Cortes de caja por cajero." },
    ],
    modulos: ["lotes", "mermas"],
    faqs: [
      { pregunta: "¿Controla fechas de caducidad?", respuesta: "Sí. Activa lotes y caducidades en Configuración → Módulos y registra cada lote con su fecha al recibir la mercancía." },
      { pregunta: "¿Puedo tener varios cajeros?", respuesta: "Sí. Cada usuario tiene su acceso y su propia caja, y tú decides qué módulos ve cada uno." },
      { pregunta: "¿Qué hago con el producto caducado?", respuesta: "Regístralo como merma: sale del inventario y la pérdida queda registrada." },
    ],
  },
  {
    slug: "papelerias",
    nombre: { es: "Papelería", en: "Stationery store" },
    plural: "Papelerías",
    tu: "tu papelería",
    icono: PencilRuler,
    config: "GENERAL",
    resumen:
      "Cientos de artículos pequeños, servicios como copias e impresiones y temporada escolar sin caos.",
    queEs:
      "Un punto de venta para papelerías ordena cientos de artículos pequeños —lápices, cuadernos, material escolar— y cobra también servicios como copias, impresiones o engargolados. En temporada de regreso a clases, cuando se forman filas, cobrar rápido y saber qué se está acabando es lo que más importa.",
    beneficios: [
      { titulo: "Copias y artículos en un ticket", texto: "Cobra las copias como servicio junto con el cuaderno y la pluma." },
      { titulo: "Listas escolares más rápido", texto: "Busca por nombre o escanea y arma el ticket en segundos." },
      { titulo: "Temporada sin sorpresas", texto: "Alertas de stock mínimo para resurtir antes del regreso a clases." },
      { titulo: "Mayoreo para escuelas", texto: "Precio especial para escuelas y negocios que compran volumen." },
    ],
    funciones: [
      { clave: "servicios", texto: "Copias, impresiones, engargolados y enmicados como servicio." },
      { clave: "ventaRapida", texto: "Cobro con lector de códigos o búsqueda por nombre." },
      { clave: "listasPrecio", texto: "Lista de mayoreo para escuelas y oficinas." },
      { clave: "importacion", texto: "Carga tu catálogo desde Excel." },
      { clave: "reportes", texto: "Qué se vende más en cada temporada." },
    ],
    modulos: ["servicios", "credito"],
    faqs: [
      { pregunta: "¿Puedo cobrar copias e impresiones?", respuesta: "Sí. Créalas como productos de tipo servicio: se cobran sin descontar inventario." },
      { pregunta: "¿Cómo cargo tantos artículos?", respuesta: "Importa tu lista desde Excel o CSV; el sistema detecta duplicados por código de barras." },
      { pregunta: "¿Puedo dar precio especial a escuelas?", respuesta: "Sí, con una lista de precios de mayoreo que eliges al cobrar." },
    ],
  },
  {
    slug: "carnicerias",
    nombre: { es: "Carnicería", en: "Butcher shop" },
    plural: "Carnicerías",
    tu: "tu carnicería",
    icono: Beef,
    config: "VERDULERIA",
    resumen:
      "Venta por kilo con precio exacto, control de mermas y precios de mayoreo para restaurantes.",
    queEs:
      "Un punto de venta para carnicerías calcula el importe de cada corte por su peso, registra las mermas del producto y te dice cuánto ganas realmente. Si surtes a restaurantes o fondas, también maneja precios de mayoreo y ventas a crédito.",
    beneficios: [
      { titulo: "Precio exacto por kilo", texto: "Capturas el peso y el sistema calcula el total del corte." },
      { titulo: "Mermas registradas", texto: "Lo que se pierde en limpieza o no se vende queda registrado." },
      { titulo: "Mayoreo y crédito", texto: "Precio especial y saldo para restaurantes y fondas." },
      { titulo: "Ganancia real", texto: "Reportes con lo vendido y la ganancia por periodo." },
    ],
    funciones: [
      { clave: "granel", texto: "Cortes de res, cerdo y pollo por kilo." },
      { clave: "mermas", texto: "Registro de mermas por producto." },
      { clave: "listasPrecio", texto: "Precio de mayoreo para restaurantes." },
      { clave: "credito", texto: "Crédito a clientes frecuentes." },
      { clave: "lotes", texto: "Productos empacados con fecha de caducidad." },
    ],
    modulos: ["granel", "mermas", "credito", "lotes"],
    faqs: [
      { pregunta: "¿Vende por kilo?", respuesta: "Sí. Activa la venta a granel en Configuración → Módulos y configura cada corte por kilo." },
      { pregunta: "¿Puedo llevar el crédito de restaurantes?", respuesta: "Sí, con el módulo de crédito cada cliente tiene su saldo y sus abonos." },
      { pregunta: "¿Cómo registro las mermas?", respuesta: "Con el módulo de mermas registras la cantidad perdida y el motivo; el inventario se ajusta." },
    ],
  },
  {
    slug: "panaderias",
    nombre: { es: "Panadería", en: "Bakery" },
    plural: "Panaderías",
    tu: "tu panadería",
    icono: Croissant,
    config: "GENERAL",
    resumen:
      "Cobro ágil en hora pico, control de lo que sobra al final del día y pedidos de mayoreo.",
    queEs:
      "Un punto de venta para panaderías agiliza el cobro cuando se llena el mostrador, registra el pan que sobra o se desperdicia y lleva los pedidos de mayoreo para cafeterías y tiendas. Con los reportes sabes qué pan se vende más y a qué hora, para hornear lo justo.",
    beneficios: [
      { titulo: "Cobro rápido en hora pico", texto: "Busca el pan por nombre y cobra en segundos." },
      { titulo: "Menos desperdicio", texto: "Registra lo que sobra como merma y ajusta tu producción." },
      { titulo: "Pedidos de mayoreo", texto: "Precio especial y crédito para cafeterías y tiendas." },
      { titulo: "Sabes qué hornear", texto: "Reportes de lo más vendido por periodo." },
    ],
    funciones: [
      { clave: "ventaRapida", texto: "Búsqueda por nombre y botones de favoritos para lo que más vendes." },
      { clave: "mermas", texto: "Registro del pan que sobra o se desperdicia." },
      { clave: "listasPrecio", texto: "Precio de mayoreo para cafeterías y tiendas." },
      { clave: "credito", texto: "Crédito a clientes de pedido frecuente." },
      { clave: "reportes", texto: "Productos más vendidos y ganancia." },
    ],
    modulos: ["mermas", "credito", "granel"],
    faqs: [
      { pregunta: "El pan no trae código de barras, ¿cómo cobro?", respuesta: "Buscas por nombre o marcas tus productos más vendidos como favoritos para tocarlos directo en el punto de venta." },
      { pregunta: "¿Puedo registrar el pan que sobra?", respuesta: "Sí, como merma: sale del inventario y queda registrado para que ajustes lo que horneas." },
      { pregunta: "¿Puedo vender a cafeterías con otro precio?", respuesta: "Sí, con una lista de precios de mayoreo." },
    ],
  },
  {
    slug: "dulcerias",
    nombre: { es: "Dulcería", en: "Candy store" },
    plural: "Dulcerías",
    tu: "tu dulcería",
    icono: Candy,
    config: "ABARROTES",
    resumen:
      "Dulces por pieza, a granel o por bolsa, con precios de mayoreo para fiestas y revendedores.",
    queEs:
      "Un punto de venta para dulcerías maneja dulces por pieza, a granel y en bolsa, y los precios especiales para quien compra para fiestas o para revender. También controla caducidades y te dice qué productos rotan más.",
    beneficios: [
      { titulo: "Pieza, bolsa o kilo", texto: "Cada producto con su unidad y su precio." },
      { titulo: "Mayoreo para fiestas", texto: "Lista de precios para revendedores y compras grandes." },
      { titulo: "Caducidades bajo control", texto: "Lotes con fecha para vender primero lo que vence." },
      { titulo: "Sabes qué rota", texto: "Reportes de lo más vendido." },
    ],
    funciones: [
      { clave: "granel", texto: "Dulces a granel por kilo." },
      { clave: "listasPrecio", texto: "Precio de mayoreo para revendedores." },
      { clave: "lotes", texto: "Caducidad por lote." },
      { clave: "ventaRapida", texto: "Cobro con lector de códigos." },
      { clave: "compras", texto: "Compras a distribuidores." },
    ],
    modulos: ["granel", "lotes", "credito"],
    faqs: [
      { pregunta: "¿Puedo vender dulces a granel?", respuesta: "Sí, activa la venta a granel y configura el producto por kilo." },
      { pregunta: "¿Maneja precio de mayoreo?", respuesta: "Sí, con listas de precios que eliges al cobrar." },
      { pregunta: "¿Controla la caducidad?", respuesta: "Sí, con lotes y fechas de caducidad." },
    ],
  },
  {
    slug: "licorerias",
    nombre: { es: "Licorería", en: "Liquor store" },
    plural: "Licorerías",
    tu: "tu licorería",
    icono: Wine,
    config: "ABARROTES",
    resumen:
      "Cobro rápido con código de barras, precios de mayoreo por caja y control de inventario de alto valor.",
    queEs:
      "Un punto de venta para licorerías controla un inventario de alto valor donde cada botella cuenta, cobra rápido en fin de semana y maneja precios especiales por caja o para eventos. Con los cortes de caja por cajero sabes que el dinero cuadra.",
    beneficios: [
      { titulo: "Cada botella contada", texto: "Inventario al día con cada venta y cada compra." },
      { titulo: "Precio por caja", texto: "Lista de mayoreo para eventos y negocios." },
      { titulo: "Caja que cuadra", texto: "Corte por cajero con diferencia visible." },
      { titulo: "Cobro rápido el fin de semana", texto: "Escanea y cobra sin filas largas." },
    ],
    funciones: [
      { clave: "ventaRapida", texto: "Cobro con lector de código de barras." },
      { clave: "listasPrecio", texto: "Precio por caja o para eventos." },
      { clave: "caja", texto: "Cortes de caja por cajero." },
      { clave: "compras", texto: "Compras a distribuidores con costo actualizado." },
      { clave: "reportes", texto: "Ganancia por producto y periodo." },
      { clave: "terminal", texto: "Cobro con tarjeta en terminal." },
    ],
    modulos: ["credito", "mermas"],
    faqs: [
      { pregunta: "¿Puedo dar precio por caja?", respuesta: "Sí, crea una lista de precios de mayoreo y elígela al cobrar." },
      { pregunta: "¿Cómo sé si la caja cuadra?", respuesta: "Al cerrar, cada cajero cuenta el efectivo y el sistema lo compara contra lo esperado." },
      { pregunta: "¿Acepta pagos con tarjeta?", respuesta: "Sí, puedes registrar pagos con tarjeta o transferencia, y conectar una terminal de cobro." },
    ],
  },
  {
    slug: "zapaterias",
    nombre: { es: "Zapatería", en: "Shoe store" },
    plural: "Zapaterías",
    tu: "tu zapatería",
    icono: Footprints,
    config: "ROPA",
    resumen:
      "Cada modelo por número y color con su propio stock, apartados a crédito y ventas por catálogo.",
    queEs:
      "Un punto de venta para zapaterías lleva el inventario por modelo, número y color, para que sepas al instante si tienes el 25 en negro sin ir a la bodega. También maneja ventas a crédito y precios para vendedoras por catálogo.",
    beneficios: [
      { titulo: "Stock por número y color", texto: "Cada combinación con sus existencias." },
      { titulo: "Respuesta inmediata", texto: "Sabes si hay el número que busca el cliente sin ir a la bodega." },
      { titulo: "Crédito y apartados", texto: "Saldo por cliente con sus abonos." },
      { titulo: "Precio para vendedoras", texto: "Lista de mayoreo para ventas por catálogo." },
    ],
    funciones: [
      { clave: "variantes", texto: "Modelos por número y color con stock independiente." },
      { clave: "credito", texto: "Ventas a crédito con abonos." },
      { clave: "listasPrecio", texto: "Precio para vendedoras por catálogo." },
      { clave: "sucursales", texto: "Traspasos entre sucursales." },
      { clave: "reportes", texto: "Modelos y números más vendidos." },
    ],
    modulos: ["variantes", "credito"],
    faqs: [
      { pregunta: "¿Maneja números de calzado?", respuesta: "Sí, con variantes: cada número y color tiene su propio stock y código." },
      { pregunta: "¿Puedo vender a crédito?", respuesta: "Sí, con el módulo de crédito registras el saldo y los abonos de cada cliente." },
      { pregunta: "¿Funciona con varias tiendas?", respuesta: "Sí, cada sucursal tiene su inventario y puedes traspasar pares entre ellas." },
    ],
  },
  {
    slug: "cremerias",
    nombre: { es: "Cremería", en: "Dairy shop" },
    plural: "Cremerías",
    tu: "tu cremería",
    icono: Milk,
    config: "VERDULERIA",
    resumen:
      "Quesos y carnes frías por kilo, caducidades por lote y mermas registradas.",
    queEs:
      "Un punto de venta para cremerías calcula el precio de quesos, cremas y carnes frías por peso, controla las fechas de caducidad por lote y registra lo que se pierde. Así tu inventario es real y tu ganancia también.",
    beneficios: [
      { titulo: "Precio exacto por kilo", texto: "Quesos y carnes frías con importe calculado por peso." },
      { titulo: "Caducidades bajo control", texto: "Cada lote con su fecha para vender primero lo que vence." },
      { titulo: "Mermas registradas", texto: "Lo que se echa a perder queda registrado." },
      { titulo: "Clientes de mayoreo", texto: "Precio especial para taquerías y fondas." },
    ],
    funciones: [
      { clave: "granel", texto: "Quesos, crema y jamón por kilo." },
      { clave: "lotes", texto: "Lotes con fecha de caducidad." },
      { clave: "mermas", texto: "Registro de producto que se echa a perder." },
      { clave: "listasPrecio", texto: "Precio de mayoreo para negocios." },
      { clave: "credito", texto: "Crédito a clientes frecuentes." },
    ],
    modulos: ["granel", "lotes", "mermas", "credito"],
    faqs: [
      { pregunta: "¿Vende quesos por kilo?", respuesta: "Sí, activa la venta a granel y configura cada producto por kilo." },
      { pregunta: "¿Controla la caducidad?", respuesta: "Sí, registra cada lote con su fecha al recibir la mercancía." },
      { pregunta: "¿Puedo dar crédito a taquerías?", respuesta: "Sí, con el módulo de crédito." },
    ],
  },
  {
    slug: "refaccionarias",
    nombre: { es: "Refaccionaria", en: "Auto parts store" },
    plural: "Refaccionarias",
    tu: "tu refaccionaria",
    icono: Cog,
    config: "FERRETERIA",
    resumen:
      "Catálogos grandes de refacciones, búsqueda por código o nombre y crédito a talleres.",
    queEs:
      "Un punto de venta para refaccionarias ordena miles de piezas con su código, te deja encontrarlas por nombre o número de parte y lleva el crédito de los talleres que te compran seguido. También te ayuda a pedir a tiempo lo que más se mueve.",
    beneficios: [
      { titulo: "Encuentras la pieza", texto: "Busca por código o por nombre entre miles de refacciones." },
      { titulo: "Crédito a talleres", texto: "Saldo por taller con sus pagos." },
      { titulo: "Precio para mecánicos", texto: "Lista de precios especial para talleres." },
      { titulo: "Compras a tiempo", texto: "Alertas de stock mínimo y órdenes a proveedores." },
    ],
    funciones: [
      { clave: "importacion", texto: "Carga tu catálogo de refacciones desde Excel." },
      { clave: "credito", texto: "Crédito a talleres y mecánicos." },
      { clave: "listasPrecio", texto: "Precio especial para talleres." },
      { clave: "compras", texto: "Órdenes de compra y recepción de mercancía." },
      { clave: "sucursales", texto: "Existencias por sucursal y traspasos." },
    ],
    modulos: ["credito"],
    faqs: [
      { pregunta: "¿Puedo buscar por número de parte?", respuesta: "Sí, el código de cada producto sirve para buscarlo o escanearlo." },
      { pregunta: "¿Maneja crédito a talleres?", respuesta: "Sí, cada taller tiene su saldo y registras sus abonos." },
      { pregunta: "¿Cómo cargo mi catálogo?", respuesta: "Importa tu lista desde Excel o CSV y asigna las columnas." },
    ],
  },
  {
    slug: "tiendas-de-regalos",
    nombre: { es: "Tienda de Regalos", en: "Gift shop" },
    plural: "Tiendas de Regalos",
    tu: "tu tienda de regalos",
    icono: Gift,
    config: "GENERAL",
    resumen:
      "Artículos variados, servicio de envoltura y temporadas altas sin perder el control del inventario.",
    queEs:
      "Un punto de venta para tiendas de regalos maneja artículos muy variados, cobra servicios como la envoltura y te ayuda a prepararte para temporadas altas —14 de febrero, día de las madres, Navidad— sabiendo qué se vendió el año anterior.",
    beneficios: [
      { titulo: "Envoltura en el ticket", texto: "Cobra la envoltura como servicio junto con el regalo." },
      { titulo: "Temporadas preparadas", texto: "Reportes de lo que más se vendió para pedir a tiempo." },
      { titulo: "Artículos por modelo", texto: "Variantes de color o diseño con su stock." },
      { titulo: "Caja que cuadra", texto: "Cortes de caja con diferencia visible." },
    ],
    funciones: [
      { clave: "servicios", texto: "Envoltura y personalización como servicio." },
      { clave: "variantes", texto: "Artículos por color o diseño." },
      { clave: "reportes", texto: "Lo más vendido por temporada." },
      { clave: "ventaRapida", texto: "Cobro con lector de códigos." },
      { clave: "terminal", texto: "Cobro con tarjeta." },
    ],
    modulos: ["servicios", "variantes"],
    faqs: [
      { pregunta: "¿Puedo cobrar la envoltura?", respuesta: "Sí, como producto de tipo servicio que no descuenta inventario." },
      { pregunta: "¿Cómo me preparo para temporadas altas?", respuesta: "Con los reportes de ventas por periodo ves qué se vendió más y resurtes antes." },
      { pregunta: "¿Acepta tarjeta?", respuesta: "Sí, puedes registrar pagos con tarjeta y conectar una terminal de cobro." },
    ],
  },
  {
    slug: "veterinarias",
    nombre: { es: "Veterinaria", en: "Veterinary clinic" },
    plural: "Veterinarias",
    tu: "tu veterinaria",
    icono: Stethoscope,
    config: "MASCOTAS",
    resumen:
      "Consultas y vacunas como servicio, medicamentos con caducidad y alimento a granel en un solo lugar.",
    queEs:
      "Un punto de venta para veterinarias cobra consultas, vacunas y estética como servicios, controla los medicamentos por lote y caducidad, y vende alimento y accesorios con su inventario. Todo en el mismo ticket y con cortes de caja claros.",
    beneficios: [
      { titulo: "Consulta y productos juntos", texto: "Cobra la consulta, la vacuna y el alimento en un solo ticket." },
      { titulo: "Medicamentos sin caducar", texto: "Lotes con fecha para usar primero lo que vence." },
      { titulo: "Alimento a granel", texto: "Croquetas por kilo o por bulto." },
      { titulo: "Clientes registrados", texto: "Consulta el historial de compras de cada cliente." },
    ],
    funciones: [
      { clave: "servicios", texto: "Consultas, vacunas y estética como servicio." },
      { clave: "lotes", texto: "Medicamentos por lote con caducidad." },
      { clave: "granel", texto: "Alimento por kilo." },
      { clave: "credito", texto: "Crédito a clientes de confianza." },
      { clave: "caja", texto: "Cortes de caja por turno." },
    ],
    modulos: ["servicios", "lotes", "granel", "credito"],
    faqs: [
      { pregunta: "¿Puedo cobrar consultas?", respuesta: "Sí, como productos de tipo servicio, sin inventario." },
      { pregunta: "¿Controla caducidad de medicamentos?", respuesta: "Sí, con lotes y fechas de caducidad." },
      { pregunta: "¿Lleva expediente de las mascotas?", respuesta: "No. SYMVORA es un punto de venta e inventario: registra al cliente y sus compras, pero no lleva historia clínica." },
    ],
  },
  {
    slug: "tiendas-de-cosmeticos",
    nombre: { es: "Cosméticos", en: "Cosmetics store" },
    plural: "Tiendas de Cosméticos",
    tu: "tu tienda de cosméticos",
    icono: Sparkles,
    config: "GENERAL",
    resumen:
      "Tonos y presentaciones con su propio stock, caducidades y precios para revendedoras.",
    queEs:
      "Un punto de venta para tiendas de cosméticos maneja cada tono y presentación como variante con su propio inventario, controla fechas de caducidad y ofrece precios especiales para revendedoras. Así sabes exactamente qué tono se está acabando.",
    beneficios: [
      { titulo: "Stock por tono", texto: "Cada tono o presentación con sus existencias." },
      { titulo: "Caducidades controladas", texto: "Lotes con fecha para no vender producto vencido." },
      { titulo: "Precio para revendedoras", texto: "Lista de mayoreo al cobrar." },
      { titulo: "Lo más vendido", texto: "Reportes para resurtir lo que rota." },
    ],
    funciones: [
      { clave: "variantes", texto: "Tonos y presentaciones con stock independiente." },
      { clave: "lotes", texto: "Caducidad por lote." },
      { clave: "listasPrecio", texto: "Precio para revendedoras." },
      { clave: "credito", texto: "Ventas a crédito." },
      { clave: "reportes", texto: "Productos más vendidos." },
    ],
    modulos: ["variantes", "lotes", "credito"],
    faqs: [
      { pregunta: "¿Maneja tonos?", respuesta: "Sí, con variantes: cada tono tiene su stock y su código." },
      { pregunta: "¿Controla caducidad?", respuesta: "Sí, con lotes y fechas de caducidad." },
      { pregunta: "¿Puedo dar precio a revendedoras?", respuesta: "Sí, con una lista de precios de mayoreo." },
    ],
  },
  {
    slug: "florerias",
    nombre: { es: "Florería", en: "Flower shop" },
    plural: "Florerías",
    tu: "tu florería",
    icono: Flower2,
    config: "VERDULERIA",
    resumen:
      "Flor por pieza o por ramo, arreglos como servicio y control de la flor que se marchita.",
    queEs:
      "Un punto de venta para florerías vende flores por pieza o por manojo, cobra arreglos y entregas como servicio y registra la flor que se marchita. Con eso conoces tu ganancia real en un negocio donde el producto dura pocos días.",
    beneficios: [
      { titulo: "Arreglos en el ticket", texto: "Cobra el arreglo o la entrega como servicio." },
      { titulo: "Mermas a la vista", texto: "La flor que se marchita queda registrada." },
      { titulo: "Temporadas preparadas", texto: "Reportes para 14 de febrero y 10 de mayo." },
      { titulo: "Crédito a clientes", texto: "Para eventos y clientes frecuentes." },
    ],
    funciones: [
      { clave: "servicios", texto: "Arreglos, entregas y decoración como servicio." },
      { clave: "mermas", texto: "Registro de flor marchita." },
      { clave: "reportes", texto: "Ventas por temporada." },
      { clave: "credito", texto: "Crédito para eventos." },
      { clave: "compras", texto: "Compras a proveedores de flor." },
    ],
    modulos: ["servicios", "mermas", "credito"],
    faqs: [
      { pregunta: "¿Puedo cobrar arreglos y entregas?", respuesta: "Sí, como productos de tipo servicio." },
      { pregunta: "¿Cómo registro la flor que se marchita?", respuesta: "Como merma: sale del inventario y la pérdida queda registrada." },
      { pregunta: "¿Puedo dar crédito para eventos?", respuesta: "Sí, con el módulo de crédito." },
    ],
  },
  {
    slug: "joyerias",
    nombre: { es: "Joyería y Bisutería", en: "Jewelry store" },
    plural: "Joyerías y Bisuterías",
    tu: "tu joyería",
    icono: Gem,
    config: "ROPA",
    resumen:
      "Piezas de alto valor bajo control, variantes por medida y apartados a crédito.",
    queEs:
      "Un punto de venta para joyerías y bisuterías controla un inventario de alto valor pieza por pieza, maneja medidas y acabados como variantes y lleva apartados y ventas a crédito con sus abonos.",
    beneficios: [
      { titulo: "Cada pieza contada", texto: "Inventario al día con cada venta." },
      { titulo: "Medidas y acabados", texto: "Anillos por medida, cadenas por largo, cada una con stock." },
      { titulo: "Apartados y crédito", texto: "Saldo por cliente con abonos." },
      { titulo: "Precio para revendedoras", texto: "Lista de mayoreo para bisutería." },
    ],
    funciones: [
      { clave: "variantes", texto: "Medidas, largos y acabados con stock independiente." },
      { clave: "credito", texto: "Apartados y ventas a crédito." },
      { clave: "listasPrecio", texto: "Precio para revendedoras." },
      { clave: "caja", texto: "Cortes de caja por cajero." },
      { clave: "terminal", texto: "Cobro con tarjeta." },
    ],
    modulos: ["variantes", "credito"],
    faqs: [
      { pregunta: "¿Maneja medidas de anillos?", respuesta: "Sí, con variantes: cada medida tiene su propio stock." },
      { pregunta: "¿Puedo hacer apartados?", respuesta: "Sí, con ventas a crédito: registras el saldo y los abonos del cliente." },
      { pregunta: "¿Acepta tarjeta?", respuesta: "Sí, registra pagos con tarjeta y conecta una terminal de cobro." },
    ],
  },
  {
    slug: "tiendas",
    nombre: { es: "Tienda General", en: "General store" },
    plural: "Tiendas y Negocios",
    tu: "tu negocio",
    icono: ShoppingBag,
    config: "GENERAL",
    resumen:
      "Un punto de venta flexible: activa solo los módulos que tu negocio necesita.",
    queEs:
      "Si tu giro no aparece en la lista, SYMVORA se adapta igual: es un punto de venta con inventario, compras, caja y reportes, y módulos que enciendes según tu negocio —venta por peso, variantes, caducidades, servicios o crédito—.",
    beneficios: [
      { titulo: "Solo lo que necesitas", texto: "Enciende o apaga módulos cuando quieras en Configuración." },
      { titulo: "Inventario al día", texto: "Cada venta y cada compra actualizan tus existencias." },
      { titulo: "Caja que cuadra", texto: "Cortes de caja con diferencia visible." },
      { titulo: "Crece contigo", texto: "Agrega usuarios y sucursales cuando los necesites." },
    ],
    funciones: [
      { clave: "ventaRapida", texto: "Cobro con lector de códigos o búsqueda por nombre." },
      { clave: "compras", texto: "Compras y órdenes a proveedores." },
      { clave: "caja", texto: "Apertura, movimientos y corte de caja." },
      { clave: "reportes", texto: "Ventas, productos y ganancia." },
      { clave: "sucursales", texto: "Varias sucursales con traspasos." },
      { clave: "importacion", texto: "Importa tu catálogo desde Excel." },
    ],
    modulos: ["credito", "servicios"],
    faqs: [
      { pregunta: "Mi giro no está en la lista, ¿me sirve?", respuesta: "Sí. Los módulos se activan según lo que vendes: por peso, con variantes, con caducidad, servicios o a crédito." },
      { pregunta: "¿Puedo agregar más usuarios?", respuesta: "Sí, das de alta a tu equipo y decides qué módulos ve cada uno." },
      { pregunta: "¿Funciona en celular?", respuesta: "Sí, funciona en celular, tablet y computadora desde el navegador." },
    ],
  },
];

/** Los que aparecen en la franja bajo los logos, en este orden (+ "Otros"). */
export const GIROS_FRANJA = [
  "abarrotes",
  "farmacias",
  "florerias",
  "papelerias",
  "verdulerias",
  "ferreterias",
  "licorerias",
  "dulcerias",
  "tiendas-de-ropa",
  "carnicerias",
  "zapaterias",
] as const;

export function giroPorSlug(slug: string): Giro | undefined {
  return GIROS.find((g) => g.slug === slug);
}

/** Ruta publica de la pagina de un giro (solo existe en español). */
export function rutaGiro(slug: string): string {
  return `/es/punto-de-venta/${slug}`;
}

/** Registro con el giro ya elegido (`auth-forms.tsx` lee `?giro=`). */
export function rutaRegistroGiro(giro: Giro): string {
  return `/es/auth?mode=signup&giro=${giro.config}`;
}
