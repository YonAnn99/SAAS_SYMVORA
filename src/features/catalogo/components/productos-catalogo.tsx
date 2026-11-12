"use client";

import { useMoneda } from "@/hooks/use-moneda";

import { useTranslations } from "next-intl";
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
import { abreviatura, esFraccionable } from "@/lib/unidades";
import { cn } from "@/lib/utils";
import { guardarAjustesProductos, listarFilasCatalogo, mensajeErrorCatalogo } from "../catalogo-service";
import {
  aplicarAccion,
  conteosCatalogo,
  filtrarFilas,
  precioEspecialCapturado,
  type FilaCatalogo,
  type FiltroCatalogo,
} from "../seleccion";
import type { AjusteProductoCatalogo } from "../types";

/** Texto de cada filtro: `onlineCatalog.products.filters.<valor>`. */
const FILTROS: { valor: FiltroCatalogo }[] = [
  { valor: "todos" },
  { valor: "publicados" },
  { valor: "ocultos" },
  { valor: "destacados" },
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
  const t = useTranslations("onlineCatalog.products");
  const te = useTranslations("onlineCatalog.errors");
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
      toast.error(mensajeErrorCatalogo(error, te));
      return false;
    }
  };

  const accionEnGrupo = async (accion: Accion) => {
    setGuardando(true);
    const ids = [...seleccion];
    const ok = await aplicar(ids, (a) => aplicarAccion(a, accion));
    setGuardando(false);
    if (ok) {
      toast.success(t(`bulk.${accion}`, { count: ids.length }));
      setSeleccion(new Set());
    }
  };

  if (errorCarga) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {t("loadError")}
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
        {t("intro")}
      </p>

      {/* Filtros */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">{t("search")}</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setLimite(PASO_LISTA);
            }}
            placeholder={t("search")}
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
            opciones={[{ value: "", label: t("allCategories") }, ...categorias]}
            placeholder={t("allCategories")}
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
            {t(`filters.${f.valor}`)} <span className="opacity-70">{conteos[f.valor]}</span>
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
          aria-label={t("selectVisible")}
        />
        <span className="text-xs text-muted-foreground">
          {seleccion.size > 0 ? t("selected", { count: seleccion.size }) : t("selectAll")}
        </span>
        {seleccion.size > 0 && (
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button size="xs" variant="outline" disabled={guardando} onClick={() => void accionEnGrupo("publicar")}>
              <Eye className="h-3.5 w-3.5" /> {t("publish")}
            </Button>
            <Button size="xs" variant="outline" disabled={guardando} onClick={() => void accionEnGrupo("ocultar")}>
              <EyeOff className="h-3.5 w-3.5" /> {t("hide")}
            </Button>
            <Button size="xs" variant="outline" disabled={guardando} onClick={() => void accionEnGrupo("destacar")}>
              <Star className="h-3.5 w-3.5" /> {t("feature")}
            </Button>
            <Button size="xs" variant="outline" disabled={guardando} onClick={() => void accionEnGrupo("quitarDestacado")}>
              <StarOff className="h-3.5 w-3.5" /> {t("unfeature")}
            </Button>
          </div>
        )}
      </div>

      {visibles.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {filas.length === 0 ? t("noProducts") : t("noMatch")}
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
            {t("showMore", { n: visibles.length - limite })}
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
  const { formatear } = useMoneda();
  const t = useTranslations("onlineCatalog.products");
  const tf = useTranslations("products.form");
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
      toast.error(capturado.error === "Escribe un precio válido" ? t("priceInvalid") : t("pricePositive", { cero: formatear(0) }));
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
      <Checkbox checked={marcada} onCheckedChange={(v) => onMarcar(Boolean(v))} aria-label={t("selectNamed", { nombre: fila.nombre })} />
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
          {formatear(fila.precio_venta)}
          {esFraccionable(fila.unidad_medida) ? tf("perUnit", { unidad: abreviatura(fila.unidad_medida, 1) }) : ""}
          {fila.categoria ? ` · ${fila.categoria}` : ""}
          {fila.tieneVariantes ? ` · ${t("withVariants")}` : ""}
        </p>
      </div>

      <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="sm:sr-only">{t("catalogPrice")}</span>
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={guardarPrecio}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            inputMode="decimal"
            placeholder={fila.tieneVariantes ? "—" : t("catalogPrice")}
            disabled={fila.tieneVariantes || fila.oculto}
            title={fila.tieneVariantes ? t("noVariantPrice") : undefined}
            className="h-8 w-28 font-mono text-xs"
            aria-label={t("specialPriceOf", { nombre: fila.nombre })}
          />
        </label>
        <button
          type="button"
          onClick={() => void onCambio((a) => aplicarAccion(a, a.destacado ? "quitarDestacado" : "destacar"))}
          aria-pressed={fila.destacado}
          aria-label={fila.destacado ? t("unfeatureNamed", { nombre: fila.nombre }) : t("featureNamed", { nombre: fila.nombre })}
          title={fila.destacado ? t("featuredHint") : t("feature")}
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
        >
          <Star className={cn("h-4 w-4", fila.destacado ? "fill-amber-400 text-amber-500" : "text-muted-foreground")} />
        </button>
        <Switch
          checked={!fila.oculto}
          onCheckedChange={(v) => void onCambio((a) => aplicarAccion(a, v ? "publicar" : "ocultar"))}
          aria-label={fila.oculto ? t("publishNamed", { nombre: fila.nombre }) : t("hideNamed", { nombre: fila.nombre })}
        />
      </div>
    </li>
  );
}
