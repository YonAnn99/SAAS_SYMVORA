/**
 * Lectura de codigos de barras con la camara, sin lector fisico.
 *
 *   Android (Chrome)      `BarcodeDetector` del navegador: rapido, no descarga nada.
 *   iPhone/iPad, resto    ponyfill `barcode-detector` (zxing en WebAssembly),
 *                         cargado solo al abrir la camara.
 *
 * El `.wasm` se sirve desde el propio sitio (`public/zxing/`), no desde un CDN:
 * la CSP no tiene que abrir dominios y no depende de terceros. OJO: al
 * actualizar `barcode-detector` (version fija en package.json) hay que volver a
 * copiar `node_modules/zxing-wasm/dist/reader/zxing_reader.wasm` a esa carpeta;
 * si no coinciden, la lectura falla en iPhone.
 */

export interface CodigoDetectado {
  rawValue: string;
}

export interface Detector {
  detect: (fuente: HTMLVideoElement) => Promise<CodigoDetectado[]>;
}

/** Los de tienda (EAN/UPC), los de etiquetas internas (Code 128/39, ITF) y QR. */
const FORMATOS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "itf",
  "qr_code",
] as const;

const RUTA_WASM = "/zxing/zxing_reader.wasm";

interface BarcodeDetectorNativo {
  new (opciones?: { formats?: string[] }): Detector;
  getSupportedFormats?: () => Promise<string[]>;
}

/**
 * Si el equipo puede usar la camara aqui. `getUserMedia` solo existe en
 * contexto seguro: con HTTPS o en localhost (no con la IP de la PC en la red).
 */
export function camaraDisponible(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

/** El contexto no es seguro (http con IP): la camara no se puede pedir. */
export function faltaHttps(): boolean {
  return typeof window !== "undefined" && !window.isSecureContext;
}

export async function crearDetector(): Promise<Detector> {
  const Nativo = (globalThis as { BarcodeDetector?: BarcodeDetectorNativo }).BarcodeDetector;
  if (Nativo) {
    try {
      const soportados = (await Nativo.getSupportedFormats?.()) ?? [];
      const formatos = FORMATOS.filter((f) => soportados.includes(f));
      // Algunos escritorios exponen el API sin ningun formato: no sirve.
      if (formatos.includes("ean_13")) return new Nativo({ formats: formatos });
    } catch {
      // Se cae al ponyfill.
    }
  }

  const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
  prepareZXingModule({
    overrides: {
      locateFile: (ruta: string, prefijo: string) =>
        ruta.endsWith(".wasm") ? RUTA_WASM : prefijo + ruta,
    },
  });
  return new BarcodeDetector({ formats: [...FORMATOS] });
}
