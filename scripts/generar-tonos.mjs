/**
 * Genera los tonos de las notificaciones (`public/audio/notificaciones/<clave>.v1.mp3`).
 *
 * Sin dependencias: sintetiza con senoidales + armónicos y envolvente tipo campana, escribe un WAV
 * mono de 16 bits y lo codifica a mp3 con ffmpeg. Los parámetros viven aquí; si un tono cambia, subir
 * la versión del nombre (`.v2`): el service worker guarda los audios con CacheFirst.
 *
 * Uso: node scripts/generar-tonos.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RATE = 22050;
const SALIDA = "public/audio/notificaciones";

// Nota: frecuencia (Hz), inicio y duración (s).
const TONOS = {
  // Lo más llamativo: entra dinero. Tres notas ascendentes brillantes.
  "pedido-nuevo": {
    cola: 0.6,
    notas: [
      { f: 1046.5, t: 0, d: 0.45 },
      { f: 1318.5, t: 0.13, d: 0.45 },
      { f: 1568.0, t: 0.26, d: 0.7 },
    ],
  },
  // Urgente: dos notas descendentes y más graves.
  "stock-agotado": {
    cola: 0.5,
    notas: [
      { f: 659.25, t: 0, d: 0.35 },
      { f: 523.25, t: 0.22, d: 0.55 },
    ],
  },
  // Precaución suave: dos notas descendentes más cortas.
  "stock-bajo": {
    cola: 0.4,
    notas: [
      { f: 783.99, t: 0, d: 0.25 },
      { f: 659.25, t: 0.15, d: 0.35 },
    ],
  },
  // Amable: arpegio ascendente con brillo.
  novedad: {
    cola: 0.5,
    notas: [
      { f: 523.25, t: 0, d: 0.6 },
      { f: 659.25, t: 0.12, d: 0.6 },
      { f: 783.99, t: 0.24, d: 0.6 },
      { f: 1046.5, t: 0.36, d: 0.7 },
    ],
  },
  // Atención neutra: un «ping» de dos notas iguales.
  atencion: {
    cola: 0.3,
    notas: [
      { f: 880.0, t: 0, d: 0.25 },
      { f: 880.0, t: 0.18, d: 0.3 },
    ],
  },
};

// Campana: parciales con su amplitud; la caída es exponencial y el ataque, corto.
const PARCIALES = [
  { m: 1, a: 1.0 },
  { m: 2, a: 0.45 },
  { m: 3, a: 0.2 },
  { m: 4.2, a: 0.08 },
];

function sintetizar({ cola, notas }) {
  const fin = Math.max(...notas.map((n) => n.t + n.d)) + cola;
  const muestras = new Float32Array(Math.ceil(fin * RATE));
  for (const { f, t, d } of notas) {
    const inicio = Math.floor(t * RATE);
    const largo = Math.floor((d + cola) * RATE);
    const tau = d / 4;
    for (let i = 0; i < largo && inicio + i < muestras.length; i++) {
      const s = i / RATE;
      const ataque = Math.min(1, s / 0.006);
      const caida = Math.exp(-s / tau);
      let v = 0;
      for (const { m, a } of PARCIALES) v += a * Math.sin(2 * Math.PI * f * m * s);
      muestras[inicio + i] += ataque * caida * v * 0.35;
    }
  }
  // Normaliza a -3 dBFS para que todos suenen parejos sin recortar.
  let pico = 0;
  for (const v of muestras) pico = Math.max(pico, Math.abs(v));
  const escala = pico > 0 ? 0.7 / pico : 1;
  return Int16Array.from(muestras, (v) => Math.round(v * escala * 32767));
}

function wav(pcm) {
  const datos = Buffer.from(pcm.buffer);
  const cab = Buffer.alloc(44);
  cab.write("RIFF", 0);
  cab.writeUInt32LE(36 + datos.length, 4);
  cab.write("WAVE", 8);
  cab.write("fmt ", 12);
  cab.writeUInt32LE(16, 16);
  cab.writeUInt16LE(1, 20); // PCM
  cab.writeUInt16LE(1, 22); // mono
  cab.writeUInt32LE(RATE, 24);
  cab.writeUInt32LE(RATE * 2, 28);
  cab.writeUInt16LE(2, 32);
  cab.writeUInt16LE(16, 34);
  cab.write("data", 36);
  cab.writeUInt32LE(datos.length, 40);
  return Buffer.concat([cab, datos]);
}

mkdirSync(SALIDA, { recursive: true });
const tmp = join(tmpdir(), "symvora-tonos");
mkdirSync(tmp, { recursive: true });

for (const [clave, tono] of Object.entries(TONOS)) {
  const wavPath = join(tmp, `${clave}.wav`);
  const mp3 = join(SALIDA, `${clave}.v1.mp3`);
  writeFileSync(wavPath, wav(sintetizar(tono)));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wavPath, "-codec:a", "libmp3lame", "-b:a", "64k", "-ac", "1", mp3], { stdio: "inherit" });
  console.log("ok", mp3);
}
rmSync(tmp, { recursive: true, force: true });
