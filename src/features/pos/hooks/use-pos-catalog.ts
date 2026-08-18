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

  const refetch = useCallback(async () => {
    if (!tenantId) return;
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
    setLoadingProducts(false);
  }, [tenantId]);

  useEffect(() => {
    if (tenantLoading) return;
    const timeout = window.setTimeout(() => void refetch(), 0);
    return () => window.clearTimeout(timeout);
  }, [tenantLoading, refetch]);

  return { products, customers, userId, loadingProducts, refetch };
}