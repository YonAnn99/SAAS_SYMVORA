"use client";

import { useTranslations } from "next-intl";
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
import { usePlan } from "@/hooks/use-plan";
import { nivelesActivos } from "@/lib/niveles";
import { Link } from "@/i18n/navigation";
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
  const t = useTranslations("branches.card");
  const { can, loading: permisosLoading } = usePermissions();
  const { sucursales, refetch, loading } = useSucursal();
  // Tope de sucursales activas del nivel (migracion 140). Esto solo avisa y deshabilita el boton; quien
  // manda es el trigger `limite_sucursales` de la base.
  const { funciones, puedeAgregarSucursal, sucursalesUsadas, refrescar: refrescarPlan } = usePlan();
  // Prueba (sin nivel, sin tope): todo incluido. Se avisa con tiempo cuánto incluye cada plan para que no haya sorpresas al pagar.
  const enPruebaSinTope = nivelesActivos() && funciones.nivel === null && funciones.sucursalesMax === null;
  const tPlanes = useTranslations("planes");
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function agregar() {
    const limpio = nombre.trim();
    if (!limpio) {
      toast.error(t("nameRequired"));
      return;
    }
    if (!tenantId) return;
    if (!puedeAgregarSucursal) {
      toast.error(t("limitReached", { max: funciones.sucursalesMax ?? 0 }));
      return;
    }

    // El choque con el nombre ya existente se detecta aquí para poder decirlo
    // en castellano; la restricción UNIQUE de la base sigue siendo la que manda.
    if (sucursales.some((s) => s.nombre.toLowerCase() === limpio.toLowerCase())) {
      toast.error(t("duplicate", { nombre: limpio }));
      return;
    }

    setGuardando(true);
    try {
      await createSucursal(tenantId, limpio, direccion.trim() || null);
      setNombre("");
      setDireccion("");
      await refetch();
      void refrescarPlan();
      toast.success(t("created", { nombre: limpio }));
    } catch (error) {
      toast.error(
        esErrorDeLimite(error) ? t("limitReached", { max: funciones.sucursalesMax ?? 0 }) : t("createError")
      );
    } finally {
      setGuardando(false);
    }
  }

  async function alternar(id: string, activa: boolean, nombreSucursal: string) {
    try {
      await updateSucursal(id, { activa: !activa });
      await refetch();
      void refrescarPlan();
      toast.success(
        activa
          ? t("closed", { nombre: nombreSucursal })
          : t("reopened", { nombre: nombreSucursal })
      );
    } catch (error) {
      toast.error(
        esErrorDeLimite(error) ? t("limitReached", { max: funciones.sucursalesMax ?? 0 }) : t("toggleError")
      );
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
          {t("title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("desc")}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {!loading && sucursales.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {t("none")}
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
                  className="h-9 gap-1.5 text-xs shrink-0 sm:h-7"
                  onClick={() => void alternar(s.id, s.activa, s.nombre)}
                >
                  {s.activa ? (
                    <>
                      <PowerOff className="h-3 w-3" aria-hidden="true" />
                      {t("close")}
                    </>
                  ) : (
                    <>
                      <Power className="h-3 w-3" aria-hidden="true" />
                      {t("reopen")}
                    </>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {enPruebaSinTope && sucursalesUsadas >= 1 && (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground" role="note">
            {tPlanes("trialBranches")}{" "}
            <Link href="/billing" className="font-medium underline underline-offset-2">
              {tPlanes("trialBranchesCta")}
            </Link>
          </p>
        )}

        {!puedeAgregarSucursal && (
          <div
            className="flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs sm:flex-row sm:items-center sm:justify-between"
            role="status"
          >
            <p>
              <span className="font-medium">{tPlanes("limit.sucursalesTitle")}. </span>
              {tPlanes("limit.sucursales", {
                nivel: funciones.nivel ? tPlanes(`names.${funciones.nivel}`) : "",
                max: funciones.sucursalesMax ?? 0,
              })}
            </p>
            <Link href="/billing" className="shrink-0 font-medium underline underline-offset-2">
              {tPlanes("upgrade.cta")}
            </Link>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="sucursal-nombre">
              {t("name")}
            </Label>
            <Input
              id="sucursal-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={t("namePlaceholder")}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="sucursal-direccion">
              {t("address")}
            </Label>
            <Input
              id="sucursal-direccion"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder={t("addressPlaceholder")}
              className="h-8 text-sm"
            />
          </div>
          <SpecularActionButton
            tone="add"
            className="h-9 gap-1.5 sm:h-8"
            disabled={guardando || !nombre.trim() || !puedeAgregarSucursal}
            onClick={() => void agregar()}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {t("addShort")}
          </SpecularActionButton>
        </div>
      </CardContent>
    </Card>
  );
}

/** El trigger `limite_sucursales` (migracion 140) rechazo la operacion por el tope del nivel. */
function esErrorDeLimite(error: unknown): boolean {
  const texto =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null
        ? String((error as { message?: unknown }).message ?? "")
        : String(error ?? "");
  return texto.includes("limite_sucursales");
}
