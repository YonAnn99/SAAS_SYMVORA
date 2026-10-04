"use client";

/**
 * Las claves de acceso en celular: una pastilla por clave con una sola
 * accion, Eliminar (deslizar completo o a la mitad), con confirmacion.
 */

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  COLOR_ELIMINAR,
  FilaDeslizable,
  usePistaDeslizar,
} from "@/components/ui/fila-deslizable";
import { fechaCorta, nombreDeClave, roleColors, type InviteKey } from "../tipos-usuarios";

interface InviteKeySwipeListProps {
  claves: InviteKey[];
  /** `false` si no se pudo: la pastilla reaparece. */
  onEliminar: (key: InviteKey) => Promise<boolean>;
}

export function InviteKeySwipeList({ claves, onEliminar }: InviteKeySwipeListProps) {
  const t = useTranslations();
  const { alAbrir } = usePistaDeslizar();

  return (
    <div className="space-y-2">
      {claves.map((key) => {
        const nombre = nombreDeClave(key);
        const quien = nombre ?? key.email;
        return (
          <FilaDeslizable
            key={key.id}
            label={`Clave de ${quien}`}
            acciones={[
              {
                id: "eliminar",
                etiqueta: "Eliminar",
                color: COLOR_ELIMINAR,
                icono: <Trash2 size={18} strokeWidth={2} />,
                alElegir: () => onEliminar(key),
                confirmar: {
                  titulo: `¿Eliminar la clave de ${quien}?`,
                  descripcion: "Ya no servirá para entrar. Esta acción no se puede deshacer.",
                },
              },
            ]}
            onOpenChange={alAbrir}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{quien}</p>
              {nombre && <p className="truncate text-xs text-muted-foreground">{key.email}</p>}
              <div className="flex items-center gap-1.5 text-xs">
                <Badge className={`${roleColors[key.role]} text-[10px] px-1.5 py-0`}>
                  {t(`users.roles.${key.role}`)}
                </Badge>
                <span className="opacity-60">{fechaCorta(key.created_at)}</span>
              </div>
            </div>
            <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {key.key}
            </code>
          </FilaDeslizable>
        );
      })}
    </div>
  );
}
