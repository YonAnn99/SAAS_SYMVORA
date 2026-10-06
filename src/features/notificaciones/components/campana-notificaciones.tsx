"use client";

import { useState } from "react";
import {
  ArrowLeftRight,
  Bell,
  ClipboardList,
  Package,
  PackageX,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  COLOR_ELIMINAR,
  FilaDeslizable,
  usePistaDeslizar,
} from "@/components/ui/fila-deslizable";
import { cn } from "@/lib/utils";
import { useEsEscritorio } from "@/hooks/use-es-movil";
import { etiquetaGlobo, haceCuanto, type Notificacion, type TipoNotificacion } from "@/lib/notificaciones";
import { useNotificaciones } from "@/features/notificaciones/hooks/use-notificaciones";

const ESTILO: Record<TipoNotificacion, { icono: LucideIcon; clase: string }> = {
  stock_agotado: { icono: PackageX, clase: "bg-red-500/15 text-red-600 dark:text-red-400" },
  stock_bajo: { icono: TriangleAlert, clase: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  caja_cerrada: { icono: Wallet, clase: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  producto: { icono: Package, clase: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  compra: { icono: ShoppingCart, clase: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  orden_compra: { icono: ClipboardList, clase: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  ajuste: { icono: SlidersHorizontal, clase: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  traspaso: { icono: ArrowLeftRight, clase: "bg-teal-500/15 text-teal-600 dark:text-teal-400" },
};

/** Icono del tipo, con el punto de "nueva" en su esquina. */
function IconoNotificacion({ n, nueva }: { n: Notificacion; nueva: boolean }) {
  const estilo = ESTILO[n.tipo] ?? ESTILO.producto;
  const Icono = estilo.icono;
  return (
    <span
      className={cn(
        "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        estilo.clase
      )}
    >
      <Icono className="h-4 w-4" />
      {nueva && (
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-popover"
          aria-label="Nueva"
        />
      )}
    </span>
  );
}

/**
 * Campana del header. Al abrirla se marcan todas como leídas, pero las que
 * eran nuevas conservan su punto mientras el panel siga abierto (se compara
 * contra el corte de ANTES de abrir).
 *
 * Descartar (solo para este usuario, migración 109):
 * - escritorio: la X que aparece al pasar el mouse;
 * - celular y tablet: deslizar a la izquierda, la misma pastilla de Productos
 *   (`FilaDeslizable`), sin confirmación: quitar un aviso no borra nada.
 */
export function CampanaNotificaciones() {
  const { lista, leidoHasta, noLeidas, cargando, marcarLeidas, ocultar } = useNotificaciones();
  const esEscritorio = useEsEscritorio();
  const router = useRouter();
  const { verPista, alAbrir } = usePistaDeslizar();
  const [abierta, setAbierta] = useState(false);
  const [corteAlAbrir, setCorteAlAbrir] = useState<string | null>(null);

  const globo = etiquetaGlobo(noLeidas);

  const alCambiar = (abrir: boolean) => {
    setAbierta(abrir);
    if (abrir) {
      setCorteAlAbrir(leidoHasta);
      if (noLeidas > 0) void marcarLeidas();
    }
  };

  const esNueva = (n: Notificacion) =>
    !corteAlAbrir || new Date(n.creado_en).getTime() > new Date(corteAlAbrir).getTime();

  const abrirEnlace = (n: Notificacion) => {
    if (!n.enlace) return;
    setAbierta(false);
    router.push(n.enlace);
  };

  return (
    <Popover open={abierta} onOpenChange={alCambiar}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200"
            aria-label={globo ? `Notificaciones, ${noLeidas} sin leer` : "Notificaciones"}
          />
        }
      >
        <Bell className="h-4 w-4" />
        {globo && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-card">
            {globo}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b border-border/60 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Notificaciones</p>
            {lista.length > 0 && (
              <span className="text-xs text-muted-foreground">Últimas {lista.length}</span>
            )}
          </div>
          {!esEscritorio && verPista && lista.length > 0 && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Desliza a la izquierda para eliminar
            </p>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {cargando && lista.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : lista.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Bell className="h-6 w-6 text-muted-foreground/60" />
              <p className="text-sm font-medium">Sin notificaciones</p>
              <p className="text-xs text-muted-foreground">
                Aquí verás el stock que se acaba y lo que hace tu equipo.
              </p>
            </div>
          ) : esEscritorio ? (
            <ul className="divide-y divide-border/50">
              {lista.map((n) => {
                const contenido = (
                  <div className="flex gap-3 py-3 pl-4 pr-10">
                    <span className="mt-0.5">
                      <IconoNotificacion n={n} nueva={esNueva(n)} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug text-foreground">{n.titulo}</p>
                      {n.mensaje && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.mensaje}</p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground/80">{haceCuanto(n.creado_en)}</p>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id} className="group relative">
                    {n.enlace ? (
                      <Link
                        href={n.enlace}
                        onClick={() => setAbierta(false)}
                        className="block transition-colors hover:bg-muted/60"
                      >
                        {contenido}
                      </Link>
                    ) : (
                      contenido
                    )}
                    {/* Fuera del enlace: cerrar no navega. Visible al pasar el
                        mouse, con el teclado, o siempre en pantallas sin hover. */}
                    <button
                      type="button"
                      onClick={() => void ocultar(n.id)}
                      aria-label="Descartar notificación"
                      title="Descartar"
                      className="absolute right-2 top-2.5 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="space-y-2 p-2">
              {lista.map((n) => (
                <FilaDeslizable
                  key={n.id}
                  label={n.titulo}
                  alto={72}
                  onOpenChange={alAbrir}
                  onTap={n.enlace ? () => abrirEnlace(n) : undefined}
                  acciones={[
                    {
                      id: "eliminar",
                      etiqueta: "Eliminar",
                      color: COLOR_ELIMINAR,
                      icono: <Trash2 size={18} strokeWidth={2} />,
                      alElegir: () => ocultar(n.id),
                    },
                  ]}
                >
                  <IconoNotificacion n={n} nueva={esNueva(n)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{n.titulo}</p>
                    {n.mensaje && <p className="truncate text-xs text-muted-foreground">{n.mensaje}</p>}
                    <p className="text-[11px] opacity-60">{haceCuanto(n.creado_en)}</p>
                  </div>
                </FilaDeslizable>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
