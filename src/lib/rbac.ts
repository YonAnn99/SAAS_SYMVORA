import type { UserRole } from "@/lib/types/database";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  CAJERO: 1,
  ORG_ADMIN: 2,
  SUPER_ADMIN: 3,
};

export function hasRole(userRole: UserRole | null, requiredRole: UserRole): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
