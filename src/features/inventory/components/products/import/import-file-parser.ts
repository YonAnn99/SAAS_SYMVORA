/**
 * papaparse y xlsx (~500 kB juntos) se descargan al elegir el archivo, no al
 * abrir Productos: solo los usa quien importa un catalogo.
 */

import { guessFieldMapping } from "./import-field-config";

export interface ParsedImportFile {
  headers: string[];
  rows: Record<string, unknown>[];
  /** Fila real de la hoja (1 = primera) de cada elemento de `rows`. */
  rowNumbers: number[];
}

/** Hasta que fila se busca el encabezado. */
const FILAS_PARA_ENCABEZADO = 20;
/** Una celda mas larga no es encabezado: son instrucciones o ayuda. */
const LARGO_MAXIMO_ENCABEZADO = 40;

export async function parseImportFile(file: File): Promise<ParsedImportFile> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    return parseCsv(file);
  }
  if (extension === "xlsx" || extension === "xls") {
    return parseExcel(file);
  }
  throw new Error("Formato no soportado. Usa un archivo .csv o .xlsx.");
}

async function parseCsv(file: File): Promise<ParsedImportFile> {
  const { default: Papa } = await import("papaparse");
  return new Promise((resolve, reject) => {
    Papa.parse<unknown[]>(file, {
      header: false,
      skipEmptyLines: false,
      complete: (results) => resolve(tablaDesdeMatriz(results.data, 1)),
      error: (error: Error) => reject(error),
    });
  });
}

async function parseExcel(file: File): Promise<ParsedImportFile> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet?.["!ref"]) return { headers: [], rows: [], rowNumbers: [] };
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: true,
  });
  return tablaDesdeMatriz(matriz, XLSX.utils.decode_range(sheet["!ref"]).s.r + 1);
}

function celdaTexto(valor: unknown): string {
  return valor === null || valor === undefined ? "" : String(valor).trim();
}

function filaVacia(fila: unknown[]): boolean {
  return fila.every((celda) => celdaTexto(celda) === "");
}

/**
 * Convierte la hoja en encabezados + filas. Muchos Excel (p. ej. las plantillas
 * de otros sistemas) traen instrucciones arriba, asi que el encabezado es la
 * fila de las primeras que mas columnas reconoce; si ninguna, la primera con
 * datos. `primeraFila` es el numero de fila de la hoja de `matriz[0]`.
 */
export function tablaDesdeMatriz(matriz: unknown[][], primeraFila: number): ParsedImportFile {
  let indiceEncabezado = -1;
  let mejorPuntaje = 0;
  for (let i = 0; i < Math.min(matriz.length, FILAS_PARA_ENCABEZADO); i++) {
    const celdas = (matriz[i] ?? [])
      .map(celdaTexto)
      .map((texto) => (texto.length <= LARGO_MAXIMO_ENCABEZADO ? texto : ""));
    const puntaje = Object.keys(guessFieldMapping(celdas)).length;
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      indiceEncabezado = i;
    }
  }
  if (indiceEncabezado === -1) {
    indiceEncabezado = matriz.findIndex((fila) => !filaVacia(fila ?? []));
  }
  if (indiceEncabezado === -1) return { headers: [], rows: [], rowNumbers: [] };

  // Columnas con encabezado; los vacios se ignoran y los repetidos se numeran.
  const columnas: { indice: number; nombre: string }[] = [];
  const vistos = new Map<string, number>();
  (matriz[indiceEncabezado] ?? []).forEach((celda, indice) => {
    const texto = celdaTexto(celda);
    if (!texto) return;
    const veces = (vistos.get(texto) ?? 0) + 1;
    vistos.set(texto, veces);
    columnas.push({ indice, nombre: veces === 1 ? texto : `${texto} (${veces})` });
  });

  const rows: Record<string, unknown>[] = [];
  const rowNumbers: number[] = [];
  for (let i = indiceEncabezado + 1; i < matriz.length; i++) {
    const fila = matriz[i] ?? [];
    if (columnas.every(({ indice }) => celdaTexto(fila[indice]) === "")) continue;
    rows.push(Object.fromEntries(columnas.map(({ indice, nombre }) => [nombre, fila[indice] ?? ""])));
    rowNumbers.push(primeraFila + i);
  }

  return { headers: columnas.map(({ nombre }) => nombre), rows, rowNumbers };
}
