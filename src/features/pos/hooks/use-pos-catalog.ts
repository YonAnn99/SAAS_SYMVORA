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

export interface PosCatalogState {
  products: Producto[];
  /** Variantes del tenant, agrupadas por `producto_id`. */
  variantsByProduct: Record<string, VarianteProducto[]>;
  customers: Cliente[];
  /** Listas de precios activas, con sus renglones ya cargados. */
  priceLists: ListaParaPos[];
  userId: string;
  loadingProducts: boolean;
  isOfflineCatalog: boolean;
  /**
   * Caja abierta al cargar el POS. Se cachea para que una venta offline pueda
   * registrar EN QUÉ CAJA se hizo: el servidor, al sincronizar horas después,
   * ya no puede deducirlo (buscaría la caja abierta en ese momento, que puede
   * ser la del día siguiente).
   */
  cajaId: string | null;
  refetch: () => Promise<void>;
}

interface PosCache {
  products: Producto[];
  /**
   * Id del cajero. Sin el, una venta sin conexion se encola con `userId`
   * vacio y revienta al sincronizar.
   */
  userId?: string;
  variants: VarianteProducto[];
  customers: Cliente[];
  cajaId: string | null;
  /** Opcional: una cache escrita antes de las listas no las trae. */
  priceLists?: ListaParaPos[];
}

function catalogCacheKey(tenantId: string) {
  return `pos-catalog-cache:${tenantId}`;
}

function readCache(tenantId: string): PosCache | null {
  try {
    const raw = window.localStorage.getItem(catalogCacheKey(tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Compatibilidad con el formato viejo, que guardaba solo el array de
    // productos. Sin esto, el primer arranque tras actualizar dejaría el POS
    // sin catálogo offline.
    if (Array.isArray(parsed)) {
      return {
        products: parsed as Producto[],
        variants: [],
        customers: [],
        cajaId: null,
        priceLists: [],
      };
    }
    return parsed as PosCache;
  } catch {
    return null;
  }
}

function writeCache(tenantId: string, cache: PosCache) {
  try {
    window.localStorage.setItem(catalogCacheKey(tenantId), JSON.stringify(cache));
  } catch {
    // localStorage puede estar lleno o inaccesible (modo incógnito) — no es crítico.
  }
}

export function usePosCatalog(
  tenantId: string | null,
  tenantLoading: boolean
): PosCatalogState {
  const [products, setProducts] = useState<Producto[]>([]);
  const [customers, setCustomers] = useState<Cliente[]>([]);
  const [userId, setUserId] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [isOfflineCatalog, setIsOfflineCatalog] = useState(false);
  const [cajaId, setCajaId] = useState<string | null>(null);
  const [variants, setVariants] = useState<VarianteProducto[]>([]);
  const [priceLists, setPriceLists] = useState<ListaParaPos[]>([]);

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
      if (!user) throw new Error("Sesión no disponible sin conexión");
      setUserId(user.id);

      const [
        productsResult,
        variantsResult,
        customersResult,
        activeRegister,
        priceListsResult,
      ] = await Promise.all([
        fetchPosProducts(tenantId),
        fetchPosVariants(tenantId),
        fetchCustomers(tenantId),
        fetchActiveRegister(user.id),
        fetchPosPriceLists(tenantId),
      ]);

      const activeCajaId = activeRegister?.id ?? null;

      setProducts(productsResult);
      setVariants(variantsResult);
      setCustomers(customersResult);
      setPriceLists(priceListsResult);
      setCajaId(activeCajaId);
      setIsOfflineCatalog(false);
      writeCache(tenantId, {
        products: productsResult,
        variants: variantsResult,
        customers: customersResult,
        cajaId: activeCajaId,
        priceLists: priceListsResult,
        userId: user.id,
      });
    } catch (error) {
      console.error("[pos] catalog fetch failed:", error);
      const cached = readCache(tenantId);
      if (cached) {
        setProducts(cached.products);
        setVariants(cached.variants ?? []);
        setCustomers(cached.customers);
        // Sin red el cajero sigue pudiendo elegir lista: los precios ya
        // estan guardados y el servidor los revalidara al sincronizar.
        setPriceLists(cached.priceLists ?? []);
        // Sin esto la venta encolada sale sin cajero.
        if (cached.userId) setUserId(cached.userId);
        setCajaId(cached.cajaId);
        setIsOfflineCatalog(true);
      }
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

  return {
    products,
    variantsByProduct,
    customers,
    priceLists,
    userId,
    loadingProducts,
    isOfflineCatalog,
    cajaId,
    refetch,
  };
}