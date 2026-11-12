"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Boxes, Loader2, Printer, Search, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectSimple } from "@/components/ui/select-simple";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { dibujarCodigo } from "@/lib/codigo-barras";
import { unidadDeVenta } from "@/lib/unidades";
import { etiquetaAtributos } from "../atributos-variante";
import { asignarCodigosGenerados, type AsignacionCodigo } from "../services/product-service";
import type { Producto, VarianteProducto } from "../types/inventory.types";
import {
  FORMATOS,
  formatoPorId,
  porPagina,
  textoPrecio,
  totalEtiquetas,
  type FormatoEtiqueta,
  type IdFormato,
  type ItemEtiqueta,
} from "./formatos-etiqueta";

interface Renglon extends ItemEtiqueta {
  tipo: "producto" | "variante";
  id: string;
  existencias: number;
}

const FORMATO_GUARDADO = "symvora-etiquetas-formato";

/** Ultimo formato usado en este navegador (cortesia: sin el, hoja carta 3x10). */
function formatoGuardado(): IdFormato {
  try {
    const guardado = localStorage.getItem(FORMATO_GUARDADO);
    if (guardado && FORMATOS.some((f) => f.id === guardado)) return guardado as IdFormato;
  } catch {
    // Sin almacenamiento: el formato por defecto.
  }
  return "carta-3x10";
}

function renglonesDe(p: Producto, variantes: VarianteProducto[] | undefined): Renglon[] {
  if (variantes && variantes.length > 0) {
    return variantes.map((v) => ({
      clave: `variante:${v.id}`,
      tipo: "variante",
      id: v.id,
      nombre: p.nombre,
      detalle: etiquetaAtributos(v) || null,
      precio: Number(v.precio_venta) || 0,
      unidad: unidadDeVenta(p, v),
      codigo: v.codigo_barras?.trim() || null,
      sku: v.sku?.trim() || null,
      copias: 1,
      existencias: Number(v.stock_actual) || 0,
    }));
  }
  return [
    {
      clave: `producto:${p.id}`,
      tipo: "producto",
      id: p.id,
      nombre: p.nombre,
      detalle: null,
      precio: Number(p.precio_venta) || 0,
      unidad: p.unidad_medida,
      codigo: p.codigo_barras?.trim() || null,
      sku: p.sku?.trim() || null,
      copias: 1,
      existencias: p.es_servicio ? 0 : Number(p.stock_actual) || 0,
    },
  ];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Productos marcados en la tabla: con ellos se arma la lista inicial. */
  seleccion: Producto[];
  /** Catalogo completo, para buscar y agregar mas. */
  productos: Producto[];
  variantesPorProducto: Record<string, VarianteProducto[]>;
  /** Generar y guardar codigos exige `inventory.manage`. */
  puedeGenerar: boolean;
  /** Tras guardar codigos nuevos: refrescar el catalogo. */
  onCodigosGenerados: () => void;
}

export function ImprimirEtiquetasDialog({
  open,
  onOpenChange,
  seleccion,
  productos,
  variantesPorProducto,
  puedeGenerar,
  onCodigosGenerados,
}: Props) {
  const { tenantId, tenantName, moneda } = useCurrentTenant();
  const t = useTranslations("products.labels");
  // La pagina monta esta ventana solo al abrirla: el estado inicial sale de la
  // seleccion de la tabla y del ultimo formato usado.
  const [renglones, setRenglones] = useState<Renglon[]>(() =>
    seleccion.flatMap((p) => renglonesDe(p, variantesPorProducto[p.id]))
  );
  const [busqueda, setBusqueda] = useState("");
  const [formatoId, setFormatoId] = useState<IdFormato>(formatoGuardado);
  const [inicio, setInicio] = useState(1);
  const [mostrarPrecio, setMostrarPrecio] = useState(true);
  const [mostrarSku, setMostrarSku] = useState(false);
  const [mostrarNegocio, setMostrarNegocio] = useState(false);
  const [confirmarGenerar, setConfirmarGenerar] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [descargando, setDescargando] = useState(false);

  const formato = formatoPorId(formatoId);
  const elegirFormato = (id: IdFormato) => {
    setFormatoId(id);
    setInicio(1);
    try {
      localStorage.setItem(FORMATO_GUARDADO, id);
    } catch {
      // Sin almacenamiento: no se recuerda, sin mas.
    }
  };

  const yaAgregados = useMemo(() => new Set(renglones.map((r) => r.clave)), [renglones]);
  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (q.length < 2) return [];
    return productos
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.codigo_barras?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [busqueda, productos]);

  const agregar = (p: Producto) => {
    const nuevos = renglonesDe(p, variantesPorProducto[p.id]).filter((r) => !yaAgregados.has(r.clave));
    setRenglones((prev) => [...prev, ...nuevos]);
    setBusqueda("");
  };

  const cambiarCopias = (clave: string, copias: number) =>
    setRenglones((prev) => prev.map((r) => (r.clave === clave ? { ...r, copias } : r)));
  const quitar = (clave: string) => setRenglones((prev) => prev.filter((r) => r.clave !== clave));
  const usarExistencias = () =>
    setRenglones((prev) => prev.map((r) => ({ ...r, copias: Math.max(0, Math.ceil(r.existencias)) })));

  const sinCodigo = renglones.filter((r) => !r.codigo);
  const total = totalEtiquetas(renglones);
  const hojas = formato.tipo === "hoja" ? Math.ceil((total + inicio - 1) / porPagina(formato)) : total;

  const generarFaltantes = async () => {
    if (!tenantId || sinCodigo.length === 0) return;
    setGenerando(true);
    try {
      const pedido: AsignacionCodigo[] = sinCodigo.map((r) => ({ tipo: r.tipo, id: r.id }));
      const { asignados, errores } = await asignarCodigosGenerados(tenantId, pedido);
      setRenglones((prev) =>
        prev.map((r) => (asignados.has(r.clave) ? { ...r, codigo: asignados.get(r.clave)! } : r))
      );
      if (asignados.size > 0) {
        toast.success(
          t("generated", { count: asignados.size })
        );
        onCodigosGenerados();
      }
      if (errores.length > 0) toast.error(t("saveErrors", { count: errores.length, error: errores[0] }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("generateError"));
    } finally {
      setGenerando(false);
      setConfirmarGenerar(false);
    }
  };

  const descargar = async () => {
    if (total === 0) return;
    setDescargando(true);
    try {
      const { generarPdfEtiquetas } = await import("./etiquetas-pdf");
      const blob = await generarPdfEtiquetas(
        renglones,
        formato,
        { mostrarPrecio, mostrarSku, negocio: mostrarNegocio ? tenantName || null : null, moneda },
        inicio
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `etiquetas-${formato.id}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success(t("pdfReady"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("pdfError"));
    } finally {
      setDescargando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* `minmax(0,1fr)`: sin el, la columna del grid crece al ancho de los nombres
          largos (con `truncate`) y en la hoja del celular el contenido se corria
          de lado. */}
      <DialogContent className="grid-cols-[minmax(0,1fr)] max-w-2xl sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{t("title")}</DialogTitle>
          <DialogDescription className="text-xs">
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        {/* Buscar y agregar */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("addPlaceholder")}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
          {resultados.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
              {resultados.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => agregar(p)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span className="truncate">{p.nombre}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {variantesPorProducto[p.id]?.length
                      ? t("variantsCount", { count: variantesPorProducto[p.id].length })
                      : p.codigo_barras || t("noCode")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lista */}
        {renglones.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {t("itemsCount", { count: renglones.length })} · {t("labelsCount", { count: total })}
              </p>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={usarExistencias}>
                <Boxes className="h-3.5 w-3.5" />
                {t("copiesStock")}
              </Button>
            </div>
            <div className="max-h-48 divide-y overflow-y-auto rounded-md border sm:max-h-56">
              {renglones.map((r) => (
                <div key={r.clave} className="flex items-center gap-2 px-2.5 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {r.nombre}
                      {r.detalle && <span className="font-normal text-muted-foreground"> · {r.detalle}</span>}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {textoPrecio(r.precio, r.unidad, moneda)} ·{" "}
                      {r.codigo ? (
                        <span className="font-mono">{r.codigo}</span>
                      ) : (
                        <span className="font-medium text-amber-600 dark:text-amber-400">{t("noCode")}</span>
                      )}
                    </p>
                  </div>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    aria-label={t("copiesOf", { nombre: r.nombre })}
                    value={r.copias}
                    onChange={(e) => cambiarCopias(r.clave, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                    className="h-7 w-16 text-center text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => quitar(r.clave)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={t("removeItem", { nombre: r.nombre })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {sinCodigo.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs">
                {!puedeGenerar ? (
                  <p>
                    {t("missingNoPermission", { count: sinCodigo.length })}
                  </p>
                ) : confirmarGenerar ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p>
                      {t("confirmGenerate", { count: sinCodigo.length })}
                    </p>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setConfirmarGenerar(false)}>
                        Cancelar
                      </Button>
                      <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={generarFaltantes} disabled={generando}>
                        {generando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {t("generateAndSave")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p>
                      {t("missing", { count: sinCodigo.length })}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => setConfirmarGenerar(true)}
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      {t("generateMissing")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Formato y opciones */}
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("format")}</Label>
              <SelectSimple
                value={formatoId}
                onChange={(v) => v && elegirFormato(v as IdFormato)}
                opciones={FORMATOS.map((f) => ({ value: f.id, label: t(`formats.${f.id}.name`) }))}
                ariaLabel={t("formatAria")}
              />
              <p className="text-[11px] text-muted-foreground">{t(`formats.${formato.id}.desc`)}</p>
            </div>
            {formato.tipo === "hoja" && (
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="inicio-etiqueta" className="shrink-0 text-xs">
                  {t("startAt")}
                </Label>
                <Input
                  id="inicio-etiqueta"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={porPagina(formato)}
                  value={inicio}
                  onChange={(e) =>
                    setInicio(Math.min(porPagina(formato), Math.max(1, Math.floor(Number(e.target.value) || 1))))
                  }
                  className="h-7 w-16 text-center text-sm"
                />
                <span className="text-[11px] text-muted-foreground">{t("startAtHint")}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <Opcion id="et-precio" etiqueta={t("optPrice")} valor={mostrarPrecio} onCambio={setMostrarPrecio} />
              <Opcion id="et-sku" etiqueta={t("optSku")} valor={mostrarSku} onCambio={setMostrarSku} />
              {formato.renglonesNombre > 0 && (
                <Opcion id="et-negocio" etiqueta={t("optBusiness")} valor={mostrarNegocio} onCambio={setMostrarNegocio} />
              )}
            </div>
          </div>
          <VistaPrevia
            formato={formato}
            renglon={renglones.find((r) => r.codigo) ?? renglones[0] ?? null}
            mostrarPrecio={mostrarPrecio}
            mostrarSku={mostrarSku}
            negocio={mostrarNegocio ? tenantName : null}
          />
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-[11px] text-muted-foreground">
            {total > 0 &&
              (formato.tipo === "hoja"
                ? t("sheets", { count: hojas })
                : t("onRoll", { count: total }))}
            {total > 0 && ` · ${t("print100")}`}
          </p>
          <SpecularActionButton tone="add" className="h-8 gap-1.5" onClick={descargar} disabled={total === 0 || descargando}>
            {descargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
            {t("download")}{total > 0 ? ` (${total})` : ""}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Opcion({
  id,
  etiqueta,
  valor,
  onCambio,
}: {
  id: string;
  etiqueta: string;
  valor: boolean;
  onCambio: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Checkbox id={id} checked={valor} onCheckedChange={(c) => onCambio(Boolean(c))} />
      <label htmlFor={id} className="cursor-pointer select-none text-xs">
        {etiqueta}
      </label>
    </div>
  );
}

/** Una etiqueta a escala (SVG, en mm) con las mismas barras que el PDF. */
function VistaPrevia({
  formato,
  renglon,
  mostrarPrecio,
  mostrarSku,
  negocio,
}: {
  formato: FormatoEtiqueta;
  renglon: Renglon | null;
  mostrarPrecio: boolean;
  mostrarSku: boolean;
  negocio: string | null;
}) {
  const t = useTranslations("products.labels");
  const { moneda } = useCurrentTenant();
  const { ancho: w, alto: h } = formato;
  const codigo = dibujarCodigo(renglon?.codigo);
  const pad = h >= 20 ? 1.6 : 0.9;
  const chica = formato.renglonesNombre === 0;
  const tam = { nombre: h >= 35 ? 3.2 : h >= 24 ? 2.7 : 2.1, precio: h >= 35 ? 4.6 : h >= 24 ? 3.7 : 2.6, digitos: h >= 24 ? 2.2 : 1.9 };
  let y = pad;
  const negocioY = negocio && !chica ? (y += 2) : null;
  const nombreY = !chica ? (y += tam.nombre) : null;
  const precioY = (y += tam.precio + 0.4);
  const barrasY = y + 0.8;
  const altoBarras = Math.max(2, h - pad - barrasY - tam.digitos - 0.3);
  const modulo = codigo ? Math.min(0.5, (w - pad * 2) / (codigo.modulos + 22)) : 0;
  const x0 = codigo ? (w - codigo.modulos * modulo) / 2 : 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-48 rounded-sm border bg-white shadow-sm"
        role="img"
        aria-label={t("previewAria")}
      >
        {renglon ? (
          <>
            {negocioY !== null && (
              <text x={w / 2} y={negocioY} fontSize={1.8} textAnchor="middle" fill="#000">
                {negocio!.toUpperCase().slice(0, 40)}
              </text>
            )}
            {nombreY !== null && (
              <text x={pad} y={nombreY} fontSize={tam.nombre} fontWeight="bold" fill="#000">
                {renglon.nombre.slice(0, Math.floor(w / (tam.nombre * 0.55)))}
              </text>
            )}
            {mostrarPrecio && (
              <text x={pad} y={precioY} fontSize={tam.precio} fontWeight="bold" fill="#000">
                {textoPrecio(renglon.precio, renglon.unidad, moneda)}
              </text>
            )}
            {mostrarSku && renglon.sku && (
              <text x={w - pad} y={precioY} fontSize={tam.nombre * 0.8} textAnchor="end" fill="#000">
                {renglon.sku}
              </text>
            )}
            {codigo &&
              codigo.barras.map((b, i) => (
                <rect key={i} x={x0 + b.x * modulo} y={barrasY} width={b.w * modulo} height={altoBarras} fill="#000" />
              ))}
            {codigo && (
              <text x={w / 2} y={barrasY + altoBarras + tam.digitos} fontSize={tam.digitos} textAnchor="middle" fill="#000">
                {codigo.texto}
              </text>
            )}
          </>
        ) : (
          <text x={w / 2} y={h / 2} fontSize={2.4} textAnchor="middle" fill="#999">
            {t("preview")}
          </text>
        )}
      </svg>
      <span className="text-[10px] text-muted-foreground">
        {w} × {h} mm
      </span>
    </div>
  );
}
