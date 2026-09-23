"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Cliente, Producto } from "@/lib/types/database";
import type { VarianteProducto } from "../types/pos.types";
import { fetchCustomers } from "@/features/customers/services/customer-service";
import { fetchActiveRegister } from "@/features/cash-register/services/cash-register-service";
import { fetchPosProducts, fetchPosVariants } from "../services/pos-service";
import { fetchStockSucursal } from "@/features/sucursales/services/stock-sucursal-service";
import { CASH_REGISTER_CHANGED_EVENT } from "@/features/cash-register/hooks/use-open-register";
import {
  fetchPosPriceLists,
  type ListaParaPos,
} from "@/features/inventory/services/price-list-service";
import { fetchFavoritos } from "@/features/inventory/services/favorites-service";

export interface PosCatalogState {
  products: Producto[];
  /** Variantes del tenant, agrupadas por `producto_id`. */
  variantsByProduct: Record<string, VarianteProducto[]>;
  customers: Cliente[];
  /** Listas de precios activas, con sus renglones ya cargados. */
  priceLists: ListaParaPos[];
  /** Ids de los productos favoritos del usuario actual. */
  favoritos: ReadonlySet<string>;
  favoritosCount: number;
  userId: string;
  loadingProducts: boolean;
  /** Caja abierta al cargar el POS. */
  cajaId: string | null;
  refetch: () => Promise<void>;
}

export function usePosCatalog(
  tenantId: string | null,
  tenantLoading: boolean
): PosCatalogState {
  const [products, setProducts] = useState<Producto[]>([]);
  const [customers, setCustomers] = useState<Cliente[]>([]);
  const [userId, setUserId] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [cajaId, setCajaId] = useState<string | null>(null);
  const [variants, setVariants] = useState<VarianteProducto[]>([]);
  const [priceLists, setPriceLists] = useState<ListaParaPos[]>([]);
  const [favoritos, setFavoritos] = useState<Set<string>>(() => new Set());

  const refetch = useCallback(async () => {
    // Antes este `return` estaba ANTES del `try`, asi que el `finally` no
    // corria y `loadingProducts` se quedaba en `true` para siempre. Pasaba
    // justo sin conexion, cuando el contexto no lograba resolver el tenant:
    // el Punto de Venta se quedaba cargando eternamente.
    if (!tenantId) {
      setLoadingProducts(false);
      return;
    }
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      // `getUser()` va a la red. Sin conexión no siempre lanza: a veces
      // devuelve `user: null` sin más. Con un `return` aquí el POS se quedaba
      // sin catálogo Y sin caché, porque la rama de respaldo vive en el
      // `catch`. Lanzar es lo que la lleva a ejecutarse.
      if (!user) throw new Error("No se pudo verificar la sesión");
      setUserId(user.id);

      // LA CAJA PRIMERO, y no en paralelo con el catalogo como antes: su
      // sucursal decide QUE existencias se ven. Un mostrador de Norte tiene que
      // enseñar lo que hay en Norte, no el total del negocio — si no, ofrece
      // productos que la venta luego rechaza por falta de stock en el local.
      const activeRegister = await fetchActiveRegister(user.id);
      const stockLocal = activeRegister?.sucursal_id
        ? await fetchStockSucursal(activeRegister.sucursal_id)
        : null;

      const [
        productsResult,
        variantsResult,
        customersResult,
        priceListsResult,
        favoritosResult,
      ] = await Promise.all([
        fetchPosProducts(tenantId, stockLocal),
        fetchPosVariants(tenantId, stockLocal),
        fetchCustomers(tenantId),
        fetchPosPriceLists(tenantId),
        fetchFavoritos(tenantId),
      ]);

      const activeCajaId = activeRegister?.id ?? null;

      setProducts(productsResult);
      setVariants(variantsResult);
      setCustomers(customersResult);
      setPriceLists(priceListsResult);
      setFavoritos(favoritosResult);
      setCajaId(activeCajaId);
    } catch (error) {
      // Ya no hay catalogo guardado al que caer: servir precios viejos solo
      // servia para poder vender sin red, y cobrar con un precio desactualizado
      // es peor que pedir al cajero que reintente.
      console.error("[pos] catalog fetch failed:", error);
    } finally {
      setLoadingProducts(false);
    }
  }, [tenantId]);

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
    () => products.filter((p) => favoritos.has(p.id)).length,
    [products, favoritos]
  );

  return {
    products,
    variantsByProduct,
    customers,
    priceLists,
    favoritos,
    favoritosCount,
    userId,
    loadingProducts,
    cajaId,
    refetch,
  };
}