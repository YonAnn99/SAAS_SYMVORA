"use client";

import { useTenantContext } from "@/contexts/tenant-context";
import type { UserRole } from "@/lib/types/database";

interface TenantInfo {
  tenantId: string;
  tenantName: string;
  tenantLogo: string | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
}

export function useCurrentTenant(): TenantInfo {
  const { tenantId, tenantName, tenantLogo, role, loading, error } =
    useTenantContext();
  return { tenantId, tenantName, tenantLogo, role, loading, error };
}
