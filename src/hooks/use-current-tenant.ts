"use client";

import { useTenantContext } from "@/contexts/tenant-context";
import type { UserRole } from "@/lib/types/database";

interface TenantInfo {
  tenantId: string;
  tenantName: string;
  tenantLogo: string | null;
  /** Domicilio del negocio. Lo imprime el pie del ticket del POS. */
  tenantAddress: string | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
}

export function useCurrentTenant(): TenantInfo {
  const {
    tenantId,
    tenantName,
    tenantLogo,
    tenantAddress,
    role,
    loading,
    error,
  } = useTenantContext();
  return {
    tenantId,
    tenantName,
    tenantLogo,
    tenantAddress,
    role,
    loading,
    error,
  };
}
