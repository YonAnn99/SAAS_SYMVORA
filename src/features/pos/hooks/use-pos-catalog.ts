"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Cliente, Producto } from "@/lib/types/database";
import type { VarianteProducto } from "../types/pos.types";
import { fetchCustomers } from "@/features/customers/services/customer-service";
import { fetchActiveRegister } from "@/features/cash-register/services/cash-register-service";
import { fetchPosProducts, fetchPosVariants } from "../services/pos-service";
import {
  conStockDeSucursal,
  conStockDeSucursalVariantes,
  vendibleEnPos,
} from "@/features/sucursales/stock";
import { fetchStockSucursal } from "@/features/sucursales/services/stock-sucursal-service";
import { CASH_REGISTER_CHANGED_EVENT } from "@/features/cash-register/hooks/use-open-register";
import {
  fetchPosPriceLists,
  type ListaParaPos,
} from "@/features/inventory/services/price-list-service";
import {
  fetchFavoritos,
  fetchVariantesFavoritas,
} from "@/features/inventory/services/favorites-service";
import { productoEnFavoritos } from "../favoritos-pos";
import { guardarCache, leerCache } from "@/lib/cache-datos";

/**
 * Lo que se guarda en la cache entre modulos (`lib/cache-datos.ts`) para pintar
 * el catalogo al instante al volver al POS. La CAJA no va aqui: cobrar exige
 * confirmarla con el servidor (el boton queda bloqueado hasta entonces).
 */
interface CatalogoEnCache {
  productos: Producto[];
  variantes: VarianteProducto[];
  clientes: Cliente[];
  listas: ListaParaPos[];
  favoritos: string[];
  variantesFavoritas: string[];
}

const claveCatalogo = (tenantId: string | null, sucursalId: string | null) =>
  ["pos-catalogo", tenantId, sucursalId] as const;

type StockLocal = Awaited<ReturnType<typeof fetchStockSucursal>> | null;

/**
 * Productos y variantes con el stock del local y el filtro de "vendible": lo
 * que el mostrador ofrece es lo que tiene existencias propias, es servicio o
 * tiene alguna variante con existencias (un producto con variantes puede ser
 * solo el nombre general, con stock 0).
 */
function armarCatalogo(
  productsRaw: Producto[],
  variantsRaw: VarianteProducto[],
  stockLocal: StockLocal
): { productos: Producto[]; variantes: VarianteProducto[] } {
  const productos = stockLocal ? conStockDeSucursal(productsRaw, stockLocal) : productsRaw;
  const variantes = stockLocal ? conStockDeSucursalVariantes(variantsRaw, stockLocal) : variantsRaw;
  const porProducto = new Map<string, VarianteProducto[]>();
  for (const v of variantes) {
    const lista = porProducto.get(v.producto_id) ?? [];
    lista.push(v);
    porProducto.set(v.producto_id, lista);
  }
  return {
    productos: productos.filter((p) => vendibleEnPos(p, porProducto.get(p.id))),
    variantes,
  };
}

export interface PosCatalogState {
  products: Producto[];
  /** Variantes del tenant, agrupadas por `producto_id`. */
  variantsByProduct: Record<string, VarianteProducto[]>;
  customers: Cliente[];
  /** Listas de precios activas, con sus renglones ya cargados. */
  priceLists: ListaParaPos[];
  /** Ids de los productos favoritos del usuario actual. */
  favoritos: ReadonlySet<string>;
  /** Ids de las variantes favoritas del usuario actual (migracion 098). */
  variantesFavoritas: ReadonlySet<string>;
  /** Productos que salen en "Favoritos": favoritos o con alguna variante favorita. */
  favoritosCount: number;
  userId: string;
  loadingProducts: boolean;
  /** Caja abierta al cargar el POS (la de `sucursalId`, si se pidio una). */
  cajaId: string | null;
  /** Local de esa caja: el que el mostrador esta atendiendo. */
  cajaSucursalId: string | null;
  /** Recarga TODO: caja, catalogo, clientes, listas y favoritos. */
  refetch: () => Promise<void>;
  /**
   * Solo existencias (productos y variantes con el stock del local). Es lo
   * unico que cambia al cobrar: recargar clientes, listas y favoritos tras
   * cada venta eran 6 peticiones de mas por cobro, que en hora pico hacian
   * fila en el pool de Supabase.
   */
  refetchStock: () => Promise<void>;
  /** Solo clientes (al dar de alta uno desde el POS). */
  refetchCustomers: () => Promise<void>;
}

/**
 * `sucursalId`: el local donde se quiere cobrar (el dueño que cambia de
 * sucursal, ver `sucursalDelPos`). Con el, la caja es la del usuario EN ESE
 * local —o ninguna, y el POS ofrece abrirla— y las existencias son las de ahi.
 * Con `null`, la caja abierta mas reciente, como siempre.
 *
 * `usuarioId`: el del contexto del tenant. Con el no se llama a
 * `auth.getUser()`, que es una ida a la red antes de poder pedir nada mas.
 */
export function usePosCatalog(
  tenantId: string | null,
  tenantLoading: boolean,
  sucursalId: string | null = null,
  usuarioId: string | null = null
): PosCatalogState {
  // Lo ultimo cargado en esta pestaña (si ya se visito el POS): se pinta ya y
  // la carga normal de abajo lo reemplaza en cuanto llega.
  const [enCache] = useState(() =>
    leerCache<CatalogoEnCache>(claveCatalogo(tenantId, sucursalId))
  );
  const [products, setProducts] = useState<Producto[]>(() => enCache?.productos ?? []);
  const [customers, setCustomers] = useState<Cliente[]>(() => enCache?.clientes ?? []);
  const [userId, setUserId] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [cajaId, setCajaId] = useState<string | null>(null);
  const [cajaSucursalId, setCajaSucursalId] = useState<string | null>(null);
  // Cambiar de sucursal lanza otra carga: si la anterior llega despues, no debe
  // pisar la caja ni las existencias del local nuevo.
  const peticion = useRef(0);
  const sucursalCargada = useRef<string | null | undefined>(undefined);
  const [variants, setVariants] = useState<VarianteProducto[]>(() => enCache?.variantes ?? []);
  const [priceLists, setPriceLists] = useState<ListaParaPos[]>(() => enCache?.listas ?? []);
  const [favoritos, setFavoritos] = useState<Set<string>>(() => new Set(enCache?.favoritos));
  const [variantesFavoritas, setVariantesFavoritas] = useState<Set<string>>(
    () => new Set(enCache?.variantesFavoritas)
  );
  // Local cuyas existencias se estan viendo (el de la caja o el elegido): la
  // recarga de solo stock lo reutiliza sin volver a buscar la caja.
  const sucursalStockRef = useRef<string | null>(null);

  const refetch = useCallback(async () => {
    // Antes este `return` estaba ANTES del `try`, asi que el `finally` no
    // corria y `loadingProducts` se quedaba en `true` para siempre. Pasaba
    // justo sin conexion, cuando el contexto no lograba resolver el tenant:
    // el Punto de Venta se quedaba cargando eternamente.
    if (!tenantId) {
      setLoadingProducts(false);
      return;
    }
    const id = ++peticion.current;
    // Solo al CAMBIAR de local (no en la recarga tras cada venta): se suelta la
    // caja anterior en el acto para que nada se cobre en el cajon de Principal
    // mientras llega la de Norte.
    if (sucursalCargada.current !== sucursalId) {
      sucursalCargada.current = sucursalId;
      setCajaId(null);
      setCajaSucursalId(null);
      setLoadingProducts(true);
    }
    try {
      let uid = usuarioId;
      if (!uid) {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        // `getUser()` va a la red. Sin conexión no siempre lanza: a veces
        // devuelve `user: null` sin más; lanzar lleva al `catch`.
        if (!user) throw new Error("No se pudo verificar la sesión");
        uid = user.id;
      }
      setUserId(uid);

      // TODO EN PARALELO. El catalogo, los clientes, las listas y los favoritos
      // no dependen de la caja; solo las EXISTENCIAS dependen del local. El
      // stock del local se pide junto con lo demas y se aplica al final (las
      // consultas de productos y variantes son las mismas con o sin sucursal:
      // `conStockDeSucursal*` solo sobrepone el stock). Antes eran 4 idas y
      // vueltas en serie (usuario -> caja -> stock -> catalogo).
      const cajaPromesa = fetchActiveRegister(uid, sucursalId);
      // Con un local elegido, su caja (si hay) es de ese local: su stock se pide
      // ya. Sin local elegido, el stock es el del local de la caja.
      const stockPromesa = sucursalId
        ? fetchStockSucursal(sucursalId)
        : cajaPromesa.then((caja) => (caja?.sucursal_id ? fetchStockSucursal(caja.sucursal_id) : null));

      const [
        activeRegister,
        stockLocal,
        productsRaw,
        variantsRaw,
        customersResult,
        priceListsResult,
        favoritosResult,
        variantesFavoritasResult,
      ] = await Promise.all([
        cajaPromesa,
        stockPromesa,
        fetchPosProducts(tenantId),
        fetchPosVariants(tenantId),
        fetchCustomers(tenantId),
        fetchPosPriceLists(tenantId),
        fetchFavoritos(tenantId),
        fetchVariantesFavoritas(tenantId),
      ]);

      if (id !== peticion.current) return;
      // Sin caja en el local pedido se enseña igualmente SU stock detras del
      // aviso de abrir caja: es lo que se va a vender en cuanto la abra.
      sucursalStockRef.current = activeRegister?.sucursal_id ?? sucursalId;
      const catalogo = armarCatalogo(productsRaw, variantsRaw, stockLocal);
      setProducts(catalogo.productos);
      setVariants(catalogo.variantes);
      setCustomers(customersResult);
      setPriceLists(priceListsResult);
      setFavoritos(favoritosResult);
      setVariantesFavoritas(variantesFavoritasResult);
      setCajaId(activeRegister?.id ?? null);
      setCajaSucursalId(activeRegister?.sucursal_id ?? null);
      guardarCache<CatalogoEnCache>(claveCatalogo(tenantId, sucursalId), {
        productos: catalogo.productos,
        variantes: catalogo.variantes,
        clientes: customersResult,
        listas: priceListsResult,
        favoritos: [...favoritosResult],
        variantesFavoritas: [...variantesFavoritasResult],
      });
    } catch (error) {
      // Ya no hay catalogo guardado al que caer: servir precios viejos solo
      // servia para poder vender sin red, y cobrar con un precio desactualizado
      // es peor que pedir al cajero que reintente.
      console.error("[pos] catalog fetch failed:", error);
    } finally {
      if (id === peticion.current) setLoadingProducts(false);
    }
  }, [tenantId, sucursalId, usuarioId]);

  const refetchStock = useCallback(async () => {
    // Si cambio el local o aun no hay una carga completa, va la completa.
    if (!tenantId || sucursalCargada.current !== sucursalId) return refetch();
    const id = ++peticion.current;
    try {
      const sucursalStock = sucursalStockRef.current;
      const [stockLocal, productsRaw, variantsRaw] = await Promise.all([
        sucursalStock ? fetchStockSucursal(sucursalStock) : Promise.resolve(null),
        fetchPosProducts(tenantId),
        fetchPosVariants(tenantId),
      ]);
      if (id !== peticion.current) return;
      const catalogo = armarCatalogo(productsRaw, variantsRaw, stockLocal);
      setProducts(catalogo.productos);
      setVariants(catalogo.variantes);
      const clave = claveCatalogo(tenantId, sucursalId);
      const previo = leerCache<CatalogoEnCache>(clave);
      if (previo) {
        guardarCache<CatalogoEnCache>(clave, {
          ...previo,
          productos: catalogo.productos,
          variantes: catalogo.variantes,
        });
      }
    } catch (error) {
      console.error("[pos] stock refresh failed:", error);
    }
  }, [tenantId, sucursalId, refetch]);

  const refetchCustomers = useCallback(async () => {
    if (!tenantId) return;
    try {
      const clientes = await fetchCustomers(tenantId);
      setCustomers(clientes);
      const clave = claveCatalogo(tenantId, sucursalId);
      const previo = leerCache<CatalogoEnCache>(clave);
      if (previo) guardarCache<CatalogoEnCache>(clave, { ...previo, clientes });
    } catch (error) {
      console.error("[pos] customers refresh failed:", error);
    }
  }, [tenantId, sucursalId]);

  useEffect(() => {
    if (tenantLoading) return;
    const timeout = window.setTimeout(() => void refetch(), 0);
    return () => window.clearTimeout(timeout);
  }, [tenantLoading, refetch]);

  // SE RECARGA AL ABRIR O CERRAR CAJA. La caja decide QUE local se esta
  // atendiendo, y con el que existencias ve el mostrador. Sin esto, abrir caja
  // desde el aviso global estando ya en el POS dejaba el catalogo como estaba:
  // sin caja asociada y enseñando el stock de todo el negocio en vez del del
  // local. Paso de verdad el 2026-09-22 (una venta quedo sin sucursal).
  useEffect(() => {
    const alCambiar = () => void refetch();
    window.addEventListener(CASH_REGISTER_CHANGED_EVENT, alCambiar);
    return () => window.removeEventListener(CASH_REGISTER_CHANGED_EVENT, alCambiar);
  }, [refetch]);

  // Agrupadas una sola vez: el POS pregunta por producto en cada clic.
  const variantsByProduct = useMemo(() => {
    const map: Record<string, VarianteProducto[]> = {};
    for (const v of variants) {
      (map[v.producto_id] ??= []).push(v);
    }
    return map;
  }, [variants]);

  const favoritosCount = useMemo(
    () =>
      products.filter((p) =>
        productoEnFavoritos(p.id, favoritos, variantesFavoritas, variantsByProduct[p.id])
      ).length,
    [products, favoritos, variantesFavoritas, variantsByProduct]
  );

  return {
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
    refetch,
    refetchStock,
    refetchCustomers,
  };
}