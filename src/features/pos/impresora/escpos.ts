/**
 * Comandos ESC/POS para impresoras termicas de tickets (58 y 80 mm).
 *
 * Es el "idioma" que entienden casi todas las termicas (Epson, Xprinter,
 * Goojprt, las portatiles Bluetooth de 58 mm...): texto plano mas comandos de
 * control. Asi se imprime SIN la ventana de impresion del navegador, que
 * `window.print()` no permite saltarse.
 *
 * Logica pura: produce bytes; enviarlos es cosa de `conexiones.ts`.
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/** Caracteres por renglon con la fuente normal. */
export const COLUMNAS: Record<AnchoPapel, number> = { 58: 32, 80: 48 };
/** Puntos de ancho imprimible (para el logo). */
export const PUNTOS: Record<AnchoPapel, number> = { 58: 384, 80: 576 };

export type AnchoPapel = 58 | 80;
export type Alineacion = "izquierda" | "centro" | "derecha";

/**
 * Pagina de codigos PC850 (`ESC t 2`), la que traen practicamente todas: cubre
 * acentos, ñ y los signos de apertura. Lo que no esta aqui y no es ASCII se
 * imprime sin acento (via NFD) o como "?", nunca como basura.
 */
const PC850: Record<string, number> = {
  "á": 0xa0, "é": 0x82, "í": 0xa1, "ó": 0xa2, "ú": 0xa3,
  "Á": 0xb5, "É": 0x90, "Í": 0xd6, "Ó": 0xe0, "Ú": 0xe9,
  "ñ": 0xa4, "Ñ": 0xa5, "ü": 0x81, "Ü": 0x9a,
  "¿": 0xa8, "¡": 0xad, "°": 0xf8, "·": 0xfa,
};

/** Texto -> bytes en PC850. */
export function codificar(texto: string): number[] {
  const bytes: number[] = [];
  for (const caracter of texto) {
    const codigo = caracter.codePointAt(0) ?? 63;
    if (codigo >= 0x20 && codigo < 0x7f) {
      bytes.push(codigo);
    } else if (caracter in PC850) {
      bytes.push(PC850[caracter]);
    } else if (caracter === "\n") {
      bytes.push(LF);
    } else {
      // "ç" -> "c", "—" -> "?"... lo que no se pueda representar.
      const base = caracter.normalize("NFD").replace(/[̀-ͯ]/g, "");
      const b = base.codePointAt(0) ?? 63;
      bytes.push(b >= 0x20 && b < 0x7f ? b : 0x3f);
    }
  }
  return bytes;
}

/** Longitud visible (un caracter = una columna). */
const largo = (texto: string) => Array.from(texto).length;

/** Parte un texto en renglones de `ancho` columnas, cortando por palabras. */
export function partir(texto: string, ancho: number): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const renglones: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    // Palabra mas larga que el renglon: se corta a la fuerza.
    let resto = palabra;
    while (largo(resto) > ancho) {
      if (actual) {
        renglones.push(actual);
        actual = "";
      }
      const letras = Array.from(resto);
      renglones.push(letras.slice(0, ancho).join(""));
      resto = letras.slice(ancho).join("");
    }
    if (!resto) continue;
    const candidato = actual ? `${actual} ${resto}` : resto;
    if (largo(candidato) <= ancho) {
      actual = candidato;
    } else {
      renglones.push(actual);
      actual = resto;
    }
  }
  if (actual) renglones.push(actual);
  return renglones.length > 0 ? renglones : [""];
}

/**
 * Renglon con columnas: la primera a la izquierda y el resto a la derecha,
 * cada una con su ancho fijo. Si no cabe, la primera se recorta.
 */
export function columnas(
  partes: string[],
  anchos: number[],
  total: number
): string {
  const [primera, ...resto] = partes;
  const derecha = resto
    .map((p, i) => p.padStart(anchos[i + 1] ?? largo(p)))
    .join("");
  const espacio = Math.max(0, total - largo(derecha));
  const izquierda = Array.from(primera).slice(0, espacio).join("").padEnd(espacio);
  return izquierda + derecha;
}

/** Renglon "etiqueta ........ valor" a todo el ancho. */
export function izquierdaDerecha(izq: string, der: string, total: number): string {
  const hueco = total - largo(der) - 1;
  const recortado = Array.from(izq).slice(0, Math.max(0, hueco)).join("");
  return recortado.padEnd(total - largo(der)) + der;
}

/** Construye la secuencia de bytes de un ticket. */
export class TicketEscPos {
  private bytes: number[] = [];

  constructor(readonly ancho: AnchoPapel) {
    this.bytes.push(ESC, 0x40); // Iniciar
    this.bytes.push(ESC, 0x74, 0x02); // Pagina de codigos PC850
  }

  get columnas(): number {
    return COLUMNAS[this.ancho];
  }

  alinear(a: Alineacion): this {
    this.bytes.push(ESC, 0x61, a === "centro" ? 1 : a === "derecha" ? 2 : 0);
    return this;
  }

  negritas(activo: boolean): this {
    this.bytes.push(ESC, 0x45, activo ? 1 : 0);
    return this;
  }

  /** Doble alto y ancho (el total). Ocupa el doble de columnas. */
  grande(activo: boolean): this {
    this.bytes.push(GS, 0x21, activo ? 0x11 : 0x00);
    return this;
  }

  texto(t: string): this {
    this.bytes.push(...codificar(t));
    return this;
  }

  linea(t = ""): this {
    return this.texto(t).salto();
  }

  /** Texto largo partido en renglones del ancho del papel. */
  parrafo(t: string, columnasDisponibles = this.columnas): this {
    for (const renglon of partir(t, columnasDisponibles)) this.linea(renglon);
    return this;
  }

  separador(caracter = "-"): this {
    return this.linea(caracter.repeat(this.columnas));
  }

  salto(n = 1): this {
    for (let i = 0; i < n; i++) this.bytes.push(LF);
    return this;
  }

  /** Imagen en blanco y negro (`GS v 0`). `filas` de `anchoBytes` bytes. */
  imagen(datos: Uint8Array, anchoBytes: number, alto: number): this {
    this.bytes.push(
      GS, 0x76, 0x30, 0x00,
      anchoBytes & 0xff, (anchoBytes >> 8) & 0xff,
      alto & 0xff, (alto >> 8) & 0xff,
      ...datos
    );
    return this;
  }

  /** Avanza papel y corta (las que no cortan ignoran el comando). */
  cortar(): this {
    this.salto(4);
    this.bytes.push(GS, 0x56, 0x42, 0x00);
    return this;
  }

  resultado(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}
