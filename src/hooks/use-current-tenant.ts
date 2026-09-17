"use client";

import { useTenantContext } from "@/contexts/tenant-context";
import type { UserRole } from "@/lib/types/database";

interface TenantInfo {
  tenantId: string;
  /** Id del cajero, necesario para encolar ventas sin conexion. */
  userId: string;
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
    userId,
    tenantName,
    tenantLogo,
    tenantAddress,
    role,
    loading,
    error,
  } = useTenantContext();
  return {
    tenantId,
    userId,
    tenantName,
    tenantLogo,
    tenantAddress,
    role,
    loading,
    error,
  };
}
