/**
 * Convierte a WebP las capturas de las guías de Aprende (`src/features/marketing/aprende.ts`).
 *
 *   node scripts/capturas-aprende.mjs [carpeta-origen]
 *
 * Origen: las capturas originales por módulo (por defecto ~/Imágenes/MODULOS),
 * que NO viven en el repo. Destino: public/aprende/<guia>/<nombre>.webp.
 *
 * - Computadora: máximo 1600 px de ancho. Las ventanas (`ventana: true`) se
 *   recortan a la franja central, donde se abren los diálogos, para que el texto
 *   se lea; se muestran a su tamaño.
 * - Celular: máximo 720 px de ancho.
 * - Nunca agranda una imagen chica. Se puede correr otra vez: sobrescribe.
 *
 * Imprime un JSON con el ancho y alto finales de cada una: van en `captura` /
 * `capturaMovil` del paso correspondiente.
 */
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import sharp from "sharp";

const ORIGEN = resolve(process.argv[2] ?? join(homedir(), "Imágenes", "MODULOS"));
const PUBLICO = resolve("public");
const ANCHO = { d: 1600, m: 720 };
/** Franja central de una pantalla de escritorio donde se abren las ventanas. */
const VENTANA = { desde: 0.3, hasta: 0.7 };

/**
 * [guía, paso (título exacto), d = computadora | m = celular, origen, nombre, ventana?]
 * Quedan fuera a propósito: Bitácora (muestra correos del equipo), Suscripción
 * (muestra un precio promocional) y lo que enseña datos de una persona (correo,
 * celular, nombre de un colaborador) o una clave de acceso.
 */
const CAPTURAS = [
  // Punto de venta
  ["punto-de-venta", "Escanea o busca", "d", "PUNTO DE VENTA/DESKTOP/lector_codigo_barras.jpg", "escanear"],
  ["punto-de-venta", "Escanea o busca", "m", "PUNTO DE VENTA/MOBILE/lector_codigo_barras.jpg", "escanear-movil"],
  ["punto-de-venta", "Cantidades y quitar productos", "d", "PUNTO DE VENTA/DESKTOP/punto_venta__carrito_desktop", "carrito"],
  ["punto-de-venta", "Cantidades y quitar productos", "m", "PUNTO DE VENTA/MOBILE/punto_venta__carrito_mobile_02.jpg", "carrito-movil"],
  ["punto-de-venta", "Precios de mayoreo", "d", "PUNTO DE VENTA/DESKTOP/lista_precios.jpg", "lista-de-precios"],
  ["punto-de-venta", "Elige el método de pago", "d", "PUNTO DE VENTA/DESKTOP/carrito_metodo de pago.jpg", "metodo-de-pago"],
  ["punto-de-venta", "Elige el método de pago", "m", "PUNTO DE VENTA/MOBILE/carrito_mobile.jpg", "metodo-de-pago-movil"],
  ["punto-de-venta", "Entrega el ticket", "d", "PUNTO DE VENTA/DESKTOP/ticket_compra.jpg", "ticket", true],
  ["punto-de-venta", "Entrega el ticket", "m", "PUNTO DE VENTA/MOBILE/ticket_mobile.jpg", "ticket-movil"],
  ["punto-de-venta", "Ajustes del mostrador", "m", "PUNTO DE VENTA/MOBILE/ajustes_mostrador.jpg", "ajustes-mostrador-movil"],
  ["punto-de-venta", "El carrito abajo", "m", "PUNTO DE VENTA/MOBILE/punto_venta__carrito_mobile_01.jpg", "barra-carrito-movil"],
  ["punto-de-venta", "Cambia de sucursal", "d", "SUCURSALES/DESKTOP/punto_venta_sucursales.png", "cambiar-sucursal"],
  ["punto-de-venta", "Cambia de sucursal", "m", "SUCURSALES/MOBILE/punto_venta_sucursales.png", "cambiar-sucursal-movil"],

  // Productos e inventario
  ["productos-e-inventario", "Agregar producto", "d", "PRODUCTOS/desktop/agregar_producto.jpg", "agregar-producto"],
  ["productos-e-inventario", "Agregar producto", "m", "PRODUCTOS/mobile/menu_agregar_producto.jpg", "agregar-producto-movil"],
  ["productos-e-inventario", "¿Cómo se vende?", "d", "PRODUCTOS/desktop/crear_producto_01.jpg", "como-se-vende", true],
  ["productos-e-inventario", "¿Cómo se vende?", "m", "PRODUCTOS/mobile/crear_producto_unico_01.jpg", "como-se-vende-movil"],
  ["productos-e-inventario", "Foto del producto", "d", "PRODUCTOS/desktop/crear_producto_06.jpg", "foto-producto", true],
  ["productos-e-inventario", "Foto del producto", "m", "PRODUCTOS/mobile/crear_producto_05.jpg", "foto-producto-movil"],
  ["productos-e-inventario", "Servicios", "d", "PRODUCTOS/desktop/crear_producto_03.jpg", "inventario-y-servicio", true],
  ["productos-e-inventario", "Servicios", "m", "PRODUCTOS/mobile/crear_producto_03.jpg", "inventario-y-servicio-movil"],
  ["productos-e-inventario", "Producto con variantes", "d", "PRODUCTOS/desktop/crear_producto_variante_01.jpg", "producto-con-variantes", true],
  ["productos-e-inventario", "Producto con variantes", "m", "PRODUCTOS/mobile/crear:productros_variante_01.jpg", "producto-con-variantes-movil"],
  ["productos-e-inventario", "Sube tu archivo", "d", "PRODUCTOS/desktop/importar_catalogo.jpg", "importar", true],
  ["productos-e-inventario", "Sube tu archivo", "m", "PRODUCTOS/mobile/importar_catalogo.jpg", "importar-movil"],
  ["productos-e-inventario", "Precios de mayoreo o especiales", "d", "PRODUCTOS/desktop/nueva_lista_precios_agregar_productos.jpg", "lista-de-precios", true],
  ["productos-e-inventario", "Precios de mayoreo o especiales", "m", "PRODUCTOS/mobile/lista_precios.jpg", "lista-de-precios-movil"],

  // Lotes
  ["lotes-caducidades-e-insumos", "Registrar lote", "m", "PRODUCTOS/mobile/producto_registrar_lote.jpg", "registrar-lote-movil"],

  // Compras y órdenes
  ["compras-y-ordenes", "Alta de proveedor", "d", "COMPRAS/DESKTOP/proveedores_agregar_nuevo.jpg", "agregar-proveedor", true],
  ["compras-y-ordenes", "Alta de proveedor", "m", "COMPRAS/MOBILE/proveedores_agregar_nuevo.jpg", "agregar-proveedor-movil"],
  ["compras-y-ordenes", "Registra lo que te llegó", "d", "COMPRAS/DESKTOP/nueva_compra_productos.jpg", "nueva-compra", true],
  ["compras-y-ordenes", "Registra lo que te llegó", "m", "COMPRAS/MOBILE/nueva_compra_productos.jpg", "nueva-compra-movil"],
  ["compras-y-ordenes", "Crea la orden", "d", "ORDENES DE COMPRA/DESKTOP/nueva_orden_compra.jpg", "nueva-orden", true],
  ["compras-y-ordenes", "Crea la orden", "m", "ORDENES DE COMPRA/MOBILE/nueva_orden_compra.jpg", "nueva-orden-movil"],
  ["compras-y-ordenes", "Recibe la mercancía", "d", "ORDENES DE COMPRA/DESKTOP/recibir_mercancia.jpg", "recibir-mercancia", true],
  ["compras-y-ordenes", "Recibe la mercancía", "m", "ORDENES DE COMPRA/MOBILE/recibir_orden.jpg", "recibir-mercancia-movil"],

  // Caja y finanzas
  ["caja-y-finanzas", "Fondo inicial", "d", "FINANZAS/desktop/abrir_caja.jpg", "abrir-caja", true],
  ["caja-y-finanzas", "Fondo inicial", "m", "FINANZAS/mobile/abrir_caja.jpg", "abrir-caja-movil"],
  ["caja-y-finanzas", "Registra movimientos", "d", "FINANZAS/desktop/agrega_movimiento.jpg", "movimiento", true],
  ["caja-y-finanzas", "Registra movimientos", "m", "FINANZAS/mobile/movimiento.jpg", "movimiento-movil"],
  ["caja-y-finanzas", "Cierra la caja", "d", "FINANZAS/desktop/cerrar_caja.jpg", "cerrar-caja", true],
  ["caja-y-finanzas", "Cierra la caja", "m", "FINANZAS/mobile/cerrar_caja.jpg", "cerrar-caja-movil"],

  // Clientes y crédito
  ["clientes-y-credito", "Alta de cliente", "d", "CLIENTES/DESKTOP/nuevo_cliente_puntoventa.jpg", "nuevo-cliente", true],
  ["clientes-y-credito", "Consulta su saldo", "d", "CLIENTES/DESKTOP/clientes.jpg", "clientes"],
  ["clientes-y-credito", "Consulta su saldo", "m", "CLIENTES/MOBILE/clientes.jpg", "clientes-movil"],
  ["clientes-y-credito", "Registra abonos", "d", "CLIENTES/DESKTOP/c_registrar_abono.jpg", "abono", true],
  ["clientes-y-credito", "Registra abonos", "m", "CLIENTES/MOBILE/abonar.jpg", "abono-movil"],

  // Tarjetas de lealtad
  ["tarjetas-de-lealtad", "Define el premio", "d", "CLIENTES/DESKTOP/tarjeta_lealtad_01.jpg", "programa"],
  ["tarjetas-de-lealtad", "Define el premio", "m", "CLIENTES/MOBILE/c_tarjeta_lealtad_configuracion.jpg", "programa-movil"],
  ["tarjetas-de-lealtad", "Compártela", "d", "CLIENTES/DESKTOP/c_tarjeta_cliente.jpg", "compartir-tarjeta", true],
  ["tarjetas-de-lealtad", "Compártela", "m", "CLIENTES/MOBILE/tarjeta_lealtad_ej.jpg", "compartir-tarjeta-movil"],
  ["tarjetas-de-lealtad", "Adjunta la tarjeta", "d", "PUNTO DE VENTA/DESKTOP/lector_tarjeta_lealtad.jpg", "escanear-tarjeta"],
  ["tarjetas-de-lealtad", "Adjunta la tarjeta", "m", "PUNTO DE VENTA/MOBILE/lector_qr_tarjeta_lealtad.jpg", "escanear-tarjeta-movil"],
  ["tarjetas-de-lealtad", "Cómo va tu programa", "d", "CLIENTES/DESKTOP/tarjeta_lealtad.jpg", "panel"],
  ["tarjetas-de-lealtad", "Cómo va tu programa", "m", "CLIENTES/MOBILE/c_tarjetas_lealtad.jpg", "panel-movil"],

  // Reportes y dashboard
  ["reportes-y-dashboard", "Tus cifras del día y del mes", "d", "REPORTES/DESKTOP/dashboard.jpg", "dashboard"],
  ["reportes-y-dashboard", "Tus cifras del día y del mes", "m", "REPORTES/MOBILE/dashboard.jpg", "dashboard-movil"],
  ["reportes-y-dashboard", "Por sucursal", "d", "SUCURSALES/DESKTOP/dashboard_sucursales.png", "dashboard-sucursal"],
  ["reportes-y-dashboard", "Elige el periodo", "d", "REPORTES/DESKTOP/filtros.jpg", "periodo"],
  ["reportes-y-dashboard", "Elige el periodo", "m", "REPORTES/MOBILE/reportes_filtrados.jpg", "periodo-movil"],
  ["reportes-y-dashboard", "Ganancia sobre productos", "d", "REPORTES/DESKTOP/reportes_productos.jpg", "productos"],
  ["reportes-y-dashboard", "Ganancia sobre productos", "m", "REPORTES/MOBILE/reportes_productos.jpg", "productos-movil"],
  ["reportes-y-dashboard", "Gráficas", "d", "REPORTES/DESKTOP/reportes_resumen_02.jpg", "graficas"],
  ["reportes-y-dashboard", "Gráficas", "m", "REPORTES/MOBILE/reportes_resumen_01.jpg", "graficas-movil"],
  ["reportes-y-dashboard", "Exporta tu reporte", "d", "REPORTES/DESKTOP/reportes_exportar.jpg", "exportar"],
  ["reportes-y-dashboard", "Exporta tu reporte", "m", "REPORTES/MOBILE/reportes_exportar.jpg", "exportar-movil"],
  ["reportes-y-dashboard", "Historial de ventas", "d", "REPORTES/DESKTOP/reportes_historial.jpg", "historial"],
  ["reportes-y-dashboard", "Historial de ventas", "m", "REPORTES/MOBILE/reportes_historial.jpg", "historial-movil"],

  // Sucursales
  ["sucursales", "Tu segunda sucursal", "d", "SUCURSALES/DESKTOP/alta_sucursal.png", "alta"],
  ["sucursales", "Tu segunda sucursal", "m", "SUCURSALES/MOBILE/sucursales_dar_alta.png", "alta-movil"],
  ["sucursales", "Cerrar un local", "d", "SUCURSALES/DESKTOP/sucursal_alta_cierre.png", "alta-y-cierre"],
  ["sucursales", "Cerrar un local", "m", "SUCURSALES/MOBILE/sucursales_locales.png", "alta-y-cierre-movil"],
  ["sucursales", "Consulta y ajusta", "d", "SUCURSALES/DESKTOP/sucursal_existencias.png", "existencias"],
  ["sucursales", "Consulta y ajusta", "m", "SUCURSALES/MOBILE/sucursales_existencias.png", "existencias-movil"],
  ["sucursales", "Mueve mercancía", "d", "SUCURSALES/DESKTOP/sucursales_traspasos.png", "traspasos"],
  ["sucursales", "Mueve mercancía", "m", "SUCURSALES/MOBILE/sucursales_traspasos.png", "traspasos-movil"],

  // Usuarios y permisos
  ["usuarios-y-permisos", "Agrega al usuario", "d", "USUARIOS/DESKTOP/agregar_usuario.jpg", "agregar-usuario", true],
  ["usuarios-y-permisos", "Agrega al usuario", "m", "USUARIOS/MOBILE/agregar_usuario.jpg", "agregar-usuario-movil"],
  ["usuarios-y-permisos", "El empleado entra con su clave", "d", "USUARIOS/DESKTOP/acceso_colaborador.jpg", "acceso-con-clave"],
  ["usuarios-y-permisos", "El empleado entra con su clave", "m", "USUARIOS/MOBILE/login_colaborador.jpg", "acceso-con-clave-movil"],
  ["usuarios-y-permisos", "Qué ve cada rol", "m", "USUARIOS/MOBILE/modulos_cajero.png", "modulos-cajero-movil"],

  // Configuración
  ["configuracion", "Datos del negocio", "d", "CONFIGURACION_BITACORA/DESKTOP/configuracion_general.png", "general"],
  ["configuracion", "Datos del negocio", "m", "CONFIGURACION_BITACORA/MOBILE/configuracion_general.png", "general-movil"],
  ["configuracion", "Enciende lo que necesitas", "d", "CONFIGURACION_BITACORA/DESKTOP/configuracion_modulos.png", "modulos"],
  ["configuracion", "Enciende lo que necesitas", "m", "CONFIGURACION_BITACORA/MOBILE/configuracion_modulos.png", "modulos-movil"],
  ["configuracion", "Terminal Mercado Pago Point", "d", "CONFIGURACION_BITACORA/DESKTOP/configuracion_mercado_pago.png", "mercado-pago"],
  ["configuracion", "Terminal Mercado Pago Point", "m", "CONFIGURACION_BITACORA/MOBILE/configuracion_mercado_pago.png", "mercado-pago-movil"],
  ["configuracion", "Conecta tu impresora", "d", "CONFIGURACION_BITACORA/DESKTOP/configuracion_impresora.png", "impresora"],
  ["configuracion", "Conecta tu impresora", "m", "CONFIGURACION_BITACORA/MOBILE/configuracion_impresora.png", "impresora-movil"],
];

const resultado = [];
for (const [guia, paso, tipo, origen, nombre, ventana] of CAPTURAS) {
  const archivo = join(ORIGEN, origen);
  let img = sharp(archivo).rotate();
  if (ventana) {
    const { width, height } = await sharp(archivo).metadata();
    const left = Math.round(width * VENTANA.desde);
    img = img.extract({ left, top: 0, width: Math.round(width * VENTANA.hasta) - left, height });
  }
  const destino = join(PUBLICO, "aprende", guia, `${nombre}.webp`);
  mkdirSync(dirname(destino), { recursive: true });
  const info = await img
    .resize({ width: ANCHO[tipo], withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(destino);
  resultado.push({ guia, paso, tipo, src: `/aprende/${guia}/${nombre}.webp`, ancho: info.width, alto: info.height });
}

console.log(JSON.stringify(resultado, null, 1));
