"use client";

import { useCallback, useEffect, useState } from "react";
import type { Cliente } from "@/lib/types/database";
import { fetchCustomers } from "../services/customer-service";

export function useCustomers(tenantId: string | null) {
  const [customers, setCustomers] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const data = await fetchCustomers(tenantId);
      setCustomers(data);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  return { customers, loading, refresh };
}