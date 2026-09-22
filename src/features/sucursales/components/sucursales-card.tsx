"use client";

import { useState } from "react";
import { Store, Plus, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { usePermissions } from "@/hooks/use-permissions";
import { useSucursal } from "@/contexts/sucursal-context";
import {
  createSucursal,
  updateSucursal,
} from "@/features/sucursales/services/sucursales-service";

/**
 * Alta y baja de sucursales, dentro de Configuracion.
 *
 * SE CIERRAN, NO SE BORRAN. No hay boton de eliminar a proposito: una sucursal
 * con ventas detras no se puede borrar —la migracion 076 lo impide con
 * `ON DELETE RESTRICT`— porque su historico la sigue apuntando. Ofrecer un
 * boton que falla en cuanto el local ha vendido algo, que es siempre, seria
 * peor que no ofrecerlo. Cerrar la saca del desplegable de apertura de caja y
 * la deja intacta en los informes.
 *
 * QUIEN PUEDE: quien tenga `org.manage_branches`, que de fabrica es SOLO el
 * SUPER_ADMIN (migracion 077). El dueño puede cederselo a un encargado desde
 * Usuarios -> Permisos; por eso se comprueba el PERMISO y no el rol, que desde
 * la migracion 055 ya no cuenta toda la historia.
 *
 * ESCONDER LA TARJETA NO ES LA PROTECCION, solo la cortesia de no enseñar un
 * boton que iba a fallar. Quien manda es RLS: las politicas de escritura de
 * `sucursales` exigen el mismo permiso, asi que saltarse la interfaz y llamar a
 * PostgREST no sirve de nada. En este repo la barrera cosmetica ya fallo cuatro
 * veces (bugs #1, #27, #33, #34).
 */
export function SucursalesCard() {
  const { tenantId } = useCurrentTenant();
  const { can, loading: permisosLoading } = usePermissions();
  const { sucursales, refetch, loading } = useSucursal();
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function agregar() {
    const limpio = nombre.trim();
    if (!limpio) {
      toast.error("Escribe un nombre para la sucursal");
      return;
    }
    if (!tenantId) return;

    // El choque con el nombre ya existente se detecta aquí para poder decirlo
    // en castellano; la restricción UNIQUE de la base sigue siendo la que manda.
    if (sucursales.some((s) => s.nombre.toLowerCase() === limpio.toLowerCase())) {
      toast.error(`Ya tienes una sucursal llamada "${limpio}"`);
      return;
    }

    setGuardando(true);
    try {
      await createSucursal(tenantId, limpio, direccion.trim() || null);
      setNombre("");
      setDireccion("");
      await refetch();
      toast.success(`Sucursal "${limpio}" creada`);
    } catch {
      toast.error("No se pudo crear la sucursal. Revisa tus permisos.");
    } finally {
      setGuardando(false);
    }
  }

  async function alternar(id: string, activa: boolean, nombreSucursal: string) {
    try {
      await updateSucursal(id, { activa: !activa });
      await refetch();
      toast.success(
        activa
          ? `"${nombreSucursal}" cerrada. Su historial se conserva.`
          : `"${nombreSucursal}" reabierta`
      );
    } catch {
      toast.error("No se pudo cambiar la sucursal. Revisa tus permisos.");
    }
  }

  // Mientras se resuelven los permisos no se dibuja nada: enseñar la tarjeta y
  // quitarla medio segundo después es peor que tardar un poco en mostrarla.
  if (permisosLoading || !can("org.manage_branches")) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Store className="h-4 w-4" aria-hidden="true" />
          Sucursales
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Cada venta se cuenta en la sucursal de la caja donde se cobró, así que
          puedes ver las cifras de cada local por separado. El inventario sigue
          siendo común a todo el negocio.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {!loading && sucursales.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Todavía no tienes sucursales. Si tu negocio es un solo local, no
            necesitas crear ninguna.
          </p>
        )}

        {sucursales.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border">
            {sucursales.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      s.activa ? "" : "text-muted-foreground line-through"
                    }`}
                  >
                    {s.nombre}
                  </p>
                  {s.direccion && (
                    <p className="text-xs text-muted-foreground truncate">
                      {s.direccion}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs shrink-0"
                  onClick={() => void alternar(s.id, s.activa, s.nombre)}
                >
                  {s.activa ? (
                    <>
                      <PowerOff className="h-3 w-3" aria-hidden="true" />
                      Cerrar
                    </>
                  ) : (
                    <>
                      <Power className="h-3 w-3" aria-hidden="true" />
                      Reabrir
                    </>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="sucursal-nombre">
              Nombre
            </Label>
            <Input
              id="sucursal-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Centro"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="sucursal-direccion">
              Dirección (opcional)
            </Label>
            <Input
              id="sucursal-direccion"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Av. Juárez 12"
              className="h-8 text-sm"
            />
          </div>
          <SpecularActionButton
            tone="add"
            className="h-8 gap-1.5"
            disabled={guardando || !nombre.trim()}
            onClick={() => void agregar()}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Agregar
          </SpecularActionButton>
        </div>
      </CardContent>
    </Card>
  );
}
