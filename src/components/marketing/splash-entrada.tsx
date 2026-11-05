import "@/styles/splash-entrada.css";
import { GIROS } from "@/features/marketing/giros";
import { TRAZO_GIRO } from "./giro-estilos";
import { SplashControl } from "./splash-control";
import { decidirSplash, type VarianteSplash } from "./splash-logica";

/**
 * Pantalla de entrada de la landing (diseño aprobado en el canvas "Splash SYMVORA").
 *
 * Funcionamiento:
 * - Se pinta con el HTML estatico, asi tapa la pagina desde el primer cuadro mientras carga.
 * - La entrada es solo CSS (`styles/splash-entrada.css`).
 * - `SplashControl` decide cuando salir (carga de la pagina, con minimo y tope; ver
 *   `splash-logica.ts`) y hace volar el logo y la palabra al header.
 *
 * Reglas:
 * - Una vez por sesion; nunca a bots ni con `prefers-reduced-motion`.
 * - Los destinos del vuelo son los `data-splash-*` de `components/ui/app-frame.tsx`: si cambia
 *   el header, revisar el vuelo.
 */

/** Giros que flotan, con los mismos iconos del catalogo de giros de la landing. */
const GIROS_SPLASH = [
  "abarrotes",
  "verdulerias",
  "tiendas-de-mascotas",
  "tiendas-de-ropa",
  "ferreterias",
  "farmacias",
  "panaderias",
  "tiendas-de-regalos",
];

const LETRAS = ["S", "Y", "M", "V", "O", "R", "A"];

/** Las tres piezas de la "S" del logo (`public/symvora-logo.webp`), en el mismo lienzo. */
const PIEZAS_LOGO = [
  "M165 15H452L310 158Z",
  "M148 18L455 325L325 455L18 148Z",
  "M160 312L302 455H18Z",
];

// Corre en cuanto el navegador lo lee, antes de pintar el splash: decide si se muestra.
// Los tiempos de la salida no salen de aqui: `SplashControl` espera a que las animaciones
// de entrada terminen de verdad.
const scriptDecision = (variante: VarianteSplash) =>
  `(${decidirSplash.toString()})(undefined,${JSON.stringify(variante)})`;

/**
 * - `landing`: al final el logo y la palabra vuelan al header de la landing.
 * - `app` (layouts del panel y del login): solo sale al abrir la app instalada, PWA o APK
 *   de Play. Va todo sobre el azul del splash nativo de Android y de la PWA, para empalmar
 *   sin corte. Al final se despide con el vidrio, sin vuelo.
 */
export function SplashEntrada({ variante = "landing" }: { variante?: VarianteSplash }) {
  const giros = GIROS_SPLASH.flatMap((slug) => GIROS.filter((g) => g.slug === slug));

  return (
    <div
      id="splash-entrada"
      className={variante === "app" ? "splash-entrada sp-app" : "splash-entrada"}
      aria-hidden="true"
    >
      <script dangerouslySetInnerHTML={{ __html: scriptDecision(variante) }} />
      <div className="sp-capa">
        <div className="sp-mar" />
        <div className="sp-brillo" />
        <div className="sp-giros">
          {giros.map((giro, i) => {
            const Icono = giro.icono;
            return (
              <div key={giro.slug} className={`sp-giro sp-g${i + 1}`}>
                <Icono strokeWidth={TRAZO_GIRO} aria-hidden="true" focusable="false" />
              </div>
            );
          })}
        </div>
        <div className="sp-grupo">
          <div className="sp-vuelo-logo">
            <div className="sp-logo">
              {PIEZAS_LOGO.map((d) => (
                <svg key={d} className="sp-pieza" viewBox="0 0 470 470" aria-hidden="true" focusable="false">
                  <path d={d} />
                </svg>
              ))}
            </div>
          </div>
          <div className="sp-vuelo-palabra">
            <div className="sp-palabra">
              {LETRAS.map((letra, i) => (
                <span key={i} className="sp-l">
                  {letra}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <SplashControl variante={variante} />
    </div>
  );
}
