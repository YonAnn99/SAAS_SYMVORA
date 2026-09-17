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
import { useOpenRegister } from "@/features/cash-register/hooks/use-open-register";
import { OpenRegisterRequiredDialog } from "@/features/cash-register";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { enqueueSale } from "@/lib/offline/queue";
import {
  esErrorDeRed,
  hayConexionReal,
} from "@/lib/offline/connectivity";
import {
  motivoBloqueoCobro,
  OFFLINE_PAYMENT_METHODS,
} from "@/features/pos/venta-bloqueada";
import { requestPersistentStorage } from "@/lib/offline/persist";

import { completeSale } from "@/features/pos/services/pos-service";
import { useBarcodeScanner } from "@/features/pos/hooks/use-barcode-scanner";
import { useCashDrawer } from "@/features/pos/hooks/use-cash-drawer";
import { usePosCart } from "@/features/pos/hooks/use-pos-cart";
import { usePosCatalog } from "@/features/pos/hooks/use-pos-catalog";
import { CheckoutPanel } from "@/features/pos/components/checkout-panel";
import { ConfirmSaleDialog } from "@/features/pos/components/confirm-sale-dialog";
import { MobileCartBar } from "@/features/pos/components/mobile-cart-bar";
import {
  PosSearchBar,
  SIN_LISTA,
} from "@/features/pos/components/pos-search-bar";
import {
  construirMapaLista,
  estaEnLista,
  filtrarCatalogoPorLista,
  precioConLista,
} from "@/features/pos/price-list-pos";
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
  const router = useRouter();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const { items, totals, itemCount, includeIva, addItem, removeItem, updateQuantity, setIncludeIva, clearCart } =
    usePosCart(tenantId);
  const {
    products,
    variantsByProduct,
    customers,
    priceLists,
    userId,
    loadingProducts,
    isOfflineCatalog,
    cajaId,
    refetch,
  } = usePosCatalog(tenantId, tenantLoading);
  const isOnline = useOnlineStatus();
  const saleSync = useSaleSync(tenantId);
  // El middleware ya redirige si no hay caja, pero no corre en la navegacion
  // de cliente ni cuando la PWA abre el POS desde su cache sin conexion.
  const { hasOpenRegister, loading: loadingRegister } = useOpenRegister(tenantId);
  const [variantPickerFor, setVariantPickerFor] = useState<Producto | null>(null);

  // Pedir almacenamiento persistente al entrar al POS: es lo que reduce el
  // riesgo de que el navegador desaloje la cola de ventas sin subir.
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPriceList, setSelectedPriceList] =
    useState<string>(SIN_LISTA);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("none");
  const [selectedPayment, setSelectedPayment] = useState<string>("");
  const [montoRecibido, setMontoRecibido] = useState<string>("");
  const [processingSale, setProcessingSale] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [saleReceipt, setSaleReceipt] = useState<SaleReceipt | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Precios de la lista elegida, indexados. `null` = sin lista, y entonces
  // todo el POS se comporta exactamente como antes.
  const mapaLista = useMemo(() => {
    if (selectedPriceList === SIN_LISTA) return null;
    const lista = priceLists.find((l) => l.id === selectedPriceList);
    // Si la lista desaparecio (la desactivaron mientras el POS estaba
    // abierto), se cae a precios normales en vez de cobrar a ciegas.
    if (!lista) return null;
    return construirMapaLista(lista.renglones);
  }, [priceLists, selectedPriceList]);

  // Agrega ya resuelta la variante (o `null` para la venta general).
  const addResolved = useCallback(
    (product: Producto, variant: VarianteProducto | null) => {
      // El precio base primero (la variante tiene el suyo; 0 = "usa el del
      // producto") y encima, si hay lista, el de la lista. Este es el mismo
      // orden que sigue el servidor en `_crear_venta_desde_items`: si aqui se
      // invirtiera, el ticket no cuadraria con lo cobrado.
      const precioBase = variant
        ? variantPrice(variant, product)
        : product.precio_venta;

      addItem({
        productId: product.id,
        varianteId: variant?.id ?? null,
        varianteLabel: variant ? variantLabel(variant) : null,
        nombre: product.nombre,
        cantidad: 1,
        precioUnitario: precioConLista(
          precioBase,
          mapaLista,
          product.id,
          variant?.id ?? null
        ),
        unidad_medida: product.unidad_medida,
      });
    },
    [addItem, mapaLista]
  );

  // Conteo para el distintivo de la cuadrícula. Se deriva de la MISMA fuente
  // que decide si se abre el diálogo, unas líneas más abajo: si salieran de
  // sitios distintos, la insignia podría prometer variantes que el diálogo no
  // ofrece (o al revés).
  const variantCountByProduct = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(variantsByProduct).map(([id, vs]) => [id, vs.length])
      ),
    [variantsByProduct]
  );

  // Con una lista puesta, la cuadricula muestra SOLO sus productos: es lo
  // que se decidio con el usuario. Se aplica antes que la busqueda y la
  // categoria para que los contadores de esos filtros cuenten sobre la lista.
  const productosDeLista = useMemo(
    () => filtrarCatalogoPorLista(products, variantsByProduct, mapaLista),
    [products, variantsByProduct, mapaLista]
  );

  // Ids visibles con la lista puesta. El codigo de barras busca sobre TODO el
  // catalogo, asi que sin esto un escaneo colaria por la puerta de atras un
  // producto que la cuadricula esta ocultando, y se cobraria a precio base
  // dentro de un ticket de lista.
  const idsDeLista = useMemo(
    () => (mapaLista ? new Set(productosDeLista.map((p) => p.id)) : null),
    [mapaLista, productosDeLista]
  );

  const nombreListaElegida = useMemo(
    () => priceLists.find((l) => l.id === selectedPriceList)?.nombre ?? "",
    [priceLists, selectedPriceList]
  );

  const handleAddProduct = useCallback(
    (product: Producto) => {
      if (idsDeLista && !idsDeLista.has(product.id)) {
        toast.error(
          `"${product.nombre}" no esta en ${nombreListaElegida}. Cambia a precios normales para venderlo.`
        );
        return;
      }

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
    [variantsByProduct, addResolved, idsDeLista, nombreListaElegida]
  );

  const { search, setSearch, handleSearch, handleKeyDown } = useBarcodeScanner(
    products,
    handleAddProduct
  );

  const finalizeSale = useCallback(() => {
    clearCart();
    setSelectedCustomer("none");
    setSelectedPayment("");
    // La lista se suelta al cobrar, por decision del usuario: dejarla puesta
    // haria que el SIGUIENTE cliente, uno normal, se llevara el precio de
    // mayoreo sin que nadie se diera cuenta.
    setSelectedPriceList(SIN_LISTA);
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
      productosDeLista.filter(
        (p) =>
          (selectedCategory === "all" || p.categoria === selectedCategory) &&
          (p.nombre.toLowerCase().includes(search.toLowerCase()) ||
            p.codigo_barras?.toLowerCase().includes(search.toLowerCase()) ||
            p.sku?.toLowerCase().includes(search.toLowerCase()))
      ),
    [productosDeLista, selectedCategory, search]
  );

  // Las categorias salen de lo que la lista deja ver, no del catalogo entero:
  // si no, con una lista puesta el desplegable ofreceria categorias que no
  // tienen ni un producto detras.
  const categories = useMemo(
    () =>
      Array.from(
        new Set(productosDeLista.map((p) => p.categoria).filter(Boolean))
      ) as string[],
    [productosDeLista]
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
        items,
        selectedPriceList === SIN_LISTA ? null : selectedPriceList
      );
      return;
    }

    const clienteId = selectedCustomer === "none" ? null : selectedCustomer;
    // Se manda el ID de la lista, NUNCA el precio: el servidor lo relee de
    // `precios_lista`. Mandar el precio desde aqui es el bug #5.
    const listaPrecioId =
      selectedPriceList === SIN_LISTA ? null : selectedPriceList;

    const encolarVenta = async (): Promise<string> => {
      // `crypto.randomUUID()` genera la clave de idempotencia, que es lo que
      // garantiza que un reintento no cree una venta duplicada. Esa misma
      // clave es la referencia del ticket: aquí todavía no existe fila en
      // `ventas`, y como el servidor deduplica por ella, el número impreso
      // seguirá apuntando a esta venta cuando termine de subir.
      const claveIdempotencia = crypto.randomUUID();
      await enqueueSale({
        idempotencyKey: claveIdempotencia,
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
        // Sin la lista, al sincronizar el servidor recalcularía a precio
        // base y `p_total_cobrado <> v_total` marcaría para revisión TODAS
        // las ventas offline hechas con lista.
        listaPrecioId,
        createdAt: new Date().toISOString(),
      });
      await saleSync.refresh();
      return claveIdempotencia;
    };

    setProcessingSale(true);
    try {

      // Referencia que el ticket imprime como número de operación.
      let referenciaTicket: string | null = null;


      // No basta con `navigator.onLine`: con el módem caído sigue diciendo que
      // sí, y la venta acababa en el `catch` genérico, sin cobrar y sin
      // encolar. Se confirma con una petición real antes de decidir.
      const hayRed = isOnline && (await hayConexionReal());

      if (hayRed) {
        // El retorno del RPC se descartaba. Trae la fila completa de `ventas`,
        // y su `id` es lo que hace falta para el ticket.
        const venta = (await completeSale({
          tenantId,
          userId,
          clienteId,
          metodoPago: selectedPayment as MetodoPagoDirecto,
          items,
          includeIva,
          montoRecibido: isEfectivo ? montoRecibidoNum : null,
          listaPrecioId,
        })) as { id?: string } | null;
        referenciaTicket = venta?.id ?? null;
      } else if (!isOnline || !OFFLINE_PAYMENT_METHODS.has(selectedPayment)) {
        // La red se cayó entre la comprobación y aquí, o el método elegido
        // necesita servidor. No se puede cobrar a ciegas.
        toast.error(
          "Se perdió la conexión. Cobra en efectivo o con tarjeta manual para poder guardar la venta."
        );
        return;
      } else {
        // Sin red: se guarda en el dispositivo y se sube sola.
        referenciaTicket = await encolarVenta();
      }

      setSaleReceipt({
        items: [...items],
        total: totals.total,
        paymentMethod: selectedPayment,
        customerName,
        customerPhone: selectedCustomerObj?.telefono ?? null,
        montoRecibido: isEfectivo ? montoRecibidoNum : null,
        cambio: isEfectivo ? cambio : null,
        reference: referenciaTicket,
      });
      toast.success(
        isOnline
          ? `Venta completada: $${totals.total.toFixed(2)}`
          : `Venta guardada sin conexión: $${totals.total.toFixed(2)} — se subirá sola`
      );
      clearCart();
      setSelectedCustomer("none");
      setSelectedPayment("");
      setSelectedPriceList(SIN_LISTA);
      setMontoRecibido("");
      setShowConfirmDialog(false);
      setMobileCartOpen(false);
      if (isOnline) void refetch();
    } catch (error) {
      // RED DE SEGURIDAD. Antes, un fallo de red aquí mostraba "Error al
      // procesar la venta" y la venta SE PERDÍA: ni cobrada ni encolada. Si el
      // fallo fue de red y el método se puede cobrar sin conexión, se encola.
      // Encolar de más es recuperable — el servidor deduplica por clave de
      // idempotencia —; perder una venta ya cobrada, no.
      if (esErrorDeRed(error) && OFFLINE_PAYMENT_METHODS.has(selectedPayment)) {
        try {
          const referencia = await encolarVenta();
          setSaleReceipt({
            items: [...items],
            total: totals.total,
            paymentMethod: selectedPayment,
            customerName,
            customerPhone: selectedCustomerObj?.telefono ?? null,
            montoRecibido: isEfectivo ? montoRecibidoNum : null,
            cambio: isEfectivo ? cambio : null,
            reference: referencia,
          });
          toast.success(
            `Se cayó la conexión: la venta de $${totals.total.toFixed(2)} quedó guardada y se subirá sola`
          );
          clearCart();
          setSelectedCustomer("none");
          setSelectedPayment("");
          setSelectedPriceList(SIN_LISTA);
          setMontoRecibido("");
          setShowConfirmDialog(false);
          setMobileCartOpen(false);
          return;
        } catch {
          toast.error(
            "Se cayó la conexión y no se pudo guardar la venta en este dispositivo. Anótala antes de continuar."
          );
          return;
        }
      }
      toast.error(error instanceof Error ? error.message : "Error al procesar la venta");
    } finally {
      setProcessingSale(false);
    }
  };

  // Una sola fuente para las dos instancias del panel de cobro (escritorio y
  // hoja movil). Estaban escritas por separado, y por eso el bloqueo por
  // `!isOnline` sobrevivio a la llegada de la cola de ventas offline.
  const motivoBloqueo = useMemo(
    () =>
      motivoBloqueoCobro({
        items: items.length,
        metodoPago: selectedPayment,
        procesando: processingSale,
        montoInsuficiente: montoRecibidoInsuficiente,
        isOnline,
      }),
    [
      items.length,
      selectedPayment,
      processingSale,
      montoRecibidoInsuficiente,
      isOnline,
    ]
  );

  const paymentMethods = [
    { key: "EFECTIVO", label: t("pos.paymentMethods.CASH"), icon: Banknote },
    { key: "TARJETA", label: t("pos.paymentMethods.CARD"), icon: CreditCard },
    { key: "TRANSFERENCIA", label: t("pos.paymentMethods.TRANSFER"), icon: ArrowRightLeft },
    { key: "CREDITO", label: t("pos.paymentMethods.CREDIT"), icon: AlertTriangle },
    { key: "TARJETA_TERMINAL", label: t("pos.paymentMethods.TERMINAL"), icon: Smartphone },
  ];

  // Sin caja abierta no se vende: las ventas no generarian movimiento y el
  // corte del dia no cuadraria.
  const isRegisterOpen = hasOpenRegister === true || Boolean(cajaId);
  const isRegisterResolved = !tenantLoading && !loadingRegister && !loadingProducts;
  const showRegisterBlocked = isRegisterResolved && !isRegisterOpen;

  return (
    <>
      <div
        className={cn(
          "flex flex-col lg:flex-row h-[calc(100vh-3.5rem)] gap-3 lg:gap-5 transition-all duration-200",
          showRegisterBlocked && "filter blur-sm pointer-events-none select-none opacity-40"
        )}
      >
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
          priceLists={priceLists}
          selectedPriceList={selectedPriceList}
          onPriceListChange={setSelectedPriceList}
        />

        <ProductGrid
          products={filteredProducts}
          loading={loadingProducts}
          hasSearch={Boolean(search)}
          onAddProduct={handleAddProduct}
          variantCountByProduct={variantCountByProduct}
          precioDe={(p) => precioConLista(p.precio_venta, mapaLista, p.id, null)}
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
          motivoBloqueo={motivoBloqueo}
          processingSale={processingSale}
          disabledComplete={motivoBloqueo !== null}
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
              motivoBloqueo={motivoBloqueo}
              processingSale={processingSale}
              disabledComplete={motivoBloqueo !== null}
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
        precioDe={(variant) => {
          if (!variantPickerFor) return 0;
          const base = variant
            ? variantPrice(variant, variantPickerFor)
            : variantPickerFor.precio_venta;
          return precioConLista(
            base,
            mapaLista,
            variantPickerFor.id,
            variant?.id ?? null
          );
        }}
        onSelect={(variant) => {
          if (!variantPickerFor) return;
          // Un producto puede estar visible porque SOLO una de sus tallas
          // entro en la lista. Las demas no se venden con esa lista: si no,
          // el ticket mezclaria precios de lista con precios normales sin que
          // el cajero lo note. Misma regla que con el codigo de barras.
          if (
            mapaLista &&
            !estaEnLista(mapaLista, variantPickerFor.id, variant?.id ?? null)
          ) {
            toast.error(
              `Esa opcion de "${variantPickerFor.nombre}" no esta en ${nombreListaElegida}.`
            );
            return;
          }
          addResolved(variantPickerFor, variant);
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

    <OpenRegisterRequiredDialog
      open={showRegisterBlocked}
      onOpenChange={(open) => {
        if (!open) {
          router.push("/dashboard");
        }
      }}
      onCancel={() => {
        router.push("/dashboard");
      }}
    />
  </>
  );
}