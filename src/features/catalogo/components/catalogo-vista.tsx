"use client";

import Image from "next/image";
import { useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { Loader2, MapPin, Minus, Package, Plus, Search, ShoppingBag, Sparkles, Star, Trash2, X } from "lucide-react";
import { abreviatura, esFraccionable, normalizarCantidad, textoContenido } from "@/lib/unidades";
import { urlWhatsApp } from "@/lib/whatsapp";
import {
  conteoPedido,
  formatearPrecio,
  mensajePedido,
  precioDeLinea,
  reducirPedido,
  textoPrecio,
  totalEstimado,
  type LineaPedido,
} from "../pedido";
import type { CatalogoEncabezado, CatalogoPagina, CatalogoProducto, CatalogoVariante } from "../types";

const AZUL_SYMVORA = "#1E3A8A";
const PASO_GRANEL = 0.25;

/** Texto blanco u oscuro según el color de la marca del negocio. */
function textoSobre(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#0f172a" : "#ffffff";
}

function claveGuardado(slug: string): string {
  return `symvora-catalogo:${slug}`;
}

function leerCarrito(slug: string): LineaPedido[] {
  try {
    const crudo = window.localStorage.getItem(claveGuardado(slug));
    const lineas = crudo ? (JSON.parse(crudo) as LineaPedido[]) : [];
    return Array.isArray(lineas) ? lineas.filter((l) => l && typeof l.clave === "string" && l.cantidad > 0) : [];
  } catch {
    return [];
  }
}

const suscribirNada = () => () => {};

/** Búsqueda y "Cargar más": la API pública o, en la vista previa, el RPC del equipo. */
export type FuenteCatalogo = (
  busqueda: string,
  categoria: string | null,
  offset: number,
  signal: AbortSignal
) => Promise<CatalogoPagina | { error: string }>;

function fuentePublica(slug: string): FuenteCatalogo {
  return async (busqueda, categoria, offset, signal) => {
    const params = new URLSearchParams();
    if (busqueda.trim()) params.set("q", busqueda.trim());
    if (categoria) params.set("categoria", categoria);
    if (offset) params.set("offset", String(offset));
    const res = await fetch(`/api/catalogo/${slug}/productos?${params}`, { signal });
    if (!res.ok) {
      return { error: res.status === 429 ? "Demasiadas búsquedas seguidas. Espera un momento." : "No se pudo cargar el catálogo." };
    }
    return (await res.json()) as CatalogoPagina;
  };
}

export function CatalogoVista({
  encabezado,
  paginaInicial,
  fuente,
  vistaPrevia = false,
}: {
  encabezado: CatalogoEncabezado;
  paginaInicial: CatalogoPagina;
  /** Por defecto, la API pública del catálogo. */
  fuente?: FuenteCatalogo;
  /** Dentro del módulo: no guarda el carrito ni abre WhatsApp. */
  vistaPrevia?: boolean;
}) {
  const color = encabezado.color && /^#[0-9a-f]{6}$/i.test(encabezado.color) ? encabezado.color : AZUL_SYMVORA;
  const tinta = textoSobre(color);
  const whatsapp = (encabezado.whatsapp ?? "").replace(/\D/g, "");
  const slug = encabezado.slug ?? "";
  const consultarFuente = fuente ?? fuentePublica(slug);
  const destacados = encabezado.destacados ?? [];

  // En el servidor no hay carrito: lo que depende de él se pinta ya montado.
  const montado = useSyncExternalStore(suscribirNada, () => true, () => false);
  const [lineas, despachar] = useReducer(reducirPedido, slug, (clave) =>
    typeof window === "undefined" || vistaPrevia ? [] : leerCarrito(clave)
  );
  useEffect(() => {
    if (vistaPrevia || !slug) return;
    try {
      window.localStorage.setItem(claveGuardado(slug), JSON.stringify(lineas));
    } catch {
      // Navegación privada o almacenamiento lleno: el carrito vive solo en la pestaña.
    }
  }, [slug, lineas, vistaPrevia]);

  const [productos, setProductos] = useState(paginaInicial.productos);
  const [total, setTotal] = useState(paginaInicial.total);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elegido, setElegido] = useState<CatalogoProducto | null>(null);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const temporizador = useRef<number | null>(null);
  const peticion = useRef<AbortController | null>(null);

  async function consultar(q: string, cat: string | null, offset: number) {
    peticion.current?.abort();
    const control = new AbortController();
    peticion.current = control;
    setCargando(true);
    setError(null);
    try {
      const pagina = await consultarFuente(q, cat, offset, control.signal);
      if (control.signal.aborted) return;
      if ("error" in pagina) {
        setError(pagina.error);
        return;
      }
      setTotal(pagina.total);
      setProductos((previos) => (offset ? [...previos, ...pagina.productos] : pagina.productos));
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("Sin conexión. Revisa tu internet.");
    } finally {
      if (peticion.current === control) setCargando(false);
    }
  }

  function cambiarBusqueda(texto: string) {
    setBusqueda(texto);
    if (temporizador.current) window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => void consultar(texto, categoria, 0), 300);
  }

  function cambiarCategoria(cat: string | null) {
    setCategoria(cat);
    void consultar(busqueda, cat, 0);
  }

  function agregar(producto: CatalogoProducto, variante: CatalogoVariante | null, cantidad = 1) {
    const unidad = variante?.unidad_medida ?? producto.unidad_medida;
    const precio = precioDeLinea(producto, variante);
    despachar({
      tipo: "agregar",
      cantidad,
      linea: {
        productoId: producto.id,
        varianteId: variante?.id ?? null,
        nombre: producto.nombre,
        variante: variante?.etiqueta ?? null,
        unidad,
        precio,
      },
    });
  }

  const enCarrito = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const l of lineas) mapa.set(l.productoId, (mapa.get(l.productoId) ?? 0) + 1);
    return mapa;
  }, [lineas]);

  const conteo = montado ? conteoPedido(lineas) : 0;
  const estimado = totalEstimado(lineas);

  const elegir = (p: CatalogoProducto) => {
    if (p.variantes.length > 0 || esFraccionable(p.unidad_medida)) setElegido(p);
    else agregar(p, null);
  };

  return (
    <div className={`${vistaPrevia ? "min-h-full" : "min-h-dvh"} bg-slate-50 text-slate-900`}>
      {/* Encabezado con la marca del negocio; con portada, la imagen detrás de un velo del color. */}
      <header
        className="relative overflow-hidden"
        style={{ backgroundColor: color, color: encabezado.portada_url ? "#ffffff" : tinta }}
      >
        {encabezado.portada_url && (
          <>
            <Image
              src={encabezado.portada_url}
              alt=""
              fill
              unoptimized
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(to top, ${color}f2 0%, ${color}99 45%, ${color}33 100%)` }}
              aria-hidden="true"
            />
          </>
        )}
        <div
          className={`relative mx-auto flex max-w-5xl items-center gap-3 px-4 pb-5 sm:gap-4 ${
            encabezado.portada_url ? "pt-28 sm:pt-36" : "pt-6"
          }`}
        >
          {encabezado.logo_url ? (
            <Image
              src={encabezado.logo_url}
              alt=""
              width={64}
              height={64}
              unoptimized
              className="h-14 w-14 shrink-0 rounded-2xl bg-white object-contain p-1 sm:h-16 sm:w-16"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 sm:h-16 sm:w-16">
              <Package className="h-7 w-7" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold sm:text-2xl">{encabezado.negocio}</h1>
            <p className="text-sm opacity-80">
              Catálogo · {encabezado.total} {encabezado.total === 1 ? "producto" : "productos"}
            </p>
            {encabezado.direccion && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs opacity-75">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{encabezado.direccion}</span>
              </p>
            )}
          </div>
        </div>
        {encabezado.mensaje && (
          <p className="relative mx-auto max-w-5xl px-4 pb-5 text-sm opacity-90">{encabezado.mensaje}</p>
        )}
      </header>

      {/* Buscador y categorías: siempre a la vista */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-5xl space-y-2 px-4 py-3">
          <label className="relative block">
            <span className="sr-only">Buscar productos</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => cambiarBusqueda(e.target.value)}
              placeholder="Buscar productos"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pr-10 pl-9 text-base outline-none focus:border-slate-400 focus:bg-white"
            />
            {cargando && (
              <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" aria-hidden="true" />
            )}
          </label>
          {encabezado.categorias.length > 0 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              <Chip activo={categoria === null} color={color} tinta={tinta} onClick={() => cambiarCategoria(null)}>
                Todo
              </Chip>
              {encabezado.categorias.map((c) => (
                <Chip
                  key={c.nombre}
                  activo={categoria === c.nombre}
                  color={color}
                  tinta={tinta}
                  onClick={() => cambiarCategoria(categoria === c.nombre ? null : c.nombre)}
                >
                  {c.nombre}
                </Chip>
              ))}
            </div>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 pt-4 pb-32">
        {error && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p>}

        {destacados.length > 0 && !busqueda && !categoria && (
          <section className="mb-6" aria-label="Destacados">
            <h2 className="mb-2 flex items-center gap-1.5 text-base font-semibold">
              <Star className="h-4 w-4" style={{ color, fill: color }} aria-hidden="true" />
              Destacados
            </h2>
            <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
              {destacados.map((p) => (
                <li key={p.id} className="w-40 shrink-0 snap-start sm:w-48">
                  <TarjetaProducto
                    producto={p}
                    color={color}
                    tinta={tinta}
                    enCarrito={montado ? (enCarrito.get(p.id) ?? 0) : 0}
                    onElegir={() => elegir(p)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {productos.length === 0 && !cargando ? (
          <div className="py-16 text-center text-slate-500">
            <Package className="mx-auto mb-2 h-10 w-10 text-slate-300" aria-hidden="true" />
            <p>{busqueda || categoria ? "No encontramos productos con esa búsqueda." : "Aún no hay productos publicados."}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {productos.map((p) => (
              <li key={p.id}>
                <TarjetaProducto
                  producto={p}
                  color={color}
                  tinta={tinta}
                  enCarrito={montado ? (enCarrito.get(p.id) ?? 0) : 0}
                  onElegir={() => elegir(p)}
                />
              </li>
            ))}
          </ul>
        )}

        {productos.length < total && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              disabled={cargando}
              onClick={() => void consultar(busqueda, categoria, productos.length)}
              className="h-11 rounded-full border border-slate-300 bg-white px-6 text-sm font-medium disabled:opacity-60"
            >
              {cargando ? "Cargando…" : `Cargar más (${total - productos.length})`}
            </button>
          </div>
        )}

        <footer className="mt-10 text-center text-xs text-slate-400">
          Precios y disponibilidad sujetos a confirmación del negocio.
          <br />
          <a href="https://www.symvora.com.mx" className="underline-offset-2 hover:underline">
            Catálogo hecho con SYMVORA
          </a>
        </footer>
      </main>

      {/* Barra del carrito */}
      {conteo > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setCarritoAbierto(true)}
            style={{ backgroundColor: color, color: tinta }}
            className="mx-auto flex h-14 w-full max-w-md items-center justify-between rounded-2xl px-5 text-base font-semibold shadow-lg"
            aria-label={`Ver pedido: ${conteo} ${conteo === 1 ? "artículo" : "artículos"}`}
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              Ver pedido ({conteo})
            </span>
            {estimado != null && <span>{formatearPrecio(estimado)}</span>}
          </button>
        </div>
      )}

      {elegido && (
        <HojaEleccion
          producto={elegido}
          color={color}
          tinta={tinta}
          onCerrar={() => setElegido(null)}
          onAgregar={(variante, cantidad) => {
            agregar(elegido, variante, cantidad);
            setElegido(null);
          }}
        />
      )}

      {carritoAbierto && (
        <HojaCarrito
          negocio={encabezado.negocio}
          whatsapp={whatsapp}
          vistaPrevia={vistaPrevia}
          lineas={lineas}
          despachar={despachar}
          onCerrar={() => setCarritoAbierto(false)}
        />
      )}
    </div>
  );
}

function Chip({
  activo,
  color,
  tinta,
  onClick,
  children,
}: {
  activo: boolean;
  color: string;
  tinta: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      style={activo ? { backgroundColor: color, color: tinta, borderColor: color } : undefined}
      className="h-9 shrink-0 rounded-full border border-slate-200 bg-white px-4 text-sm whitespace-nowrap text-slate-700"
    >
      {children}
    </button>
  );
}

function Foto({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-300 ${className ?? ""}`}>
        <Package className="h-10 w-10" aria-hidden="true" />
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={400}
      height={400}
      unoptimized
      loading="lazy"
      className={`bg-white object-cover ${className ?? ""}`}
    />
  );
}

function TarjetaProducto({
  producto,
  color,
  tinta,
  enCarrito,
  onElegir,
}: {
  producto: CatalogoProducto;
  color: string;
  tinta: string;
  enCarrito: number;
  onElegir: () => void;
}) {
  const especial = producto.precio_especial ?? null;
  const precio = especial != null
    ? textoPrecio(especial, especial, producto.unidad_medida)
    : textoPrecio(producto.precio_min, producto.precio_max, producto.unidad_medida);
  const anterior = especial != null && producto.precio_min != null ? formatearPrecio(producto.precio_min) : null;
  const contenido = textoContenido(producto);
  const conVariantes = producto.variantes.length > 0;
  return (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white ${
        producto.disponible ? "" : "opacity-60"
      }`}
    >
      <div className="relative">
        <Foto src={producto.imagen_url} alt={producto.nombre} className="aspect-square w-full" />
        {!producto.disponible && (
          <span className="absolute top-2 left-2 rounded-full bg-slate-900/80 px-2 py-0.5 text-xs font-medium text-white">
            Agotado
          </span>
        )}
        {enCarrito > 0 ? (
          <span
            style={{ backgroundColor: color, color: tinta }}
            className="absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-semibold"
          >
            En tu pedido
          </span>
        ) : (
          especial != null && (
            <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-950">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Precio en línea
            </span>
          )
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h2 className="line-clamp-2 text-sm leading-snug font-medium">{producto.nombre}</h2>
        {contenido && <p className="text-xs text-slate-500">{contenido}</p>}
        {conVariantes && (
          <p className="text-xs text-slate-500">
            {producto.variantes.length} {producto.variantes.length === 1 ? "opción" : "opciones"}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          {precio ? (
            <p className="text-sm leading-tight font-semibold">
              {precio}
              {anterior && <span className="block text-xs font-normal text-slate-400 line-through">{anterior}</span>}
            </p>
          ) : (
            <span />
          )}
          <button
            type="button"
            disabled={!producto.disponible}
            onClick={onElegir}
            style={producto.disponible ? { backgroundColor: color, color: tinta } : undefined}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500 disabled:cursor-not-allowed"
            aria-label={conVariantes ? `Elegir opción de ${producto.nombre}` : `Agregar ${producto.nombre} al pedido`}
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

/** Hoja inferior genérica (celular) / ventana centrada (escritorio). */
function Hoja({
  titulo,
  onCerrar,
  children,
  pie,
}: {
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
  pie?: React.ReactNode;
}) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflow;
    };
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={titulo}>
      <button type="button" className="absolute inset-0 bg-slate-900/50" aria-label="Cerrar" onClick={onCerrar} />
      <div className="relative flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-3xl bg-white sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="truncate text-base font-semibold">{titulo}</h2>
          <button type="button" onClick={onCerrar} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100" aria-label="Cerrar">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {pie && <div className="border-t border-slate-100 px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">{pie}</div>}
      </div>
    </div>
  );
}

function HojaEleccion({
  producto,
  color,
  tinta,
  onCerrar,
  onAgregar,
}: {
  producto: CatalogoProducto;
  color: string;
  tinta: string;
  onCerrar: () => void;
  onAgregar: (variante: CatalogoVariante | null, cantidad: number) => void;
}) {
  const disponibles = producto.variantes.filter((v) => v.disponible);
  const [varianteId, setVarianteId] = useState<string | null>(disponibles[0]?.id ?? null);
  const variante = producto.variantes.find((v) => v.id === varianteId) ?? null;
  const unidad = variante?.unidad_medida ?? producto.unidad_medida;
  const granel = esFraccionable(unidad);
  const [cantidadTexto, setCantidadTexto] = useState("1");
  const cantidad = normalizarCantidad(cantidadTexto, unidad);
  const precioUnitario = precioDeLinea(producto, variante);
  const foto = variante?.imagen_url ?? producto.imagen_url;
  const conVariantes = producto.variantes.length > 0;
  const listo = cantidad != null && (!conVariantes || variante?.disponible);

  function mover(delta: number) {
    const base = cantidad ?? 0;
    const siguiente = Math.max(granel ? PASO_GRANEL : 1, Math.round((base + delta) * 1000) / 1000);
    setCantidadTexto(String(siguiente));
  }

  return (
    <Hoja
      titulo={producto.nombre}
      onCerrar={onCerrar}
      pie={
        <button
          type="button"
          disabled={!listo}
          onClick={() => cantidad != null && onAgregar(variante, cantidad)}
          style={listo ? { backgroundColor: color, color: tinta } : undefined}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-200 text-base font-semibold text-slate-500"
        >
          Agregar al pedido
          {listo && precioUnitario != null && cantidad != null && <span>· {formatearPrecio(precioUnitario * cantidad)}</span>}
        </button>
      }
    >
      <div className="space-y-4">
        <Foto src={foto} alt={producto.nombre} className="mx-auto aspect-square w-40 rounded-2xl" />
        {producto.descripcion && <p className="text-sm text-slate-600">{producto.descripcion}</p>}

        {conVariantes && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Elige una opción</legend>
            <div className="flex flex-wrap gap-2">
              {producto.variantes.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  disabled={!v.disponible}
                  aria-pressed={v.id === varianteId}
                  onClick={() => setVarianteId(v.id)}
                  style={v.id === varianteId ? { backgroundColor: color, color: tinta, borderColor: color } : undefined}
                  className="min-h-10 rounded-xl border border-slate-200 px-3 py-1.5 text-left text-sm disabled:opacity-40 disabled:line-through"
                >
                  {v.etiqueta}
                  {v.precio != null && <span className="block text-xs opacity-80">{formatearPrecio(v.precio)}</span>}
                </button>
              ))}
            </div>
            {disponibles.length === 0 && <p className="mt-2 text-sm text-slate-500">Todas las opciones están agotadas.</p>}
          </fieldset>
        )}

        <div>
          <p className="mb-2 text-sm font-medium">{granel ? `¿Cuánto? (${abreviatura(unidad, 1)})` : "Cantidad"}</p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => mover(granel ? -PASO_GRANEL : -1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200" aria-label="Menos">
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              inputMode={granel ? "decimal" : "numeric"}
              value={cantidadTexto}
              onChange={(e) => setCantidadTexto(e.target.value)}
              className="h-11 w-24 rounded-xl border border-slate-200 text-center text-base"
              aria-label="Cantidad"
            />
            <button type="button" onClick={() => mover(granel ? PASO_GRANEL : 1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200" aria-label="Más">
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {cantidad == null && (
            <p className="mt-1 text-xs text-red-600">{granel ? "Escribe una cantidad mayor a 0." : "Escribe una cantidad entera."}</p>
          )}
        </div>
      </div>
    </Hoja>
  );
}

function HojaCarrito({
  negocio,
  whatsapp,
  vistaPrevia,
  lineas,
  despachar,
  onCerrar,
}: {
  negocio: string;
  whatsapp: string;
  vistaPrevia: boolean;
  lineas: LineaPedido[];
  despachar: React.Dispatch<Parameters<typeof reducirPedido>[1]>;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const estimado = totalEstimado(lineas);
  const mensaje = mensajePedido(negocio, lineas, nombre);
  const enlace = whatsapp ? urlWhatsApp(whatsapp, mensaje) : null;

  return (
    <Hoja
      titulo="Tu pedido"
      onCerrar={onCerrar}
      pie={
        lineas.length > 0 ? (
          <div className="space-y-3">
            {estimado != null && (
              <p className="flex justify-between text-base font-semibold">
                <span>Total estimado</span>
                <span>{formatearPrecio(estimado)}</span>
              </p>
            )}
            {vistaPrevia || !enlace ? (
              <>
                <div className="flex h-12 w-full items-center justify-center rounded-2xl bg-slate-200 text-sm font-semibold text-slate-500">
                  Enviar pedido por WhatsApp
                </div>
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer text-center">
                    {vistaPrevia ? "Vista previa: así le llegaría el mensaje" : "Falta el WhatsApp del negocio"}
                  </summary>
                  <pre className="mt-2 rounded-lg bg-slate-50 p-3 font-sans whitespace-pre-wrap text-slate-700">{mensaje}</pre>
                </details>
              </>
            ) : (
              <>
                <a
                  href={enlace}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ backgroundColor: "#16a34a" }}
                  className="flex h-12 w-full items-center justify-center rounded-2xl text-base font-semibold text-white"
                >
                  Enviar pedido por WhatsApp
                </a>
                <p className="text-center text-xs text-slate-500">
                  Se abre WhatsApp con tu pedido escrito. {negocio} te confirma precio y disponibilidad.
                </p>
              </>
            )}
          </div>
        ) : undefined
      }
    >
      {lineas.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Tu pedido está vacío.</p>
      ) : (
        <div className="space-y-4">
          <ul className="divide-y divide-slate-100">
            {lineas.map((l) => (
              <LineaCarrito key={l.clave} linea={l} despachar={despachar} />
            ))}
          </ul>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Tu nombre (opcional)</span>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value.slice(0, 60))}
              placeholder="Para que el negocio sepa quién pide"
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-base"
              autoComplete="given-name"
            />
          </label>
          <button
            type="button"
            onClick={() => despachar({ tipo: "vaciar" })}
            className="text-sm text-slate-500 underline-offset-2 hover:underline"
          >
            Vaciar pedido
          </button>
        </div>
      )}
    </Hoja>
  );
}

function LineaCarrito({
  linea,
  despachar,
}: {
  linea: LineaPedido;
  despachar: React.Dispatch<Parameters<typeof reducirPedido>[1]>;
}) {
  const granel = esFraccionable(linea.unidad);
  const paso = granel ? PASO_GRANEL : 1;
  const [texto, setTexto] = useState(String(linea.cantidad));
  const [anterior, setAnterior] = useState(linea.cantidad);
  // Si cambia desde fuera (botones), el campo sigue a la cantidad real.
  if (anterior !== linea.cantidad) {
    setAnterior(linea.cantidad);
    setTexto(String(linea.cantidad));
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{linea.nombre}</p>
        {linea.variante && <p className="truncate text-xs text-slate-500">{linea.variante}</p>}
        {linea.precio != null && (
          <p className="text-xs text-slate-500">
            {formatearPrecio(linea.precio)}
            {granel ? ` por ${abreviatura(linea.unidad, 1)}` : ""} · {formatearPrecio(linea.precio * linea.cantidad)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() =>
            linea.cantidad - paso <= 0
              ? despachar({ tipo: "quitar", clave: linea.clave })
              : despachar({ tipo: "cantidad", clave: linea.clave, cantidad: Math.round((linea.cantidad - paso) * 1000) / 1000 })
          }
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200"
          aria-label={linea.cantidad - paso <= 0 ? `Quitar ${linea.nombre}` : "Menos"}
        >
          {linea.cantidad - paso <= 0 ? <Trash2 className="h-4 w-4" aria-hidden="true" /> : <Minus className="h-4 w-4" aria-hidden="true" />}
        </button>
        <input
          inputMode={granel ? "decimal" : "numeric"}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => {
            const n = normalizarCantidad(texto, linea.unidad);
            if (n != null) despachar({ tipo: "cantidad", clave: linea.clave, cantidad: n });
            else setTexto(String(linea.cantidad));
          }}
          className="h-9 w-14 rounded-lg border border-slate-200 text-center text-sm"
          aria-label={`Cantidad de ${linea.nombre}`}
        />
        <button
          type="button"
          onClick={() => despachar({ tipo: "cantidad", clave: linea.clave, cantidad: Math.round((linea.cantidad + paso) * 1000) / 1000 })}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200"
          aria-label="Más"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

