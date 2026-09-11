"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowRightLeft,
  Banknote,
  CreditCard,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useSaleSync } from "@/features/pos/hooks/use-sale-sync";
import {
  VariantPickerDialog,
  variantLabel,
  variantPrice,
} from "@/features/pos/components/variant-picker-dialog";
import { PendingSalesBanner } from "@/features/pos/components/pending-sales-banner";
import { enqueueSale } from "@/lib/offline/queue";
import { requestPersistentStorage } from "@/lib/offline/persist";

/**
 * Métodos de pago permitidos sin conexión.
 *
 * Se dejan fuera a propósito:
 *  - TARJETA_TERMINAL: MercadoPago Point necesita red por definición.
 *  - CREDITO: hay que validar `saldo_pendiente` del cliente contra el
 *    servidor; hacerlo con datos cacheados permitiría pasarse del límite
 *    de crédito sin que nada lo detecte hasta sincronizar.
 *  - TRANSFERENCIA: el cajero no puede confirmar que el dinero llegó.
 */
const OFFLINE_PAYMENT_METHODS = new Set(["EFECTIVO", "TARJETA"]);
import { completeSale } from "@/features/pos/services/pos-service";
import { useBarcodeScanner } from "@/features/pos/hooks/use-barcode-scanner";
import { useCashDrawer } from "@/features/pos/hooks/use-cash-drawer";
import { usePosCart } from "@/features/pos/hooks/use-pos-cart";
import { usePosCatalog } from "@/features/pos/hooks/use-pos-catalog";
import { CheckoutPanel } from "@/features/pos/components/checkout-panel";
import { ConfirmSaleDialog } from "@/features/pos/components/confirm-sale-dialog";
import { MobileCartBar } from "@/features/pos/components/mobile-cart-bar";
import { PosSearchBar } from "@/features/pos/components/pos-search-bar";
import { ProductGrid } from "@/features/pos/components/product-grid";
import { TerminalPaymentDialog } from "@/features/pos/components/terminal-payment-dialog";
import { TicketReceipt } from "@/features/pos/components/ticket-receipt";
import { NewCustomerDialog } from "@/features/customers/components/new-customer-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  MetodoPagoDirecto,
  Producto,
  SaleReceipt,
  VarianteProducto,
} from "@/features/pos/types/pos.types";

export default function POSPage() {
  const t = useTranslations();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const { items, totals, itemCount, includeIva, addItem, removeItem, updateQuantity, setIncludeIva, clearCart } =
    usePosCart(tenantId);
  const {
    products,
    variantsByProduct,
    customers,
    userId,
    loadingProducts,
    isOfflineCatalog,
    cajaId,
    refetch,
  } = usePosCatalog(tenantId, tenantLoading);
  const isOnline = useOnlineStatus();
  const saleSync = useSaleSync(tenantId);
  const [variantPickerFor, setVariantPickerFor] = useState<Producto | null>(null);

  // Pedir almacenamiento persistente al entrar al POS: es lo que reduce el
  // riesgo de que el navegador desaloje la cola de ventas sin subir.
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("none");
  const [selectedPayment, setSelectedPayment] = useState<string>("");
  const [montoRecibido, setMontoRecibido] = useState<string>("");
  const [processingSale, setProcessingSale] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [saleReceipt, setSaleReceipt] = useState<SaleReceipt | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Agrega ya resuelta la variante (o `null` para la venta general).
  const addResolved = useCallback(
    (product: Producto, variant: VarianteProducto | null) => {
      addItem({
        productId: product.id,
        varianteId: variant?.id ?? null,
        varianteLabel: variant ? variantLabel(variant) : null,
        nombre: product.nombre,
        cantidad: 1,
        // La variante tiene su propio precio; 0 significa "usa el del producto".
        precioUnitario: variant
          ? variantPrice(variant, product)
          : product.precio_venta,
        unidad_medida: product.unidad_medida,
      });
    },
    [addItem]
  );

  const handleAddProduct = useCallback(
    (product: Producto) => {
      const variants = variantsByProduct[product.id] ?? [];

      // Solo se pregunta si el producto TIENE variantes creadas. Uno marcado
      // como "permite variantes" pero sin ninguna (caso real: "Cafe") se vende
      // directo — obligar a elegir lo dejaría invendible.
      if (variants.length > 0) {
        setVariantPickerFor(product);
        return;
      }

      if (product.stock_actual <= 0) {
        toast.error("Sin stock disponible");
        return;
      }
      addResolved(product, null);
    },
    [variantsByProduct, addResolved]
  );

  const { search, setSearch, handleSearch, handleKeyDown } = useBarcodeScanner(
    products,
    handleAddProduct
  );

  const finalizeSale = useCallback(() => {
    clearCart();
    setSelectedCustomer("none");
    setSelectedPayment("");
    setShowConfirmDialog(false);
    setMobileCartOpen(false);
    void refetch();
  }, [clearCart, refetch]);

  const {
    mpReady,
    terminalOrder,
    terminalStatus,
    cancellingTerminal,
    startTerminalSale,
    handleCancelTerminal,
    closeTerminalDialog,
  } = useCashDrawer({
    tenantId,
    tenantReady: !tenantLoading,
    onSaleCompleted: finalizeSale,
    onTerminalStarted: () => setShowConfirmDialog(false),
  });

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          (selectedCategory === "all" || p.categoria === selectedCategory) &&
          (p.nombre.toLowerCase().includes(search.toLowerCase()) ||
            p.codigo_barras?.toLowerCase().includes(search.toLowerCase()) ||
            p.sku?.toLowerCase().includes(search.toLowerCase()))
      ),
    [products, selectedCategory, search]
  );

  const categories = useMemo(
    () =>
      Array.from(
        new Set(products.map((p) => p.categoria).filter(Boolean))
      ) as string[],
    [products]
  );

  const selectedCustomerObj =
    selectedCustomer === "none"
      ? null
      : customers.find((c) => c.id === selectedCustomer) ?? null;
  const customerName = selectedCustomerObj?.nombre ?? null;

  const isEfectivo = selectedPayment === "EFECTIVO";
  const montoRecibidoNum = montoRecibido === "" ? null : Number(montoRecibido);
  const cambio =
    isEfectivo && montoRecibidoNum != null && !Number.isNaN(montoRecibidoNum)
      ? Math.round((montoRecibidoNum - totals.total) * 100) / 100
      : null;
  const montoRecibidoInsuficiente =
    isEfectivo &&
    items.length > 0 &&
    (montoRecibidoNum == null || Number.isNaN(montoRecibidoNum) || montoRecibidoNum < totals.total);

  const handleCompleteSale = async () => {
    if (items.length === 0) return;
    if (!selectedPayment) {
      toast.error("Selecciona un método de pago");
      return;
    }
    // Sin red solo se permiten los métodos que el cajero puede confirmar por
    // sí mismo (ver OFFLINE_PAYMENT_METHODS).
    if (!isOnline && !OFFLINE_PAYMENT_METHODS.has(selectedPayment)) {
      toast.error(
        "Sin conexión solo puedes cobrar en efectivo o con tarjeta manual"
      );
      return;
    }

    if (selectedPayment === "CREDITO" && selectedCustomer === "none") {
      toast.error("Selecciona un cliente para la venta a crédito");
      return;
    }

    if (isEfectivo && montoRecibidoInsuficiente) {
      toast.error("El monto recibido debe ser al menos el total de la venta");
      return;
    }

    if (selectedPayment === "TARJETA_TERMINAL") {
      await startTerminalSale(
        selectedCustomer === "none" ? null : selectedCustomer,
        items
      );
      return;
    }

    setProcessingSale(true);
    try {
      const clienteId = selectedCustomer === "none" ? null : selectedCustomer;

      if (isOnline) {
        await completeSale({
          tenantId,
          userId,
          clienteId,
          metodoPago: selectedPayment as MetodoPagoDirecto,
          items,
          includeIva,
          montoRecibido: isEfectivo ? montoRecibidoNum : null,
        });
      } else {
        // Sin red: la venta se guarda en IndexedDB y se sube sola al volver la
        // conexión. `crypto.randomUUID()` genera la clave de idempotencia, que
        // es lo que garantiza que un reintento no cree una venta duplicada.
        await enqueueSale({
          idempotencyKey: crypto.randomUUID(),
          tenantId,
          userId,
          cajaId,
          clienteId,
          metodoPago: selectedPayment as MetodoPagoDirecto,
          items,
          includeIva,
          notas: null,
          montoRecibido: isEfectivo ? montoRecibidoNum : null,
          // El total que se le cobró al cliente. Al sincronizar, el servidor
          // recalcula desde el catálogo y marca la venta para revisión si el
          // precio cambió mientras estábamos sin red.
          totalCobrado: totals.total,
          createdAt: new Date().toISOString(),
        });
        await saleSync.refresh();
      }

      setSaleReceipt({
        items: [...items],
        total: totals.total,
        paymentMethod: selectedPayment,
        customerName,
        customerPhone: selectedCustomerObj?.telefono ?? null,
        montoRecibido: isEfectivo ? montoRecibidoNum : null,
        cambio: isEfectivo ? cambio : null,
      });
      toast.success(
        isOnline
          ? `Venta completada: $${totals.total.toFixed(2)}`
          : `Venta guardada sin conexión: $${totals.total.toFixed(2)} — se subirá sola`
      );
      clearCart();
      setSelectedCustomer("none");
      setSelectedPayment("");
      setMontoRecibido("");
      setShowConfirmDialog(false);
      setMobileCartOpen(false);
      if (isOnline) void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al procesar la venta");
    } finally {
      setProcessingSale(false);
    }
  };

  const paymentMethods = [
    { key: "EFECTIVO", label: t("pos.paymentMethods.CASH"), icon: Banknote },
    { key: "TARJETA", label: t("pos.paymentMethods.CARD"), icon: CreditCard },
    { key: "TRANSFERENCIA", label: t("pos.paymentMethods.TRANSFER"), icon: ArrowRightLeft },
    { key: "CREDITO", label: t("pos.paymentMethods.CREDIT"), icon: AlertTriangle },
    { key: "TARJETA_TERMINAL", label: t("pos.paymentMethods.TERMINAL"), icon: Smartphone },
  ];

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)] gap-3 lg:gap-5">
      {/* Left: Products grid / search */}
      <div className="flex-1 flex flex-col gap-3 lg:gap-4 min-h-0">
        <PendingSalesBanner
          pendingCount={saleSync.pendingCount}
          failedCount={saleSync.failedCount}
          syncing={saleSync.syncing}
          needsReauth={saleSync.needsReauth}
          oldestPendingAt={saleSync.oldestPendingAt}
          onSyncNow={() => void saleSync.syncNow()}
        />

        {isOfflineCatalog && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            Sin conexión: mostrando el catálogo guardado de la última vez que hubo
            internet. Las existencias que ves pueden estar desactualizadas.
          </div>
        )}

        <PosSearchBar
          search={search}
          onSearchChange={setSearch}
          onKeyDown={handleKeyDown}
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onSearchSubmit={handleSearch}
        />

        <ProductGrid
          products={filteredProducts}
          loading={loadingProducts}
          hasSearch={Boolean(search)}
          onAddProduct={handleAddProduct}
        />

        <MobileCartBar
          itemCount={itemCount}
          total={totals.total}
          onOpen={() => setMobileCartOpen(true)}
        />
      </div>

      {/* Right: Cart (desktop only — on mobile it lives in the bottom sheet below) */}
      <div className="hidden lg:flex lg:w-80 flex-col animate-fade-in-up stagger-2">
        <CheckoutPanel
          className="h-full"
          customers={customers}
          selectedCustomer={selectedCustomer}
          onSelectCustomer={setSelectedCustomer}
          onNewCustomer={() => setShowNewCustomerDialog(true)}
          items={items}
          totals={totals}
          itemCount={itemCount}
          includeIva={includeIva}
          onUpdateQuantity={updateQuantity}
          onRemove={removeItem}
          onToggleIva={setIncludeIva}
          paymentMethods={paymentMethods}
          selectedPayment={selectedPayment}
          onSelectPayment={(key) => {
            setSelectedPayment(key);
            if (key !== "EFECTIVO") setMontoRecibido("");
          }}
          mpReady={mpReady}
          isEfectivo={isEfectivo}
          montoRecibido={montoRecibido}
          onMontoRecibidoChange={setMontoRecibido}
          cambio={cambio}
          isOnline={isOnline}
          processingSale={processingSale}
          disabledComplete={
            items.length === 0 ||
            !selectedPayment ||
            processingSale ||
            montoRecibidoInsuficiente ||
            !isOnline
          }
          onCompleteSale={() => setShowConfirmDialog(true)}
          onClearCart={clearCart}
        />
      </div>

      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto p-0 lg:hidden">
          <SheetHeader className="pb-0 sticky top-0 z-10 bg-popover">
            <SheetTitle>{t("pos.cart")}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <CheckoutPanel
              customers={customers}
              selectedCustomer={selectedCustomer}
              onSelectCustomer={setSelectedCustomer}
              onNewCustomer={() => setShowNewCustomerDialog(true)}
              items={items}
              totals={totals}
              itemCount={itemCount}
              includeIva={includeIva}
              onUpdateQuantity={updateQuantity}
              onRemove={removeItem}
              onToggleIva={setIncludeIva}
              paymentMethods={paymentMethods}
              selectedPayment={selectedPayment}
              onSelectPayment={(key) => {
                setSelectedPayment(key);
                if (key !== "EFECTIVO") setMontoRecibido("");
              }}
              mpReady={mpReady}
              isEfectivo={isEfectivo}
              montoRecibido={montoRecibido}
              onMontoRecibidoChange={setMontoRecibido}
              cambio={cambio}
              isOnline={isOnline}
              processingSale={processingSale}
              disabledComplete={
                items.length === 0 ||
                !selectedPayment ||
                processingSale ||
                montoRecibidoInsuficiente ||
                !isOnline
              }
              onCompleteSale={() => setShowConfirmDialog(true)}
              onClearCart={clearCart}
            />
          </div>
        </SheetContent>
      </Sheet>

      <VariantPickerDialog
        product={variantPickerFor}
        variants={
          variantPickerFor ? (variantsByProduct[variantPickerFor.id] ?? []) : []
        }
        onOpenChange={(open) => !open && setVariantPickerFor(null)}
        onSelect={(variant) => {
          if (variantPickerFor) addResolved(variantPickerFor, variant);
          setVariantPickerFor(null);
        }}
      />

      <ConfirmSaleDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        items={items}
        totals={totals}
        selectedPayment={selectedPayment}
        customerName={customerName}
        processing={processingSale}
        includeIva={includeIva}
        montoRecibido={isEfectivo ? montoRecibidoNum : null}
        cambio={isEfectivo ? cambio : null}
        onConfirm={handleCompleteSale}
      />

      <TerminalPaymentDialog
        status={terminalStatus}
        order={terminalOrder}
        cancelling={cancellingTerminal}
        onCancel={() => void handleCancelTerminal()}
        onClose={() => void closeTerminalDialog()}
      />

      <NewCustomerDialog
        open={showNewCustomerDialog}
        onOpenChange={setShowNewCustomerDialog}
        tenantId={tenantId}
        onCreated={(customer) => {
          setSelectedCustomer(customer.id);
          void refetch();
        }}
      />

      <TicketReceipt
        open={saleReceipt !== null}
        onOpenChange={(open) => {
          if (!open) setSaleReceipt(null);
        }}
        receipt={saleReceipt}
      />
    </div>
  );
}