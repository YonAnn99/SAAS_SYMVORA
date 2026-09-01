"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Cliente, Producto } from "@/lib/types/database";
import { fetchCustomers } from "@/features/customers/services/customer-service";
import { fetchPosProducts } from "../services/pos-service";

export interface PosCatalogState {
  products: Producto[];
  customers: Cliente[];
  userId: string;
  loadingProducts: boolean;
  isOfflineCatalog: boolean;
  refetch: () => Promise<void>;
}

function catalogCacheKey(tenantId: string) {
  return `pos-catalog-cache:${tenantId}`;
}

function readCachedProducts(tenantId: string): Producto[] | null {
  try {
    const raw = window.localStorage.getItem(catalogCacheKey(tenantId));
    if (!raw) return null;
    return JSON.parse(raw) as Producto[];
  } catch {
    return null;
  }
}

function writeCachedProducts(tenantId: string, products: Producto[]) {
  try {
    window.localStorage.setItem(
      catalogCacheKey(tenantId),
      JSON.stringify(products)
    );
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

  const refetch = useCallback(async () => {
    if (!tenantId) return;
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [productsResult, customersResult] = await Promise.all([
        fetchPosProducts(tenantId),
        fetchCustomers(tenantId),
      ]);

      setProducts(productsResult);
      setCustomers(customersResult);
      setIsOfflineCatalog(false);
      writeCachedProducts(tenantId, productsResult);
    } catch (error) {
      console.error("[pos] catalog fetch failed:", error);
      const cached = readCachedProducts(tenantId);
      if (cached) {
        setProducts(cached);
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

  return {
    products,
    customers,
    userId,
    loadingProducts,
    isOfflineCatalog,
    refetch,
  };
}