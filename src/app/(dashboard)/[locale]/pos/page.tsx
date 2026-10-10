"use client";

import { useCallback, useMemo, useRef, useState } from "react";
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
import { esFraccionable, unidadDeVenta } from "@/lib/unidades";
import { cartLineKey } from "@/features/pos/stores/cart";
import { CantidadDialog } from "@/features/pos/components/cantidad-dialog";
import { ALTO_PANEL_POS } from "@/components/dashboard/alto-panel";
import { primerNombre } from "@/lib/nombre-usuario";
import { motivoBloqueoCobro } from "@/features/pos/venta-bloqueada";
import { tarjetaManualDisponible } from "@/features/pos/tarjeta-disponible";
import { useIsDemo } from "@/hooks/use-is-demo";

import { calculateSaleTotals, completeSale } from "@/features/pos/services/pos-service";
import { usePosLealtad } from "@/features/lealtad/use-pos-lealtad";
import { TiraLealtadPos } from "@/features/lealtad/components/tira-lealtad-pos";
import { aplicarPremio, codigoDesdeEscaneo } from "@/features/lealtad/lealtad";
import type { EstadoTarjeta } from "@/features/lealtad/types";
import { numeroOperacion } from "@/features/pos/ticket-format";
import { celebrarVenta } from "@/features/pos/celebracion-venta";
import { logActivity } from "@/lib/supabase/activity-logger";
import { resolverCodigo, useBarcodeScanner } from "@/features/pos/hooks/use-barcode-scanner";
import type { ResultadoEscaneo } from "@/components/escaner/escaner-camara";
import { useCashDrawer } from "@/features/pos/hooks/use-cash-drawer";
import { usePosCart } from "@/features/pos/hooks/use-pos-cart";
import { usePosCatalog } from "@/features/pos/hooks/use-pos-catalog";
import { CheckoutPanel } from "@/features/pos/components/checkout-panel";
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
import { etiquetaDescuento } from "@/features/pos/descuento-ticket";
import { productoEnFavoritos } from "@/features/pos/favoritos-pos";
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
  const { tenantId, userId: usuarioContexto, role, userName, loading: tenantLoading } = useCurrentTenant();
  // "¡Hola, {nombre}!" solo para el cajero, que no entra al Dashboard; los
  // administradores lo ven alla y aqui no se repite.
  // Se arma aqui y no dentro del JSX: con el ternario de `t()` en el JSX, el
  // React Compiler deja de optimizar el componente entero.
  const nombreSaludo = primerNombre(userName);
  const saludo =
    role === "CAJERO"
      ? nombreSaludo
        ? t("common.greeting", { nombre: nombreSaludo })
        : t("common.greetingNoName")
      : null;
  const { activas, hayVarias, seleccionada, setSeleccionada } = useSucursal();
  const { can } = usePermissions();
  const { modulos, terminalExterna } = useModulos();
  const esDemo = useIsDemo();
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
  const { items, totals, itemCount, includeIva, addItem, removeItem, updateQuantity, setIncludeIva, clearCart, descuentoTicket, restaurado: carritoRestaurado } =
    usePosCart(tenantId, usuarioContexto || null);
  const {
    products,
    variantsByProduct,
    customers,
    priceLists,
    favoritos,
    variantesFavoritas,
    favoritosCount,
    userId,
    loadingProducts,
    cajaId,
    cajaSucursalId,
    refetchStock,
    refetchCustomers,
  } = usePosCatalog(tenantId, tenantLoading, sucursalPos, usuarioContexto || null);
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
  // Sube con cada venta cobrada: reinicia el deslizador "Desliza para cobrar"
  // (tras "Venta completada" se queda en ese estado).
  const [ventasCobradas, setVentasCobradas] = useState(0);
  // Donde cae el foco al abrir la hoja del carrito en el celular. Sin esto, Base
  // UI enfocaba el buscador de clientes y se abria el teclado: la hoja se abre
  // desde codigo (la barra del carrito), no con un `Sheet.Trigger`, y no sabe
  // que fue con el dedo. Casi todo se vende a "Cliente general".
  const tituloCarritoRef = useRef<HTMLHeadingElement>(null);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [saleReceipt, setSaleReceipt] = useState<SaleReceipt | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Tarjeta de lealtad de la venta (migracion 115). Sin programa activo todo
  // es null y el cobro sigue el camino de siempre.
  const lealtad = usePosLealtad(tenantId);
  const conTerminal = selectedPayment === "TARJETA_TERMINAL";
  // El premio en los renglones, SOLO para mostrar el total que cobrara el
  // servidor (mismo algoritmo que `complete_sale_lealtad`). Al servidor se le
  // mandan los renglones sin premio y lo calcula el.
  const premioCalculado =
    lealtad.programa && lealtad.tarjeta
      ? aplicarPremio(items, {
          tipo: lealtad.programa.premio_tipo,
          productoId: lealtad.programa.premio_producto_id,
          varianteId: lealtad.programa.premio_variante_id,
          valor: lealtad.programa.premio_valor,
        })
      : null;
  const canjearPremio =
    lealtad.canjear && !conTerminal && premioCalculado !== null && !premioCalculado.faltaProducto;
  const itemsCobro = canjearPremio && premioCalculado ? premioCalculado.items : items;
  const totalsCobro = canjearPremio ? calculateSaleTotals(itemsCobro, includeIva) : totals;
  const premioLealtad =
    canjearPremio && premioCalculado && lealtad.programa
      ? { etiqueta: lealtad.programa.premio_descripcion, monto: premioCalculado.monto }
      : null;

  // Elegir cliente adjunta su tarjeta (si tiene) y suelta la del anterior.
  const seleccionarCliente = useCallback(
    (id: string) => {
      setSelectedCustomer(id);
      void lealtad.adjuntarPorCliente(id === "none" ? null : id);
    },
    [lealtad]
  );

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
      // Al volver al POS se pinta el catalogo de la cache mientras llegan los
      // precios frescos (menos de un segundo). En ese rato no se agrega nada:
      // la linea guardaria el precio viejo y el ticket no cuadraria con lo
      // que cobra el servidor. Tampoco antes de restaurar el carrito guardado
      // de la pestaña: la restauracion reemplazaria lo agregado.
      if (loadingProducts || !carritoRestaurado) {
        toast.info("Actualizando precios, intenta de nuevo en un momento");
        return;
      }
      // La unidad de la variante si tiene la suya (migracion 104).
      if (cantidad === undefined && esFraccionable(unidadDeVenta(product, variant))) {
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
        unidad_medida: unidadDeVenta(product, variant),
      });
    },
    [addItem, mapaLista, loadingProducts, carritoRestaurado]
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

  // Adjunta la tarjeta de lealtad leida (ya normalizada) y asigna su cliente a
  // la venta. Lo usan el buscador/escaner de productos y el boton del QR.
  const adjuntarTarjetaEscaneada = useCallback(
    (codigoTarjeta: string) => {
      const meta = lealtad.programa?.sellos_meta ?? 0;
      void lealtad.adjuntarPorCodigo(codigoTarjeta).then((tarjeta) => {
        if (!tarjeta) {
          toast.error("Esa tarjeta de lealtad no es de este negocio");
          return;
        }
        setSelectedCustomer(tarjeta.cliente_id);
        toast.success(`Tarjeta de ${tarjeta.cliente?.nombre ?? "cliente"}: ${tarjeta.sellos}/${meta} sellos`);
      });
    },
    [lealtad]
  );

  // Boton QR del POS: solo acepta tarjetas. Un codigo de producto suena mal y
  // la camara sigue abierta; una tarjeta la cierra.
  const leerTarjetaCamara = useCallback(
    (codigo: string): ResultadoEscaneo => {
      const codigoTarjeta = codigoDesdeEscaneo(codigo);
      if (!codigoTarjeta) return { tipo: "error", mensaje: "Ese código no es una tarjeta de lealtad" };
      adjuntarTarjetaEscaneada(codigoTarjeta);
      return { tipo: "salir", mensaje: "Tarjeta de lealtad leída" };
    },
    [adjuntarTarjetaEscaneada]
  );

  // Un codigo leido, venga del lector fisico (Enter en el buscador) o de la
  // camara. Mismas reglas que tocar el producto en la cuadricula, pero
  // respondiendo en vez de avisar: la camara en modo continuo necesita saber
  // si sonar bien, sonar mal o cerrarse para dejar paso a otra ventana.
  const agregarPorCodigo = useCallback(
    (codigo: string): ResultadoEscaneo => {
      // Mismo candado que `addResolved`: con el catalogo de la cache aun sin
      // confirmar no se agrega (el aviso sale en el escaner, no un toast).
      if (loadingProducts || !carritoRestaurado) {
        return { tipo: "error", mensaje: "Actualizando precios, escanea de nuevo" };
      }
      // Tarjeta de lealtad: su QR (la URL /tarjeta/...) o su codigo tecleado. Un
      // codigo de producto gana si coincide con uno del catalogo.
      const codigoTarjeta = lealtad.programa ? codigoDesdeEscaneo(codigo) : null;
      if (
        codigoTarjeta &&
        (/\/tarjeta\//i.test(codigo) || !resolverCodigo(codigo, products, variantsByProduct))
      ) {
        adjuntarTarjetaEscaneada(codigoTarjeta);
        return { tipo: "ok", mensaje: "Tarjeta de lealtad leída" };
      }
      const encontrado = resolverCodigo(codigo, products, variantsByProduct);
      if (!encontrado) {
        return { tipo: "error", mensaje: `Código ${codigo.trim()} no encontrado` };
      }
      const { product, variant } = encontrado;
      if (idsDeLista && !idsDeLista.has(product.id)) {
        return { tipo: "error", mensaje: `"${product.nombre}" no está en ${nombreListaElegida}` };
      }
      const etiqueta = variant ? `${product.nombre} ${variantLabel(variant)}` : product.nombre;

      // El codigo del producto, que tiene tallas: hay que elegir cual.
      if (!variant && (variantsByProduct[product.id]?.length ?? 0) > 0) {
        setVariantPickerFor(product);
        return { tipo: "salir", mensaje: `Elige la variante de ${product.nombre}` };
      }
      const stock = variant ? variant.stock_actual : product.stock_actual;
      if (!product.es_servicio && stock <= 0) {
        return { tipo: "error", mensaje: `${etiqueta}: sin stock` };
      }
      // Por medida (kg, l...) se pregunta la cantidad en su propia ventana.
      if (esFraccionable(unidadDeVenta(product, variant))) {
        addResolved(product, variant);
        return { tipo: "salir", mensaje: `Captura la cantidad de ${etiqueta}` };
      }
      addResolved(product, variant);
      return { tipo: "ok", mensaje: `${etiqueta} agregado` };
    },
    [products, variantsByProduct, idsDeLista, nombreListaElegida, addResolved, loadingProducts, carritoRestaurado, lealtad, adjuntarTarjetaEscaneada]
  );

  // "Agregar articulo" se quito: Enter en el buscador (y el lector de codigos,
  // que manda Enter solo) hace lo mismo via `handleKeyDown`.
  const { search, setSearch, handleKeyDown } = useBarcodeScanner(agregarPorCodigo);

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
    lealtad.soltar();
    setSelectedPayment("");
    // La lista se suelta al cobrar, por decision del usuario: dejarla puesta
    // haria que el SIGUIENTE cliente, uno normal, se llevara el precio de
    // mayoreo sin que nadie se diera cuenta.
    setSelectedPriceList(SIN_LISTA);
    setMobileCartOpen(false);
    // Cobrar solo cambia existencias: no se recargan clientes, listas ni
    // favoritos (ver `refetchStock`).
    void refetchStock();
  }, [clearCart, refetchStock, lealtad]);

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
    // Cobro con terminal confirmado: la misma celebracion que el cobro directo.
    onSaleCompleted: () => {
      celebrarVenta(null);
      finalizeSale();
    },
    // Ya no hay ventana de confirmar: al iniciar el cobro en la terminal se
    // cierra la hoja del carrito (celular) y queda la ventana de la terminal.
    onTerminalStarted: () => setMobileCartOpen(false),
  });

  // «Tarjeta» (manual) solo con una terminal con que cobrar: Mercado Pago Point
  // lista o una terminal externa declarada en Configuración → Métodos de pago.
  const tarjetaLista = tarjetaManualDisponible({ mpReady, terminalExterna, esDemo });

  // Lo que ya va en el carrito, para marcarlo sobre cada tarjeta ("×2").
  const enCarrito = useMemo(() => {
    const porProducto: Record<string, number> = {};
    const porVariante: Record<string, number> = {};
    for (const item of items) {
      porProducto[item.productId] = (porProducto[item.productId] ?? 0) + item.cantidad;
      if (item.varianteId) {
        porVariante[item.varianteId] = (porVariante[item.varianteId] ?? 0) + item.cantidad;
      }
    }
    return { porProducto, porVariante };
  }, [items]);

  const filteredProducts = useMemo(
    () =>
      productosDeLista.filter((p) => {
        const matchesCategory =
          selectedCategory === "all"
            ? true
            : selectedCategory === "favorites"
            ? productoEnFavoritos(p.id, favoritos, variantesFavoritas, variantsByProduct[p.id])
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
    [productosDeLista, selectedCategory, search, favoritos, variantesFavoritas, variantsByProduct]
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
      ? Math.round((montoRecibidoNum - totalsCobro.total) * 100) / 100
      : null;
  const montoRecibidoInsuficiente =
    isEfectivo &&
    items.length > 0 &&
    (montoRecibidoNum == null || Number.isNaN(montoRecibidoNum) || montoRecibidoNum < totalsCobro.total);

  /**
   * Venta ya registrada que espera a que termine la animacion del slider para
   * limpiar el carrito y abrir el ticket (ver `handleVentaConfirmada`). Solo
   * la llena el cobro directo: el de terminal sigue su propio camino.
   */
  const ventaRegistrada = useRef<{
    receipt: SaleReceipt;
    descuento: { tipo: string; valor: number } | null;
    montoDescuento: number;
    subtotal: number;
    total: number;
  } | null>(null);

  /**
   * Registra la venta. Devuelve una promesa que se RESUELVE si quedo
   * registrada y se RECHAZA si no: el slider de "Desliza para cobrar" muestra
   * "Venta completada" o la sacudida de error segun eso. Los avisos se siguen
   * mostrando aqui.
   */
  const handleCompleteSale = async (): Promise<void> => {
    const fallar = (mensaje: string): never => {
      toast.error(mensaje);
      throw new Error(mensaje);
    };
    if (items.length === 0) fallar("El carrito está vacío");
    if (!selectedPayment) fallar("Selecciona un método de pago");
    if (selectedPayment === "CREDITO" && selectedCustomer === "none") {
      fallar("Selecciona un cliente para la venta a crédito");
    }
    if (isEfectivo && montoRecibidoInsuficiente) {
      fallar("El monto recibido debe ser al menos el total de la venta");
    }

    if (selectedPayment === "TARJETA_TERMINAL") {
      // La hoja del carrito se cierra al iniciar el cobro (`onTerminalStarted`); la
      // celebracion suena cuando la terminal confirma el pago.
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
        // La caja del local que se esta atendiendo. Sin ella, el servidor usaba
        // la caja abierta MAS RECIENTE del usuario: con una abierta en Principal
        // y otra en Norte, una venta de Principal se descontaba (y validaba el
        // stock) en Norte, y fallaba con "Stock insuficiente".
        cajaId: cajaId ?? null,
        // Con tarjeta: misma venta + sello o canje (`complete_sale_lealtad`).
        // Con terminal no llega aqui (`startTerminalSale`), sin sello.
        tarjetaLealtadId: lealtad.tarjeta?.id ?? null,
        canjearPremio,
      })) as { id?: string; lealtad?: EstadoTarjeta } | null;

      const estadoLealtad = venta?.lealtad ?? null;
      const lineaLealtad = estadoLealtad
        ? estadoLealtad.premio_canjeado
          ? `Premio canjeado: ${estadoLealtad.premio_descripcion}`
          : `Sellos: ${estadoLealtad.sellos}/${estadoLealtad.sellos_meta}`
        : null;
      const descuentoManual = Math.round((totalsCobro.descuento - (premioLealtad?.monto ?? 0)) * 100) / 100;

      ventaRegistrada.current = {
        receipt: {
          items: [...itemsCobro],
          total: totalsCobro.total,
          paymentMethod: selectedPayment,
          customerName,
          customerPhone: selectedCustomerObj?.telefono ?? null,
          montoRecibido: isEfectivo ? montoRecibidoNum : null,
          cambio: isEfectivo ? cambio : null,
          reference: venta?.id ?? null,
          descuentoEtiqueta: premioLealtad
            ? descuentoManual > 0
              ? "Descuento y premio"
              : "Premio de lealtad"
            : totalsCobro.descuento > 0
              ? etiquetaDescuento(descuentoTicket)
              : null,
          lealtad: lineaLealtad,
        },
        descuento: descuentoTicket,
        // Solo el descuento MANUAL va a la Bitacora; el premio queda en la tarjeta.
        montoDescuento: descuentoManual,
        subtotal: totalsCobro.subtotal,
        total: totalsCobro.total,
      };
      toast.success(`Venta completada: $${totalsCobro.total.toFixed(2)}`);
      if (estadoLealtad?.premio_canjeado) {
        toast.success(`Premio canjeado: ${estadoLealtad.premio_descripcion}`);
      } else if (estadoLealtad?.sello_sumado) {
        toast.success(`Sello sumado: ${estadoLealtad.sellos}/${estadoLealtad.sellos_meta}`);
      }
    } catch (error) {
      // Un fallo de red aqui deja la venta EN DUDA: la peticion pudo llegar al
      // servidor y confirmarse, y perderse solo la respuesta. Antes daba igual
      // porque la venta se encolaba; sin cola, volver a cobrar a ciegas es
      // duplicar el cargo al cliente. Por eso se distingue del error de
      // validacion, que si es inequivoco (el servidor rechazo y no guardo nada).
      // El error de Supabase no es un `Error` de JS: con `instanceof Error` se
      // perdia su mensaje y solo se veia "Error al procesar la venta".
      const mensaje =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
            ? String((error as { message: unknown }).message)
            : "";
      const pareceFalloDeRed =
        error instanceof TypeError ||
        /fetch|network|failed to fetch|load failed/i.test(mensaje);

      if (pareceFalloDeRed) {
        toast.error(
          "No se pudo confirmar la venta por un problema de conexión. Búscala en Reportes antes de volver a cobrarla: puede que sí haya quedado registrada.",
          { duration: 12000 }
        );
      } else {
        toast.error(mensaje || "Error al procesar la venta");
      }
      throw error;
    } finally {
      setProcessingSale(false);
    }
  };

  /**
   * Terminada la animacion de exito del slider: sonido y destello verde, y un
   * momento despues se cierra el dialogo y se abre el ticket. Si se limpiara
   * al registrar, el dialogo se cerraria antes de verse "Venta completada".
   */
  const handleVentaConfirmada = (origen: DOMRect | null) => {
    const v = ventaRegistrada.current;
    if (!v) return;
    ventaRegistrada.current = null;
    celebrarVenta(origen);

    window.setTimeout(() => {
      setSaleReceipt(v.receipt);
      // Un descuento manual queda en la Bitacora: quien lo dio, cuanto y en
      // que venta. No se espera: que falle la Bitacora no frena el cobro.
      if (v.descuento && v.montoDescuento > 0) {
        const ref = v.receipt.reference;
        void logActivity({
          action: "DESCUENTO",
          entity: "venta",
          entityId: ref ?? undefined,
          entityName: ref ? `Venta #${numeroOperacion(ref) ?? ""}` : "Venta",
          details: {
            tipo: v.descuento.tipo,
            valor: v.descuento.valor,
            monto: v.montoDescuento,
            subtotal: v.subtotal,
            total: v.total,
          },
        });
      }
      clearCart();
      setSelectedCustomer("none");
      lealtad.soltar();
      setSelectedPayment("");
      setSelectedPriceList(SIN_LISTA);
      setMontoRecibido("");
      setMobileCartOpen(false);
      setVentasCobradas((n) => n + 1);
      // Cobrar solo cambia existencias (ver `refetchStock`).
      void refetchStock();
    }, 900);
  };

  // Tarjeta de lealtad bajo el selector de cliente (las dos instancias del panel).
  const productoPremio =
    lealtad.programa?.premio_tipo === "producto"
      ? products.find((p) => p.id === lealtad.programa?.premio_producto_id) ?? null
      : null;
  const tiraLealtad =
    lealtad.tarjeta && lealtad.programa ? (
      <TiraLealtadPos
        tarjeta={lealtad.tarjeta}
        programa={lealtad.programa}
        canjear={canjearPremio}
        onCanjear={lealtad.setCanjear}
        onQuitar={lealtad.soltar}
        conTerminal={conTerminal}
        faltaProducto={Boolean(premioCalculado?.faltaProducto)}
        onAgregarProductoPremio={
          productoPremio
            ? () => {
                // Se agrega como cualquier producto (variante o cantidad si
                // aplica) y el premio se aplica en cuanto la linea exista.
                handleAddProduct(productoPremio);
                lealtad.setCanjear(true);
              }
            : undefined
        }
      />
    ) : null;

  // Una sola fuente para las dos instancias del panel de cobro (escritorio y
  // hoja movil). Estaban escritas por separado, y esa duplicacion es la que
  // dejo sobrevivir un bloqueo obsoleto durante semanas.
  const motivoBloqueo = useMemo(
    () =>
      motivoBloqueoCobro({
        items: items.length,
        metodoPago: selectedPayment,
        // Mientras el catalogo se confirma con el servidor (al volver al POS se
        // pinta el de la cache) no se cobra: la caja y los precios tienen que
        // venir frescos.
        procesando: processingSale || loadingProducts,
        montoInsuficiente: montoRecibidoInsuficiente,
        tarjetaDisponible: tarjetaLista === true,
      }),
    [
      items.length,
      selectedPayment,
      processingSale,
      loadingProducts,
      montoRecibidoInsuficiente,
      tarjetaLista,
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
          ALTO_PANEL_POS,
          showRegisterBlocked && "filter blur-sm pointer-events-none select-none opacity-40"
        )}
      >
      {/* Left: Products grid / search.
          `min-w-0`: sin el, esta columna no podia ser mas angosta que su barra
          de herramientas y empujaba el carrito fuera de la pantalla en anchos
          de ~1280 px (laptops con la escala de Windows al 125 %). */}
      <div className="flex-1 flex flex-col gap-3 lg:gap-4 min-h-0 min-w-0">
        {/* La columna es flex-col y la cuadricula ocupa lo que sobra: esta
            linea solo le quita alto a la cuadricula, no al panel completo. */}
        {saludo && (
          <p className="shrink-0 text-base font-semibold tracking-tight">
            {saludo}
          </p>
        )}
        <PosSearchBar
          search={search}
          onSearchChange={setSearch}
          onKeyDown={handleKeyDown}
          onCodigoCamara={agregarPorCodigo}
          onTarjetaCamara={lealtad.programa ? leerTarjetaCamara : undefined}
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          favoritosCount={favoritosCount}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          priceLists={priceLists}
          selectedPriceList={selectedPriceList}
          onPriceListChange={setSelectedPriceList}
          sucursalNombre={
            modoDueno ? activas.find((s) => s.id === sucursalMostrador)?.nombre ?? null : null
          }
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
          // Con catalogo en cache se muestra ya; el "cargando" solo sin nada que
          // enseñar.
          loading={loadingProducts && products.length === 0}
          hasSearch={Boolean(search)}
          viewMode={viewMode}
          isFavoritesFilter={selectedCategory === "favorites"}
          favoritos={favoritos}
          variantesFavoritas={variantesFavoritas}
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
          enCarrito={enCarrito}
          precioDe={(p, v) => {
            const precioBase = v ? variantPrice(v, p) : p.precio_venta;
            return precioConLista(precioBase, mapaLista, p.id, v?.id ?? null);
          }}
        />

        <MobileCartBar
          itemCount={itemCount}
          total={totalsCobro.total}
          onOpen={() => setMobileCartOpen(true)}
        />
      </div>

      {/* Right: Cart (desktop only — on mobile it lives in the bottom sheet below) */}
      <div className="hidden lg:flex lg:w-80 shrink-0 flex-col animate-fade-in-up stagger-2">
        <CheckoutPanel
          // Con poca altura el panel se desplaza en vez de aplastar el carrito.
          // `-mx-1 px-1`: el scroll recorta tambien a lo ancho y se comia los
          // anillos de foco.
          className="h-full overflow-y-auto -mx-1 px-1"
          customers={customers}
          selectedCustomer={selectedCustomer}
          onSelectCustomer={seleccionarCliente}
          onNewCustomer={() => setShowNewCustomerDialog(true)}
          items={items}
          totals={totalsCobro}
          premioLealtad={premioLealtad}
          bajoCliente={tiraLealtad}
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
          tarjetaLista={tarjetaLista}
          isEfectivo={isEfectivo}
          montoRecibido={montoRecibido}
          onMontoRecibidoChange={setMontoRecibido}
          cambio={cambio}
          processingSale={processingSale}
          motivoBloqueo={motivoBloqueo}
          onCobrar={handleCompleteSale}
          onVentaConfirmada={handleVentaConfirmada}
          ventasCobradas={ventasCobradas}
          onClearCart={clearCart}
        />
      </div>

      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto p-0 lg:hidden"
          initialFocus={tituloCarritoRef}
        >
          <SheetHeader className="pb-0 sticky top-0 z-10 bg-popover">
            <SheetTitle ref={tituloCarritoRef} tabIndex={-1} className="outline-none">
              {t("pos.cart")}
              {itemCount > 0 && (
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  · {itemCount} artículo{itemCount === 1 ? "" : "s"}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <CheckoutPanel
              customers={customers}
              selectedCustomer={selectedCustomer}
              onSelectCustomer={seleccionarCliente}
              onNewCustomer={() => setShowNewCustomerDialog(true)}
              items={items}
              totals={totalsCobro}
              premioLealtad={premioLealtad}
              bajoCliente={tiraLealtad}
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
              tarjetaLista={tarjetaLista}
              isEfectivo={isEfectivo}
              montoRecibido={montoRecibido}
              onMontoRecibidoChange={setMontoRecibido}
              cambio={cambio}
                  processingSale={processingSale}
              motivoBloqueo={motivoBloqueo}
              onCobrar={handleCompleteSale}
              onVentaConfirmada={handleVentaConfirmada}
              ventasCobradas={ventasCobradas}
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
        unidad={
          pidiendoCantidad
            ? unidadDeVenta(pidiendoCantidad.product, pidiendoCantidad.variant)
            : "KG"
        }
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
          seleccionarCliente(customer.id);
          void refetchCustomers();
        }}
      />

      <TicketReceipt
        open={saleReceipt !== null}
        onOpenChange={(open) => {
          if (!open) setSaleReceipt(null);
        }}
        receipt={saleReceipt}
        // Venta recien cobrada: con impresora conectada sale sola.
        autoImprimir
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