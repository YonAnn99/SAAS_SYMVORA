/**
 * Hoja "Productos con variantes" de la plantilla: cada fila es una variante y
 * las filas con el mismo "Nombre general" forman un producto.
 *
 * Cada fila se convierte en una `TarjetaVariante`, la misma estructura de la
 * ventana "Producto con variantes", y se valida con su misma logica
 * (`problemaDeTarjeta`, `tarjetaRepetida`). Asi se guarda tambien igual
 * (`inputDeTarjeta`): lo importado queda como si se hubiera capturado a mano.
 */
import { TIPOS_ATRIBUTO, TIPO_PERSONALIZADO } from "../../../atributos-variante";
import {
  UNIDAD_DEL_PRODUCTO,
  nuevaTarjeta,
  problemaDeTarjeta,
  tarjetaRepetida,
  type AtributoTarjeta,
  type TarjetaVariante,
} from "../../../tarjetas-variante";
import { ATRIBUTOS_POR_VARIANTE, VAR } from "../../../plantilla-productos";
import type { UnidadMedida } from "@/lib/unidades";
import type { ExistingProductInfo } from "../../../services/product-import-service";
import type { VariantGroup } from "../../../types/import.types";
import { parseNumber, parseSiNo, parseUnidadMedida } from "./import-row-processor";

/** Minusculas, sin acentos ni signos: para comparar encabezados y nombres. */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Lee una celda por el nombre de su columna, aunque cambien acentos o signos. */
function lector(raw: Record<string, unknown>) {
  const porNombre = new Map<string, unknown>();
  for (const [columna, valor] of Object.entries(raw)) {
    porNombre.set(normalizarTexto(columna), valor);
  }
  return (columna: string): string => {
    const valor = porNombre.get(normalizarTexto(columna));
    return valor === null || valor === undefined ? "" : String(valor).trim();
  };
}

/** "talla" -> "Talla"; un tipo que no es de la lista va como personalizado. */
function atributoDe(tipoTexto: string, valor: string): AtributoTarjeta {
  const conocido = TIPOS_ATRIBUTO.find(
    (t) => t.tipo !== TIPO_PERSONALIZADO && normalizarTexto(t.tipo) === normalizarTexto(tipoTexto)
  );
  return conocido
    ? { tipo: conocido.tipo, nombre: "", valor }
    : { tipo: TIPO_PERSONALIZADO, nombre: tipoTexto, valor };
}

interface FilaLeida {
  fila: number;
  nombre: string;
  categoria: string;
  esServicio: boolean;
  permiteLotes: boolean;
  tarjeta: TarjetaVariante;
  /** Problema propio de la fila (numeros, atributos), antes de la tarjeta. */
  error: string | null;
}

const NUMEROS = [
  ["precio", VAR.precio],
  ["costo", VAR.costo],
  ["stock", VAR.stock],
  ["stockMinimo", VAR.stockMinimo],
] as const;

function leerFila(raw: Record<string, unknown>, fila: number): FilaLeida {
  const celda = lector(raw);
  let error: string | null = null;

  const atributos: AtributoTarjeta[] = [];
  for (let n = 1; n <= ATRIBUTOS_POR_VARIANTE; n++) {
    const tipo = celda(VAR.atributo(n));
    const valor = celda(VAR.valor(n));
    if (!tipo && !valor) continue;
    if (!tipo) error ??= `Falta el nombre del Atributo ${n} (ej. Talla)`;
    else if (!valor) error ??= `Falta el Valor ${n} del atributo «${tipo}»`;
    else atributos.push(atributoDe(tipo, valor));
  }

  const numeros: Record<(typeof NUMEROS)[number][0], string> = {
    precio: "",
    costo: "",
    stock: "0",
    stockMinimo: "0",
  };
  for (const [clave, columna] of NUMEROS) {
    const texto = celda(columna);
    const numero = parseNumber(texto);
    if (numero === null) error ??= `${columna} no es un número ("${texto}")`;
    else if (numero < 0) error ??= `${columna} no puede ser negativo`;
    else numeros[clave] = String(numero);
  }

  const unidadTexto = celda(VAR.unidad);
  const contenidoUnidadTexto = celda(VAR.contenidoUnidad);
  const esServicio = parseSiNo(celda(VAR.servicio));

  return {
    fila,
    nombre: celda(VAR.nombre),
    categoria: celda(VAR.categoria),
    esServicio,
    permiteLotes: !esServicio && parseSiNo(celda(VAR.lotes)),
    error,
    tarjeta: nuevaTarjeta([], {
      atributos,
      descripcion: celda(VAR.descripcion),
      unidad: unidadTexto ? parseUnidadMedida(unidadTexto) : UNIDAD_DEL_PRODUCTO,
      contenidoCantidad: celda(VAR.contenidoCantidad),
      contenidoUnidad: contenidoUnidadTexto ? parseUnidadMedida(contenidoUnidadTexto) : "",
      sku: celda(VAR.sku),
      codigo: celda(VAR.codigo),
      ...numeros,
    }),
  };
}

export interface BuildVariantGroupsParams {
  rawRows: Record<string, unknown>[];
  /** Fila real de la hoja de cada `rawRows[i]`. */
  rowNumbers: number[];
  /** Codigos del catalogo (en minusculas), como en los productos unicos. */
  existingBarcodes: Map<string, ExistingProductInfo>;
  /** Nombres de productos activos, ya normalizados con `normalizarTexto`. */
  existingNames: Set<string>;
  /**
   * Codigos que ya usa la hoja de productos unicos (minusculas -> fila): un
   * codigo no puede repetirse entre las dos hojas.
   */
  barcodesEnArchivo?: Map<string, number>;
}

export function buildVariantGroups({
  rawRows,
  rowNumbers,
  existingBarcodes,
  existingNames,
  barcodesEnArchivo = new Map(),
}: BuildVariantGroupsParams): VariantGroup[] {
  // Agrupar por nombre general, en el orden en que aparecen.
  const grupos = new Map<string, FilaLeida[]>();
  const sinNombre: FilaLeida[] = [];
  rawRows.forEach((raw, i) => {
    const leida = leerFila(raw, rowNumbers[i] ?? i + 2);
    const clave = normalizarTexto(leida.nombre);
    if (!clave) {
      sinNombre.push(leida);
      return;
    }
    grupos.set(clave, [...(grupos.get(clave) ?? []), leida]);
  });

  const codigosVistos = new Map(barcodesEnArchivo);
  const resultado: VariantGroup[] = [];

  for (const [clave, filas] of grupos) {
    const primera = filas[0];
    const esServicio = primera.esServicio;
    const tarjetas = filas.map((f) => f.tarjeta);
    const unidadPrimera = tarjetas[0].unidad;
    const grupo: VariantGroup = {
      nombre: primera.nombre,
      filas: filas.map((f) => f.fila),
      status: "new",
      categoria: primera.categoria || null,
      esServicio,
      permiteLotes: primera.permiteLotes,
      // Igual que la ventana: la unidad del producto es la de la Variante 1.
      unidadProducto: esServicio
        ? "SERVICIO"
        : unidadPrimera === UNIDAD_DEL_PRODUCTO
          ? "PIEZA"
          : (unidadPrimera as UnidadMedida),
      tarjetas,
    };

    const invalido = (fila: number, mensaje: string) => {
      grupo.status = "invalid";
      grupo.errorMessage = `Fila ${fila}: ${mensaje}`;
    };

    for (const f of filas) {
      if (grupo.status === "invalid") break;
      if (f.error) {
        invalido(f.fila, f.error);
        break;
      }
      const problema = problemaDeTarjeta(f.tarjeta);
      if (problema) {
        invalido(f.fila, problema.mensaje);
        break;
      }
      const codigo = f.tarjeta.codigo.trim().toLowerCase();
      if (codigo) {
        if (existingBarcodes.has(codigo)) {
          invalido(f.fila, `El código de barras ${f.tarjeta.codigo} ya existe en tu catálogo`);
          break;
        }
        const otra = codigosVistos.get(codigo);
        if (otra !== undefined) {
          invalido(f.fila, `Código de barras repetido en el archivo (ya aparece en la fila ${otra})`);
          break;
        }
        codigosVistos.set(codigo, f.fila);
      }
    }

    if (grupo.status !== "invalid") {
      const repetida = tarjetaRepetida(tarjetas);
      if (repetida >= 0) {
        invalido(filas[repetida].fila, "repite los atributos de otra variante del mismo producto");
      }
    }

    if (grupo.status !== "invalid" && existingNames.has(clave)) {
      grupo.status = "duplicate";
      grupo.errorMessage = `Ya existe «${primera.nombre}» en tu catálogo: agrega sus variantes desde ahí`;
    }

    resultado.push(grupo);
  }

  for (const f of sinNombre) {
    resultado.push({
      nombre: "",
      filas: [f.fila],
      status: "invalid",
      errorMessage: `Fila ${f.fila}: falta el ${VAR.nombre}`,
      categoria: null,
      esServicio: false,
      permiteLotes: false,
      unidadProducto: "PIEZA",
      tarjetas: [f.tarjeta],
    });
  }

  return resultado;
}
