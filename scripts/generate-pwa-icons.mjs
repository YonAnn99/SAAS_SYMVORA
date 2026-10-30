/**
 * Genera los iconos y las pantallas de arranque de la PWA en el azul de la marca.
 *
 * Fuente: `scripts/assets/symvora-app-icon.png` (S blanca sobre azul a sangre,
 * 1254×1254). Su azul (#153188) no es exactamente el de la marca, así que no se
 * reescala tal cual: se usa su luminancia como máscara de la S (el azul queda en
 * 0, el blanco en 255) y se pinta en blanco. Así los bordes conservan su
 * antialiasing y el fondo, cuando lo hay, es el azul exacto.
 *
 *   - Iconos `any`: S blanca sobre fondo TRANSPARENTE, al 80% del lienzo. Android
 *     arma el arranque pintando este icono sobre `background_color`; con fondo
 *     opaco, aunque sea del mismo azul, el escalado deja una orilla visible y se
 *     ve un cuadrado contorneado alrededor de la S.
 *   - Iconos `maskable` y `apple-touch-icon.png` (180×180): opacos, S blanca
 *     sobre `BRAND_BG` a sangre. La S ocupa del 25% al 75% del lienzo, dentro de
 *     la zona segura de Android (círculo del 80%); iOS no respeta transparencia.
 *   - Logo de los correos (`public/symvora-logo-email.png`, 288×288): el mismo
 *     icono opaco con esquinas redondeadas (las de un ícono de app). Lo usan
 *     `BRAND.logo` de src/lib/email.ts y las plantillas de Supabase
 *     (`supabase/templates/`); los correos lo muestran a 72 px.
 *   - Pantallas de arranque de iOS (`public/splash/*.png`): se regeneran desde sí
 *     mismas con el mismo método (su luminancia es la máscara de la S y de
 *     «SYMVORA»). Funciona sobre el fondo que tengan, así que repetir el script
 *     no las degrada.
 *
 * `BRAND_BG` es el mismo valor que `background_color` en src/app/manifest.ts.
 *
 * Uso:  node scripts/generate-pwa-icons.mjs
 */

import sharp from "sharp";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(root, "scripts/assets/symvora-app-icon.png");
const ICONS_DIR = join(root, "public/icons");
const SPLASH_DIR = join(root, "public/splash");

const BRAND_BG = "#1E3A8A";
const LOGO_COLOR = { r: 255, g: 255, b: 255 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** Proporción del lienzo que ocupa la S en los iconos `any`. */
const RATIO_ANY = 0.8;

/**
 * Margen sobre el fondo antes de considerar un pixel parte del logo: absorbe el
 * ruido de compresión del fondo para que no quede un velo blanco.
 */
const UMBRAL_FONDO = 12;
const BLANCO = 235;

/**
 * Logo de `input` (claro sobre un fondo liso más oscuro) en blanco con
 * transparencia, al tamaño pedido. El fondo se mide en la esquina superior
 * izquierda de la imagen.
 */
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

  return sharp({ create: { width, height, channels: 3, background: LOGO_COLOR } })
    .joinChannel(alfa, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
}

/** El logo de `input` en blanco sobre `BRAND_BG`, mismo encuadre. */
async function sobreAzul(input, width, height) {
  return sharp({ create: { width, height, channels: 3, background: BRAND_BG } })
    .composite([{ input: await logoBlanco(input, width, height) }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** La S recortada a su caja, en blanco y transparente, a resolución completa. */
async function sRecortada() {
  const { width, height } = await sharp(SOURCE).metadata();
  return sharp(await logoBlanco(SOURCE, width, height)).trim().png().toBuffer();
}

async function writeAny(s, size, file) {
  const lado = Math.round(size * RATIO_ANY);
  const logo = await sharp(s).resize(lado, lado, { fit: "contain", background: TRANSPARENT }).toBuffer();
  const offset = Math.round((size - lado) / 2);
  await sharp({ create: { width: size, height: size, channels: 4, background: TRANSPARENT } })
    .composite([{ input: logo, top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toFile(join(ICONS_DIR, file));
  console.log(`  ✓ ${file} (${size}px, transparente, S al ${Math.round(RATIO_ANY * 100)}%)`);
}

async function writeOpaco(size, file) {
  await sharp(await sobreAzul(SOURCE, size, size)).toFile(join(ICONS_DIR, file));
  console.log(`  ✓ ${file} (${size}px, fondo ${BRAND_BG})`);
}

async function writeCorreo(size, file) {
  const radio = Math.round(size * 0.22);
  const esquinas = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radio}" ry="${radio}"/></svg>`
  );
  await sharp(await sobreAzul(SOURCE, size, size))
    .ensureAlpha()
    .composite([{ input: esquinas, blend: "dest-in" }])
    .png({ compressionLevel: 9 })
    .toFile(join(root, "public", file));
  console.log(`  ✓ ${file} (${size}px, esquinas redondeadas)`);
}

console.log("Iconos desde symvora-app-icon.png:");
const s = await sRecortada();
await writeAny(s, 192, "icon-192.png");
await writeAny(s, 512, "icon-512.png");
await writeOpaco(192, "icon-maskable-192.png");
await writeOpaco(512, "icon-maskable-512.png");
await writeOpaco(180, "apple-touch-icon.png");
await writeCorreo(288, "symvora-logo-email.png");

console.log(`\nPantallas de arranque de iOS, fondo ${BRAND_BG}:`);
for (const file of (await readdir(SPLASH_DIR)).filter((f) => f.endsWith(".png")).sort()) {
  const ruta = join(SPLASH_DIR, file);
  const { width, height } = await sharp(ruta).metadata();
  // Se lee a memoria antes de escribir: entrada y salida son el mismo archivo.
  const salida = await sobreAzul(await sharp(ruta).toBuffer(), width, height);
  await sharp(salida).toFile(ruta);
  console.log(`  ✓ ${file}`);
}

console.log("\nListo.");
