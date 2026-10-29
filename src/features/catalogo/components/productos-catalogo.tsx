"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Package, Search, Star, StarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SelectSimple } from "@/components/ui/select-simple";
import { Switch } from "@/components/ui/switch";
import { porUnidad } from "@/lib/unidades";
import { cn } from "@/lib/utils";
import { guardarAjustesProductos, listarFilasCatalogo, mensajeErrorCatalogo } from "../catalogo-service";
import { formatearPrecio } from "../pedido";
import {
  aplicarAccion,
  conteosCatalogo,
  filtrarFilas,
  precioEspecialCapturado,
  type FilaCatalogo,
  type FiltroCatalogo,
} from "../seleccion";
import type { AjusteProductoCatalogo } from "../types";

const FILTROS: { valor: FiltroCatalogo; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "publicados", etiqueta: "Publicados" },
  { valor: "ocultos", etiqueta: "Ocultos" },
  { valor: "destacados", etiqueta: "Destacados" },
];

/** Se pintan de 100 en 100: un negocio puede tener miles de productos. */
const PASO_LISTA = 100;

type Accion = "publicar" | "ocultar" | "destacar" | "quitarDestacado";

function ajusteDe(f: FilaCatalogo): AjusteProductoCatalogo {
  return { oculto: f.oculto, destacado: f.destacado, precio_especial: f.precio_especial };
}

/**
 * Pestaña «Productos» del módulo: qué sale en el catálogo, qué se destaca y
 * con qué precio especial. Cada cambio se guarda al momento (optimista: si la
 * base lo rechaza, la fila regresa a como estaba).
 */
export function ProductosCatalogo({ tenantId }: { tenantId: string }) {
  const [filas, setFilas] = useState<FilaCatalogo[] | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroCatalogo>("todos");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [limite, setLimite] = useState(PASO_LISTA);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vigente = true;
    listarFilasCatalogo(tenantId)
      .then((f) => vigente && setFilas(f))
      .catch(() => vigente && setErrorCarga(true));
    return () => {
      vigente = false;
    };
  }, [tenantId]);

  const categorias = useMemo(
    () =>
      [...new Set((filas ?? []).map((f) => f.categoria).filter((c): c is string => Boolean(c)))]
        .sort((a, b) => a.localeCompare(b, "es"))
        .map((c) => ({ value: c, label: c })),
    [filas]
  );
  const visibles = useMemo(
    () => (filas ? filtrarFilas(filas, { busqueda, categoria, filtro }) : []),
    [filas, busqueda, categoria, filtro]
  );
  const conteos = useMemo(() => conteosCatalogo(filas ?? []), [filas]);

  /** Cambia varias filas a la vez y lo guarda; si falla, las regresa. */
  const aplicar = async (ids: string[], cambio: (a: AjusteProductoCatalogo) => AjusteProductoCatalogo) => {
    if (!filas || ids.length === 0) return false;
    const objetivo = new Set(ids);
    const antes = filas;
    const despues = filas.map((f) => (objetivo.has(f.id) ? { ...f, ...cambio(ajusteDe(f)) } : f));
    setFilas(despues);
    try {
      await guardarAjustesProductos(
        tenantId,
        despues.filter((f) => objetivo.has(f.id)).map((f) => ({ producto_id: f.id, ...ajusteDe(f) }))
      );
      return true;
    } catch (error) {
      setFilas(antes);
      toast.error(mensajeErrorCatalogo(error));
      return false;
    }
  };

  const accionEnGrupo = async (accion: Accion) => {
    setGuardando(true);
    const ids = [...seleccion];
    const ok = await aplicar(ids, (a) => aplicarAccion(a, accion));
    setGuardando(false);
    if (ok) {
      const textos: Record<Accion, string> = {
        publicar: "publicados",
        ocultar: "ocultos",
        destacar: "destacados",
        quitarDestacado: "sin destacar",
      };
      toast.success(`${ids.length} ${ids.length === 1 ? "producto" : "productos"} ${textos[accion]}`);
      setSeleccion(new Set());
    }
  };

  if (errorCarga) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No se pudieron cargar los productos. Recarga la página.
        </CardContent>
      </Card>
    );
  }
  if (!filas) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const enPantalla = visibles.slice(0, limite);
  const todosMarcados = visibles.length > 0 && visibles.every((f) => seleccion.has(f.id));
  const algunoMarcado = visibles.some((f) => seleccion.has(f.id));

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Al publicar el catálogo salen todos tus productos activos. Aquí ocultas los que no quieras mostrar, destacas
        los que van primero y pones un precio especial solo para el catálogo (en el punto de venta se cobra el precio
        normal).
      </p>

      {/* Filtros */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Buscar producto</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setLimite(PASO_LISTA);
            }}
            placeholder="Buscar producto"
            className="h-9 pl-8"
          />
        </label>
        {categorias.length > 0 && (
          <SelectSimple
            value={categoria}
            onChange={(c) => {
              setCategoria(c);
              setLimite(PASO_LISTA);
            }}
            opciones={[{ value: "", label: "Todas las categorías" }, ...categorias]}
            placeholder="Todas las categorías"
            ariaLabel="Categoría"
            className="sm:w-56"
          />
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            aria-pressed={filtro === f.valor}
            onClick={() => {
              setFiltro(f.valor);
              setLimite(PASO_LISTA);
            }}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-xs whitespace-nowrap",
              filtro === f.valor ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
            )}
          >
            {f.etiqueta} <span className="opacity-70">{conteos[f.valor]}</span>
          </button>
        ))}
      </div>

      {/* Acciones en grupo */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
        <Checkbox
          checked={todosMarcados}
          indeterminate={!todosMarcados && algunoMarcado}
          onCheckedChange={(v) =>
            setSeleccion((prev) => {
              const nueva = new Set(prev);
              for (const f of visibles) {
                if (v) nueva.add(f.id);
                else nueva.delete(f.id);
              }
              return nueva;
            })
          }
          aria-label="Seleccionar todos los que se ven"
        />
        <span className="text-xs text-muted-foreground">
          {seleccion.size > 0 ? `${seleccion.size} seleccionados` : "Seleccionar todos"}
        </span>
        {seleccion.size > 0 && (
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button size="xs" variant="outline" disabled={guardando} onClick={() => void accionEnGrupo("publicar")}>
              <Eye className="h-3.5 w-3.5" /> Publicar
            </Button>
            <Button size="xs" variant="outline" disabled={guardando} onClick={() => void accionEnGrupo("ocultar")}>
              <EyeOff className="h-3.5 w-3.5" /> Ocultar
            </Button>
            <Button size="xs" variant="outline" disabled={guardando} onClick={() => void accionEnGrupo("destacar")}>
              <Star className="h-3.5 w-3.5" /> Destacar
            </Button>
            <Button size="xs" variant="outline" disabled={guardando} onClick={() => void accionEnGrupo("quitarDestacado")}>
              <StarOff className="h-3.5 w-3.5" /> Quitar destacado
            </Button>
          </div>
        )}
      </div>

      {visibles.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {filas.length === 0 ? "Aún no tienes productos. Agrégalos en Productos." : "Ningún producto coincide con el filtro."}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {enPantalla.map((f) => (
            <FilaProducto
              key={f.id}
              fila={f}
              marcada={seleccion.has(f.id)}
              onMarcar={(v) =>
                setSeleccion((prev) => {
                  const nueva = new Set(prev);
                  if (v) nueva.add(f.id);
                  else nueva.delete(f.id);
                  return nueva;
                })
              }
              onCambio={(cambio) => aplicar([f.id], cambio)}
            />
          ))}
        </ul>
      )}

      {visibles.length > limite && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setLimite((l) => l + PASO_LISTA)}>
            Mostrar más ({visibles.length - limite})
          </Button>
        </div>
      )}
    </div>
  );
}

function FilaProducto({
  fila,
  marcada,
  onMarcar,
  onCambio,
}: {
  fila: FilaCatalogo;
  marcada: boolean;
  onMarcar: (v: boolean) => void;
  onCambio: (cambio: (a: AjusteProductoCatalogo) => AjusteProductoCatalogo) => Promise<boolean>;
}) {
  const [texto, setTexto] = useState(fila.precio_especial != null ? String(fila.precio_especial) : "");
  const [anterior, setAnterior] = useState(fila.precio_especial);
  // Si cambia desde fuera (se revirtió un guardado), el campo sigue al dato.
  if (anterior !== fila.precio_especial) {
    setAnterior(fila.precio_especial);
    setTexto(fila.precio_especial != null ? String(fila.precio_especial) : "");
  }

  const guardarPrecio = () => {
    const capturado = precioEspecialCapturado(texto, fila.precio_venta);
    if (!capturado.ok) {
      toast.error(capturado.error);
      setTexto(fila.precio_especial != null ? String(fila.precio_especial) : "");
      return;
    }
    if (capturado.valor === fila.precio_especial) {
      setTexto(capturado.valor != null ? String(capturado.valor) : "");
      return;
    }
    void onCambio((a) => ({ ...a, precio_especial: capturado.valor }));
  };

  return (
    <li className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5", fila.oculto && "bg-muted/40")}>
      <Checkbox checked={marcada} onCheckedChange={(v) => onMarcar(Boolean(v))} aria-label={`Seleccionar ${fila.nombre}`} />
      {fila.imagen_url ? (
        <Image
          src={fila.imagen_url}
          alt=""
          width={40}
          height={40}
          unoptimized
          className={cn("h-10 w-10 shrink-0 rounded-md object-cover", fila.oculto && "opacity-50")}
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Package className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1 basis-40">
        <p className={cn("truncate text-sm font-medium", fila.oculto && "text-muted-foreground")}>{fila.nombre}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatearPrecio(fila.precio_venta)}
          {porUnidad(fila.unidad_medida)}
          {fila.categoria ? ` · ${fila.categoria}` : ""}
          {fila.tieneVariantes ? " · con variantes" : ""}
        </p>
      </div>

      <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="sm:sr-only">Precio catálogo</span>
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={guardarPrecio}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            inputMode="decimal"
            placeholder={fila.tieneVariantes ? "—" : "Precio catálogo"}
            disabled={fila.tieneVariantes || fila.oculto}
            title={fila.tieneVariantes ? "El precio especial es solo para productos sin variantes" : undefined}
            className="h-8 w-28 font-mono text-xs"
            aria-label={`Precio especial en el catálogo de ${fila.nombre}`}
          />
        </label>
        <button
          type="button"
          onClick={() => void onCambio((a) => aplicarAccion(a, a.destacado ? "quitarDestacado" : "destacar"))}
          aria-pressed={fila.destacado}
          aria-label={fila.destacado ? `Quitar destacado de ${fila.nombre}` : `Destacar ${fila.nombre}`}
          title={fila.destacado ? "Destacado: sale primero" : "Destacar"}
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
        >
          <Star className={cn("h-4 w-4", fila.destacado ? "fill-amber-400 text-amber-500" : "text-muted-foreground")} />
        </button>
        <Switch
          checked={!fila.oculto}
          onCheckedChange={(v) => void onCambio((a) => aplicarAccion(a, v ? "publicar" : "ocultar"))}
          aria-label={fila.oculto ? `Publicar ${fila.nombre}` : `Ocultar ${fila.nombre}`}
        />
      </div>
    </li>
  );
}
