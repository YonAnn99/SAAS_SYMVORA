"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { progresoEscena } from "./progreso";
import { ControlesRecorrido, irATramo } from "./recorrido";

const PAUSA_ESCENA_MS = 6000;

/** Diff animado del acto Productos: el precio anterior se apaga y el nuevo entra. */
const ESTILOS_DIFF = `
.escena-diff-viejo { animation: escena-diff-viejo 6s ease-in-out infinite; }
.escena-diff-nuevo { animation: escena-diff-nuevo 6s ease-in-out infinite; }
.escena-pedido-mover { animation: escena-pedido-mover 7s ease-in-out infinite; }
@keyframes escena-pedido-mover { 0%, 20% { transform: translateX(0); } 45%, 100% { transform: translateX(calc(100% + 12px)); } }
@keyframes escena-diff-viejo { 0%, 40% { opacity: 1; } 50%, 90% { opacity: 0; } 100% { opacity: 1; } }
@keyframes escena-diff-nuevo { 0%, 40% { opacity: 0; transform: translateY(8px); } 55%, 90% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateY(-8px); } }
@media (prefers-reduced-motion: reduce) {
  .escena-diff-viejo { animation: none; opacity: 0.45; }
  .escena-diff-nuevo { animation: none; opacity: 1; }
  .escena-pedido-mover { animation: none; }
}
`;

/**
 * Escena fija al estilo de code.visualstudio.com: el contenedor mide ~300vh y un
 * panel «sticky» muestra cuatro actos. El scroll solo escribe la variable CSS `--p`
 * (0 → 1); cada acto se muestra con `calc()` sobre ella. Así no hay `setState` por
 * cuadro: React solo se vuelve a pintar al cambiar de acto.
 *
 * Sin pin (celular, tablet, o `prefers-reduced-motion`) los cuatro actos quedan
 * apilados y visibles: el mismo contenido, estático.
 *
 * Las maquetas replican la pantalla real de la app: menú lateral oscuro
 * (`--nav-bg`: #0A0A0A, azul en modo oscuro) y panel de contenido #FAFAF9.
 */

const ACTOS = ["vende", "cobra", "cuadra", "controla", "pedidos"] as const;
type Acto = (typeof ACTOS)[number];
const N = ACTOS.length;

/** Opacidad del acto `i`: entra y sale en su tramo del progreso. El primero no sale. */
function opacidadActo(i: number): CSSProperties {
  const inicio = i / N;
  const fin = (i + 1) / N;
  const entra = i === 0 ? "1" : `clamp(0, (var(--p, 1) - ${inicio}) * ${N * 2}, 1)`;
  const sale = i === N - 1 ? "1" : `clamp(0, (${fin} - var(--p, 1)) * ${N * 2}, 1)`;
  return { opacity: `min(${entra}, ${sale})` };
}

const CAPA = "relative motion-safe:lg:absolute motion-safe:lg:inset-0 motion-safe:lg:pb-2 px-4 sm:px-6 lg:px-10 flex flex-col gap-5 motion-safe:lg:grid motion-safe:lg:grid-cols-1 motion-safe:lg:grid-rows-[auto_minmax(0,1fr)] motion-safe:lg:gap-5";

export function EscenaPos() {
  const t = useTranslations("landing.escena");
  const ref = useRef<HTMLElement>(null);
  const [pinado, setPinado] = useState(false);
  const [acto, setActo] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mq = window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
    let pendiente = 0;

    const medir = () => {
      pendiente = 0;
      const activo = mq.matches;
      setPinado(activo);
      if (!activo) {
        el.style.removeProperty("--p");
        return;
      }
      const r = el.getBoundingClientRect();
      const p = progresoEscena(r.top, el.offsetHeight, window.innerHeight);
      el.style.setProperty("--p", p.toFixed(4));
      // El acto solo se vuelve a pintar al cambiar de tramo (no por cada cuadro).
      const nuevo = Math.min(N - 1, Math.floor(p * N + 1e-6));
      setActo((previo) => (previo === nuevo ? previo : nuevo));
    };

    const alScroll = () => {
      if (!pendiente) pendiente = requestAnimationFrame(medir);
    };

    medir();
    // El scroll de la landing ocurre en el <main> interno, no en la ventana, y el
    // evento no sube hasta `window`. Con captura en `document` lo recibimos de
    // cualquier contenedor desplazable.
    document.addEventListener("scroll", alScroll, { passive: true, capture: true });
    window.addEventListener("resize", alScroll);
    mq.addEventListener("change", medir);
    return () => {
      document.removeEventListener("scroll", alScroll, { capture: true });
      window.removeEventListener("resize", alScroll);
      mq.removeEventListener("change", medir);
      if (pendiente) cancelAnimationFrame(pendiente);
    };
  }, []);

  // Recorrido automático: tras una pausa lleva al siguiente acto, hasta el último.
  useEffect(() => {
    if (!reproduciendo || !pinado) return;
    const id = window.setTimeout(() => {
      if (acto >= N - 1) setReproduciendo(false);
      else if (ref.current) irATramo(ref.current, acto + 1, N);
    }, PAUSA_ESCENA_MS);
    return () => window.clearTimeout(id);
  }, [reproduciendo, pinado, acto]);

  const irActo = (i: number) => {
    setReproduciendo(false);
    if (ref.current) irATramo(ref.current, Math.max(0, Math.min(N - 1, i)), N);
  };

  return (
    <section
      ref={ref}
      aria-labelledby="escena-pos-titulo"
      className="relative lg:motion-safe:h-[300vh] lg:motion-safe:py-0 py-16 sm:py-24"
    >
      <div className="lg:motion-safe:sticky lg:motion-safe:top-0 lg:motion-safe:h-[calc(100dvh-10rem)] lg:motion-safe:overflow-hidden flex flex-col max-w-7xl mx-auto w-full">
        <style>{ESTILOS_DIFF}</style>
        <h2 id="escena-pos-titulo" className="sr-only">{t("titulo")}</h2>

        <div className="relative lg:motion-safe:flex-1 lg:motion-safe:min-h-0">
          {ACTOS.map((clave, i) => (
            <article
              key={clave}
              aria-current={pinado && acto === i ? "step" : undefined}
              className={CAPA}
              style={pinado ? opacidadActo(i) : undefined}
            >
              <div className="max-w-xl motion-safe:lg:max-w-3xl">
                <p className="text-sm font-semibold text-neutral-400 dark:text-neutral-500">
                  {String(i + 1).padStart(2, "0")} · {t(`actos.${clave}.nombre`)}
                </p>
                <h3 className="mt-1 text-2xl sm:text-3xl font-bold text-black dark:text-neutral-50">
                  {t(`actos.${clave}.titulo`)}
                </h3>
                <p className="mt-2 text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {t(`actos.${clave}.texto`)}
                </p>
              </div>
              <div className="min-h-0 h-[580px] sm:h-[620px] mb-20 lg:mb-0 motion-safe:lg:h-full motion-safe:lg:flex-1 flex justify-center" aria-hidden="true">
                <div className="h-full w-full max-w-[340px] lg:hidden">
                  <PantallaMovil acto={clave} />
                </div>
                <div className="hidden h-full w-full lg:block">
                  <PantallaApp acto={clave} />
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="hidden motion-safe:lg:block px-10 pb-2">
          <ControlesRecorrido
            total={N}
            actual={acto}
            reproduciendo={reproduciendo}
            onAnterior={() => irActo(acto - 1)}
            onSiguiente={() => irActo(acto + 1)}
            onAlternar={() => setReproduciendo((r) => !r)}
          />
        </div>
      </div>
    </section>
  );
}

/* ───────── Pantalla de la app: sigue el tema (claro = app en claro, oscuro = app en oscuro) ───────── */

const MENU = [
  "Dashboard", "Punto de Venta", "Productos", "Clientes", "Catálogo en línea", "Pedidos",
  "Finanzas", "Reportes", "Compras", "Órdenes de Compra", "Bitácora", "Usuarios",
  "Sucursales", "Suscripción", "Sugerencias", "Configuración",
];

const ACTIVO_EN_MENU: Record<Acto, string> = {
  vende: "Punto de Venta",
  cobra: "Punto de Venta",
  cuadra: "Finanzas",
  controla: "Productos",
  pedidos: "Pedidos",
};

const TITULO_PAGINA: Record<Acto, string> = {
  vende: "Punto de Venta",
  cobra: "Punto de Venta",
  cuadra: "Finanzas",
  controla: "Productos",
  pedidos: "Pedidos",
};

// Tokens: primero el de la app en claro, después el de la app en oscuro.
const FONDO = "bg-[#FAFAF9] dark:bg-[#0b0b0c]";
const TEXTO = "text-neutral-900 dark:text-white";
const SUB = "text-neutral-500 dark:text-white/45";
const CARD = "rounded-lg border border-neutral-200 bg-white dark:border-white/10 dark:bg-[#141416]";
const IMG = "bg-neutral-100 dark:bg-[#1c1c20]";
const OUTLINE = "border border-neutral-200 text-neutral-600 dark:border-white/10 dark:text-white/70";
const SELECCION = "bg-neutral-900 text-white dark:bg-[#1e40af]";
const OK = "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400";
const BAJO = "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400";
const AVISO = "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
const VERDE = "text-emerald-600 dark:text-emerald-400";
const ROJO = "text-red-600 dark:text-red-400";
const AZUL = "text-blue-600 dark:text-blue-400";

function PantallaApp({ acto }: { acto: Acto }) {
  return (
    <div className={`flex h-full w-full overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-2xl ${FONDO} text-[11px] sm:text-xs lg:text-[12px] font-sans`}>
      <aside className="hidden md:flex w-[168px] lg:w-[200px] shrink-0 flex-col bg-[#0A0A0A] dark:bg-[#1e3a8a] py-4">
        <div className="flex items-center gap-2 px-4 pb-4">
          <span className="h-6 w-6 rounded-md bg-white/90" />
          <span className="font-bold tracking-tight text-white">SYMVORA</span>
        </div>
        <ul className="flex-1 space-y-0.5 overflow-hidden">
          {MENU.map((m) => {
            const activo = m === ACTIVO_EN_MENU[acto];
            return (
              <li
                key={m}
                className={`flex items-center justify-between gap-2 py-1.5 pl-4 pr-2 ${activo ? "rounded-r-full bg-white text-black dark:bg-[#0b0b0c] dark:text-white" : "text-white/70"}`}
              >
                <span className="truncate">{m}</span>
                {m === "Pedidos" && (
                  <span className="rounded bg-white px-1 text-[8px] font-bold tracking-wide text-black dark:bg-white/15 dark:text-white">NUEVO</span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mx-auto mt-3 h-9 w-9 rounded-full bg-white/20" />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 dark:border-white/5 px-4 py-3">
          <p className={`text-sm font-semibold ${TEXTO}`}>{TITULO_PAGINA[acto]}</p>
          <div className={`hidden sm:flex items-center gap-3 ${SUB}`}>
            <span>Iniciar tutorial</span>
            <span>Aprende</span>
            <span className="rounded border border-neutral-200 dark:border-white/10 px-1">⌘ K</span>
            <span>ES</span>
            <span className="h-5 w-5 rounded-full bg-[#1e3a8a]" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
          {acto === "vende" && <VistaVender />}
          {acto === "cobra" && <VistaCobrar />}
          {acto === "cuadra" && <VistaCaja />}
          {acto === "controla" && <VistaInventario />}
          {acto === "pedidos" && <VistaPedidos />}
        </div>
      </div>
    </div>
  );
}

const PRODUCTOS = [
  { codigo: "CF", nombre: "Café de olla 350 ml", categoria: "BEBIDAS", precio: "$45.00", ok: true },
  { codigo: "PD", nombre: "Pan dulce surtido", categoria: "PANADERÍA", precio: "$18.00", ok: true },
  { codigo: "AG", nombre: "Agua natural 1 L", categoria: "BEBIDAS", precio: "$15.00", ok: false },
  { codigo: "GA", nombre: "Galletas de avena", categoria: "ABARROTES", precio: "$32.00", ok: true },
  { codigo: "RF", nombre: "Refresco de cola 600 ml", categoria: "BEBIDAS", precio: "$25.00", ok: true },
  { codigo: "JN", nombre: "Jugo natural naranja", categoria: "BEBIDAS", precio: "$38.00", ok: true },
  { codigo: "SN", nombre: "Sándwich de jamón", categoria: "COMIDA", precio: "$55.00", ok: false },
  { codigo: "HL", nombre: "Helado de vainilla", categoria: "POSTRES", precio: "$30.00", ok: true },
];

function VistaVender() {
  return (
    <div className="grid h-full grid-cols-[1fr_230px] gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className={`${CARD} min-w-0 flex-1 truncate whitespace-nowrap px-3 py-2 ${SUB}`}>Escanea o escribe el código…</div>
          <div className={`${CARD} shrink-0 whitespace-nowrap px-3 py-2 ${TEXTO}`}>Principal</div>
          <div className={`${CARD} shrink-0 whitespace-nowrap px-3 py-2 ${TEXTO}`}>Precios normales</div>
          <div className={`${CARD} hidden shrink-0 overflow-hidden whitespace-nowrap xl:flex`}>
            <span className={`px-2.5 py-2 ${SUB}`}>Agrupado</span>
            <span className={`px-2.5 py-2 ${TEXTO} bg-neutral-100 dark:bg-white/10`}>Desglosado</span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 overflow-hidden">
          {PRODUCTOS.map((p) => (
            <div key={p.nombre} className={`${CARD} overflow-hidden`}>
              <div className={`flex h-14 items-center justify-center text-sm font-bold text-neutral-400 dark:text-white/40 ${IMG}`}>{p.codigo}</div>
              <div className="p-2">
                <p className={`text-[8px] ${SUB}`}>{p.categoria}</p>
                <p className={`truncate font-medium ${TEXTO}`}>{p.nombre}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className={`font-mono ${SUB}`}>{p.precio}</span>
                  <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-semibold ${p.ok ? OK : BAJO}`}>{p.ok ? "OK" : "Bajo"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <CarritoLateral />
    </div>
  );
}

function CarritoLateral() {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className={`${CARD} px-3 py-2 ${SUB}`}>Cliente general</div>
      <div className={`${CARD} px-3 py-2 text-center ${TEXTO}`}>Guardar pedido</div>
      <div className={`${CARD} flex-1 p-3`}>
        <div className={`flex justify-between font-semibold ${TEXTO}`}><span>Carrito</span><span>2</span></div>
        <div className="mt-3 space-y-3">
          <div className={TEXTO}><p className="truncate">Café de olla 350 ml</p><p className={`font-mono text-[10px] ${SUB}`}>$45.00 × 2</p></div>
          <div className={TEXTO}><p className="truncate">Pan dulce surtido</p><p className={`font-mono text-[10px] ${SUB}`}>$18.00 × 1</p></div>
        </div>
        <div className={`mt-3 flex justify-between border-t border-neutral-200 dark:border-white/10 pt-2 font-bold ${TEXTO}`}><span>Total</span><span>$108.00</span></div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className={`rounded-md py-2 text-center font-medium ${SELECCION}`}>Efectivo</div>
        <div className={`rounded-md py-2 text-center ${OUTLINE}`}>Tarjeta</div>
        <div className={`rounded-md py-2 text-center ${OUTLINE}`}>Transferencia</div>
        <div className={`rounded-md py-2 text-center ${OUTLINE}`}>Fiado</div>
      </div>
      <div className="rounded-full bg-neutral-900 dark:bg-[#1e40af] px-3 py-2.5 text-center font-semibold text-white">Desliza para cobrar</div>
    </div>
  );
}

function VistaCobrar() {
  return (
    <div className="relative flex h-full items-center justify-center">
      <div className="absolute inset-0 opacity-40 blur-[2px]"><VistaVender /></div>
      <div className="relative w-[min(300px,80%)] rounded-xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-[#141416] p-4 shadow-2xl">
        <p className={`flex items-center gap-2 font-semibold ${TEXTO}`}><span className={VERDE}>✓</span> Venta completada</p>
        <div className="mt-3 rounded-lg bg-white p-3 font-mono text-[9px] leading-snug text-black">
          <p className="text-center text-xs font-bold">SYMVORA</p>
          <p className="mt-1 font-bold">DETALLE DE PRODUCTOS</p>
          <p>Operación #B9C58C70</p>
          <p className="mt-1 border-t border-black pt-1">Café de olla 350 ml</p>
          <p>x2 ·· 90.00</p>
          <p>Pan dulce surtido</p>
          <p>x1 ·· 18.00</p>
          <p className="mt-2 flex justify-between text-xs font-bold"><span>Total $</span><span>108.00</span></p>
          <p className="flex justify-between"><span>Efectivo $</span><span>110.00</span></p>
          <p className="flex justify-between"><span>Cambio $</span><span>2.00</span></p>
          <p className="mt-2 text-center font-bold">SIN VALIDEZ FISCAL</p>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <span className={`rounded-md px-3 py-1.5 ${OUTLINE}`}>Aceptar</span>
          <span className={`rounded-md px-3 py-1.5 font-medium text-white ${SELECCION}`}>Imprimir</span>
        </div>
      </div>
    </div>
  );
}

function VistaCaja() {
  const movimientos = [
    { fecha: "27/11 09:14", descripcion: "Venta #a31f… · EFECTIVO", monto: "+$90.00" },
    { fecha: "27/11 10:02", descripcion: "Venta #7c2e… · TARJETA", monto: "+$55.00" },
    { fecha: "27/11 11:40", descripcion: "Retiro para cambio", monto: "−$200.00" },
    { fecha: "27/11 13:05", descripcion: "Venta #b9c5… · EFECTIVO", monto: "+$25.00" },
  ];
  const tarjetas = [
    { t: "FONDO INICIAL", v: "$1,985.00", c: TEXTO },
    { t: "VENTAS", v: "+$470.00", c: AZUL },
    { t: "ENTRADA", v: "+$0.00", c: VERDE },
    { t: "SALIDA", v: "−$0.00", c: ROJO },
    { t: "SALDO", v: "$2,455.00", c: TEXTO },
  ];
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className={`text-sm font-semibold ${TEXTO}`}>Caja de Principal</p>
        <span className="rounded-md bg-red-600 px-2.5 py-1 font-medium text-white">Cerrar caja</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {tarjetas.map((x) => (
          <div key={x.t} className={`${CARD} p-2.5`}>
            <p className={`text-[8px] tracking-wide ${SUB}`}>{x.t}</p>
            <p className={`mt-1 font-mono text-[11px] font-semibold ${x.c}`}>{x.v}</p>
          </div>
        ))}
      </div>
      <div className={`${CARD} flex min-h-0 flex-1 flex-col overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-white/10 px-3 py-2">
          <p className={`font-semibold ${TEXTO}`}>Movimientos</p>
          <span className={`rounded-md px-2 py-1 text-white ${SELECCION}`}>Agregar movimiento</span>
        </div>
        <div className={`grid grid-cols-[1fr_2fr_60px_80px] gap-2 border-b border-neutral-200 dark:border-white/10 px-3 py-1.5 text-[8px] tracking-wide ${SUB}`}>
          <span>FECHA</span><span>DESCRIPCIÓN</span><span>ESTADO</span><span className="text-right">TOTAL</span>
        </div>
        {movimientos.map((m) => (
          <div key={m.fecha + m.descripcion} className="grid grid-cols-[1fr_2fr_60px_80px] items-center gap-2 border-b border-neutral-100 dark:border-white/5 px-3 py-2">
            <span className={TEXTO}>{m.fecha}</span>
            <span className={`truncate ${SUB}`}>{m.descripcion}</span>
            <span className={`rounded px-1.5 py-0.5 text-center text-[8px] text-white ${SELECCION}`}>Venta</span>
            <span className={`text-right font-mono ${m.monto.startsWith("+") ? VERDE : ROJO}`}>{m.monto}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VistaInventario() {
  const filas = [
    { nombre: "Café de olla 350 ml", codigo: "4501244567909", precio: "$45.00", margen: "30.9%", stock: 2, estado: "Stock bajo" },
    { nombre: "Agua natural 1 L", codigo: "4501254567890", precio: "$15.00", margen: "26.7%", stock: 54, estado: "OK" },
    { nombre: "Pan dulce surtido", codigo: "—", precio: "$18.00", margen: "39.6%", stock: 0, estado: "Agotado" },
    { nombre: "Galletas de avena", codigo: "—", precio: "$32.00", margen: "45.5%", stock: 13, estado: "OK" },
    { nombre: "Jugo natural naranja", codigo: "—", precio: "$38.00", margen: "42.3%", stock: 7, estado: "OK" },
    { nombre: "Helado de vainilla", codigo: "—", precio: "$30.00", margen: "36.4%", stock: 4, estado: "OK" },
  ];
  const estadoClase = (e: string) => (e === "OK" ? OK : e === "Agotado" ? BAJO : AVISO);
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-md px-2.5 py-1 font-medium ${TEXTO} bg-neutral-100 dark:bg-white/10`}>Catálogo</span>
        <span className={`px-2.5 py-1 ${SUB}`}>Lotes</span>
        <span className={`px-2.5 py-1 ${SUB}`}>Ajustes</span>
        <span className={`px-2.5 py-1 ${SUB}`}>Archivados</span>
        <span className={`ml-auto rounded-md px-2.5 py-1 text-white ${SELECCION}`}>Agregar producto</span>
      </div>
      <div className="flex flex-wrap gap-2 text-[10px]">
        <span className={`${CARD} px-2 py-1 ${SUB}`}>Stock bajo <b className={ROJO}>94</b></span>
        <span className={`${CARD} px-2 py-1 ${SUB}`}>Stock indefinido <b className={TEXTO}>32</b></span>
        <span className={`${CARD} px-2 py-1 ${SUB}`}>Favoritos <b className={TEXTO}>9</b></span>
      </div>
      <div className={`${CARD} relative overflow-hidden px-3 py-2`}>
        <p className={`text-[9px] tracking-wide ${SUB}`}>CAMBIO DE PRECIO · Café de olla 350 ml</p>
        <div className="relative mt-1.5 h-9">
          <div className={`escena-diff-viejo absolute inset-0 flex items-center justify-between rounded-md bg-red-500/10 px-3 font-mono text-red-600 line-through dark:text-red-400`}>
            <span>Precio anterior</span><span>$45.00</span>
          </div>
          <div className={`escena-diff-nuevo absolute inset-0 flex items-center justify-between rounded-md bg-emerald-500/15 px-3 font-mono font-semibold text-emerald-700 dark:text-emerald-300`}>
            <span>Precio nuevo</span><span>$48.00</span>
          </div>
        </div>
      </div>
      <div className={`${CARD} flex min-h-0 flex-1 flex-col overflow-hidden`}>
        <div className={`grid grid-cols-[2fr_1.2fr_0.8fr_0.7fr_0.7fr_0.7fr] gap-2 border-b border-neutral-200 dark:border-white/10 px-3 py-2 text-[8px] tracking-wide ${SUB}`}>
          <span>NOMBRE DEL PRODUCTO</span><span>CÓDIGO DE BARRAS</span><span>PRECIO</span><span>MARGEN</span><span>STOCK</span><span>ESTADO</span>
        </div>
        {filas.map((f) => (
          <div key={f.nombre} className="grid grid-cols-[2fr_1.2fr_0.8fr_0.7fr_0.7fr_0.7fr] items-center gap-2 border-b border-neutral-100 dark:border-white/5 px-3 py-2">
            <span className={`truncate font-medium ${TEXTO}`}>{f.nombre}</span>
            <span className={`font-mono ${SUB}`}>{f.codigo}</span>
            <span className={`font-mono ${TEXTO}`}>{f.precio}</span>
            <span className={`font-mono ${SUB}`}>{f.margen}</span>
            <span className={`font-mono ${TEXTO}`}>{f.stock}</span>
            <span className={`w-fit whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-semibold ${estadoClase(f.estado)}`}>{f.estado}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── Celular: la app móvil (barra superior, tarjetas, paneles y menú inferior) ───────── */

const DOCK = [
  { nombre: "Vender", icono: "🛒" },
  { nombre: "Productos", icono: "▣" },
  { nombre: "Finanzas", icono: "▭" },
  { nombre: "Órdenes", icono: "▤" },
];

const DOCK_ACTIVO: Record<Acto, string> = {
  vende: "Vender",
  cobra: "Vender",
  cuadra: "Finanzas",
  controla: "Productos",
  pedidos: "Órdenes",
};

function PantallaMovil({ acto }: { acto: Acto }) {
  return (
    <div className={`flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-neutral-300 dark:border-neutral-700 shadow-2xl ${FONDO} text-[10px] font-sans`}>
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span className="h-6 w-6 rounded-md bg-neutral-900 dark:bg-white/90" />
        <div className={`flex items-center gap-2 ${SUB}`}>
          <span className="h-4 w-4 rounded-full border border-current" />
          <span className="h-6 w-6 rounded-full bg-[#1e3a8a]" />
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden px-3">
        {acto === "vende" && <MovilVender />}
        {acto === "cobra" && <MovilCobrar />}
        {acto === "cuadra" && <MovilCaja />}
        {acto === "controla" && <MovilProductos />}
        {acto === "pedidos" && <MovilPedidos />}
      </div>
      <nav className="mx-3 mb-3 mt-2 flex items-center justify-around rounded-full bg-[#0A0A0A] dark:bg-[#1e3a8a] px-2 py-2 text-white/70">
        {DOCK.map((d) => {
          const activo = d.nombre === DOCK_ACTIVO[acto];
          return (
            <span key={d.nombre} className={`flex flex-col items-center gap-0.5 rounded-full px-3 py-1 ${activo ? "bg-white text-black dark:bg-[#0b0b0c] dark:text-white" : ""}`}>
              <span className="text-[11px]">{d.icono}</span>
              <span className="text-[8px] font-medium">{d.nombre}</span>
            </span>
          );
        })}
      </nav>
    </div>
  );
}

function MovilVender() {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className={`${CARD} px-3 py-2 ${SUB}`}>Escanea o escribe el código…</div>
      <div className="flex gap-1.5 overflow-hidden whitespace-nowrap">
        <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-white dark:bg-white dark:text-black">Todas</span>
        <span className={`rounded-full px-2.5 py-1 ${OUTLINE}`}>♥ Favoritos</span>
        <span className={`rounded-full px-2.5 py-1 ${OUTLINE}`}>Bebidas</span>
      </div>
      <div className="grid grid-cols-2 gap-2 overflow-hidden">
        {PRODUCTOS.slice(0, 4).map((p) => (
          <div key={p.nombre} className={`${CARD} overflow-hidden`}>
            <div className={`flex h-12 items-center justify-center text-xs font-bold text-neutral-400 dark:text-white/40 ${IMG}`}>{p.codigo}</div>
            <div className="p-2">
              <p className={`truncate ${TEXTO}`}>{p.nombre}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className={`font-mono font-semibold ${TEXTO}`}>{p.precio}</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-white dark:text-black">+</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between rounded-full bg-neutral-900 px-3 py-2 text-white dark:bg-[#1e40af]">
        <span className="rounded-full bg-white/20 px-2 font-bold">3</span>
        <span>Ver carrito</span>
        <span className="font-mono font-bold">$146</span>
      </div>
    </div>
  );
}

function MovilCobrar() {
  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 rounded-t-2xl border-t border-neutral-200 dark:border-white/10 bg-white dark:bg-[#141416] p-3 shadow-2xl">
      <p className={`font-semibold ${TEXTO}`}>Carrito · 2 artículos</p>
      {PRODUCTOS.slice(0, 2).map((p) => (
        <div key={p.nombre} className={`${CARD} flex items-center justify-between p-2`}>
          <div className="min-w-0">
            <p className={`truncate ${TEXTO}`}>{p.nombre}</p>
            <p className={`font-mono ${SUB}`}>{p.precio} x 1 pza</p>
          </div>
          <span className={`font-semibold ${TEXTO}`}>1</span>
        </div>
      ))}
      <div className={`flex justify-between font-bold ${TEXTO}`}><span>Total</span><span>$63.00</span></div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className={`rounded-md py-2 text-center font-medium ${SELECCION}`}>Efectivo</div>
        <div className={`rounded-md py-2 text-center ${OUTLINE}`}>Tarjeta</div>
        <div className={`rounded-md py-2 text-center ${OUTLINE}`}>Transferencia</div>
        <div className={`rounded-md py-2 text-center ${OUTLINE}`}>Fiado</div>
      </div>
      <div className={`rounded-md px-2 py-1.5 font-mono ${OUTLINE}`}>Monto recibido: 70,00</div>
      <div className="flex items-center gap-2 rounded-full bg-neutral-100 dark:bg-white/10 p-1">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-white dark:text-black">→</span>
        <span className={`flex-1 text-center ${SUB}`}>Desliza para cobrar $63.00</span>
      </div>
    </div>
  );
}

function MovilCaja() {
  return (
    <div className="flex h-full flex-col gap-2">
      <p className={`text-xs font-semibold ${TEXTO}`}>Caja de Principal</p>
      <div className="grid grid-cols-2 gap-2">
        <div className={`${CARD} p-2`}><p className={`text-[8px] ${SUB}`}>VENTAS</p><p className={`font-mono font-semibold ${AZUL}`}>+$470.00</p></div>
        <div className={`${CARD} p-2`}><p className={`text-[8px] ${SUB}`}>SALDO</p><p className={`font-mono font-semibold ${TEXTO}`}>$2,455.00</p></div>
      </div>
      <span className="rounded-md bg-red-600 py-1.5 text-center font-medium text-white">Cerrar caja</span>
      <div className={`${CARD} flex min-h-0 flex-1 flex-col overflow-hidden`}>
        {["Venta · Café de olla", "Venta · Sándwich", "Retiro para cambio"].map((m, i) => (
          <div key={m} className="flex justify-between border-b border-neutral-100 dark:border-white/5 px-2 py-2">
            <span className={TEXTO}>{m}</span>
            <span className={`font-mono ${i === 2 ? ROJO : VERDE}`}>{i === 2 ? "−$200" : i === 0 ? "+$90" : "+$55"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MovilProductos() {
  const filas = [
    { nombre: "Café de olla 350 ml", stock: "2 en stock", precio: "$45.00", estado: "Stock bajo" },
    { nombre: "Agua natural 1 L", stock: "54 en stock", precio: "$15.00", estado: "OK" },
    { nombre: "Pan dulce surtido", stock: "0 en stock", precio: "$18.00", estado: "Agotado" },
    { nombre: "Galletas de avena", stock: "13 en stock", precio: "$32.00", estado: "OK" },
  ];
  return (
    <div className="flex h-full flex-col gap-2">
      <p className={`text-sm font-semibold ${TEXTO}`}>Productos</p>
      <div className="grid grid-cols-2 gap-2">
        <span className="rounded-md bg-neutral-900 py-1.5 text-center text-white dark:bg-[#1e40af]">Agregar producto</span>
        <span className={`rounded-md py-1.5 text-center ${OUTLINE}`}>Importar</span>
      </div>
      <div className={`${CARD} px-2 py-1.5 ${SUB}`}>Buscar</div>
      {filas.map((f) => (
        <div key={f.nombre} className={`${CARD} flex items-center gap-2 p-2`}>
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[8px] font-bold ${IMG} ${SUB}`}>{f.nombre.slice(0, 2).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className={`truncate font-medium ${TEXTO}`}>{f.nombre}</p>
            <p className={SUB}>Pieza · {f.stock}</p>
          </div>
          <div className="text-right">
            <p className={`font-mono ${TEXTO}`}>{f.precio}</p>
            <span className={`rounded px-1 text-[8px] font-semibold ${f.estado === "OK" ? OK : f.estado === "Agotado" ? BAJO : AVISO}`}>{f.estado}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────── Acto Pedidos: columnas por etapa; una tarjeta avanza de columna sola ───────── */

const ETAPAS = [
  { nombre: "Nuevo", tarjetas: [{ folio: "#A21", tipo: "Recoger 13:00", total: "$146" }, { folio: "#A22", tipo: "Domicilio", total: "$320" }] },
  { nombre: "Confirmado", tarjetas: [{ folio: "#A19", tipo: "Recoger 12:30", total: "$90" }] },
  { nombre: "En preparación", tarjetas: [{ folio: "#A17", tipo: "Domicilio", total: "$210" }] },
  { nombre: "Listo", tarjetas: [{ folio: "#A15", tipo: "Recoger 11:45", total: "$55" }] },
];

function VistaPedidos() {
  return (
    <div className="grid h-full grid-cols-4 gap-3">
      {ETAPAS.map((etapa, c) => (
        <div key={etapa.nombre} className="flex min-w-0 flex-col gap-2 rounded-lg bg-neutral-100/70 dark:bg-white/[0.03] p-2">
          <div className={`flex items-center justify-between px-1 font-semibold ${TEXTO}`}>
            <span className="truncate">{etapa.nombre}</span>
            <span className={SUB}>{etapa.tarjetas.length}</span>
          </div>
          {c === 0 && (
            <div className={`${CARD} escena-pedido-mover p-2.5`}>
              <p className={`font-mono ${TEXTO}`}>#A23</p>
              <p className={SUB}>Recoger 14:00</p>
              <p className={`mt-1 font-semibold ${TEXTO}`}>$165.00</p>
            </div>
          )}
          {etapa.tarjetas.map((tj) => (
            <div key={tj.folio} className={`${CARD} p-2.5`}>
              <p className={`font-mono ${TEXTO}`}>{tj.folio}</p>
              <p className={SUB}>{tj.tipo}</p>
              <p className={`mt-1 font-semibold ${TEXTO}`}>{tj.total}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function MovilPedidos() {
  return (
    <div className="flex h-full flex-col gap-2">
      <p className={`text-sm font-semibold ${TEXTO}`}>Pedidos</p>
      <div className="flex gap-1.5 overflow-hidden whitespace-nowrap">
        {ETAPAS.map((e, i) => (
          <span key={e.nombre} className={`rounded-full px-2.5 py-1 ${i === 0 ? "bg-neutral-900 text-white dark:bg-white dark:text-black" : OUTLINE}`}>{e.nombre}</span>
        ))}
      </div>
      {ETAPAS[0].tarjetas.concat(ETAPAS[1].tarjetas).map((tj) => (
        <div key={tj.folio} className={`${CARD} flex items-center justify-between p-2.5`}>
          <div>
            <p className={`font-mono ${TEXTO}`}>{tj.folio}</p>
            <p className={SUB}>{tj.tipo}</p>
          </div>
          <span className={`font-semibold ${TEXTO}`}>{tj.total}</span>
        </div>
      ))}
    </div>
  );
}
