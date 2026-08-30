"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowRightLeft,
  Banknote,
  CreditCard,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { completeSale } from "@/features/pos/services/pos-service";
import { useBarcodeScanner } from "@/features/pos/hooks/use-barcode-scanner";
import { useCashDrawer } from "@/features/pos/hooks/use-cash-drawer";
import { usePosCart } from "@/features/pos/hooks/use-pos-cart";
import { usePosCatalog } from "@/features/pos/hooks/use-pos-catalog";
import { ConfirmSaleDialog } from "@/features/pos/components/confirm-sale-dialog";
import { PaymentMethodPicker } from "@/features/pos/components/payment-method-picker";
import { PosCart } from "@/features/pos/components/pos-cart";
import { PosSearchBar } from "@/features/pos/components/pos-search-bar";
import { ProductGrid } from "@/features/pos/components/product-grid";
import { TerminalPaymentDialog } from "@/features/pos/components/terminal-payment-dialog";
import { TicketReceipt } from "@/features/pos/components/ticket-receipt";
import { CustomerSelector } from "@/features/customers/components/customer-selector";
import { NewCustomerDialog } from "@/features/customers/components/new-customer-dialog";
import type { MetodoPagoDirecto, Producto, SaleReceipt } from "@/features/pos/types/pos.types";

export default function POSPage() {
  const t = useTranslations();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const { items, totals, itemCount, includeIva, addItem, removeItem, updateQuantity, setIncludeIva, clearCart } =
    usePosCart();
  const { products, customers, userId, loadingProducts, refetch } = usePosCatalog(
    tenantId,
    tenantLoading
  );

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("none");
  const [selectedPayment, setSelectedPayment] = useState<string>("");
  const [montoRecibido, setMontoRecibido] = useState<string>("");
  const [processingSale, setProcessingSale] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [saleReceipt, setSaleReceipt] = useState<SaleReceipt | null>(null);

  const handleAddProduct = useCallback(
    (product: Producto) => {
      if (product.stock_actual <= 0) {
        toast.error("Sin stock disponible");
        return;
      }
      addItem({
        productId: product.id,
        nombre: product.nombre,
        cantidad: 1,
        precioUnitario: product.precio_venta,
        unidad_medida: product.unidad_medida,
      });
    },
    [addItem]
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

  const customerName =
    selectedCustomer === "none"
      ? null
      : customers.find((c) => c.id === selectedCustomer)?.nombre ?? null;

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
      await completeSale({
        tenantId,
        userId,
        clienteId: selectedCustomer === "none" ? null : selectedCustomer,
        metodoPago: selectedPayment as MetodoPagoDirecto,
        items,
        includeIva,
        montoRecibido: isEfectivo ? montoRecibidoNum : null,
      });

      setSaleReceipt({
        items: [...items],
        total: totals.total,
        paymentMethod: selectedPayment,
        customerName,
        montoRecibido: isEfectivo ? montoRecibidoNum : null,
        cambio: isEfectivo ? cambio : null,
      });
      toast.success(`Venta completada: $${totals.total.toFixed(2)}`);
      clearCart();
      setSelectedCustomer("none");
      setSelectedPayment("");
      setMontoRecibido("");
      setShowConfirmDialog(false);
      void refetch();
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
      </div>

      {/* Right: Cart */}
      <div className="w-full lg:w-80 flex flex-col animate-fade-in-up stagger-2">
        <CustomerSelector
          customers={customers}
          selectedCustomer={selectedCustomer}
          onSelectCustomer={setSelectedCustomer}
          onNewCustomer={() => setShowNewCustomerDialog(true)}
        />

        <PosCart
          items={items}
          totals={totals}
          itemCount={itemCount}
          includeIva={includeIva}
          onUpdateQuantity={updateQuantity}
          onRemove={removeItem}
          onToggleIva={setIncludeIva}
        />

        <PaymentMethodPicker
          methods={paymentMethods}
          selectedPayment={selectedPayment}
          onSelect={(key) => {
            setSelectedPayment(key);
            if (key !== "EFECTIVO") setMontoRecibido("");
          }}
          mpReady={mpReady}
        />

        {isEfectivo && (
          <div className="mt-2 space-y-1.5">
            <label className="text-xs text-muted-foreground">
              {t("pos.amountReceived")}
            </label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="$0.00"
              value={montoRecibido}
              onChange={(e) => setMontoRecibido(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {cambio != null && (
              <div className="flex justify-between text-xs font-medium">
                <span className="text-muted-foreground">{t("pos.change")}</span>
                <span className="font-mono">
                  ${Math.max(0, cambio).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}

        <Button
          className="mt-3 w-full h-9 active:scale-[0.98] transition-transform"
          size="sm"
          disabled={
            items.length === 0 ||
            !selectedPayment ||
            processingSale ||
            montoRecibidoInsuficiente
          }
          onClick={() => setShowConfirmDialog(true)}
        >
          {processingSale ? t("common.loading") : t("pos.completeSale")}
        </Button>

        <Button
          variant="ghost"
          className="mt-1.5 w-full h-8 text-xs text-muted-foreground"
          size="sm"
          onClick={clearCart}
          disabled={items.length === 0}
        >
          {t("pos.clearCart")}
        </Button>
      </div>

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