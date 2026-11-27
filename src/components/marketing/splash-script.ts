import { decidirSplash } from "./splash-logica";

/**
 * Decide si sale el splash. Va al final del `<body>` del layout raíz: solo en la carga de la página
 * (no se vuelve a renderizar al navegar, así que React no avisa). Lee la variante del propio splash
 * (`sp-app` = panel y login; si no, la landing). Sin splash en la página, no hace nada: así no
 * consume la marca «una vez por sesión».
 *
 * Los tiempos de la salida no salen de aquí: `SplashControl` espera a que las animaciones de
 * entrada terminen de verdad.
 */
export function scriptSplash(): string {
  return (
    "(function(){var v=document.getElementById('splash-entrada');" +
    "if(v){(" + decidirSplash.toString() + ")(undefined,v.classList.contains('sp-app')?'app':'landing');}})();"
  );
}
