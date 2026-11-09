/**
 * Plantilla de Excel para dar de alta productos sin capturarlos uno por uno:
 * el cliente la descarga en blanco, la llena y la sube con "Importar catalogo".
 *
 * Trae los mismos datos que las ventanas "Producto unico" y "Producto con
 * variantes" (menos la foto, que se agrega despues desde el catalogo). Los
 * encabezados viven AQUI y los usa tambien el lector de la importacion: si se
 * renombra una columna, el lector la sigue reconociendo.
 *
 * El `xlsx` del proyecto (SheetJS, edicion gratuita) no escribe listas
 * desplegables: los valores validos van en la hoja "Instrucciones".
 */
import { TIPOS_ATRIBUTO, TIPO_PERSONALIZADO } from "./atributos-variante";
import { UNIDADES, UNIDADES_CONTENIDO, type UnidadMedida } from "@/lib/unidades";

export const ARCHIVO_PLANTILLA = "plantilla-productos-symvora.xlsx";

export const HOJA_UNICOS = "Productos únicos";
export const HOJA_VARIANTES = "Productos con variantes";
export const HOJA_INSTRUCCIONES = "Instrucciones";

/** Encabezados de la hoja de productos unicos (los lee `guessFieldMapping`). */
export const COLUMNAS_UNICOS = [
  "Nombre",
  "Descripción",
  "¿Cómo se vende?",
  "Categoría",
  "Contenido (cantidad)",
  "Contenido (unidad)",
  "Precio de venta",
  "Costo de compra",
  "Stock actual",
  "Stock mínimo",
  "¿Es servicio? (Sí/No)",
  "¿Maneja lotes? (Sí/No)",
  "Código de barras",
  "SKU",
] as const;

/** Cuantos atributos trae cada variante en la plantilla. */
export const ATRIBUTOS_POR_VARIANTE = 3;

/**
 * Columnas de la hoja de variantes, por clave. Las del producto (nombre
 * general, categoria, servicio y lotes) se toman de la PRIMERA fila del grupo.
 */
export const VAR = {
  nombre: "Nombre general",
  categoria: "Categoría",
  servicio: "¿Es servicio? (Sí/No)",
  lotes: "¿Maneja lotes? (Sí/No)",
  atributo: (n: number) => `Atributo ${n}`,
  valor: (n: number) => `Valor ${n}`,
  descripcion: "Descripción",
  unidad: "¿Cómo se vende?",
  contenidoCantidad: "Contenido (cantidad)",
  contenidoUnidad: "Contenido (unidad)",
  precio: "Precio de venta",
  costo: "Costo de compra",
  stock: "Stock actual",
  stockMinimo: "Stock mínimo",
  codigo: "Código de barras",
  sku: "SKU",
} as const;

export const COLUMNAS_VARIANTES: string[] = [
  VAR.nombre,
  VAR.categoria,
  VAR.servicio,
  VAR.lotes,
  ...Array.from({ length: ATRIBUTOS_POR_VARIANTE }, (_, i) => [VAR.atributo(i + 1), VAR.valor(i + 1)]).flat(),
  VAR.descripcion,
  VAR.unidad,
  VAR.contenidoCantidad,
  VAR.contenidoUnidad,
  VAR.precio,
  VAR.costo,
  VAR.stock,
  VAR.stockMinimo,
  VAR.codigo,
  VAR.sku,
];

/** Nombre en español de cada unidad (el mismo que muestra el selector). */
export const NOMBRE_UNIDAD: Record<UnidadMedida, string> = {
  PIEZA: "Pieza",
  KG: "Kilogramo",
  GRAMO: "Gramo",
  LITRO: "Litro",
  MILILITRO: "Mililitro",
  METRO: "Metro",
  CAJA: "Caja",
  PAQUETE: "Paquete",
  PAR: "Par",
  DOCENA: "Docena",
  SERVICIO: "Servicio",
};

const UNIDADES_VENTA = UNIDADES.filter((u) => u !== "SERVICIO")
  .map((u) => NOMBRE_UNIDAD[u])
  .join(", ");
const UNIDADES_DEL_CONTENIDO = UNIDADES_CONTENIDO.map((u) => NOMBRE_UNIDAD[u]).join(", ");
const TIPOS = TIPOS_ATRIBUTO.filter((t) => t.tipo !== TIPO_PERSONALIZADO)
  .map((t) => t.tipo)
  .join(", ");

/** Filas de la hoja "Instrucciones" (columna A y B). Pura: se prueba sola. */
export function filasInstrucciones(): string[][] {
  return [
    ["Cómo llenar esta plantilla", ""],
    ["", ""],
    ["1.", `Llena la hoja «${HOJA_UNICOS}» con los productos de un solo precio y existencia.`],
    ["2.", `Llena la hoja «${HOJA_VARIANTES}» con los que tienen tallas, colores, tamaños, sabores…: una fila por variante. Las filas con el mismo «${VAR.nombre}» forman un solo producto.`],
    ["3.", "Puedes dejar una hoja vacía. No cambies los nombres de las hojas ni de las columnas."],
    ["4.", "Guarda el archivo y súbelo en Productos → Importar catálogo. Antes de guardar verás una vista previa."],
    ["5.", "Las fotos se agregan después, desde el catálogo."],
    ["", ""],
    ["Columna", "Qué escribir"],
    ["Nombre / Nombre general", "Obligatorio. En variantes, el nombre que comparten (ej. Coca Cola); la variante la dicen sus atributos."],
    ["¿Cómo se vende?", `Una de: ${UNIDADES_VENTA}. Vacío = Pieza. Kilogramo, gramo, litro, mililitro y metro se venden a granel: el precio es por esa unidad.`],
    ["Contenido (cantidad / unidad)", `Opcional. Lo que trae el envase (600 ml, 2.5 L, 45 g); solo se muestra, no cambia el cobro. Unidad: ${UNIDADES_DEL_CONTENIDO}.`],
    ["Precio de venta / Costo de compra", "Números sin el símbolo $ (ej. 18.50). En variantes el precio es obligatorio y mayor a 0."],
    ["Stock actual / Stock mínimo", "Números. El stock entra a la sucursal principal. El mínimo es para el aviso de stock bajo."],
    ["¿Es servicio? / ¿Maneja lotes?", "Sí o No (vacío = No). Un servicio no lleva existencias. Los lotes y caducidades se registran después en la pestaña Lotes."],
    ["Atributo 1, 2, 3 / Valor 1, 2, 3", `Solo en variantes; al menos el Atributo 1 con su valor. Atributos sugeridos: ${TIPOS}. Puedes escribir otro (ej. Aroma).`],
    ["Código de barras / SKU", "Opcionales. No los repitas: un código que ya exista en tu catálogo se marca en la vista previa."],
    ["", ""],
    ["Ejemplo: Productos únicos", ""],
    ["Nombre", "Arroz Morelos · Cómo se vende: Kilogramo · Precio 32 · Stock 50"],
    ["Nombre", "Refresco Cola 600 ml · Pieza · Contenido 600 Mililitro · Precio 18 · Stock 24"],
    ["Nombre", "Corte de cabello · Es servicio: Sí · Precio 120"],
    ["", ""],
    ["Ejemplo: Productos con variantes", ""],
    ["Coca Cola", "Atributo 1: Capacidad · Valor 1: 600 ml · Precio 18 · Stock 20"],
    ["Coca Cola", "Atributo 1: Capacidad · Valor 1: 2.5 L · Precio 48 · Stock 10"],
    ["Playera básica", "Atributo 1: Talla · Valor 1: M · Atributo 2: Color · Valor 2: Rojo · Precio 150 · Stock 5"],
    ["Playera básica", "Atributo 1: Talla · Valor 1: G · Atributo 2: Color · Valor 2: Rojo · Precio 150 · Stock 3"],
  ];
}

/** Ancho de columna en caracteres: el del encabezado, con un minimo legible. */
function anchos(columnas: readonly string[]): { wch: number }[] {
  return columnas.map((c) => ({ wch: Math.max(14, c.length + 4) }));
}

/** Descarga la plantilla en blanco. `xlsx` se carga solo aqui (~400 kB). */
export async function descargarPlantillaProductos(): Promise<void> {
  const XLSX = await import("xlsx");
  const libro = XLSX.utils.book_new();

  const unicos = XLSX.utils.aoa_to_sheet([[...COLUMNAS_UNICOS]]);
  unicos["!cols"] = anchos(COLUMNAS_UNICOS);
  XLSX.utils.book_append_sheet(libro, unicos, HOJA_UNICOS);

  const variantes = XLSX.utils.aoa_to_sheet([COLUMNAS_VARIANTES]);
  variantes["!cols"] = anchos(COLUMNAS_VARIANTES);
  XLSX.utils.book_append_sheet(libro, variantes, HOJA_VARIANTES);

  const instrucciones = XLSX.utils.aoa_to_sheet(filasInstrucciones());
  instrucciones["!cols"] = [{ wch: 34 }, { wch: 110 }];
  XLSX.utils.book_append_sheet(libro, instrucciones, HOJA_INSTRUCCIONES);

  XLSX.writeFile(libro, ARCHIVO_PLANTILLA);
}
