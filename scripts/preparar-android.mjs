/**
 * Ajustes al proyecto Android (TWA de Bubblewrap) que Bubblewrap no ofrece y que
 * `bubblewrap update` deshace: correr este script despues de cada update y
 * antes de `bubblewrap build`.
 *
 *   node scripts/preparar-android.mjs ~/Documentos/symvora-android
 *
 * 1. SPLASH LISO: el splash nativo queda en azul, sin logo ni texto. El logo y
 *    «SYMVORA» los pone el splash animado de la web (variante `app` de
 *    `components/marketing/splash-entrada.tsx`), que arranca sobre el mismo azul.
 *    Con logo nativo se veian DOS splash seguidos (2026-11-05).
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
 * `backgroundColor` (#1E3A8A) mientras Chrome arranca. Bubblewrap lo genera
 * escalando el icono de 512; aqui se reemplaza por un PNG transparente, asi solo
 * se ve el azul. (En Android 12+ el sistema muestra un instante el icono de la
 * app al abrirla: eso no depende de este archivo.)
 */

import sharp from "sharp";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** Lado del splash por densidad: 300 dp. */
const DENSIDADES = { mdpi: 300, hdpi: 450, xhdpi: 600, xxhdpi: 900, xxxhdpi: 1200 };

const TRANSPARENTE = { r: 0, g: 0, b: 0, alpha: 0 };

const destino = process.argv[2] && resolve(process.argv[2]);
if (!destino || !existsSync(join(destino, "app/src/main/res"))) {
  console.error("Uso: node scripts/preparar-android.mjs <carpeta del proyecto Android>");
  process.exit(1);
}

for (const [densidad, lado] of Object.entries(DENSIDADES)) {
  const salida = join(destino, `app/src/main/res/drawable-${densidad}/splash.png`);
  await sharp({ create: { width: lado, height: lado, channels: 4, background: TRANSPARENTE } })
    .png({ compressionLevel: 9 })
    .toFile(salida);
  console.log(`${densidad}: ${lado}×${lado} transparente → ${salida}`);
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
