import { useSyncExternalStore } from "react";

/**
 * Animacion "articulo → carrito" del POS (diseño aprobado el 2026-10-12).
 *
 * Al tocar un producto, una copia de su foto vuela en arco hasta su linea del
 * carrito (escritorio) o hasta la barra del carrito (celular). Es SOLO visual:
 * el articulo ya entro al carrito antes de que despegue, nunca bloquea otro
 * toque, el escaner ni el cobro, y la copia no recibe clics.
 *
 * - Sin foto de origen (escaner, Enter en el buscador, premio de lealtad) no
 *   hay vuelo: solo el aterrizaje (destello de la linea / rebote de la barra).
 * - Con "reducir movimiento" del sistema tampoco hay vuelo ni saltos: solo un
 *   destello suave.
 * - Se usa la animacion nativa del navegador (`element.animate`): sin
 *   librerias nuevas en el bundle del POS.
 */

export interface Punto {
  x: number;
  y: number;
}

/** Duracion del vuelo: hacia la linea (escritorio) y hacia la barra (celular). */
export const DURACION_VUELO_LINEA_MS = 460;
export const DURACION_VUELO_BARRA_MS = 440;
const CURVA_VUELO = "cubic-bezier(.5,0,.25,1)";
/** Si el navegador nunca avisa que termino (pestaña oculta), se limpia igual. */
const MARGEN_LIMPIEZA_MS = 800;

/**
 * Cuadros del vuelo: una curva cuadratica de `desde` a `hasta` (centros) con
 * su punto de control en `control`. Al despegar crece a 1.06 ("se levanta") y
 * despues se encoge hasta `escalaFinal`; al final se desvanece a la mitad.
 */
export function framesDeArco(
  desde: Punto,
  hasta: Punto,
  control: Punto,
  escalaFinal: number,
  pasos = 16
): Keyframe[] {
  const frames: Keyframe[] = [];
  for (let k = 0; k <= pasos; k++) {
    const t = k / pasos;
    const u = 1 - t;
    const x = u * u * desde.x + 2 * u * t * control.x + t * t * hasta.x;
    const y = u * u * desde.y + 2 * u * t * control.y + t * t * hasta.y;
    const escala =
      t < 0.12 ? 1 + 0.06 * (t / 0.12) : 1.06 + (escalaFinal - 1.06) * ((t - 0.12) / 0.88);
    const opacidad = t < 0.85 ? 1 : 1 - ((t - 0.85) / 0.15) * 0.5;
    frames.push({
      offset: t,
      transform: `translate(${redondear(x - desde.x)}px, ${redondear(y - desde.y)}px) scale(${redondear(escala)})`,
      opacity: redondear(opacidad),
    });
  }
  return frames;
}

/**
 * Punto de control del arco. Hacia la linea (a la derecha, a la misma altura)
 * sube por encima de los dos; hacia la barra (abajo) da un saltito y cae.
 */
export function controlDelArco(desde: Punto, hasta: Punto, destino: "linea" | "barra"): Punto {
  if (destino === "linea") {
    return { x: (desde.x + hasta.x) / 2, y: Math.min(desde.y, hasta.y) - 140 };
  }
  return { x: desde.x + (hasta.x - desde.x) * 0.25, y: desde.y - 90 };
}

function redondear(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// --- Vuelos en curso -------------------------------------------------------
// La barra del carrito en celular muestra el conteo y el total que tenia hasta
// que aterriza el vuelo (el carrito ya cambio; solo el numero espera ~0.4 s).

export interface EstadoVuelos {
  /** Vuelos en el aire ahora mismo. */
  activos: number;
  /** Cuantos han aterrizado: cambia con cada aterrizaje. */
  aterrizajes: number;
}

const SIN_VUELOS: EstadoVuelos = { activos: 0, aterrizajes: 0 };
let estado: EstadoVuelos = SIN_VUELOS;
const oyentes = new Set<() => void>();

function cambiarEstado(siguiente: EstadoVuelos) {
  estado = siguiente;
  oyentes.forEach((oyente) => oyente());
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export function useVuelosAlCarrito(): EstadoVuelos {
  return useSyncExternalStore(suscribir, () => estado, () => SIN_VUELOS);
}

// --- Efecto en la pagina ---------------------------------------------------

interface Destino {
  tipo: "linea" | "barra";
  /** Lo que destella o rebota al aterrizar. */
  el: HTMLElement;
  /** Lo que salta al aterrizar (el conteo). */
  salto: HTMLElement | null;
}

function prefiereMovimientoReducido(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function esVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/**
 * La linea del carrito si esta a la vista (panel de escritorio); si no, la
 * barra del carrito (celular). La hoja del carrito cerrada no esta en la pagina.
 */
function buscarDestino(claveLinea: string): Destino | null {
  for (const linea of document.querySelectorAll<HTMLElement>("[data-linea-carrito]")) {
    if (linea.dataset.lineaCarrito === claveLinea && esVisible(linea)) {
      const conteo = Array.from(
        document.querySelectorAll<HTMLElement>("[data-conteo-carrito]")
      ).find(esVisible);
      return { tipo: "linea", el: linea, salto: conteo ?? null };
    }
  }
  for (const barra of document.querySelectorAll<HTMLElement>("[data-barra-carrito]")) {
    if (esVisible(barra)) {
      return {
        tipo: "barra",
        el: barra,
        salto: barra.querySelector<HTMLElement>("[data-destino-carrito]"),
      };
    }
  }
  return null;
}

/** Centro y ancho final del vuelo dentro del destino. */
function puntoDeAterrizaje(destino: Destino): { centro: Punto; ancho: number } {
  if (destino.tipo === "linea") {
    // El arranque de la linea, donde empieza el nombre.
    const r = destino.el.getBoundingClientRect();
    return { centro: { x: r.left + 20, y: r.top + r.height / 2 }, ancho: 32 };
  }
  const r = (destino.salto ?? destino.el).getBoundingClientRect();
  return { centro: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, ancho: 36 };
}

function aterrizar(destino: Destino | null, reducido: boolean) {
  if (!destino || typeof destino.el.animate !== "function") return;
  if (destino.tipo === "linea") {
    destino.el.animate(
      [{ backgroundColor: "rgba(59, 130, 246, 0.18)" }, { backgroundColor: "rgba(59, 130, 246, 0)" }],
      { duration: 700, easing: "ease-out" }
    );
  } else if (reducido) {
    destino.el.animate([{ opacity: 0.75 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
  }
  if (reducido) return;
  if (destino.tipo === "barra") {
    destino.el.animate(
      [
        { transform: "translateY(0) scale(1)" },
        { transform: "translateY(3px) scale(0.985)", offset: 0.35 },
        { transform: "translateY(-2px) scale(1.01)", offset: 0.7 },
        { transform: "translateY(0) scale(1)" },
      ],
      { duration: 260, easing: "ease-out" }
    );
  }
  destino.salto?.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.28)" }, { transform: "scale(1)" }],
    { duration: 240, easing: "ease-out" }
  );
}

/** Espera a que React pinte la linea nueva antes de medirla. */
function despuesDelRender(fn: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

/** La copia de la foto que vuela: fija sobre todo y sin recibir clics. */
function crearCopia(foto: HTMLElement, r: DOMRect): HTMLElement {
  const copia = document.createElement("div");
  copia.setAttribute("aria-hidden", "true");
  Object.assign(copia.style, {
    position: "fixed",
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    margin: "0",
    zIndex: "100",
    pointerEvents: "none",
    overflow: "hidden",
    borderRadius: "12px",
    boxShadow: "0 14px 30px rgba(15, 23, 42, 0.22)",
    willChange: "transform, opacity",
  } satisfies Partial<CSSStyleDeclaration>);
  // Solo la imagen (o las iniciales): sin las marcas "×2" ni "Talla M".
  const imagen = (foto.querySelector("[data-foto-imagen]") ?? foto.firstElementChild)?.cloneNode(true);
  if (imagen instanceof HTMLElement) {
    imagen.style.width = "100%";
    imagen.style.height = "100%";
    copia.appendChild(imagen);
  }
  document.body.appendChild(copia);
  return copia;
}

/**
 * Lanza la animacion despues de agregar `claveLinea` al carrito. `origen` es
 * la foto de la tarjeta tocada (`[data-foto-pos]`), o `null` sin tarjeta.
 */
export function animarAlCarrito(origen: HTMLElement | null, claveLinea: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const reducido = prefiereMovimientoReducido();
  const foto = origen?.isConnected ? origen : null;
  const desde = foto?.getBoundingClientRect();

  if (reducido || !foto || !desde || desde.width === 0 || typeof foto.animate !== "function") {
    despuesDelRender(() => aterrizar(buscarDestino(claveLinea), reducido));
    return;
  }

  const copia = crearCopia(foto, desde);
  cambiarEstado({ ...estado, activos: estado.activos + 1 });

  let terminado = false;
  const terminar = (destino: Destino | null) => {
    if (terminado) return;
    terminado = true;
    copia.remove();
    cambiarEstado({
      activos: Math.max(0, estado.activos - 1),
      aterrizajes: estado.aterrizajes + 1,
    });
    aterrizar(destino, false);
  };
  // Con la pestaña oculta no hay cuadros de animacion: que la barra no se
  // quede con el conteo viejo.
  window.setTimeout(() => terminar(null), DURACION_VUELO_LINEA_MS + MARGEN_LIMPIEZA_MS * 2);

  despuesDelRender(() => {
    const destino = buscarDestino(claveLinea);
    if (!destino) {
      terminar(null);
      return;
    }
    if (destino.tipo === "linea") destino.el.scrollIntoView({ block: "nearest" });
    const { centro, ancho } = puntoDeAterrizaje(destino);
    const inicio = { x: desde.left + desde.width / 2, y: desde.top + desde.height / 2 };
    const duracion = destino.tipo === "linea" ? DURACION_VUELO_LINEA_MS : DURACION_VUELO_BARRA_MS;
    const frames = framesDeArco(
      inicio,
      centro,
      controlDelArco(inicio, centro, destino.tipo),
      Math.max(ancho / desde.width, 0.12)
    );
    const vuelo = copia.animate(frames, { duration: duracion, easing: CURVA_VUELO, fill: "forwards" });
    vuelo.onfinish = () => terminar(destino);
    vuelo.oncancel = () => terminar(destino);
  });
}
