/**
 * Genera los iconos y las pantallas de arranque de la PWA en el azul de la marca.
 *
 * Fuente: `scripts/assets/symvora-app-icon.png` (S blanca sobre azul a sangre,
 * 1254×1254). Su azul (#153188) no es exactamente el de la marca, así que no se
 * reescala tal cual: se usa su luminancia como máscara de la S (el azul queda en
 * 0, el blanco en 255) y se pinta en blanco sobre `BRAND_BG`. Así el fondo es el
 * azul exacto y los bordes conservan su antialiasing.
 *
 *   - Iconos `any` y `maskable`: iguales, opacos y a sangre. El logo ocupa del
 *     25% al 75% del lienzo, dentro de la zona segura de Android (circulo del
 *     80%), así que el mismo dibujo sirve para los dos propósitos.
 *   - `apple-touch-icon.png` (180×180): iOS no respeta transparencia.
 *   - Pantallas de arranque de iOS (`public/splash/*.png`): se regeneran desde sí
 *     mismas con el mismo método (su luminancia es la máscara de la S y de
 *     «SYMVORA»). Funciona sobre el fondo que tengan, así que repetir el script
 *     no las degrada.
 *
 * `BRAND_BG` es el mismo valor que `background_color` en src/app/manifest.ts:
 * Android pinta el arranque con ese color y el icono encima.
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

/**
 * Margen sobre el fondo antes de considerar un pixel parte del logo: absorbe el
 * ruido de compresión del fondo para que no quede un velo blanco.
 */
const UMBRAL_FONDO = 12;
const BLANCO = 235;

/**
 * Compone el logo de `input` (claro sobre un fondo liso más oscuro) en blanco
 * sobre `BRAND_BG`, al tamaño pedido. El fondo se mide en la esquina superior
 * izquierda de la imagen.
 */
async function recolorear(input, width, height) {
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

  const logo = await sharp({
    create: { width, height, channels: 3, background: LOGO_COLOR },
  })
    .joinChannel(alfa, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();

  return sharp({ create: { width, height, channels: 3, background: BRAND_BG } })
    .composite([{ input: logo }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function writeIcon(size, file) {
  await sharp(await recolorear(SOURCE, size, size)).toFile(join(ICONS_DIR, file));
  console.log(`  ✓ ${file} (${size}px)`);
}

console.log(`Iconos desde symvora-app-icon.png, fondo ${BRAND_BG}:`);
await writeIcon(192, "icon-192.png");
await writeIcon(512, "icon-512.png");
await writeIcon(192, "icon-maskable-192.png");
await writeIcon(512, "icon-maskable-512.png");
await writeIcon(180, "apple-touch-icon.png");

console.log(`\nPantallas de arranque de iOS, fondo ${BRAND_BG}:`);
for (const file of (await readdir(SPLASH_DIR)).filter((f) => f.endsWith(".png")).sort()) {
  const ruta = join(SPLASH_DIR, file);
  const { width, height } = await sharp(ruta).metadata();
  // Se lee a memoria antes de escribir: entrada y salida son el mismo archivo.
  const salida = await recolorear(await sharp(ruta).toBuffer(), width, height);
  await sharp(salida).toFile(ruta);
  console.log(`  ✓ ${file}`);
}

console.log("\nListo.");
