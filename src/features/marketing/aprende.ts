import {
  ArrowRightLeft,
  BookOpen,
  ChartColumn,
  ClipboardList,
  CreditCard,
  Package,
  Rocket,
  Settings,
  ShoppingCart,
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
 *
 * VIDEO: pega en `videoYoutube` la URL tal cual la copias de YouTube (watch,
 * youtu.be, shorts o embed). `idYoutube` la entiende; si no es valida, la guia
 * se muestra sin video.
 *
 * CAPTURAS: `captura` es la ruta dentro de /public (por ejemplo
 * "/aprende/punto-de-venta/cobrar.webp"). Si no hay, el paso va sin imagen.
 */

export interface PasoGuia {
  titulo: string;
  texto: string;
  captura?: string;
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
          { titulo: "Regístrate", texto: "Entra a symvora.com.mx y pulsa «Prueba gratis». Captura tu nombre, el nombre de tu negocio y tu giro, o entra directo con tu cuenta de Google. Tienes 14 días de prueba con todas las funciones, sin tarjeta." },
          { titulo: "Si entraste con Google", texto: "La primera vez te pedimos los datos de tu negocio en «Completa tu registro». Al terminar quedas como dueño (Super Administrador) de la cuenta." },
        ],
      },
      {
        id: "configurar",
        titulo: "Configura tu negocio",
        pasos: [
          { titulo: "Datos y logo", texto: "En Configuración → General captura nombre comercial, teléfono, dirección y correo, y sube tu logo. Se usan en tus tickets." },
          { titulo: "Activa solo lo que usas", texto: "En Configuración → Módulos enciende lo que tu negocio necesita: venta a granel, variantes de talla y color, lotes y caducidades, mermas, servicios o ventas a crédito. Puedes cambiarlo cuando quieras." },
        ],
      },
      {
        id: "primera-venta",
        titulo: "Tu primera venta",
        pasos: [
          { titulo: "Da de alta un proveedor y un producto", texto: "En Compras registra a tu proveedor y en Productos pulsa «Agregar producto»: nombre, precio de venta, costo, unidad y código de barras. Si ya tienes tu lista en Excel, impórtala." },
          { titulo: "Abre la caja", texto: "En Finanzas pulsa «Abrir caja» y captura el efectivo con el que empiezas (fondo inicial). Sin caja abierta no se puede vender." },
          { titulo: "Cobra", texto: "En Punto de Venta escanea o busca el producto, elige el método de pago y pulsa «Completar venta». El inventario se descuenta solo." },
        ],
      },
    ],
    consejos: [
      "Invita a tu equipo desde Usuarios antes de empezar a vender: así cada venta queda registrada con quién la hizo.",
      "El botón «Ver tutorial» de la barra superior te lleva por los módulos principales en unos minutos.",
    ],
    relacionadas: ["punto-de-venta", "productos-e-inventario", "caja-y-finanzas"],
  },
  {
    slug: "punto-de-venta",
    titulo: "Punto de venta",
    icono: ShoppingCart,
    resumen: "Cobra rápido con lector de códigos, variantes, listas de precios, crédito y varios métodos de pago.",
    rutasApp: ["/pos"],
    secciones: [
      {
        id: "armar-venta",
        titulo: "Arma la venta",
        pasos: [
          { titulo: "Escanea o busca", texto: "Con un lector de código de barras el producto entra directo al carrito. Sin lector, escribe el nombre o el código en el buscador. También puedes filtrar por categoría o por tus favoritos." },
          { titulo: "Productos con variantes", texto: "Si el producto tiene tallas o colores, al elegirlo se abre la selección de variante: cada una tiene su propio precio y stock." },
          { titulo: "Productos por peso o medida", texto: "Si el producto se vende por kilo, litro o metro, al agregarlo se abre «¿Cuánto?»: escribe la cantidad (por ejemplo 0.750) o usa los atajos ¼, ½, 1 y 2, y ves el importe antes de agregarlo." },
          { titulo: "Cantidades y quitar productos", texto: "En el carrito toca la cantidad para escribirla (sirve también para 24 piezas) o usa + y −. Con el bote de basura quitas el producto. El total se actualiza al momento." },
          { titulo: "Precios de mayoreo", texto: "Si tienes listas de precios, elige la lista antes de cobrar y se aplica a los productos que incluye. Al terminar la venta vuelve a precios normales, para que el siguiente cliente no se lleve el precio de mayoreo por error." },
        ],
      },
      {
        id: "cobrar",
        titulo: "Cobra",
        pasos: [
          { titulo: "Elige el método de pago", texto: "Efectivo, tarjeta, transferencia, crédito/fiado o tarjeta con terminal. En efectivo captura con cuánto te pagan y el sistema calcula el cambio." },
          { titulo: "Venta a crédito", texto: "Elige al cliente y el método «Crédito / Fiado». El importe se suma a su saldo; los abonos se registran después." },
          { titulo: "Completa y entrega el ticket", texto: "Pulsa «Completar venta». Se descuenta el inventario, se registra el dinero en tu caja y puedes imprimir el ticket." },
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
      "Al cambiar de sucursal con productos en el carrito, la venta en curso se vacía, porque esos productos pueden no existir en el otro local.",
    ],
    relacionadas: ["caja-y-finanzas", "productos-e-inventario", "clientes-y-credito"],
  },
  {
    slug: "productos-e-inventario",
    titulo: "Productos e inventario",
    icono: Package,
    resumen: "Da de alta tu catálogo, maneja variantes, lotes y caducidades, e importa desde Excel.",
    rutasApp: ["/products"],
    secciones: [
      {
        id: "alta",
        titulo: "Alta de productos",
        pasos: [
          { titulo: "Agregar producto", texto: "En Productos pulsa «Agregar producto». Captura nombre, precio de venta, costo de compra, unidad, stock actual, stock mínimo y código de barras. Con el costo, el sistema calcula tu margen." },
          { titulo: "Servicios", texto: "Si activaste los servicios, marca el producto como servicio: se cobra pero no descuenta inventario (copias, reparaciones, consultas)." },
          { titulo: "Stock mínimo", texto: "Cuando un producto llega a su mínimo aparece como stock bajo, para que lo resurtas a tiempo." },
        ],
      },
      {
        id: "variantes-lotes",
        titulo: "Variantes, lotes y granel",
        pasos: [
          { titulo: "Variantes", texto: "Con el módulo de variantes encendido, un producto puede tener tallas y colores. Cada combinación lleva su propio stock, precio y código." },
          { titulo: "Lotes y caducidades", texto: "Con lotes encendido, registra cada entrada con su fecha de caducidad para vender primero lo que vence antes." },
          { titulo: "Venta por peso o medida", texto: "Con el módulo «Venta por peso o medida» encendido, elige como unidad kilogramo, gramo, litro, mililitro o metro. En el punto de venta, al agregar el producto capturas la cantidad (por ejemplo 0.750 kg o 3.5 m) y el importe se calcula solo. También hay caja, paquete, par y docena para lo que se vende cerrado." },
        ],
      },
      {
        id: "importar",
        titulo: "Importar desde Excel",
        pasos: [
          { titulo: "Sube tu archivo", texto: "En Productos pulsa «Importar» y sube tu lista en CSV o Excel." },
          { titulo: "Asigna las columnas", texto: "Indica qué columna es el nombre, el precio, el costo, el código, etc. El sistema detecta los códigos de barras repetidos y te deja omitir, actualizar o generar uno nuevo." },
        ],
      },
      {
        id: "ajustes",
        titulo: "Ajustes y mermas",
        pasos: [
          { titulo: "Ajuste de inventario", texto: "Si al contar el anaquel no coincide con el sistema, registra un ajuste con el motivo. Queda guardado quién y cuándo lo hizo." },
          { titulo: "Mermas", texto: "Con el módulo de mermas registras lo que se echa a perder o se daña. Sale del inventario y la pérdida queda registrada." },
        ],
      },
    ],
    consejos: [
      "Con varias sucursales, el stock que ves en Productos depende de la sucursal elegida arriba; en «Todas» ves la suma del negocio.",
      "Puedes editar precio y stock directo en la tabla sin abrir el producto.",
    ],
    relacionadas: ["compras-y-ordenes", "sucursales", "punto-de-venta"],
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
          { titulo: "Alta de cliente", texto: "En Clientes pulsa «Agregar cliente» y captura su nombre y datos de contacto. También puedes darlo de alta desde el punto de venta al cobrar." },
          { titulo: "Consulta su saldo", texto: "En la tabla de Clientes ves el saldo pendiente de cada uno." },
        ],
      },
      {
        id: "credito",
        titulo: "Crédito y abonos",
        pasos: [
          { titulo: "Activa el crédito", texto: "En Configuración → Módulos enciende «Ventas a crédito / fiado»." },
          { titulo: "Vende a crédito", texto: "En el punto de venta elige al cliente y el método «Crédito / Fiado». El importe se suma a su saldo." },
          { titulo: "Registra abonos", texto: "Cuando el cliente paga, usa el botón de abono en su fila de la tabla de Clientes y captura el monto y el método de pago: su saldo baja al momento." },
        ],
      },
    ],
    consejos: ["Las ventas a crédito no suman al efectivo de tu caja: el dinero entra cuando se registra el abono."],
    relacionadas: ["punto-de-venta", "caja-y-finanzas"],
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
          { titulo: "Alta de proveedor", texto: "En Compras da de alta a tus proveedores con su nombre y teléfono. Sin proveedor no se pueden registrar compras." },
        ],
      },
      {
        id: "compra-directa",
        titulo: "Compra directa",
        pasos: [
          { titulo: "Registra lo que te llegó", texto: "En Compras pulsa «Agregar compra», elige el proveedor y agrega los productos con cantidad y costo. Al guardar, el stock sube y el costo del producto se actualiza." },
          { titulo: "Con varias sucursales", texto: "Elige a qué sucursal llega la mercancía; el stock sube solo en esa." },
          { titulo: "Si te equivocaste", texto: "Cancela la compra: el sistema devuelve al inventario lo que había sumado." },
        ],
      },
      {
        id: "ordenes",
        titulo: "Órdenes de compra",
        pasos: [
          { titulo: "Crea la orden", texto: "En Órdenes de Compra arma el pedido a tu proveedor. Si tiene teléfono, puedes mandarle el pedido por WhatsApp con el mensaje ya escrito." },
          { titulo: "Recibe la mercancía", texto: "Cuando llegue, marca la orden como recibida y captura lo que realmente llegó. En ese momento sube el inventario." },
        ],
      },
    ],
    consejos: ["Revisa los productos con stock bajo antes de armar tu orden de compra."],
    relacionadas: ["productos-e-inventario", "sucursales"],
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
          { titulo: "Registra movimientos", texto: "Pulsa «Agregar movimiento» para registrar dinero que entra (un cambio que te traen) o que sale (pago a un proveedor, un gasto) con su descripción." },
        ],
      },
      {
        id: "corte",
        titulo: "Corte de caja",
        pasos: [
          { titulo: "Cierra la caja", texto: "Al terminar tu turno pulsa «Cerrar caja». Verás el fondo inicial, las ventas, las entradas, las salidas y el saldo esperado." },
          { titulo: "Cuenta y captura el saldo real", texto: "Cuenta el efectivo y captúralo. El sistema muestra la diferencia: si cuadra, si falta o si sobra. Puedes dejar una nota." },
          { titulo: "Aviso al dueño", texto: "Si quien cierra es un cajero o un administrador, al dueño le llega un correo con el corte completo y, si hay varias sucursales, de cuál fue." },
        ],
      },
      {
        id: "cierre-automatico",
        titulo: "Cierre automático",
        pasos: [
          { titulo: "Cajas olvidadas", texto: "Si una caja se queda abierta, el sistema la cierra al final del día (23:59, hora del centro de México) con el saldo esperado, y avisa por correo al usuario y al dueño." },
        ],
      },
    ],
    consejos: ["Cada usuario ve y cierra solo su propia caja; con varias sucursales, el dueño puede tener una caja abierta en cada local."],
    relacionadas: ["punto-de-venta", "reportes-y-dashboard"],
  },
  {
    slug: "reportes-y-dashboard",
    titulo: "Reportes y dashboard",
    icono: ChartColumn,
    resumen: "Consulta ventas, ganancia, ticket promedio y productos más vendidos por periodo y sucursal.",
    rutasApp: ["/reports", "/dashboard"],
    secciones: [
      {
        id: "dashboard",
        titulo: "Dashboard",
        pasos: [
          { titulo: "Tus cifras del día y del mes", texto: "Al entrar ves las ventas de hoy, del mes, la ganancia, el ticket promedio, los clientes atendidos y los productos vendidos." },
          { titulo: "Por sucursal", texto: "Con varias sucursales, usa el filtro junto a «Actualizar» para ver un local o todos juntos." },
        ],
      },
      {
        id: "reportes",
        titulo: "Reportes",
        pasos: [
          { titulo: "Elige el periodo", texto: "En Reportes elige el rango de fechas para ver ventas, productos más vendidos y métodos de pago." },
        ],
      },
    ],
    consejos: ["Dashboard y Reportes muestran las cifras del negocio: de fábrica los cajeros no los ven. El dueño puede concederlos desde Usuarios."],
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
          { titulo: "Tu segunda sucursal", texto: "Mientras tengas un solo local, en Configuración verás «¿Abriste otro local? Da de alta tu segunda sucursal». Con dos o más, el módulo Sucursales aparece en el menú." },
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
          { titulo: "Mueve mercancía", texto: "En Sucursales → Traspasos elige origen, destino y productos. O pasa todo o no pasa nada: si en el origen no alcanza, el sistema te dice de qué producto y cuánto queda." },
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
          { titulo: "Crea la clave", texto: "En Usuarios genera una clave de empleado con el rol (Cajero o Administrador) y, si tienes varias sucursales, en cuáles trabajará." },
          { titulo: "El empleado entra con su clave", texto: "En la pantalla de inicio de sesión elige «¿Eres empleado o colaborador? Ingresa tu clave»." },
        ],
      },
      {
        id: "roles",
        titulo: "Roles y permisos",
        pasos: [
          { titulo: "Qué ve cada rol", texto: "De fábrica, el cajero usa Punto de Venta, Productos, Clientes, Compras, Órdenes de Compra y su propia caja en Finanzas. El administrador además ve reportes, configuración y bitácora." },
          { titulo: "Permisos por usuario", texto: "Con el botón de permisos de cada usuario enciendes o apagas módulos solo para esa persona, por ejemplo darle Reportes a un encargado." },
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
          { titulo: "Qué se registra", texto: "Altas, ediciones y eliminaciones de productos, ventas, cajas, compras, traspasos y usuarios, con quién lo hizo y cuándo." },
          { titulo: "Filtra por módulo", texto: "Usa el filtro para ver solo lo relacionado con productos, ventas, cajas, compras u otro módulo." },
        ],
      },
    ],
    consejos: ["De fábrica la ven el dueño y los administradores; puedes concederla a otro usuario desde Usuarios."],
    relacionadas: ["usuarios-y-permisos"],
  },
  {
    slug: "configuracion",
    titulo: "Configuración y métodos de pago",
    icono: Settings,
    resumen: "Datos del negocio, logo, módulos que se activan y cobro con terminal.",
    rutasApp: ["/settings"],
    secciones: [
      {
        id: "general",
        titulo: "General",
        pasos: [
          { titulo: "Datos del negocio", texto: "Nombre comercial, teléfono, dirección, correo y logo. Aparecen en tus tickets." },
        ],
      },
      {
        id: "modulos",
        titulo: "Módulos",
        pasos: [
          { titulo: "Enciende lo que necesitas", texto: "Venta por peso o medida, variantes de talla y color, lotes y caducidades, mermas, servicios y ventas a crédito. Cada interruptor muestra u oculta sus opciones en todo el sistema (unidades, pestañas, métodos de pago). Apagar uno no borra nada: lo que ya lo usa sigue funcionando." },
        ],
      },
      {
        id: "pagos",
        titulo: "Métodos de pago",
        pasos: [
          { titulo: "Terminal de cobro", texto: "En Métodos de pago conecta tu terminal para cobrar con tarjeta desde el punto de venta con el método «Tarjeta (terminal)»." },
        ],
      },
    ],
    relacionadas: ["primeros-pasos", "punto-de-venta"],
  },
  {
    slug: "suscripcion",
    titulo: "Suscripción",
    icono: CreditCard,
    resumen: "Prueba gratuita, planes mensual y anual, pago con tarjeta o en efectivo y fechas de cobro.",
    rutasApp: ["/billing"],
    secciones: [
      {
        id: "prueba",
        titulo: "Prueba gratuita",
        pasos: [
          { titulo: "14 días completos", texto: "Tu cuenta empieza con 14 días de prueba con todas las funciones. En Suscripción ves cuántos días te quedan." },
        ],
      },
      {
        id: "pagar",
        titulo: "Planes y pago",
        pasos: [
          { titulo: "Mensual o anual", texto: "Elige el plan mensual o el anual, que sale más barato por mes." },
          { titulo: "Con tarjeta", texto: "«Pagar con tarjeta» activa el cobro automático: tu tarjeta se carga sola cada periodo." },
          { titulo: "En efectivo", texto: "«Pagar en efectivo en tienda» genera un pago único; no se renueva solo y tendrás que volver a pagar cada periodo." },
        ],
      },
      {
        id: "fechas",
        titulo: "Fechas y cancelación",
        pasos: [
          { titulo: "Último pago y próximo cobro", texto: "En Estado de suscripción ves tu último pago y el próximo cobro. Si pagaste en efectivo o cancelaste, verás hasta cuándo está vigente." },
          { titulo: "Cancelar", texto: "Puedes cancelar cuando quieras desde Suscripción; tus datos se conservan." },
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
