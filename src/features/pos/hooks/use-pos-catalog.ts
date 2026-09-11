"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Cliente, Producto } from "@/lib/types/database";
import { fetchCustomers } from "@/features/customers/services/customer-service";
import { fetchActiveRegister } from "@/features/cash-register/services/cash-register-service";
import { fetchPosProducts } from "../services/pos-service";

export interface PosCatalogState {
  products: Producto[];
  customers: Cliente[];
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
  customers: Cliente[];
  cajaId: string | null;
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
      return { products: parsed as Producto[], customers: [], cajaId: null };
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

  const refetch = useCallback(async () => {
    if (!tenantId) return;
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [productsResult, customersResult, activeRegister] = await Promise.all([
        fetchPosProducts(tenantId),
        fetchCustomers(tenantId),
        fetchActiveRegister(user.id),
      ]);

      const activeCajaId = activeRegister?.id ?? null;

      setProducts(productsResult);
      setCustomers(customersResult);
      setCajaId(activeCajaId);
      setIsOfflineCatalog(false);
      writeCache(tenantId, {
        products: productsResult,
        customers: customersResult,
        cajaId: activeCajaId,
      });
    } catch (error) {
      console.error("[pos] catalog fetch failed:", error);
      const cached = readCache(tenantId);
      if (cached) {
        setProducts(cached.products);
        setCustomers(cached.customers);
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

  return {
    products,
    customers,
    userId,
    loadingProducts,
    isOfflineCatalog,
    cajaId,
    refetch,
  };
}