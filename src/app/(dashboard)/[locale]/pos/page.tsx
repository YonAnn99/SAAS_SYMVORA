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
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import {
  VariantPickerDialog,
  variantLabel,
  variantPrice,
} from "@/features/pos/components/variant-picker-dialog";
import { useOpenRegister } from "@/features/cash-register/hooks/use-open-register";
import { OpenRegisterDialog, OpenRegisterRequiredDialog, abrirCaja } from "@/features/cash-register";
import { useSucursal } from "@/contexts/sucursal-context";
import { usePermissions } from "@/hooks/use-permissions";
import { useModulos } from "@/hooks/use-modulos";
import { sucursalDelPos } from "@/features/sucursales/seleccion";
import { PosSucursalSelector } from "@/features/pos/components/pos-sucursal-selector";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { esFraccionable } from "@/lib/unidades";
import { cartLineKey } from "@/features/pos/stores/cart";
import { CantidadDialog } from "@/features/pos/components/cantidad-dialog";
import { ALTO_PANEL_COMPLETO } from "@/components/dashboard/alto-panel";
import { motivoBloqueoCobro } from "@/features/pos/venta-bloqueada";

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
  type PosViewMode,
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
  const { tenantId, role, loading: tenantLoading } = useCurrentTenant();
  const { activas, hayVarias, seleccionada, setSeleccionada } = useSucursal();
  const { can } = usePermissions();
  const { modulos } = useModulos();
  // A donde se sale del POS si no se abre caja. El dashboard solo para quien lo
  // ve: al cajero (migracion 088) el middleware lo devolveria aqui, al mismo
  // aviso, y cancelar no haria nada. El catalogo esta abierto a todos.
  const salidaDelPos = can("sales.view_reports") ? "/dashboard" : "/products";
  // Solo el dueño cambia de sucursal desde aqui (ver `sucursalDelPos`).
  const modoDueno = role === "SUPER_ADMIN" && hayVarias;
  const sucursalPos = sucursalDelPos({
    esDueno: role === "SUPER_ADMIN",
    hayVarias,
    seleccionada,
    activas,
  });
  const { items, totals, itemCount, includeIva, addItem, removeItem, updateQuantity, setIncludeIva, clearCart } =
    usePosCart(tenantId);
  const {
    products,
    variantsByProduct,
    customers,
    priceLists,
    favoritos,
    favoritosCount,
    userId,
    loadingProducts,
    cajaId,
    cajaSucursalId,
    refetch,
  } = usePosCatalog(tenantId, tenantLoading, sucursalPos);
  // El local que se esta atendiendo: el elegido o, en "Todas", el de su caja.
  const sucursalMostrador = sucursalPos ?? cajaSucursalId;
  // El middleware ya redirige si no hay caja, pero no corre en la navegacion
  // de cliente ni cuando la PWA abre el POS desde su cache sin conexion.
  const { hasOpenRegister, loading: loadingRegister } = useOpenRegister(tenantId);
  const [variantPickerFor, setVariantPickerFor] = useState<Producto | null>(null);
  // Producto por medida (kg, l, m…) esperando que el cajero diga cuánto.
  const [pidiendoCantidad, setPidiendoCantidad] = useState<{
    product: Producto;
    variant: VarianteProducto | null;
  } | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<PosViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pos_view_mode");
      if (saved === "unbundled" || saved === "grouped") return saved;
    }
    return "grouped";
  });

  const handleViewModeChange = useCallback((mode: PosViewMode) => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("pos_view_mode", mode);
    }
  }, []);

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

  // Precio final de una linea: base (variante o producto) y encima la lista.
  const precioDeLinea = useCallback(
    (product: Producto, variant: VarianteProducto | null) =>
      precioConLista(
        variant ? variantPrice(variant, product) : product.precio_venta,
        mapaLista,
        product.id,
        variant?.id ?? null
      ),
    [mapaLista]
  );

  // Agrega ya resuelta la variante (o `null` para la venta general).
  // Por medida (kg, l, m…) primero se pregunta la cantidad: antes siempre
  // entraba 1 y no habia forma de cobrar 0.750 kg.
  const addResolved = useCallback(
    (product: Producto, variant: VarianteProducto | null, cantidad?: number) => {
      if (cantidad === undefined && esFraccionable(product.unidad_medida)) {
        setPidiendoCantidad({ product, variant });
        return;
      }
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
        cantidad: cantidad ?? 1,
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

      // Un servicio se cobra sin existencias: no hay nada que se acabe.
      if (!product.es_servicio && product.stock_actual <= 0) {
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

  // Cambiar de local vacia la venta en curso: esos productos quiza no existen
  // en el otro, y la venta se rechazaria al cobrar por falta de stock.
  const cambiarSucursal = useCallback(
    (id: string) => {
      if (id === sucursalMostrador) return;
      if (itemCount > 0) {
        clearCart();
        toast.info("Se vació la venta en curso al cambiar de sucursal");
      }
      setSeleccionada(id);
    },
    [sucursalMostrador, itemCount, clearCart, setSeleccionada]
  );

  // Si no abre caja en el local elegido: vuelve a la que ya tiene abierta, o al
  // panel si no tiene ninguna.
  const cancelarAperturaDueno = useCallback(() => {
    if (hasOpenRegister && seleccionada) {
      setSeleccionada(null);
      return;
    }
    router.push(salidaDelPos);
  }, [hasOpenRegister, seleccionada, setSeleccionada, router, salidaDelPos]);

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
      productosDeLista.filter((p) => {
        const matchesCategory =
          selectedCategory === "all"
            ? true
            : selectedCategory === "favorites"
            ? favoritos.has(p.id)
            : p.categoria === selectedCategory;

        if (!matchesCategory) return false;

        if (!search) return true;

        const term = search.toLowerCase();
        // Coincidencia directa en el producto
        if (
          p.nombre.toLowerCase().includes(term) ||
          p.codigo_barras?.toLowerCase().includes(term) ||
          p.sku?.toLowerCase().includes(term)
        ) {
          return true;
        }

        // Coincidencia en alguna de sus variantes (talla / color)
        const variants = variantsByProduct[p.id] ?? [];
        return variants.some(
          (v) =>
            v.talla?.toLowerCase().includes(term) ||
            v.color?.toLowerCase().includes(term)
        );
      }),
    [productosDeLista, selectedCategory, search, favoritos, variantsByProduct]
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

    setProcessingSale(true);
    try {
      // El retorno del RPC trae la fila completa de `ventas`; su `id` es el
      // numero de operacion que imprime el ticket.
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
      const referenciaTicket = venta?.id ?? null;

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
      toast.success(`Venta completada: $${totals.total.toFixed(2)}`);
      clearCart();
      setSelectedCustomer("none");
      setSelectedPayment("");
      setSelectedPriceList(SIN_LISTA);
      setMontoRecibido("");
      setShowConfirmDialog(false);
      setMobileCartOpen(false);
      void refetch();
    } catch (error) {
      // Un fallo de red aqui deja la venta EN DUDA: la peticion pudo llegar al
      // servidor y confirmarse, y perderse solo la respuesta. Antes daba igual
      // porque la venta se encolaba; sin cola, volver a cobrar a ciegas es
      // duplicar el cargo al cliente. Por eso se distingue del error de
      // validacion, que si es inequivoco (el servidor rechazo y no guardo nada).
      const pareceFalloDeRed =
        error instanceof TypeError ||
        (error instanceof Error && /fetch|network|failed to fetch|load failed/i.test(error.message));

      if (pareceFalloDeRed) {
        toast.error(
          "No se pudo confirmar la venta por un problema de conexión. Búscala en Reportes antes de volver a cobrarla: puede que sí haya quedado registrada.",
          { duration: 12000 }
        );
        return;
      }
      toast.error(error instanceof Error ? error.message : "Error al procesar la venta");
    } finally {
      setProcessingSale(false);
    }
  };

  // Una sola fuente para las dos instancias del panel de cobro (escritorio y
  // hoja movil). Estaban escritas por separado, y esa duplicacion es la que
  // dejo sobrevivir un bloqueo obsoleto durante semanas.
  const motivoBloqueo = useMemo(
    () =>
      motivoBloqueoCobro({
        items: items.length,
        metodoPago: selectedPayment,
        procesando: processingSale,
        montoInsuficiente: montoRecibidoInsuficiente,
      }),
    [
      items.length,
      selectedPayment,
      processingSale,
      montoRecibidoInsuficiente,
    ]
  );

  const paymentMethods = [
    { key: "EFECTIVO", label: t("pos.paymentMethods.CASH"), icon: Banknote },
    { key: "TARJETA", label: t("pos.paymentMethods.CARD"), icon: CreditCard },
    { key: "TRANSFERENCIA", label: t("pos.paymentMethods.TRANSFER"), icon: ArrowRightLeft },
    // Sin el modulo de credito/fiado no se ofrece (Configuracion -> Modulos).
    // Los saldos que ya existan se siguen cobrando desde Clientes.
    ...(modulos.permite_credito_fiado
      ? [{ key: "CREDITO", label: t("pos.paymentMethods.CREDIT"), icon: AlertTriangle }]
      : []),
    { key: "TARJETA_TERMINAL", label: t("pos.paymentMethods.TERMINAL"), icon: Smartphone },
  ];

  // Sin caja abierta no se vende: las ventas no generarian movimiento y el
  // corte del dia no cuadraria.
  // Para el dueño con varias sucursales cuenta SOLO la caja del local elegido:
  // tener abierta la de Principal no le deja cobrar en Norte, porque el dinero
  // caeria en el cajon equivocado.
  const isRegisterOpen = modoDueno
    ? Boolean(cajaId)
    : hasOpenRegister === true || Boolean(cajaId);
  const isRegisterResolved = !tenantLoading && !loadingRegister && !loadingProducts;
  const showRegisterBlocked = isRegisterResolved && !isRegisterOpen;

  return (
    <>
      <div
        className={cn(
          // El alto exacto entre el encabezado y el pie: sin esto la pagina se
          // desplazaba y el pie quedaba fuera de la pantalla.
          "flex flex-col lg:flex-row gap-3 lg:gap-5 transition-all duration-200",
          ALTO_PANEL_COMPLETO,
          showRegisterBlocked && "filter blur-sm pointer-events-none select-none opacity-40"
        )}
      >
      {/* Left: Products grid / search.
          `min-w-0`: sin el, esta columna no podia ser mas angosta que su barra
          de herramientas y empujaba el carrito fuera de la pantalla en anchos
          de ~1280 px (laptops con la escala de Windows al 125 %). */}
      <div className="flex-1 flex flex-col gap-3 lg:gap-4 min-h-0 min-w-0">
        <PosSearchBar
          search={search}
          onSearchChange={setSearch}
          onKeyDown={handleKeyDown}
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          favoritosCount={favoritosCount}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          onSearchSubmit={handleSearch}
          priceLists={priceLists}
          selectedPriceList={selectedPriceList}
          onPriceListChange={setSelectedPriceList}
          sucursalSlot={
            modoDueno ? (
              <PosSucursalSelector
                sucursales={activas}
                value={sucursalMostrador}
                onChange={cambiarSucursal}
              />
            ) : null
          }
        />

        <ProductGrid
          products={filteredProducts}
          loading={loadingProducts}
          hasSearch={Boolean(search)}
          viewMode={viewMode}
          isFavoritesFilter={selectedCategory === "favorites"}
          onAddProduct={handleAddProduct}
          onAddVariant={(product, variant) => {
            if (idsDeLista && !idsDeLista.has(product.id)) {
              toast.error(
                `"${product.nombre}" no está en ${nombreListaElegida}. Cambia a precios normales para venderlo.`
              );
              return;
            }
            addResolved(product, variant);
          }}
          variantsByProduct={variantsByProduct}
          variantCountByProduct={variantCountByProduct}
          precioDe={(p, v) => {
            const precioBase = v ? variantPrice(v, p) : p.precio_venta;
            return precioConLista(precioBase, mapaLista, p.id, v?.id ?? null);
          }}
        />

        <MobileCartBar
          itemCount={itemCount}
          total={totals.total}
          onOpen={() => setMobileCartOpen(true)}
        />
      </div>

      {/* Right: Cart (desktop only — on mobile it lives in the bottom sheet below) */}
      <div className="hidden lg:flex lg:w-80 shrink-0 flex-col animate-fade-in-up stagger-2">
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
                  processingSale={processingSale}
              disabledComplete={motivoBloqueo !== null}
              onCompleteSale={() => setShowConfirmDialog(true)}
              onClearCart={clearCart}
            />
          </div>
        </SheetContent>
      </Sheet>

      <CantidadDialog
        open={pidiendoCantidad !== null}
        nombre={
          pidiendoCantidad
            ? pidiendoCantidad.product.nombre +
              (pidiendoCantidad.variant ? ` · ${variantLabel(pidiendoCantidad.variant)}` : "")
            : ""
        }
        unidad={pidiendoCantidad?.product.unidad_medida ?? "KG"}
        precioUnitario={
          pidiendoCantidad ? precioDeLinea(pidiendoCantidad.product, pidiendoCantidad.variant) : 0
        }
        disponible={(() => {
          if (!pidiendoCantidad || pidiendoCantidad.product.es_servicio) return null;
          const { product, variant } = pidiendoCantidad;
          // Lo que queda por vender: existencias menos lo que ya va en el carrito.
          const stock = Number(variant ? variant.stock_actual : product.stock_actual);
          const enCarrito =
            items.find((i) => cartLineKey(i.productId, i.varianteId) === cartLineKey(product.id, variant?.id ?? null))
              ?.cantidad ?? 0;
          return Math.max(0, Math.round((stock - enCarrito) * 1000) / 1000);
        })()}
        onOpenChange={(open) => !open && setPidiendoCantidad(null)}
        onConfirm={(cantidad) => {
          if (!pidiendoCantidad) return;
          addResolved(pidiendoCantidad.product, pidiendoCantidad.variant, cantidad);
          setPidiendoCantidad(null);
        }}
      />

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

    {/* El dueño abre la caja del local aqui mismo, sin ir a Finanzas. */}
    <OpenRegisterDialog
      open={showRegisterBlocked && modoDueno}
      sucursalInicial={sucursalPos}
      onOpenChange={(open) => {
        if (!open) cancelarAperturaDueno();
      }}
      onCancel={cancelarAperturaDueno}
      onConfirm={async (fondoInicial, sucursalId) => {
        const caja = await abrirCaja(tenantId, fondoInicial, sucursalId);
        // `abrirCaja` avisa y el catalogo se recarga solo. Se fija ademas la
        // sucursal elegida para que el POS se quede en ese local.
        if (caja?.sucursal_id) setSeleccionada(caja.sucursal_id);
      }}
    />

    <OpenRegisterRequiredDialog
      open={showRegisterBlocked && !modoDueno}
      onOpenChange={(open) => {
        if (!open) {
          router.push(salidaDelPos);
        }
      }}
      onCancel={() => {
        router.push(salidaDelPos);
      }}
    />
  </>
  );
}