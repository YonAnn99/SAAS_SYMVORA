"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Cliente, Producto } from "@/lib/types/database";
import type { VarianteProducto } from "../types/pos.types";
import { fetchCustomers } from "@/features/customers/services/customer-service";
import { fetchActiveRegister } from "@/features/cash-register/services/cash-register-service";
import { fetchPosProducts, fetchPosVariants } from "../services/pos-service";
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

      const [
        productsResult,
        variantsResult,
        customersResult,
        activeRegister,
        priceListsResult,
        favoritosResult,
      ] = await Promise.all([
        fetchPosProducts(tenantId),
        fetchPosVariants(tenantId),
        fetchCustomers(tenantId),
        fetchActiveRegister(user.id),
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