/**
 * Convierte las portadas de las novedades a WebP (`public/novedades/<id>-portada.webp`).
 *
 * Uso: node scripts/novedades-imagenes.mjs <carpeta-con-los-png>
 * Espera `<id>.png` por novedad (p. ej. `pedidos-v2.png`). Las capturas de detalle
 * (`<id>-detalle.png`) se procesan igual si existen. Las imágenes originales viven fuera del repo.
 */
import sharp from "sharp";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const [, , origen] = process.argv;
if (!origen) {
  console.error("Uso: node scripts/novedades-imagenes.mjs <carpeta>");
  process.exit(1);
}
const SALIDA = "public/novedades";
mkdirSync(SALIDA, { recursive: true });

const TRABAJOS = [
  { entrada: "pedidos-v2.png", salida: "pedidos-v2-portada.webp", ancho: 960 },
  { entrada: "ticket-personalizable.png", salida: "ticket-personalizable-portada.webp", ancho: 960 },
  { entrada: "pedidos-v2-detalle.png", salida: "pedidos-v2-detalle.webp", ancho: 1280 },
  { entrada: "ticket-personalizable-detalle.png", salida: "ticket-personalizable-detalle.webp", ancho: 1280 },
];

for (const t of TRABAJOS) {
  const ruta = join(origen, t.entrada);
  if (!existsSync(ruta)) continue;
  const info = await sharp(ruta)
    .resize({ width: t.ancho, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(join(SALIDA, t.salida));
  console.log("ok", t.salida, `${info.width}x${info.height}`, `${Math.round(info.size / 1024)} KB`);
}
