"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useCartStore } from "@/stores/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Minus, ShoppingCart, Search, User, CreditCard, Banknote, ArrowRightLeft, AlertTriangle, Check, UserPlus } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { completeSale, calculateSaleTotals } from "@/lib/supabase/sales";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import type { Producto, Cliente } from "@/lib/types/database";
import { USOS_CFDI } from "@/lib/cfdi/catalogs";

export default function POSPage() {
  const t = useTranslations();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getSubtotal,
    getDiscount,
    getTotal,
    getItemCount,
  } = useCartStore();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [products, setProducts] = useState<Producto[]>([]);
  const [customers, setCustomers] = useState<Cliente[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("none");
  const [selectedPayment, setSelectedPayment] = useState<string>("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [processingSale, setProcessingSale] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [userId, setUserId] = useState<string>("");

  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    nombre: "",
    telefono: "",
    email: "",
    rfc: "",
    razon_social: "",
    regimen_fiscal_receptor: "",
    uso_cfdi: "",
    codigo_postal: "",
  });

  const fetchProductsAndUser = useCallback(async () => {
    if (!tenantId) return;
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [productsResult, customersResult] = await Promise.all([
      supabase
        .from("productos")
        .select("*")
        .eq("tenant_id", tenantId)
        .gt("stock_actual", 0)
        .order("nombre"),
      supabase
        .from("clientes")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("nombre"),
    ]);

    if (productsResult.data) setProducts(productsResult.data);
    if (customersResult.data) setCustomers(customersResult.data);
    setLoadingProducts(false);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantLoading) {
      fetchProductsAndUser();
    }
  }, [tenantLoading, fetchProductsAndUser]);

  const handleCreateCustomer = async () => {
    if (!tenantId) return;
    if (!newCustomer.nombre.trim()) {
      toast.error("El nombre del cliente es requerido");
      return;
    }
    setSavingCustomer(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("clientes")
        .insert({
          tenant_id: tenantId,
          nombre: newCustomer.nombre.trim(),
          telefono: newCustomer.telefono || null,
          email: newCustomer.email || null,
          rfc: newCustomer.rfc?.trim() || null,
          razon_social: newCustomer.razon_social?.trim() || null,
          regimen_fiscal_receptor: newCustomer.regimen_fiscal_receptor || null,
          uso_cfdi: newCustomer.uso_cfdi || null,
          codigo_postal: newCustomer.codigo_postal || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Cliente ${data.nombre} creado`);
      setSelectedCustomer(data.id);
      setShowNewCustomerDialog(false);
      setNewCustomer({
        nombre: "",
        telefono: "",
        email: "",
        rfc: "",
        razon_social: "",
        regimen_fiscal_receptor: "",
        uso_cfdi: "",
        codigo_postal: "",
      });
      fetchProductsAndUser();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Error al crear el cliente");
    } finally {
      setSavingCustomer(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      (selectedCategory === "all" || p.categoria === selectedCategory) &&
      (p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo_barras?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()))
  );

  const categories = Array.from(new Set(products.map((p) => p.categoria).filter(Boolean))) as string[];

  const handleAddProduct = (product: Producto) => {
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
  };

  const handleBarcodeSearch = async () => {
    if (!search.trim()) return;

    const match = products.find(
      (p) => p.codigo_barras?.toLowerCase() === search.trim().toLowerCase()
    );

    if (match) {
      handleAddProduct(match);
      setSearch("");
      toast.success(`${match.nombre} agregado`);
    } else {
      toast.error("Producto no encontrado");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBarcodeSearch();
    }
  };

  const totals = calculateSaleTotals(items);

  const handleCompleteSale = async () => {
    if (items.length === 0) return;
    if (!selectedPayment) {
      toast.error("Selecciona un método de pago");
      return;
    }

    setProcessingSale(true);
    try {
      await completeSale({
        tenantId,
        userId,
        clienteId: selectedCustomer === "none" ? null : selectedCustomer,
        metodoPago: selectedPayment as "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "CREDITO",
        items,
      });

      toast.success(`Venta completada: $${totals.total.toFixed(2)}`);
      clearCart();
      setSelectedCustomer("none");
      setSelectedPayment("");
      setShowConfirmDialog(false);
      fetchProductsAndUser();
    } catch (error: any) {
      toast.error(error.message || "Error al procesar la venta");
    } finally {
      setProcessingSale(false);
    }
  };

  const paymentMethods = [
    { key: "EFECTIVO", label: t("pos.paymentMethods.CASH"), icon: Banknote },
    { key: "TARJETA", label: t("pos.paymentMethods.CARD"), icon: CreditCard },
    { key: "TRANSFERENCIA", label: t("pos.paymentMethods.TRANSFER"), icon: ArrowRightLeft },
    { key: "CREDITO", label: t("pos.paymentMethods.CREDIT"), icon: AlertTriangle },
  ];

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)] gap-3 lg:gap-5">
      {/* Left: Products grid / search */}
      <div className="flex-1 flex flex-col gap-3 lg:gap-4 min-h-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 animate-fade-in-up stagger-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("pos.barcodePlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-8 h-9"
            />
          </div>
          {categories.length > 0 && (
            <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v ?? "all")}>
              <SelectTrigger className="w-full sm:w-40 h-9">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button className="h-9" size="sm" onClick={handleBarcodeSearch}>
            {t("pos.addItem")}
          </Button>
        </div>

        {/* Product grid */}
        <div className="flex-1 rounded-lg border border-border bg-card p-4 overflow-y-auto animate-fade-in-up stagger-2">
          {loadingProducts ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 h-full">
              <ShoppingCart className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {search ? "No se encontraron productos" : "No hay productos disponibles"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {filteredProducts.map((product, index) => (
                <button
                  key={product.id}
                  onClick={() => handleAddProduct(product)}
                  className="flex flex-col items-start p-3 rounded-lg border border-border bg-background hover:bg-accent hover:border-accent-foreground/20 transition-all duration-150 text-left animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                >
                  <span className="text-sm font-medium truncate w-full">{product.nombre}</span>
                  <span className="text-xs text-muted-foreground font-mono mt-1">
                    ${product.precio_venta.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    Stock: {product.stock_actual}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-full lg:w-80 flex flex-col animate-fade-in-up stagger-2">
        {/* Customer selector */}
        <div className="mb-3">
          <Label className="text-xs text-muted-foreground mb-1 block">
            <User className="inline h-3 w-3 mr-1" />
            Cliente (opcional)
          </Label>
          <div className="flex gap-1.5">
            <Select value={selectedCustomer} onValueChange={(v) => setSelectedCustomer(v ?? "none")}>
              <SelectTrigger className="h-8 text-sm flex-1">
                <SelectValue placeholder="Cliente general" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Cliente general</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={() => setShowNewCustomerDialog(true)}
              title="Nuevo cliente"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card className="flex-1 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              <span>{t("pos.cart")}</span>
              <span className="text-xs font-normal text-muted-foreground font-mono">
                {getItemCount()}
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col overflow-hidden pt-0">
            {items.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">{t("pos.emptyCart")}</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3">
                {items.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between gap-2 py-1 animate-fade-in-up"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.nombre}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        ${item.precioUnitario.toFixed(2)} x {item.cantidad}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          updateQuantity(item.productId, item.cantidad - 1)
                        }
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-xs font-mono">
                        {item.cantidad}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          updateQuantity(item.productId, item.cantidad + 1)
                        }
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(item.productId)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Totals */}
            {items.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <Separator />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t("pos.subtotal")}</span>
                  <span className="font-mono">${totals.subtotal.toFixed(2)}</span>
                </div>
                {totals.descuento > 0 && (
                  <div className="flex justify-between text-xs text-destructive">
                    <span>{t("common.discount")}</span>
                    <span className="font-mono">-${totals.descuento.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">IVA (16%)</span>
                  <span className="font-mono">${totals.impuesto.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-semibold">
                  <span>{t("pos.total")}</span>
                  <span className="font-mono">${totals.total.toFixed(2)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment method buttons */}
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {paymentMethods.map((method) => (
            <Button
              key={method.key}
              variant={selectedPayment === method.key ? "default" : "outline"}
              className="w-full h-8 text-xs"
              size="sm"
              onClick={() => setSelectedPayment(method.key)}
            >
              <method.icon className="h-3 w-3 mr-1" />
              {method.label}
            </Button>
          ))}
        </div>

        <Button
          className="mt-3 w-full h-9 active:scale-[0.98] transition-transform"
          size="sm"
          disabled={items.length === 0 || !selectedPayment || processingSale}
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

      {/* Confirm Sale Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">Confirmar venta</DialogTitle>
            <DialogDescription className="text-xs">
              Revisa los detalles antes de completar la venta
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-muted p-3 space-y-2">
              {items.map((item) => (
                <div key={item.productId} className="flex justify-between text-sm">
                  <span>{item.nombre} x{item.cantidad}</span>
                  <span className="font-mono">
                    ${(item.precioUnitario * item.cantidad).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">${totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">IVA (16%)</span>
              <span className="font-mono">${totals.impuesto.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Total</span>
              <span className="font-mono">${totals.total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Método de pago</span>
              <span>{selectedPayment}</span>
            </div>
            {selectedCustomer !== "none" && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Cliente</span>
                <span>{customers.find((c) => c.id === selectedCustomer)?.nombre}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setShowConfirmDialog(false)}
              disabled={processingSale}
            >
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              className="h-8 active:scale-[0.98] transition-transform"
              onClick={handleCompleteSale}
              disabled={processingSale}
            >
              {processingSale ? (
                t("common.loading")
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Completar venta
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New customer dialog */}
      <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo cliente</DialogTitle>
            <DialogDescription>
              Crea un cliente y registra sus datos fiscales para facturar (opcional).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nc-nombre">Nombre*</Label>
                <Input
                  id="nc-nombre"
                  value={newCustomer.nombre}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, nombre: e.target.value })
                  }
                  placeholder="Nombre o razón de la persona"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-rfc">RFC</Label>
                <Input
                  id="nc-rfc"
                  value={newCustomer.rfc}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, rfc: e.target.value.toUpperCase() })
                  }
                  placeholder="XAXX010101000"
                  className="uppercase"
                  maxLength={13}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-razon">Razón social</Label>
                <Input
                  id="nc-razon"
                  value={newCustomer.razon_social}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, razon_social: e.target.value })
                  }
                  placeholder="Empresa S.A. de C.V."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-regimen">Régimen fiscal</Label>
                <Input
                  id="nc-regimen"
                  value={newCustomer.regimen_fiscal_receptor}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      regimen_fiscal_receptor: e.target.value,
                    })
                  }
                  placeholder="612"
                  maxLength={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-uso">Uso CFDI</Label>
                <Select
                  value={newCustomer.uso_cfdi}
                  onValueChange={(v) =>
                    setNewCustomer({ ...newCustomer, uso_cfdi: v ?? "" })
                  }
                >
                  <SelectTrigger id="nc-uso" className="w-full">
                    <SelectValue placeholder="Selecciona un uso" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(USOS_CFDI).map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        {key} — {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-cp">Código postal</Label>
                <Input
                  id="nc-cp"
                  value={newCustomer.codigo_postal}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, codigo_postal: e.target.value })
                  }
                  placeholder="06600"
                  maxLength={5}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-tel">Teléfono</Label>
                <Input
                  id="nc-tel"
                  value={newCustomer.telefono}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, telefono: e.target.value })
                  }
                  placeholder="55 0000 0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-email">Email</Label>
                <Input
                  id="nc-email"
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, email: e.target.value })
                  }
                  placeholder="cliente@correo.com"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setShowNewCustomerDialog(false)}
              disabled={savingCustomer}
            >
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              className="h-8 active:scale-[0.98] transition-transform"
              onClick={handleCreateCustomer}
              disabled={savingCustomer}
            >
              {savingCustomer ? "Guardando..." : "Crear cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
