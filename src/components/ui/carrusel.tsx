"use client";

/**
 * Carrusel de React Bits (reactbits.dev/components/carousel): tarjetas que se
 * deslizan con giro 3D, puntos de navegacion, ciclo infinito y autoavance.
 *
 * Vendoreado con adaptaciones marcadas `// SYMVORA`:
 *   - Sin `drag` de motion: en las paginas de marketing motion se carga ligero
 *     (`LazyMotion` + `domAnimation`, ver `marketing/movimiento.tsx`) y el
 *     arrastre vive en `domMax`. Se arrastra con eventos de puntero propios y
 *     se anima con `animate()` sobre el mismo `x`.
 *   - Ancho RESPONSIVO: mide su contenedor (el original era de 300 px fijos).
 *   - Iconos de lucide (sin react-icons) y colores de SYMVORA, claro y oscuro.
 *   - Flechas y teclado (← →) ademas de los puntos; el giro y el autoavance
 *     se apagan con "reducir movimiento".
 *   - `touch-action: pan-y`: en celular el dedo sigue desplazando la pagina en
 *     vertical y solo el gesto horizontal mueve el carrusel.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import * as m from "motion/react-m";
import { animate, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CarruselItem {
  id: string;
  titulo: string;
  texto: string;
  icono: ReactNode;
}

interface CarruselProps {
  items: CarruselItem[];
  /** Ancho maximo de la tarjeta; en pantallas chicas usa todo el disponible. */
  anchoMaximo?: number;
  autoplay?: boolean;
  autoplayDelay?: number;
  pauseOnHover?: boolean;
  loop?: boolean;
  className?: string;
}

const GAP = 16;
const RELLENO = 16;
const UMBRAL_PX = 40;
const UMBRAL_VELOCIDAD = 0.5; // px/ms
const RESORTE = { type: "spring" as const, stiffness: 300, damping: 30 };

function Tarjeta({
  item,
  indice,
  ancho,
  paso,
  x,
  girar,
}: {
  item: CarruselItem;
  indice: number;
  ancho: number;
  paso: number;
  x: MotionValue<number>;
  girar: boolean;
}) {
  const rotateY = useTransform(
    x,
    [-(indice + 1) * paso, -indice * paso, -(indice - 1) * paso],
    girar ? [90, 0, -90] : [0, 0, 0],
    { clamp: false }
  );

  return (
    <m.div
      className="relative flex shrink-0 select-none flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6"
      style={{ width: ancho, rotateY }}
      aria-roledescription="diapositiva"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1e3a8a]/10 text-[#1e3a8a] dark:bg-blue-500/10 dark:text-blue-400">
        {item.icono}
      </span>
      <div className="mt-8">
        <h3 className="text-lg font-bold text-black dark:text-neutral-50">{item.titulo}</h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{item.texto}</p>
      </div>
    </m.div>
  );
}

export function Carrusel({
  items,
  anchoMaximo = 420,
  autoplay = true,
  autoplayDelay = 4000,
  pauseOnHover = true,
  loop = true,
  className,
}: CarruselProps) {
  const reducir = useReducedMotion() ?? false;
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [anchoContenedor, setAnchoContenedor] = useState(anchoMaximo);
  const [encima, setEncima] = useState(false);

  // Con ciclo: copia de la ultima al inicio y de la primera al final; al
  // llegar a una copia se salta sin animar a la real.
  const lista = loop && items.length > 1 ? [items[items.length - 1], ...items, items[0]] : items;
  const inicial = loop && items.length > 1 ? 1 : 0;
  const [posicion, setPosicion] = useState(inicial);
  const saltando = useRef(false);

  const anchoBase = Math.min(anchoContenedor, anchoMaximo);
  const anchoTarjeta = Math.max(200, anchoBase - RELLENO * 2);
  const paso = anchoTarjeta + GAP;
  const x = useMotionValue(-inicial * paso);

  // SYMVORA: ancho responsivo.
  useEffect(() => {
    const el = contenedorRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAnchoContenedor(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cada cambio de posicion (o de tamaño) anima a su lugar.
  useEffect(() => {
    if (saltando.current) {
      saltando.current = false;
      x.set(-posicion * paso);
      return;
    }
    const control = animate(x, -posicion * paso, reducir ? { duration: 0 } : RESORTE);
    control.then(() => {
      if (!loop || lista.length <= 1) return;
      if (posicion === lista.length - 1 || posicion === 0) {
        saltando.current = true;
        setPosicion(posicion === 0 ? items.length : 1);
      }
    });
    return () => control.stop();
  }, [posicion, paso, reducir, loop, lista.length, items.length, x]);

  useEffect(() => {
    if (!autoplay || reducir || lista.length <= 1 || (pauseOnHover && encima)) return;
    const t = setInterval(() => {
      setPosicion((p) => Math.min(p + 1, lista.length - 1));
    }, autoplayDelay);
    return () => clearInterval(t);
  }, [autoplay, reducir, lista.length, pauseOnHover, encima, autoplayDelay]);

  const ir = (dir: 1 | -1) =>
    setPosicion((p) => (loop ? Math.max(0, Math.min(p + dir, lista.length - 1)) : Math.max(0, Math.min(p + dir, items.length - 1))));

  // SYMVORA: arrastre con eventos de puntero.
  const arrastre = useRef<{ x0: number; base: number; t0: number } | null>(null);
  const alPresionar = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = { x0: e.clientX, base: x.get(), t0: e.timeStamp };
  };
  const alMover = (e: React.PointerEvent) => {
    const a = arrastre.current;
    if (a) x.set(a.base + (e.clientX - a.x0));
  };
  const alSoltar = (e: React.PointerEvent) => {
    const a = arrastre.current;
    arrastre.current = null;
    if (!a) return;
    const dx = e.clientX - a.x0;
    const v = dx / Math.max(1, e.timeStamp - a.t0);
    const dir = dx < -UMBRAL_PX || v < -UMBRAL_VELOCIDAD ? 1 : dx > UMBRAL_PX || v > UMBRAL_VELOCIDAD ? -1 : 0;
    if (dir === 0) {
      animate(x, -posicion * paso, RESORTE);
      return;
    }
    ir(dir);
  };

  const activo =
    items.length === 0 ? 0 : loop && items.length > 1 ? (posicion - 1 + items.length) % items.length : posicion;

  return (
    <div
      ref={contenedorRef}
      className={cn(
        "relative overflow-hidden rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/60 p-4 outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a8a]/50",
        className
      )}
      style={{ width: anchoBase }}
      role="region"
      aria-roledescription="carrusel"
      aria-label="Valores"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") ir(1);
        if (e.key === "ArrowLeft") ir(-1);
      }}
      onMouseEnter={() => setEncima(true)}
      onMouseLeave={() => setEncima(false)}
    >
      <m.div
        className="flex cursor-grab active:cursor-grabbing"
        style={{
          gap: GAP,
          x,
          perspective: 1000,
          perspectiveOrigin: `${posicion * paso + anchoTarjeta / 2}px 50%`,
          touchAction: "pan-y",
        }}
        onPointerDown={alPresionar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
      >
        {lista.map((item, i) => (
          <Tarjeta
            key={`${item.id}-${i}`}
            item={item}
            indice={i}
            ancho={anchoTarjeta}
            paso={paso}
            x={x}
            girar={!reducir}
          />
        ))}
      </m.div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => ir(-1)}
          aria-label="Anterior"
          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-black dark:hover:bg-neutral-800 dark:hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="flex items-center gap-2">
          {items.map((item, i) => (
            <button
              type="button"
              key={item.id}
              aria-label={`Ir a ${item.titulo}`}
              aria-current={activo === i}
              onClick={() => setPosicion(loop && items.length > 1 ? i + 1 : i)}
              className={cn(
                "h-2 rounded-full transition-all duration-200",
                activo === i
                  ? "w-5 bg-[#1e3a8a] dark:bg-white"
                  : "w-2 bg-neutral-300 hover:bg-neutral-400 dark:bg-neutral-700 dark:hover:bg-neutral-600"
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => ir(1)}
          aria-label="Siguiente"
          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-black dark:hover:bg-neutral-800 dark:hover:text-white"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
