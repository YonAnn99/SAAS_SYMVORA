"use client";

import { ArrowRight, Store } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { useSucursal } from "@/contexts/sucursal-context";

/**
 * La puerta al modulo Sucursales mientras el negocio tiene un solo local.
 *
 * El modulo solo aparece en el menu con 2 o mas sucursales abiertas (para no
 * meter ruido a quien tiene una), asi que sin este enlace un negocio nuevo no
 * tendria por donde dar de alta la segunda. En cuanto la tiene, el menu ya
 * lleva al modulo y esto desaparece.
 */
export function EnlaceAltaSucursal() {
  const { can, loading: permisosLoading } = usePermissions();
  const { todasActivas, loading } = useSucursal();

  if (permisosLoading || loading) return null;
  if (!can("org.manage_branches") || todasActivas.length > 1) return null;

  return (
    <Link
      href="/branches"
      className="group flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm transition-colors hover:border-primary/50 hover:bg-muted/40"
    >
      <Store className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
      <span className="flex-1 text-muted-foreground">
        ¿Abriste otro local?{" "}
        <span className="font-medium text-foreground">Da de alta tu segunda sucursal</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}
