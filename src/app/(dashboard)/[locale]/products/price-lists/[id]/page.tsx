"use client";

import { BotonActualizar } from "@/components/ui/boton-actualizar";
import { useTranslations } from "next-intl";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { ArrowLeft, Info, Pencil, Plus, Search } from "lucide-react";
import { BotonEliminar } from "@/components/ui/boton-eliminar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { usePriceList } from "@/features/inventory/hooks/use-price-lists";
import { ProductPicker } from "@/features/inventory/components/price-lists/product-picker";
import { BulkPriceDialog } from "@/features/inventory/components/price-lists/bulk-price-dialog";
import { EditableTextCell } from "@/features/inventory/components/products/editable-cell";
import {
  aplicarPorcentaje,
  CLAVE_ERROR_PRECIO,
  claveFila,
  construirFilas,
  parsearPrecio,
  type Direccion,
  type FilaSeleccionable,
} from "@/features/inventory/price-list";
import { fetchProducts } from "@/features/inventory/services/product-service";
import { fetchVariantsForPricing } from "@/features/inventory/services/price-list-service";
import { useMoneda } from "@/hooks/use-moneda";
import { toast } from "sonner";

export default function PriceListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { formatear } = useMoneda();
  const { id } = use(params);
  const t = useTranslations("products.priceLists");
  const te = useTranslations("products.priceLists.errors");
  const errorPrecio = (error: string) =>
    error in CLAVE_ERROR_PRECIO ? te(CLAVE_ERROR_PRECIO[error]) : error;
  const router = useRouter();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const { lista, items, loading, saving, refetch, agregar, quitar, guardarPrecios, activar } =
    usePriceList(id);

  const [catalogo, setCatalogo] = useState<FilaSeleccionable[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [soloSinPrecio, setSoloSinPrecio] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set());
  const [agregando, setAgregando] = useState(false);
  const [aAgregar, setAAgregar] = useState<Set<string>>(() => new Set());
  const [porcentajeAbierto, setPorcentajeAbierto] = useState(false);

  // El catálogo completo con variantes: la lista puede incluir tallas sueltas.
  useEffect(() => {
    if (tenantLoading || !tenantId) return;
    const timer = window.setTimeout(() => {
      void Promise.all([fetchProducts(tenantId), fetchVariantsForPricing(tenantId)]).then(
        ([productos, variantes]) => setCatalogo(construirFilas(productos, variantes))
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [tenantId, tenantLoading]);

  const porClave = useMemo(
    () => new Map(catalogo.map((f) => [f.clave, f])),
    [catalogo]
  );

  /** Los renglones de la lista, cruzados con el catálogo para tener nombre y precio base. */
  const filas = useMemo(
    () =>
      items
        .map((i) => {
          const base = porClave.get(claveFila(i.producto_id, i.variante_id));
          return base ? { ...base, precio: i.precio } : null;
        })
        // Un producto borrado del catálogo deja su renglón huérfano: se omite en
        // vez de pintar una fila sin nombre ni precio.
        .filter((f): f is FilaSeleccionable & { precio: number | null } => f !== null)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [items, porClave]
  );

  const yaEnLista = useMemo(() => new Set(filas.map((f) => f.clave)), [filas]);
  const sinPrecio = filas.filter((f) => f.precio === null).length;

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter(
      (f) =>
        (!soloSinPrecio || f.precio === null) &&
        (!q || f.busqueda.toLowerCase().includes(q))
    );
  }, [filas, busqueda, soloSinPrecio]);

  const marcadas = visibles.filter((f) => seleccion.has(f.clave)).length;
  const todas = visibles.length > 0 && marcadas === visibles.length;

  const alternar = useCallback((clave: string) => {
    setSeleccion((prev) => {
      const s = new Set(prev);
      if (s.has(clave)) s.delete(clave);
      else s.add(clave);
      return s;
    });
  }, []);

  function aplicarPorcentajeA(
    porcentaje: number,
    direccion: Direccion,
    redondear: boolean
  ) {
    const objetivo = filas.filter((f) => seleccion.has(f.clave));
    const cambios = [];
    for (const f of objetivo) {
      const r = aplicarPorcentaje(f.precio_base, porcentaje, direccion, redondear);
      if (!r.ok) {
        toast.error(errorPrecio(r.error));
        return;
      }
      cambios.push({
        producto_id: f.producto_id,
        variante_id: f.variante_id,
        precio: r.precio,
      });
    }
    void guardarPrecios(cambios);
    setPorcentajeAbierto(false);
    toast.success(t("pricesUpdated", { count: cambios.length }));
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1 h-7 text-xs text-muted-foreground"
            onClick={() => router.push("/products/price-lists")}
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            {t("title")}
          </Button>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            {lista?.nombre ?? t("detail.fallbackName")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("products", { count: filas.length })}
            {" · "}
            {lista?.activa ? t("active") : t("draft")}
          </p>
        </div>
        <div className="flex gap-2">
          <BotonActualizar onActualizar={refetch} />
          <Button
            variant={lista?.activa ? "outline" : "default"}
            size="sm"
            className="h-8"
            onClick={() => void activar(!lista?.activa)}
            disabled={loading}
          >
            {lista?.activa ? t("detail.deactivateList") : t("detail.saveAndActivate")}
          </Button>
        </div>
      </div>

      {/* El aviso es importante: sin él, alguien sube el precio base de un
          producto y da por hecho que su liquidación se movió sola. */}
      <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground animate-fade-in-up stagger-2">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t("detail.notice")}
      </p>

      <div className="flex flex-wrap items-center gap-2 animate-fade-in-up stagger-2">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={t("detail.search")}
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Chip activo={!soloSinPrecio} onClick={() => setSoloSinPrecio(false)}>
          {t("detail.all")} {filas.length}
        </Chip>
        <Chip activo={soloSinPrecio} onClick={() => setSoloSinPrecio(true)}>
          {t("detail.noPrice")} {sinPrecio}
        </Chip>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setPorcentajeAbierto(true)}
          disabled={marcadas === 0}
          title={
            marcadas === 0 ? t("detail.selectToUpdate") : undefined
          }
        >
          <Pencil className="mr-1 h-3.5 w-3.5" />
          {t("detail.updateAll")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => {
            setAAgregar(new Set());
            setAgregando(true);
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t("detail.addProducts")}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border animate-fade-in-up stagger-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={todas}
                  indeterminate={marcadas > 0 && !todas}
                  onCheckedChange={() =>
                    setSeleccion(
                      todas ? new Set() : new Set(visibles.map((f) => f.clave))
                    )
                  }
                  disabled={visibles.length === 0}
                />
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wider">
                {t("detail.colName")}
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wider">
                {t("detail.colCategory")}
              </TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wider">
                {t("detail.colBase")}
              </TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wider">
                {t("detail.colListPrice")}
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  {t("loading")}
                </TableCell>
              </TableRow>
            ) : visibles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  {filas.length === 0
                    ? t("detail.emptyList")
                    : t("picker.noResults")}
                </TableCell>
              </TableRow>
            ) : (
              visibles.map((f) => (
                <TableRow key={f.clave}>
                  <TableCell>
                    <Checkbox
                      checked={seleccion.has(f.clave)}
                      onCheckedChange={() => alternar(f.clave)}
                    />
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {f.nombre}
                    {f.sufijo && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {f.sufijo}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {f.categoria ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {formatear(f.precio_base)}
                  </TableCell>
                  <TableCell className="text-right">
                    <EditableTextCell
                      canEdit
                      hint={t("detail.editHint")}
                      value={f.precio === null ? "" : String(f.precio)}
                      numerico
                      className="text-right font-mono tabular-nums"
                      onCommit={(texto) => {
                        const r = parsearPrecio(texto);
                        if (!r.ok) {
                          toast.error(errorPrecio(r.error));
                          return;
                        }
                        if (r.precio === f.precio) return;
                        void guardarPrecios([
                          {
                            producto_id: f.producto_id,
                            variante_id: f.variante_id,
                            precio: r.precio,
                          },
                        ]);
                      }}
                    >
                      {f.precio === null ? (
                        <span className="flex items-center justify-end gap-1.5 text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                          {t("detail.notDefined")}
                        </span>
                      ) : (
                        formatear(f.precio)
                      )}
                    </EditableTextCell>
                  </TableCell>
                  <TableCell>
                    {/* Quita el precio especial de la lista (el producto sigue
                        existiendo): mantener presionado confirma. */}
                    <BotonEliminar
                      nombre={t("detail.removeName", { nombre: f.nombre })}
                      onEliminar={() => quitar(f.producto_id, f.variante_id)}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <BulkPriceDialog
        open={porcentajeAbierto}
        onOpenChange={setPorcentajeAbierto}
        cuantas={marcadas}
        saving={saving}
        onApply={aplicarPorcentajeA}
      />

      <Dialog open={agregando} onOpenChange={setAgregando}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{t("detail.addProducts")}</DialogTitle>
          </DialogHeader>
          <ProductPicker
            filas={catalogo}
            seleccion={aAgregar}
            yaEnLista={yaEnLista}
            onToggle={(clave) =>
              setAAgregar((prev) => {
                const s = new Set(prev);
                if (s.has(clave)) s.delete(clave);
                else s.add(clave);
                return s;
              })
            }
            onToggleTodos={(claves, marcar) =>
              setAAgregar((prev) => {
                const s = new Set(prev);
                for (const c of claves) {
                  if (marcar) s.add(c);
                  else s.delete(c);
                }
                return s;
              })
            }
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAgregando(false)} disabled={saving}>
              {t("cancel")}
            </Button>
            <Button
              disabled={aAgregar.size === 0 || saving}
              onClick={() => {
                const renglones = [...aAgregar]
                  .map((c) => porClave.get(c))
                  .filter((f): f is FilaSeleccionable => !!f)
                  .map((f) => ({
                    producto_id: f.producto_id,
                    variante_id: f.variante_id,
                  }));
                void agregar(renglones).then(() => setAgregando(false));
              }}
            >
              {saving ? t("detail.adding") : t("detail.continueN", { n: aAgregar.size })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs transition-colors ${
        activo
          ? "border-primary bg-primary/10 text-primary"
          : "border-border hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
