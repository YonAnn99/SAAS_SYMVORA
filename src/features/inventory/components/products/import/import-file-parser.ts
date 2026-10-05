/**
 * papaparse y xlsx (~500 kB juntos) se descargan al elegir el archivo, no al
 * abrir Productos: solo los usa quien importa un catalogo.
 */

export interface ParsedImportFile {
  headers: string[];
  rows: Record<string, unknown>[];
}

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
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        resolve({ headers, rows: results.data });
      },
      error: (error: Error) => reject(error),
    });
  });
}

async function parseExcel(file: File): Promise<ParsedImportFile> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { headers, rows };
}
