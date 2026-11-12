/**
 * Codigos de barras de producto: generar los internos y dibujarlos.
 *
 * - Los codigos que genera SYMVORA son EAN-13 con prefijo **200**: GS1 reserva
 *   el 200-299 para uso interno de la tienda, asi que nunca chocan con un
 *   producto comercial (en Mexico esos empiezan con 750). Antes se generaban
 *   "750" + consecutivo, sin digito verificador valido.
 * - Para imprimir: un EAN-13 valido se dibuja como EAN-13; cualquier otro
 *   codigo (los "750..." viejos, claves como "PROD-01") como Code 128, que lee
 *   cualquier lector. Ningun dato existente se modifica.
 *
 * Todo es puro: el resultado son barras en "modulos" (la barra mas delgada)
 * que cada salida (PDF, SVG de la vista previa) escala a su tamano.
 */

/** Prefijo GS1 de uso interno (200-299 = "in-store"). */
export const PREFIJO_INTERNO = "200";

export type Simbologia = "EAN13" | "CODE128";

export interface Barra {
  /** Posicion en modulos desde el inicio del codigo (sin zona de silencio). */
  x: number;
  /** Ancho en modulos. */
  w: number;
  /** Barra de guarda del EAN-13: baja un poco mas que las demas. */
  guarda: boolean;
}

export interface CodigoDibujable {
  simbologia: Simbologia;
  /** Ancho total en modulos, sin zonas de silencio. */
  modulos: number;
  barras: Barra[];
  /** Texto legible que va debajo de las barras. */
  texto: string;
}

/** Zona de silencio recomendada a cada lado, en modulos. */
export const ZONA_SILENCIO: Record<Simbologia, number> = { EAN13: 11, CODE128: 10 };

// ---------------------------------------------------------------------------
// EAN-13
// ---------------------------------------------------------------------------

/** Digito verificador de los primeros 12 digitos (pesos 1 y 3 alternados). */
export function digitoVerificadorEan13(doce: string): number {
  if (!/^\d{12}$/.test(doce)) throw new Error("Se esperaban 12 digitos");
  let suma = 0;
  for (let i = 0; i < 12; i++) suma += Number(doce[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (suma % 10)) % 10;
}

export function esEan13Valido(codigo: string | null | undefined): boolean {
  const c = (codigo ?? "").trim();
  return /^\d{13}$/.test(c) && digitoVerificadorEan13(c.slice(0, 12)) === Number(c[12]);
}

/** Un codigo interno nuevo: "200" + 9 digitos al azar + verificador. */
export function generarCodigoInterno(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(9));
  let cuerpo = PREFIJO_INTERNO;
  for (const b of bytes) cuerpo += String(b % 10);
  return cuerpo + digitoVerificadorEan13(cuerpo);
}

/**
 * `n` codigos internos distintos que no esten en uso. `enUso` recibe una tanda
 * y devuelve los que ya existen; los repetidos se vuelven a sortear (hasta
 * `intentos` rondas). Con 10^9 combinaciones casi nunca hace falta.
 */
export async function elegirCodigosLibres(
  n: number,
  enUso: (codigos: string[]) => Promise<Set<string>>,
  generar: () => string = generarCodigoInterno,
  intentos = 5
): Promise<string[]> {
  const elegidos = new Set<string>();
  for (let ronda = 0; ronda < intentos && elegidos.size < n; ronda++) {
    const tanda = new Set<string>();
    while (tanda.size < n - elegidos.size) {
      const c = generar();
      if (!elegidos.has(c)) tanda.add(c);
    }
    const ocupados = await enUso([...tanda]);
    for (const c of tanda) if (!ocupados.has(c)) elegidos.add(c);
  }
  if (elegidos.size < n) throw new Error("No se pudo generar un código de barras libre. Intenta de nuevo.");
  return [...elegidos];
}

const EAN_L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const EAN_G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const EAN_R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
/** Paridad de los 6 digitos de la izquierda segun el primer digito. */
const EAN_PARIDAD = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

/** Cadena de 95 modulos ("1" barra, "0" espacio) de un EAN-13 valido. */
export function modulosEan13(codigo: string): string {
  if (!esEan13Valido(codigo)) throw new Error("EAN-13 no valido");
  const d = codigo.split("").map(Number);
  const paridad = EAN_PARIDAD[d[0]];
  let m = "101";
  for (let i = 1; i <= 6; i++) m += (paridad[i - 1] === "L" ? EAN_L : EAN_G)[d[i]];
  m += "01010";
  for (let i = 7; i <= 12; i++) m += EAN_R[d[i]];
  return m + "101";
}

function esGuardaEan13(i: number): boolean {
  return i < 3 || (i >= 45 && i < 50) || i >= 92;
}

/** Junta modulos "1" consecutivos en barras. */
function barrasDeModulos(m: string, guarda: (i: number) => boolean): Barra[] {
  const barras: Barra[] = [];
  let i = 0;
  while (i < m.length) {
    if (m[i] !== "1") {
      i++;
      continue;
    }
    let j = i;
    while (j < m.length && m[j] === "1") j++;
    barras.push({ x: i, w: j - i, guarda: guarda(i) });
    i = j;
  }
  return barras;
}

// ---------------------------------------------------------------------------
// Code 128
// ---------------------------------------------------------------------------

/** Anchos (barra, espacio, barra...) de los simbolos 0-106 de Code 128. */
export const CODE128_PATRONES = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

const START_B = 104;
const START_C = 105;
const CODE_B = 100;
const CODE_C = 99;
const STOP = 106;

/** Code 128 solo admite ASCII imprimible (32-126) en el juego B. */
export function codificableEnCode128(texto: string): boolean {
  return texto.length > 0 && /^[\x20-\x7e]+$/.test(texto);
}

/**
 * Valores de simbolo (sin checksum ni stop). Solo digitos: juego C (dos por
 * simbolo, codigo mas corto); con un digito sobrante, el ultimo va en B.
 * Con letras: juego B, y las corridas de 6+ digitos se compactan en C.
 */
export function valoresCode128(texto: string): number[] {
  if (!codificableEnCode128(texto)) throw new Error("Code 128 solo admite ASCII imprimible");
  const valores: number[] = [];
  const pares = (digitos: string) => {
    for (let i = 0; i + 1 < digitos.length; i += 2) valores.push(Number(digitos.slice(i, i + 2)));
  };

  if (/^\d+$/.test(texto) && texto.length >= 2) {
    valores.push(START_C);
    const par = texto.length - (texto.length % 2);
    pares(texto.slice(0, par));
    if (par < texto.length) valores.push(CODE_B, texto.charCodeAt(par) - 32);
    return valores;
  }

  valores.push(START_B);
  let juego: "B" | "C" = "B";
  let i = 0;
  while (i < texto.length) {
    const corrida = /^\d+/.exec(texto.slice(i))?.[0] ?? "";
    if (corrida.length >= 6) {
      const par = corrida.length - (corrida.length % 2);
      if (juego !== "C") {
        valores.push(CODE_C);
        juego = "C";
      }
      pares(corrida.slice(0, par));
      i += par;
      continue;
    }
    if (juego !== "B") {
      valores.push(CODE_B);
      juego = "B";
    }
    valores.push(texto.charCodeAt(i) - 32);
    i++;
  }
  return valores;
}

/** Checksum: inicio + suma de valor x posicion, modulo 103. */
export function checksumCode128(valores: number[]): number {
  let suma = valores[0];
  for (let i = 1; i < valores.length; i++) suma += valores[i] * i;
  return suma % 103;
}

/** Cadena de modulos del Code 128 completo (con checksum y stop). */
export function modulosCode128(texto: string): string {
  const valores = valoresCode128(texto);
  const simbolos = [...valores, checksumCode128(valores), STOP];
  let m = "";
  for (const s of simbolos) {
    const patron = CODE128_PATRONES[s];
    for (let k = 0; k < patron.length; k++) m += (k % 2 === 0 ? "1" : "0").repeat(Number(patron[k]));
  }
  return m;
}

// ---------------------------------------------------------------------------
// Eleccion de simbologia
// ---------------------------------------------------------------------------

export function simbologiaPara(codigo: string): Simbologia | null {
  const c = codigo.trim();
  if (esEan13Valido(c)) return "EAN13";
  return codificableEnCode128(c) ? "CODE128" : null;
}

/** Barras listas para dibujar, o `null` si el codigo no se puede representar. */
export function dibujarCodigo(codigo: string | null | undefined): CodigoDibujable | null {
  const c = (codigo ?? "").trim();
  const simbologia = simbologiaPara(c);
  if (!simbologia) return null;
  if (simbologia === "EAN13") {
    const m = modulosEan13(c);
    return { simbologia, modulos: m.length, barras: barrasDeModulos(m, esGuardaEan13), texto: c };
  }
  const m = modulosCode128(c);
  return { simbologia, modulos: m.length, barras: barrasDeModulos(m, () => false), texto: c };
}
