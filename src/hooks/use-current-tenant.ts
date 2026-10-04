"use client";

import { useTenantContext } from "@/contexts/tenant-context";
import type { UserRole } from "@/lib/types/database";

interface TenantInfo {
  tenantId: string;
  /** Id del cajero, necesario para encolar ventas sin conexion. */
  userId: string;
  /** Nombre de la persona; "" si no capturó ninguno. */
  userName: string;
  tenantName: string;
  tenantLogo: string | null;
  /** Domicilio del negocio. Lo imprime el pie del ticket del POS. */
  tenantAddress: string | null;
  /** `tenants.giro_comercial` (ROPA, ABARROTES...). */
  tenantGiro: string | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
}

export function useCurrentTenant(): TenantInfo {
  const {
    tenantId,
    userId,
    userName,
    tenantName,
    tenantLogo,
    tenantAddress,
    tenantGiro,
    role,
    loading,
    error,
  } = useTenantContext();
  return {
    tenantId,
    userId,
    userName,
    tenantName,
    tenantLogo,
    tenantAddress,
    tenantGiro,
    role,
    loading,
    error,
  };
}
