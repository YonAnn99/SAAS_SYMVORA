"use client";

import { ArrowLeftRight, BarChart3, Store, Warehouse } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useSucursal } from "@/contexts/sucursal-context";
import { SucursalSelector } from "@/features/sucursales/components/sucursal-selector";
import { SucursalesCard } from "@/features/sucursales/components/sucursales-card";
import { ResumenSucursales } from "@/features/sucursales/components/resumen-sucursales";
import { ExistenciasSucursal } from "@/features/sucursales/components/existencias-sucursal";
import { TraspasosSucursal } from "@/features/sucursales/components/traspasos-sucursal";

/**
 * Modulo de Sucursales.
 *
 * Aparece en el menu solo cuando el negocio tiene 2 o mas locales activos
 * (`requiresMultiSucursal` en `lib/navigation.ts`) y solo para quien tenga
 * `org.manage_branches` —de fabrica, el SUPER_ADMIN—, que es lo que comprueba
 * el middleware antes de dejar entrar.
 *
 * NO DUPLICA EL PANEL. El selector de arriba es el MISMO que usan el dashboard,
 * Productos y Reportes: elegir aqui un local cambia lo que se ve en todas esas
 * pantallas. Este modulo añade lo que solo tiene sentido con varios locales:
 * compararlos, ver y corregir las existencias de cada uno, y mover mercancia
 * entre ellos.
 */
export default function BranchesPage() {
  const { tenantId, loading } = useCurrentTenant();
  const { hayVarias } = useSucursal();

  if (loading || !tenantId) return null;

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between animate-fade-in-up stagger-1">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Sucursales</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Compara tus locales, revisa sus existencias y mueve mercancía entre ellos
          </p>
        </div>
        <SucursalSelector className="w-[200px] h-9" />
      </div>

      {!hayVarias ? (
        // Se llega aqui por un enlace guardado o porque se cerro una sucursal y
        // quedo solo una. No es un error: se explica y se ofrece crear otra.
        <div className="space-y-4">
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Tu negocio tiene un solo local activo. Cuando des de alta una segunda
              sucursal, aquí podrás comparar sus ventas, repartir existencias y hacer
              traspasos.
            </CardContent>
          </Card>
          <SucursalesCard />
        </div>
      ) : (
        <Tabs defaultValue="resumen" className="w-full animate-fade-in-up stagger-2">
          <TabsList>
            <TabsTrigger value="resumen" className="gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" />
              Resumen
            </TabsTrigger>
            <TabsTrigger value="existencias" className="gap-1.5 text-xs">
              <Warehouse className="h-3.5 w-3.5" />
              Existencias
            </TabsTrigger>
            <TabsTrigger value="traspasos" className="gap-1.5 text-xs">
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Traspasos
            </TabsTrigger>
            <TabsTrigger value="locales" className="gap-1.5 text-xs">
              <Store className="h-3.5 w-3.5" />
              Alta y cierre
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumen">
            <ResumenSucursales tenantId={tenantId} />
          </TabsContent>
          <TabsContent value="existencias">
            <ExistenciasSucursal tenantId={tenantId} />
          </TabsContent>
          <TabsContent value="traspasos">
            <TraspasosSucursal tenantId={tenantId} />
          </TabsContent>
          <TabsContent value="locales">
            <SucursalesCard />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
