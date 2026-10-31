/**
 * Ajustes al proyecto Android (TWA de Bubblewrap) que Bubblewrap no ofrece y que
 * `bubblewrap update` deshace: correr este script despues de cada update y
 * antes de `bubblewrap build`.
 *
 *   node scripts/preparar-android.mjs ~/Documentos/symvora-android
 *
 * 1. SPLASH: S blanca y «SYMVORA» pequeños y centrados, igual que las de iOS
 *    (`public/splash/`).
 * 2. SIN APP LINK: quita del AndroidManifest el intent-filter VIEW con
 *    `autoVerify` para app.symvora.com.mx. Con el, cualquier enlace a SYMVORA
 *    (los correos de «Activar mi suscripcion», WhatsApp…) se abria en la APP,
 *    donde no hay boton de pago (politica de pagos de Google Play). Sin el, la
 *    app solo se abre desde su icono y los enlaces van a Chrome, donde si se
 *    paga. La pantalla completa no depende de este filtro: la verifica Chrome
 *    con assetlinks.json.
 *
 * --- Splash ---
 *
 * La TWA pinta `res/drawable-<densidad>/splash.png` (300 dp de lado) sobre
 * `backgroundColor` (#1E3A8A). Bubblewrap lo genera escalando el icono de 512,
 * y el logo salia casi a pantalla completa.
 *
 * Fuente: `public/splash/iphone-pro-1179x2556.png`. Se recorta el logo y se
 * convierte a blanco con transparencia con el mismo metodo que
 * `generate-pwa-icons.mjs` (luminancia como mascara: bordes suaves, sin orilla).
 *
 */

import sharp from "sharp";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FUENTE = join(root, "public/splash/iphone-pro-1179x2556.png");

/** Lado del splash por densidad: 300 dp. */
const DENSIDADES = { mdpi: 300, hdpi: 450, xhdpi: 600, xxhdpi: 900, xxxhdpi: 1200 };

/**
 * Ancho del logo respecto al cuadrado de 300 dp. En un celular de ~400 dp de
 * ancho queda en ~120 dp: la misma proporcion que en las pantallas de iOS.
 */
const PROPORCION_LOGO = 0.4;

const UMBRAL_FONDO = 12;
const BLANCO = 235;
const TRANSPARENTE = { r: 0, g: 0, b: 0, alpha: 0 };

/** Caja del logo: los pixeles claramente mas claros que el fondo. */
async function cajaDelLogo() {
  const { data, info } = await sharp(FUENTE).greyscale().raw().toBuffer({ resolveWithObject: true });
  const fondo = data[0] + UMBRAL_FONDO * 2;
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels] > fondo) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error("No se encontró el logo en la imagen fuente");
  // Margen de fondo alrededor: `logoBlanco` mide el fondo en la esquina.
  const m = 8;
  return {
    left: Math.max(0, x0 - m),
    top: Math.max(0, y0 - m),
    width: Math.min(info.width, x1 + m + 1) - Math.max(0, x0 - m),
    height: Math.min(info.height, y1 + m + 1) - Math.max(0, y0 - m),
  };
}

/** El logo en blanco con transparencia (mismo metodo que generate-pwa-icons.mjs). */
async function logoBlanco(input, width, height) {
  const { data, info } = await sharp(input)
    .resize(width, height, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bajo = data[0] + UMBRAL_FONDO;
  const rango = BLANCO - bajo;
  const alfa = Buffer.alloc(info.width * info.height);
  for (let i = 0; i < alfa.length; i++) {
    const v = ((data[i * info.channels] - bajo) / rango) * 255;
    alfa[i] = Math.max(0, Math.min(255, Math.round(v)));
  }
  return sharp({ create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .joinChannel(alfa, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
}

const destino = process.argv[2] && resolve(process.argv[2]);
if (!destino || !existsSync(join(destino, "app/src/main/res"))) {
  console.error("Uso: node scripts/preparar-android.mjs <carpeta del proyecto Android>");
  process.exit(1);
}

const caja = await cajaDelLogo();
const recorte = await sharp(FUENTE).extract(caja).png().toBuffer();

for (const [densidad, lado] of Object.entries(DENSIDADES)) {
  const ancho = Math.round(lado * PROPORCION_LOGO);
  const alto = Math.round((ancho * caja.height) / caja.width);
  const logo = await logoBlanco(recorte, ancho, alto);
  const salida = join(destino, `app/src/main/res/drawable-${densidad}/splash.png`);
  await sharp({ create: { width: lado, height: lado, channels: 4, background: TRANSPARENTE } })
    .composite([{ input: logo, left: Math.round((lado - ancho) / 2), top: Math.round((lado - alto) / 2) }])
    .png({ compressionLevel: 9 })
    .toFile(salida);
  console.log(`${densidad}: ${lado}×${lado} (logo ${ancho}×${alto}) → ${salida}`);
}

// --- Sin App Link ---
const manifiesto = join(destino, "app/src/main/AndroidManifest.xml");
const xml = readFileSync(manifiesto, "utf8");
const appLink = /\s*<intent-filter android:autoVerify="true">[\s\S]*?<\/intent-filter>/;
if (appLink.test(xml)) {
  const nuevo = xml.replace(appLink, "");
  if (!nuevo.includes("android.intent.category.LAUNCHER")) {
    throw new Error("El manifest se quedaría sin LAUNCHER: no se tocó");
  }
  writeFileSync(manifiesto, nuevo);
  console.log("AndroidManifest: quitado el App Link (los enlaces abren en Chrome)");
} else {
  console.log("AndroidManifest: sin App Link, nada que quitar");
}
