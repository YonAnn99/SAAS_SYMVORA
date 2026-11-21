/**
 * Genera los mockups del hero de la landing (`src/components/marketing/hero-mockups.tsx`).
 *
 *   node scripts/mockups-hero.mjs [carpeta-origen] [carpeta-vista-previa]
 *
 * Origen (NO vive en el repo; por defecto ~/Imágenes/mockup_landing_page):
 *   LIGHT/  laptop, tablet y celular YA con su marco de dispositivo (PNG 1080×1080, fondo transparente).
 *   DARK/   capturas de pantalla del modo oscuro, SIN marco.
 * Destino: public/landing/hero/{claro,oscuro}-{laptop,tablet,movil}.webp
 *
 * - Claro: se recorta al área visible del marco y se exporta.
 * - Oscuro: la captura se pega DENTRO del mismo marco del mockup claro (se reemplazan los píxeles de la
 *   pantalla), así los dos modos tienen exactamente el mismo dispositivo.
 *   · Laptop y tablet: la captura (1912×921) se ajusta al ancho y alto de la pantalla del marco.
 *   · Se tapa el correo de la cuenta de pruebas del menú lateral (no se publican correos).
 *   · Celular: se conserva el punto de la cámara, que va por encima de la pantalla.
 * - Se puede correr otra vez: sobrescribe. Si cambias una captura, solo vuelve a correrlo.
 *
 * Los rectángulos de pantalla de abajo están MEDIDOS sobre los PNG claros (píxeles en 1080×1080). Si llegan
 * marcos nuevos, hay que volver a medirlos.
 */
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import sharp from "sharp";

const ORIGEN = resolve(process.argv[2] ?? join(homedir(), "Imágenes", "mockup_landing_page"));
const PREVIA = process.argv[3] ? resolve(process.argv[3]) : null;
const DESTINO = resolve("public/landing/hero");
const LADO = 1080;
/** Margen alrededor del dispositivo al recortar: respira la sombra del marco. */
const MARGEN = 6;

/**
 * x, y, ancho y alto de la pantalla dentro del marco, y radio de sus esquinas.
 * `camara`: círculo que se dibuja sobre la captura (cámara frontal del celular).
 * `franjaSuperior`: alto de la «barra de estado» que se agrega arriba de la captura.
 */
const DISPOSITIVOS = {
  laptop: {
    claro: "LIGHT/MOCKUP_LAPTOP_LIGHT.png",
    oscuro: "DARK/mockup_pc_dark.png",
    pantalla: { x: 88, y: 256, ancho: 906, alto: 491, radio: 5 },
    taparCorreo: true,
  },
  tablet: {
    claro: "LIGHT/mockup_tablet_light.png",
    oscuro: "DARK/mockup_tablet_dark.png",
    pantalla: { x: 50, y: 286, ancho: 980, alto: 502, radio: 20 },
    taparCorreo: true,
  },
  movil: {
    claro: "LIGHT/mockup_mobile_light.png",
    oscuro: "DARK/mockup:mobile_dark.png",
    pantalla: { x: 340, y: 115, ancho: 398, alto: 846, radio: 22 },
    // Franja de «barra de estado» arriba (del color de la captura): deja la cámara libre del encabezado.
    franjaSuperior: 22,
    // La cámara frontal se dibuja encima: copiarla del marco claro traía un halo blanco de la pantalla clara.
    camara: { x: 538, y: 131, radio: 9 },
    taparCorreo: false,
  },
};

/**
 * Correo de la cuenta de pruebas en el menú lateral de la captura de escritorio (1912×921). Se pinta encima
 * con el color del menú, fila por fila, a la izquierda y a la derecha del texto.
 */
const CORREO = { x0: 36, x1: 192, y0: 832, y1: 851 };

async function taparCorreo(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => (y * info.width + x) * 4;
  for (let y = CORREO.y0; y <= CORREO.y1; y++) {
    const a = px(CORREO.x0 - 4, y);
    const b = px(CORREO.x1 + 4, y);
    for (let x = CORREO.x0; x <= CORREO.x1; x++) {
      const t = (x - CORREO.x0) / (CORREO.x1 - CORREO.x0);
      const o = px(x, y);
      for (let c = 0; c < 3; c++) data[o + c] = Math.round(data[a + c] * (1 - t) + data[b + c] * t);
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

function mascaraRedondeada(ancho, alto, radio) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}">` +
      `<rect width="${ancho}" height="${alto}" rx="${radio}" ry="${radio}" fill="#fff"/></svg>`
  );
}

async function componerOscuro(nombre, d) {
  const marco = join(ORIGEN, d.claro);
  const { x, y, ancho, alto, radio } = d.pantalla;

  let captura = await sharp(join(ORIGEN, d.oscuro)).png().toBuffer();
  if (d.taparCorreo) captura = await taparCorreo(captura);

  // La captura se estira lo justo a la pantalla (≤12 % en la laptop, ~4 % en el celular): ninguna recorta
  // iconos del encabezado ni el dock.
  const franja = d.franjaSuperior ?? 0;
  let contenido = await sharp(captura).resize(ancho, alto - franja, { fit: "fill" }).png().toBuffer();
  if (franja > 0) {
    const [r, g, b] = (await sharp(captura).extract({ left: 2, top: 2, width: 1, height: 1 }).raw().toBuffer());
    contenido = await sharp(contenido)
      .extend({ top: franja, background: { r, g, b, alpha: 1 } })
      .png()
      .toBuffer();
  }
  const pantalla = await sharp(contenido)
    .composite([{ input: mascaraRedondeada(ancho, alto, radio), blend: "dest-in" }])
    .png()
    .toBuffer();

  // Fondo negro RECTANGULAR (sin esquinas redondeadas) del tamaño de la pantalla: tapa por completo la
  // pantalla clara del marco; las esquinas redondeadas de la captura dejan ver este negro y no la pantalla
  // clara de abajo (antes quedaban triángulos blancos en las esquinas).
  const negro = await sharp({
    create: { width: ancho, height: alto, channels: 4, background: { r: 8, g: 8, b: 8, alpha: 1 } },
  })
    .png()
    .toBuffer();

  const capas = [
    { input: negro, left: x, top: y },
    { input: pantalla, left: x, top: y },
  ];

  if (d.camara) {
    const { x: cx, y: cy, radio: cr } = d.camara;
    const lado = cr * 2 + 2;
    const c = lado / 2;
    const camara = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}">` +
        `<circle cx="${c}" cy="${c}" r="${cr}" fill="#050505"/>` +
        `<circle cx="${c}" cy="${c}" r="${cr * 0.5}" fill="#0b1433"/></svg>`
    );
    capas.push({ input: camara, left: cx - c, top: cy - c });
  }

  return sharp(marco).ensureAlpha().composite(capas).png().toBuffer();
}

/** Recorta al área visible del marco (con un margen) y exporta a WebP. */
async function exportar(png, caja, salida) {
  const info = await sharp(png)
    .extract(caja)
    .webp({ quality: 86, alphaQuality: 92, effort: 6 })
    .toFile(salida);
  return info;
}

async function cajaVisible(rutaClaro) {
  const { data, info } = await sharp(rutaClaro).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const left = Math.max(0, x0 - MARGEN);
  const top = Math.max(0, y0 - MARGEN);
  const right = Math.min(LADO, x1 + 1 + MARGEN);
  const bottom = Math.min(LADO, y1 + 1 + MARGEN);
  return { left, top, width: right - left, height: bottom - top };
}

mkdirSync(DESTINO, { recursive: true });
if (PREVIA) mkdirSync(PREVIA, { recursive: true });

const resumen = {};
for (const [nombre, d] of Object.entries(DISPOSITIVOS)) {
  const caja = await cajaVisible(join(ORIGEN, d.claro));
  const claroPng = await sharp(join(ORIGEN, d.claro)).ensureAlpha().png().toBuffer();
  const oscuroPng = await componerOscuro(nombre, d);

  for (const [modo, png] of [["claro", claroPng], ["oscuro", oscuroPng]]) {
    const salida = join(DESTINO, `${modo}-${nombre}.webp`);
    const info = await exportar(png, caja, salida);
    resumen[`${modo}-${nombre}`] = { ancho: info.width, alto: info.height, kb: Math.round(info.size / 1024) };
    if (PREVIA) await sharp(png).extract(caja).png().toFile(join(PREVIA, `${modo}-${nombre}.png`));
  }
}

console.log(JSON.stringify(resumen, null, 2));
