/**
 * Genera los iconos de la PWA desde `public/symvora-logo.webp`.
 *
 * Por qué existe este script: los iconos anteriores traían un fondo OPACO
 * `#1a1a1a` incrustado, mientras el manifest declara `background_color:
 * "#0A0A0A"`. En el splash de Android esa diferencia se ve como un cuadrado
 * gris alrededor del logo sobre el fondo negro.
 *
 * La solución no es recortar el cuadrado del PNG existente (dejaría halos por
 * el antialiasing), sino reconstruir el icono desde el logo original:
 *
 *   - El logo fuente es NEGRO sobre transparente, así que se usa su canal
 *     alfa como máscara y se rellena de blanco. Eso da un logo blanco de
 *     bordes limpios, legible sobre el fondo oscuro de la marca.
 *   - Los iconos `purpose: "any"` quedan con fondo TRANSPARENTE: el navegador
 *     los dibuja sobre `background_color`, así que el logo se ve contorneado y
 *     nunca aparece un cuadrado de otro tono.
 *   - Los `purpose: "maskable"` SÍ llevan fondo opaco a sangre. Android los
 *     recorta a una forma (círculo, squircle...) y la transparencia produciría
 *     artefactos. Se pintan con el mismo `#0A0A0A` del manifest y el logo se
 *     reduce para caber en la zona segura (el 80% central).
 *
 * Uso:  node scripts/generate-pwa-icons.mjs
 */

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(root, "public/symvora-logo.webp");
const OUT_DIR = join(root, "public/icons");

/** Mismo valor que `background_color` en src/app/manifest.ts. */
const BRAND_BG = "#0A0A0A";
const LOGO_COLOR = { r: 255, g: 255, b: 255 };

/** Proporción del lienzo que ocupa el logo. */
const RATIO_ANY = 0.8;
/** Los maskable se recortan: el contenido debe vivir en el 80% central. */
const RATIO_MASKABLE = 0.56;

/**
 * Devuelve el logo recoloreado a blanco, conservando su transparencia.
 *
 * Se hace canal a canal: se toma el alfa del original (que es la silueta real
 * del logo) y se pega sobre un lienzo blanco liso. Recolorear así evita los
 * bordes sucios que deja un reemplazo de color por umbral.
 */
async function buildWhiteLogo(size) {
  const resized = sharp(SOURCE)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha();

  const alpha = await resized.clone().extractChannel(3).toColourspace("b-w").toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: LOGO_COLOR,
    },
  })
    .joinChannel(alpha)
    .png()
    .toBuffer();
}

async function writeIcon({ size, ratio, background, file }) {
  const logoSize = Math.round(size * ratio);
  const logo = await buildWhiteLogo(logoSize);
  const offset = Math.round((size - logoSize) / 2);

  await sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: logo, top: offset, left: offset }])
    .png()
    .toFile(join(OUT_DIR, file));

  console.log(`  ✓ ${file} (${size}px, logo al ${Math.round(ratio * 100)}%)`);
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

console.log("Generando iconos PWA desde symvora-logo.webp\n");

console.log('purpose "any" — fondo transparente:');
await writeIcon({ size: 192, ratio: RATIO_ANY, background: TRANSPARENT, file: "icon-192.png" });
await writeIcon({ size: 512, ratio: RATIO_ANY, background: TRANSPARENT, file: "icon-512.png" });

console.log(`\npurpose "maskable" — fondo ${BRAND_BG} a sangre:`);
await writeIcon({ size: 192, ratio: RATIO_MASKABLE, background: BRAND_BG, file: "icon-maskable-192.png" });
await writeIcon({ size: 512, ratio: RATIO_MASKABLE, background: BRAND_BG, file: "icon-maskable-512.png" });

console.log("\nListo.");
