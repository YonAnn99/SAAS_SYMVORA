"use client";

import { ArrowLeftRight, BarChart3, Plus, Store, Warehouse } from "lucide-react";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useAccionRapida } from "@/hooks/use-accion-rapida";
import { useSucursal } from "@/contexts/sucursal-context";
import { SucursalSelector } from "@/features/sucursales/components/sucursal-selector";
import { SucursalesCard } from "@/features/sucursales/components/sucursales-card";
import { ResumenSucursales } from "@/features/sucursales/components/resumen-sucursales";
import { ExistenciasSucursal } from "@/features/sucursales/components/existencias-sucursal";
import { TraspasosSucursal } from "@/features/sucursales/components/traspasos-sucursal";

/**
 * Modulo de Sucursales.
 *
 * Siempre esta en el menu para quien tenga `org.manage_branches` —de
 * fabrica, el SUPER_ADMIN—, que es lo que comprueba el middleware antes de
 * dejar entrar. Con un solo local invita a dar de alta el segundo (antes esa
 * invitacion vivia al final de Configuracion); en cuanto existe, el alta
 * refresca el contexto (`refetch`) y la pagina pasa sola al modulo completo.
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
  const [pestana, setPestana] = useState("resumen");

  // Lleva al formulario de alta de `SucursalesCard` y deja el cursor en
  // "Nombre", listo para escribir.
  const irAlAlta = () => {
    const campo = document.getElementById("sucursal-nombre");
    campo?.scrollIntoView({ behavior: "smooth", block: "center" });
    campo?.focus({ preventScroll: true });
  };

  // Desde la busqueda rapida (Ctrl/Cmd+K). Con varios locales el formulario
  // vive en la pestaña "Alta y cierre": se cambia y se espera a que se pinte.
  useAccionRapida(
    "alta-sucursal",
    () => {
      if (hayVarias) {
        setPestana("locales");
        window.setTimeout(irAlAlta, 150);
      } else {
        irAlAlta();
      }
    },
    !loading && Boolean(tenantId)
  );

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
        {/* Con un solo local no hay nada que elegir. */}
        {hayVarias && <SucursalSelector className="w-[200px] h-9" />}
      </div>

      {!hayVarias ? (
        // Un solo local activo (negocio nuevo, o se cerro una y quedo una): se
        // invita a dar de alta la segunda y debajo queda el formulario.
        <div className="space-y-4 animate-fade-in-up stagger-2">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Store className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="space-y-1.5">
                <p className="text-base">
                  <span className="text-muted-foreground">¿Abriste otro local?</span>{" "}
                  <span className="font-medium">Da de alta tu segunda sucursal</span>
                </p>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                  Con dos o más locales podrás comparar sus ventas, repartir existencias
                  y hacer traspasos entre ellos. Cada local lleva su propio inventario.
                </p>
              </div>
              <SpecularActionButton
                tone="add"
                className="h-9"
                onClick={irAlAlta}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Dar de alta sucursal
              </SpecularActionButton>
            </CardContent>
          </Card>
          <SucursalesCard />
        </div>
      ) : (
        <Tabs
          value={pestana}
          onValueChange={(v) => setPestana(String(v))}
          className="w-full animate-fade-in-up stagger-2"
        >
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
