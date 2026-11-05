"use client";

import { useEffect } from "react";
import {
  ATERRIZAJE_MS,
  LOGO_MOVIL_RESPALDO,
  SALIDA_FORZADA_MS,
  SALIDA_MS,
  instanteDeSalida,
  vectorDeVuelo,
  type Caja,
  type VarianteSplash,
} from "./splash-logica";

/** Animaciones finitas del splash: las de la entrada (la respiracion y el flotar son en bucle). */
function animacionesDeEntrada(splash: HTMLElement): Animation[] {
  if (typeof splash.getAnimations !== "function") return [];
  return splash
    .getAnimations({ subtree: true })
    .filter((a) => a.effect?.getTiming().iterations !== Infinity);
}

/** Primer elemento visible (con tamano) del selector; los del header de escritorio no se ven en celular. */
function cajaVisible(selector: string): Caja | null {
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
  }
  return null;
}

/**
 * Antes de medir, la entrada debe estar terminada. Normalmente ya lo esta (la salida la
 * espera); si se salta con Esc, se completa de golpe. Si no, la palabra seguiria bajando y
 * las piezas armandose DURANTE el vuelo, y llegarian corridas al header. Ademas, se quita
 * la "respiracion" (escala de hasta 1.03), que falseaba la medida.
 */
function dejarListoParaVolar(splash: HTMLElement) {
  if (typeof splash.getAnimations !== "function") return;
  for (const animacion of splash.getAnimations({ subtree: true })) {
    const nombre = "animationName" in animacion ? (animacion as CSSAnimation).animationName : "";
    if (nombre === "sp-respira") animacion.cancel();
    else if (animacion.effect?.getTiming().iterations !== Infinity) animacion.finish();
  }
}

/**
 * FLIP: mide el logo y la palabra del splash contra su lugar en el header y deja el
 * traslado en variables CSS que usa la salida (`splash-entrada.css`).
 */
function apuntarVuelo(splash: HTMLElement) {
  const logo = splash.querySelector<HTMLElement>(".sp-vuelo-logo");
  const palabra = splash.querySelector<HTMLElement>(".sp-palabra");
  if (!logo || !palabra) return;
  const fijar = (variable: string, valor: string) => splash.style.setProperty(variable, valor);
  const origenLogo = logo.getBoundingClientRect();
  const origenPalabra = palabra.getBoundingClientRect();

  const aplicar = (prefijo: "logo" | "pal", v: { dx: number; dy: number; s: number }) => {
    fijar(`--${prefijo}-dx`, `${v.dx}px`);
    fijar(`--${prefijo}-dy`, `${v.dy}px`);
    fijar(`--${prefijo}-s`, String(v.s));
  };

  // Escritorio: el header muestra el logo y "SYMVORA"; cada uno va a su lugar.
  const logoHeader = cajaVisible('[data-splash-destino="logo"]');
  if (logoHeader) {
    aplicar("logo", vectorDeVuelo(origenLogo, logoHeader));
    const marca = document.querySelector<HTMLElement>('[data-splash-destino="marca"]');
    const cajaMarca = marca ? cajaVisible('[data-splash-destino="marca"]') : null;
    if (marca && cajaMarca) {
      const escala =
        parseFloat(getComputedStyle(marca).fontSize) / parseFloat(getComputedStyle(palabra).fontSize);
      aplicar("pal", vectorDeVuelo(origenPalabra, cajaMarca, escala));
      fijar("--pal-op", "1");
    }
    return;
  }

  // Celular: solo hay logo (en la pildora); la palabra lo sigue y se guarda en el.
  const logoMovil = cajaVisible('[data-splash-destino="logo-movil"]') ?? LOGO_MOVIL_RESPALDO;
  aplicar("logo", vectorDeVuelo(origenLogo, logoMovil));
  aplicar("pal", vectorDeVuelo(origenPalabra, logoMovil, 0.1));
  fijar("--pal-op", "0");
  fijar("--pal-d", "60ms");
  // La pildora es blanca en tema claro: el logo termina oscuro, como el real.
  if (!document.documentElement.classList.contains("dark")) fijar("--logo-final", "#09090B");
}

/**
 * Controla la salida del splash: espera la entrada y la carga de la pagina, mide el
 * destino y dispara el vuelo al header. Si no hay splash (`sin-splash`, o se llego por
 * navegacion del cliente) no hace nada.
 */
export function SplashControl({ variante = "landing" }: { variante?: VarianteSplash }) {
  useEffect(() => {
    const html = document.documentElement;
    const splash = document.getElementById("splash-entrada");
    if (!splash || !html.classList.contains("splash-activo")) return;

    // Desde aqui manda el JS: se cancela el respaldo CSS.
    html.classList.add("splash-controlada");
    const relojes: number[] = [];
    let relojSalida = 0;
    let vigente = true;
    let salio = false;
    let finEntrada: number | null = null;
    let cargadaEn: number | null = null;

    const salir = () => {
      if (salio) return;
      salio = true;
      dejarListoParaVolar(splash);
      // En la app no hay header de landing: el logo se despide con el vidrio (CSS de `.sp-app`).
      if (variante === "landing") apuntarVuelo(splash);
      html.classList.remove("splash-activo");
      html.classList.add("splash-saliendo");
      splash.classList.add("saliendo");
      relojes.push(window.setTimeout(() => html.classList.remove("splash-saliendo"), ATERRIZAJE_MS));
      relojes.push(
        window.setTimeout(() => {
          splash.hidden = true;
          html.classList.remove("splash-controlada");
        }, SALIDA_MS),
      );
    };

    // (Re)programa la salida con lo que se sabe: solo despues de que la entrada termino.
    const programar = () => {
      // `vigente`: las promesas pueden resolver despues del desmontaje (StrictMode monta dos veces).
      if (!vigente || finEntrada === null || salio) return;
      window.clearTimeout(relojSalida);
      const en = instanteDeSalida(finEntrada, cargadaEn);
      relojSalida = window.setTimeout(salir, Math.max(0, en - performance.now()));
    };

    // La salida se ancla a la animacion, no a un reloj: espera a que TODA la entrada se
    // haya visto, sin importar cuando el navegador pinto por primera vez.
    const esperarEntrada = () => {
      relojes.push(window.setTimeout(salir, SALIDA_FORZADA_MS));
      Promise.all(animacionesDeEntrada(splash).map((a) => a.finished)).then(
        () => {
          finEntrada = performance.now();
          programar();
        },
        () => {
          // Una animacion cancelada: la salida forzada se encarga.
        },
      );
    };

    const alCargar = () => {
      document.fonts.ready.then(() => {
        cargadaEn = performance.now();
        programar();
      });
    };
    if (document.readyState === "complete") alCargar();
    else window.addEventListener("load", alCargar, { once: true });

    // Abierta en una pestaña de fondo: la entrada correria sin que nadie la viera. Se
    // detiene y arranca desde cero cuando el visitante llega a la pestaña.
    const alVolverVisible = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", alVolverVisible);
      for (const animacion of splash.getAnimations({ subtree: true })) {
        animacion.currentTime = 0;
        animacion.play();
      }
      esperarEntrada();
    };
    if (document.visibilityState === "hidden" && typeof splash.getAnimations === "function") {
      splash.getAnimations({ subtree: true }).forEach((a) => a.pause());
      document.addEventListener("visibilitychange", alVolverVisible);
    } else {
      esperarEntrada();
    }

    // Esc salta el splash en cualquier momento. Un toque o clic, solo cuando la entrada ya
    // se vio: asi un clic mientras carga no se lo come.
    const alTocar = () => {
      if (finEntrada !== null) salir();
    };
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") salir();
    };
    splash.addEventListener("pointerdown", alTocar);
    window.addEventListener("keydown", alTecla);

    return () => {
      vigente = false;
      relojes.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(relojSalida);
      window.removeEventListener("load", alCargar);
      window.removeEventListener("keydown", alTecla);
      document.removeEventListener("visibilitychange", alVolverVisible);
      splash.removeEventListener("pointerdown", alTocar);
    };
  }, [variante]);

  return null;
}
