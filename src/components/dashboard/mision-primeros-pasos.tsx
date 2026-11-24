"use client";

import { useState, useEffect, useCallback } from "react";
import { Link } from "@/i18n/navigation";
import { toast } from "sonner";
import {
  Rocket,
  CheckCircle2,
  Circle,
  Sparkles,
  Zap,
  PlusCircle,
  FileSpreadsheet,
  Wallet,
  ShoppingCart,
  Loader2,
  ArrowRight,
  PartyPopper,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useOpenRegister } from "@/features/cash-register/hooks/use-open-register";
import { abrirCaja } from "@/features/cash-register/hooks/use-cash-register";
import { useSucursal } from "@/contexts/sucursal-context";
import {
  insertarProductosMuestra,
  crearProductoRapido,
} from "@/features/inventory/services/catalogos-muestra";

interface MisionPrimerosPasosProps {
  tenantId: string;
  tenantGiro: string | null;
  totalVentas: number;
  onActualizar: () => void;
}

export function MisionPrimerosPasos({
  tenantId,
  tenantGiro,
  totalVentas,
  onActualizar,
}: MisionPrimerosPasosProps) {
  const { hasOpenRegister } = useOpenRegister(tenantId);
  const { seleccionada: sucursalId } = useSucursal();

  const [productosCount, setProductosCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(true);
  const [insertandoMuestras, setInsertandoMuestras] = useState(false);
  const [abriendoCaja, setAbriendoCaja] = useState(false);

  // Modal de producto rápido
  const [dialogRapido, setDialogRapido] = useState(false);
  const [nombreRapido, setNombreRapido] = useState("");
  const [precioRapido, setPrecioRapido] = useState("");
  const [guardandoRapido, setGuardandoRapido] = useState(false);

  // Ocultar si ya se terminó y el usuario lo cierra
  const [dismissed, setDismissed] = useState(false);

  const fetchProductosCount = useCallback(async () => {
    if (!tenantId) return;
    const supabase = createSupabaseBrowserClient();
    const { count, error } = await supabase
      .from("productos")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("archivado_en", null);

    if (!error) {
      setProductosCount(count ?? 0);
    }
    setLoadingCount(false);
  }, [tenantId]);

  useEffect(() => {
    fetchProductosCount();
  }, [fetchProductosCount]);

  const handleCargarMuestras = async () => {
    if (!tenantId || insertandoMuestras) return;
    setInsertandoMuestras(true);
    try {
      const res = await insertarProductosMuestra(tenantId, tenantGiro);
      if (res.ok) {
        toast.success(`¡${res.count} productos de prueba agregados exitosamente!`);
        await fetchProductosCount();
        onActualizar();
      } else {
        toast.error(res.error || "No se pudieron cargar los productos muestra");
      }
    } finally {
      setInsertandoMuestras(false);
    }
  };

  const handleGuardarProductoRapido = async () => {
    if (!nombreRapido.trim()) {
      toast.error("Ingresa el nombre del producto");
      return;
    }
    const precio = parseFloat(precioRapido);
    if (!(precio > 0)) {
      toast.error("Ingresa un precio de venta mayor a $0");
      return;
    }

    setGuardandoRapido(true);
    try {
      const res = await crearProductoRapido(tenantId, {
        nombre: nombreRapido,
        precio_venta: precio,
      });
      if (res.ok) {
        toast.success("Producto creado exitosamente");
        setDialogRapido(false);
        setNombreRapido("");
        setPrecioRapido("");
        await fetchProductosCount();
        onActualizar();
      } else {
        toast.error(res.error || "Error al crear el producto");
      }
    } finally {
      setGuardandoRapido(false);
    }
  };

  const handleAbrirCajaRapida = async (monto: number = 0) => {
    if (!tenantId || abriendoCaja) return;
    setAbriendoCaja(true);
    try {
      const caja = await abrirCaja(tenantId, monto, sucursalId);
      if (caja) {
        onActualizar();
      }
    } finally {
      setAbriendoCaja(false);
    }
  };

  const paso1Completo = (productosCount ?? 0) > 0;
  const paso2Completo = hasOpenRegister;
  const paso3Completo = totalVentas > 0;

  const pasosCompletados =
    (paso1Completo ? 1 : 0) + (paso2Completo ? 1 : 0) + (paso3Completo ? 1 : 0);
  const progresoPct = Math.round((pasosCompletados / 3) * 100);

  // Si ya tiene ventas y decidió ocultarlo
  if (dismissed) return null;

  return (
    <>
      <Card className="overflow-hidden border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm">
        {/* Encabezado de la Misión */}
        <div className="border-b border-primary/10 bg-primary/5 px-4 py-3.5 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                {pasosCompletados === 3 ? (
                  <PartyPopper className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Rocket className="h-5 w-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {pasosCompletados === 3
                      ? "¡Misión cumplida! Tu negocio está listo"
                      : "Misión: Empieza a vender en 3 minutos"}
                  </h3>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    {pasosCompletados}/3 completados
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pasosCompletados === 3
                    ? "Ya registraste productos, abriste caja y cobraste tu primera venta."
                    : "Completa estos 3 pasos clave para activar tu punto de venta."}
                </p>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="flex items-center gap-3 self-end sm:self-center">
              <div className="w-28 sm:w-36 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    pasosCompletados === 3
                      ? "bg-emerald-500"
                      : "bg-primary"
                  }`}
                  style={{ width: `${progresoPct}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-muted-foreground w-9 text-right">
                {progresoPct}%
              </span>
              {pasosCompletados === 3 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setDismissed(true)}
                  title="Cerrar guía"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Lista de Pasos */}
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {/* PASO 1 */}
            <div
              className={`rounded-xl border p-4 transition-all ${
                paso1Completo
                  ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/10"
                  : "border-border bg-card shadow-xs"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  {paso1Completo ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <h4 className="text-xs font-semibold">1. Inventario</h4>
                </div>
                {paso1Completo && (
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    {productosCount} prod.
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground mb-3">
                {paso1Completo
                  ? "Catálogo listo con productos disponibles para cobrar."
                  : "Carga tus productos para tener qué escanear y cobrar en el POS."}
              </p>

              {!paso1Completo && (
                <div className="space-y-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    className="w-full h-8 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                    onClick={handleCargarMuestras}
                    disabled={insertandoMuestras || loadingCount}
                  >
                    {insertandoMuestras ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Cargando...
                      </>
                    ) : (
                      <>
                        <Zap className="h-3 w-3 mr-1 text-amber-300" />
                        Cargar 3 productos muestra (1 clic)
                      </>
                    )}
                  </Button>

                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-[11px] cursor-pointer"
                      onClick={() => setDialogRapido(true)}
                    >
                      <PlusCircle className="h-3 w-3 mr-1 text-muted-foreground" />
                      Crear 1 rápido
                    </Button>
                    <Link
                      href="/products"
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                        className: "h-7 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer px-2",
                      })}
                    >
                      <FileSpreadsheet className="h-3 w-3 mr-1" />
                      Excel
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* PASO 2 */}
            <div
              className={`rounded-xl border p-4 transition-all ${
                paso2Completo
                  ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/10"
                  : "border-border bg-card shadow-xs"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  {paso2Completo ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <h4 className="text-xs font-semibold">2. Caja de Cobro</h4>
                </div>
                {paso2Completo && (
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    Abierta
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground mb-3">
                {paso2Completo
                  ? "Tu caja está abierta. Cada cobro se registrará para tu corte."
                  : "Abre caja con tu fondo para registrar los movimientos del día."}
              </p>

              {!paso2Completo && (
                <div className="space-y-1.5 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs font-medium border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                    onClick={() => handleAbrirCajaRapida(0)}
                    disabled={abriendoCaja}
                  >
                    {abriendoCaja ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Abriendo...
                      </>
                    ) : (
                      <>
                        <Wallet className="h-3 w-3 mr-1" />
                        Abrir caja rápida con $0
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="w-full h-7 text-[11px] text-muted-foreground cursor-pointer"
                    onClick={() => handleAbrirCajaRapida(500)}
                    disabled={abriendoCaja}
                  >
                    Abrir con $500 de fondo
                  </Button>
                </div>
              )}
            </div>

            {/* PASO 3 */}
            <div
              className={`rounded-xl border p-4 transition-all ${
                paso3Completo
                  ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/10"
                  : "border-border bg-card shadow-xs"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  {paso3Completo ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <h4 className="text-xs font-semibold">3. Primer Cobro</h4>
                </div>
                {paso3Completo && (
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    {totalVentas} venta(s)
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground mb-3">
                {paso3Completo
                  ? "¡Felicidades! Ya realizaste ventas desde el Punto de Venta."
                  : "Ve al POS, agrega un producto al carrito y presiona Cobrar."}
              </p>

              <div className="pt-1">
                <Link
                  href="/pos"
                  className={buttonVariants({
                    variant: paso3Completo ? "outline" : "default",
                    size: "sm",
                    className: `w-full h-8 text-xs font-medium cursor-pointer ${
                      paso3Completo
                        ? ""
                        : "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
                    }`,
                  })}
                >
                  <ShoppingCart className="h-3 w-3 mr-1.5" />
                  {paso3Completo ? "Ir al Punto de Venta" : "Cobrar primera venta"}
                  <ArrowRight className="h-3 w-3 ml-auto" />
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal Express: Crear 1 Producto Rápido */}
      <Dialog open={dialogRapido} onOpenChange={setDialogRapido}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Crear producto en 30 segundos
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Solo ingresa el nombre y precio. Podrás editar categorías o códigos de barras más adelante.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Nombre del producto *
              </label>
              <Input
                placeholder="Ej. Coca-Cola 600ml, Martillo 16oz, Paracetamol"
                value={nombreRapido}
                onChange={(e) => setNombreRapido(e.target.value)}
                disabled={guardandoRapido}
                className="h-9 text-sm"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Precio de venta al público *
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="0.00"
                  value={precioRapido}
                  onChange={(e) => setPrecioRapido(e.target.value)}
                  disabled={guardandoRapido}
                  className="pl-6 h-9 text-sm"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialogRapido(false)}
              disabled={guardandoRapido}
              className="h-8 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleGuardarProductoRapido}
              disabled={guardandoRapido}
              className="h-8 text-xs bg-primary text-primary-foreground"
            >
              {guardandoRapido ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar y agregar al catálogo"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
