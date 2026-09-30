"use client";

/**
 * Los miembros del negocio en celular: una pastilla deslizable por usuario
 * (ver `components/ui/fila-deslizable.tsx`).
 *
 *   a la mitad    -> Eliminar | Permisos
 *   completo      -> Eliminar (con confirmacion)
 *   tienda        -> Sucursales (a un costado, con varias sucursales)
 *   tocar el rol  -> cambiar de rol
 *
 * Mismas reglas que la tabla: solo el dueño administra, y ni Permisos ni
 * Eliminar se ofrecen sobre uno mismo ni sobre el dueño (el servidor lo
 * rechazaria; asi un deslizamiento accidental no termina en error).
 */

import { SlidersHorizontal, Store, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  COLOR_EDITAR,
  COLOR_ELIMINAR,
  FilaDeslizable,
  noArrastrar,
  usePistaDeslizar,
  type AccionFila,
} from "@/components/ui/fila-deslizable";
import { fechaCorta, roleColors, type Member } from "../tipos-usuarios";

interface MemberSwipeListProps {
  miembros: Member[];
  canManage: boolean;
  currentUserId: string | null;
  hayVarias: boolean;
  /** Nombres de las sucursales asignadas ("Todas" si ninguna). */
  sucursalesDe: (member: Member) => string;
  onPermisos: (member: Member) => void;
  onSucursales: (member: Member) => void;
  onCambiarRol: (member: Member) => void;
  /** `false` si no se pudo: la pastilla reaparece. */
  onEliminar: (member: Member) => Promise<boolean>;
}

export function MemberSwipeList({
  miembros,
  canManage,
  currentUserId,
  hayVarias,
  sucursalesDe,
  onPermisos,
  onSucursales,
  onCambiarRol,
  onEliminar,
}: MemberSwipeListProps) {
  const t = useTranslations();
  const { verPista, alAbrir } = usePistaDeslizar();

  return (
    <div className="space-y-2">
      {canManage && verPista && (
        <p className="px-1 pb-1 text-[11px] text-muted-foreground">
          Desliza a la izquierda para ver permisos o eliminar
        </p>
      )}

      {miembros.map((member) => {
        const esDueno = member.role === "SUPER_ADMIN";
        const administrable = canManage && member.user_id !== currentUserId && !esDueno;
        const correo = member.user_email || "N/A";

        const acciones: AccionFila[] = administrable
          ? [
              {
                id: "eliminar",
                etiqueta: "Eliminar",
                color: COLOR_ELIMINAR,
                icono: <Trash2 size={18} strokeWidth={2} />,
                alElegir: () => onEliminar(member),
                confirmar: {
                  titulo: `¿Eliminar a ${correo}?`,
                  descripcion: "Pierde el acceso al negocio. Esta acción no se puede deshacer.",
                },
              },
              {
                id: "permisos",
                etiqueta: "Permisos",
                color: COLOR_EDITAR,
                icono: <SlidersHorizontal size={18} strokeWidth={2} />,
                alElegir: () => onPermisos(member),
              },
            ]
          : [];

        const etiquetaRol = (
          <Badge className={`${roleColors[member.role]} text-[10px] px-1.5 py-0`}>
            {t(`users.roles.${member.role}`)}
          </Badge>
        );

        return (
          <FilaDeslizable
            key={member.id}
            label={correo}
            acciones={acciones}
            onOpenChange={alAbrir}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{correo}</p>
              <div className="flex min-w-0 items-center gap-1.5 text-xs">
                {canManage && !esDueno ? (
                  <span onPointerDown={noArrastrar} className="flex shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCambiarRol(member);
                      }}
                      className="cursor-pointer transition-opacity hover:opacity-80"
                      aria-label={`Cambiar el rol de ${correo}`}
                    >
                      {etiquetaRol}
                    </button>
                  </span>
                ) : (
                  <span className="flex shrink-0">{etiquetaRol}</span>
                )}
                <span className="min-w-0 truncate opacity-60">
                  {hayVarias && (
                    <>
                      {esDueno ? "Todas (dueño)" : sucursalesDe(member)}
                      {" · "}
                    </>
                  )}
                  {fechaCorta(member.creado_en)}
                </span>
              </div>
            </div>

            {/* Al dueño no: siempre ve todas (la base lo rechaza). */}
            {canManage && hayVarias && !esDueno && (
              <span onPointerDown={noArrastrar} className="-mr-2 flex shrink-0 items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSucursales(member);
                  }}
                  aria-label={`Sucursales de ${correo}`}
                  title="Sucursales"
                >
                  <Store className="h-4 w-4" />
                </Button>
              </span>
            )}
          </FilaDeslizable>
        );
      })}
    </div>
  );
}
