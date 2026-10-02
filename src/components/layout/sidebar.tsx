"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useRubberBordes, type Borde } from "@/components/ui/rubber-bordes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { usePermissions } from "@/hooks/use-permissions";
import { filterNavigation, stripLocale } from "@/lib/navigation";
import type { User } from "@supabase/supabase-js";

/** Radio de la pestaña activa: la mitad del alto de una opción (40 px). */
const RADIO_PESTANA = 20;

interface SidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

function SidebarContent({ collapsed, onCollapsedChange, onLinkClick, isMobile }: {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onLinkClick?: () => void;
  isMobile?: boolean;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const { tenantId, tenantName, tenantLogo, role, loading: tenantLoading } = useCurrentTenant();
  const { can, loading: permsLoading } = usePermissions();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  // `stripLocale` viene de lib/navigation.ts: su regex ancla el prefijo a un
  // separador, así que no mutila rutas que empiecen por esas letras.
  const isActive = (href: string) => {
    return stripLocale(pathname) === href;
  };

  // El filtro vive en `lib/navigation.ts` para que el menú lateral y la
  // búsqueda global (Ctrl+K) decidan con la misma regla. Ver la nota de esa
  // función sobre por qué se decide por permiso efectivo y no por rol.
  const visibleNav = filterNavigation(role, can);
  const cargando = tenantLoading || permsLoading;

  // Escritorio: la pestaña del color de la pantalla viaja a la opción activa
  // con la misma animación que la barra Catálogo/Lotes/Ajustes (Rubber
  // Segment, `rubber-bordes.ts`), aquí en vertical: se estira hasta abarcar
  // origen y destino y cae con un pequeño aplastado. Dos piezas la pintan:
  //   * `.nav-pestana` (globals.css): el fondo con las curvas invertidas que
  //     la funden con el panel; sus curvas viajan con cada borde.
  //   * la capa de texto activo: copia de las opciones en el color de la
  //     pantalla, recortada a la pastilla, para que las letras cambien de
  //     color justo bajo su borde mientras se estira.
  // Todo va en motion values, no en estado: es pura posición.
  const navRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { inicio, fin, saltar, viajar, detener } = useRubberBordes();
  const altoNav = useMotionValue(0);
  const opacidad = useMotionValue(0);
  const altoPestana = useTransform(() => fin.get() - inicio.get());
  const recorte = useTransform(
    () =>
      `inset(${Math.max(0, inicio.get())}px 0 ${Math.max(0, altoNav.get() - fin.get())}px 0 round ${RADIO_PESTANA}px 0 0 ${RADIO_PESTANA}px)`
  );
  const actual = useRef<Borde | null>(null);

  useLayoutEffect(() => {
    if (isMobile) return;
    const nav = navRef.current;
    if (!nav) return;
    // `animar`: solo al cambiar de opción. Al montar o redimensionar, la
    // pestaña se coloca en su sitio sin volar desde arriba.
    const medir = (animar: boolean) => {
      altoNav.set(nav.offsetHeight);
      const activo = nav.querySelector<HTMLElement>('[data-activo="true"]');
      if (!activo) {
        opacidad.set(0);
        actual.current = null;
        return;
      }
      const destino = { inicio: activo.offsetTop, fin: activo.offsetTop + activo.offsetHeight };
      const origen = actual.current;
      actual.current = destino;
      opacidad.set(1);
      if (animar && !reduce && origen && (origen.inicio !== destino.inicio || origen.fin !== destino.fin)) {
        viajar(origen, destino);
      } else {
        saltar(destino);
      }
    };
    medir(true);
    // Solo si de verdad cambió el alto: el `ResizeObserver` llama una vez al
    // empezar a observar, y ese aviso cortaría el viaje recién lanzado.
    const tamano = new ResizeObserver(() => {
      if (nav.offsetHeight !== altoNav.get()) medir(false);
    });
    tamano.observe(nav);
    return () => tamano.disconnect();
  }, [isMobile, pathname, collapsed, cargando, visibleNav.length, reduce, saltar, viajar, altoNav, opacidad]);

  useEffect(() => detener, [detener]);

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div
        className={cn(
          "flex items-center justify-between px-4",
          isMobile
            ? "h-14 border-b border-border bg-gradient-to-r from-primary/5 to-transparent"
            : "h-16"
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0" onClick={onLinkClick}>
          <Image
            src="/symvora-logo.webp"
            alt="SYMVORA"
            width={120}
            height={28}
            className={cn(
              "h-6 w-auto object-contain flex-shrink-0 transition-all duration-200",
              // En escritorio la barra siempre es oscura: logo en blanco.
              isMobile ? "dark:invert" : "invert",
              collapsed && "mx-auto"
            )}
            priority
          />
          {!collapsed && (
            <span className={cn("text-sm font-bold tracking-tight whitespace-nowrap", isMobile ? "text-foreground" : "text-white")}>
              SYMVORA
            </span>
          )}
        </Link>
        {!isMobile && (
          <button
            onClick={() => onCollapsedChange(!collapsed)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-white/60 transition-all duration-200 hover:text-white hover:bg-white/10"
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Navigation */}
      {/* Escritorio sin relleno a la derecha: la pestaña activa toca el borde
          y se funde con el panel. El `py-5` deja sitio a sus curvas. */}
      <ScrollArea className={cn("flex-1", isMobile && "px-2 py-3")}>
        {cargando ? (
          <div className={cn("flex flex-col gap-1.5", isMobile ? "px-1" : "py-5 pl-3 pr-3")}>
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className={cn("h-8 animate-pulse rounded-lg", isMobile ? "bg-muted/40" : "bg-white/10")}
              />
            ))}
          </div>
        ) : (
          <>
            <nav
              ref={navRef}
              className={cn("flex flex-col", isMobile ? "gap-0.5" : "relative gap-1 py-5 pl-3")}
              key={String(collapsed)}
            >
              {!isMobile && (
                <motion.span
                  aria-hidden
                  className="nav-pestana"
                  style={{ y: inicio, height: altoPestana, opacity: opacidad }}
                />
              )}
              {visibleNav.map((item, idx) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onLinkClick}
                    data-activo={active}
                    className={cn(
                      "group flex items-center gap-2.5 text-sm font-medium animate-sidebar-item-in",
                      isMobile
                        ? cn(
                            "rounded-lg px-3 py-2 transition-all duration-200",
                            active
                              ? "bg-gradient-to-r from-primary/90 to-primary text-primary-foreground shadow-[0_2px_8px_rgba(91,159,237,0.25)]"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          )
                        : cn(
                            // El color de la activa lo pinta la capa de texto
                            // activo por encima; aquí solo va el inactivo.
                            "relative z-10 rounded-l-full px-4 py-2.5 text-white/70 transition-colors duration-200",
                            !active && "hover:bg-white/10 hover:text-white"
                          )
                    )}
                    style={{ animationDelay: `${idx * 28}ms` }}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 flex-shrink-0 transition-transform duration-200",
                        isMobile
                          ? active
                            ? "text-primary-foreground scale-110"
                            : "text-muted-foreground group-hover:text-foreground"
                          : "text-white/70 group-hover:text-white"
                      )}
                    />
                    {!collapsed && (
                      <span className="flex-1 truncate">{t(item.name)}</span>
                    )}
                    {!collapsed && item.beta && (
                      <span className="rounded-full bg-yellow-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-yellow-700 dark:text-yellow-400">
                        Beta
                      </span>
                    )}
                  </Link>
                );
              })}
              {!isMobile && (
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 z-20 flex flex-col gap-1 bg-background py-5 pl-3 text-foreground"
                  style={{ clipPath: recorte, opacity: opacidad }}
                >
                  {visibleNav.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.href}
                        className="flex items-center gap-2.5 rounded-l-full px-4 py-2.5 text-sm font-medium animate-sidebar-item-in"
                        style={{ animationDelay: `${idx * 28}ms` }}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && <span className="flex-1 truncate">{t(item.name)}</span>}
                        {!collapsed && item.beta && (
                          <span className="rounded-full bg-yellow-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-yellow-700 dark:text-yellow-400">
                            Beta
                          </span>
                        )}
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </nav>
          </>
        )}
      </ScrollArea>

      {/* User info */}
      <div className={cn(isMobile ? "border-t border-border p-3" : "p-4 text-white")}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            {tenantLogo ? (
              <Image
                src={tenantLogo}
                alt={tenantName || ""}
                width={28}
                height={28}
                className="h-7 w-7 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium flex-shrink-0",
                  // En escritorio oscuro la barra ya ES `--primary`: el círculo desaparecería.
                  isMobile ? "bg-primary text-primary-foreground" : "bg-white/15 text-white"
                )}
              >
                {tenantName?.charAt(0).toUpperCase() || "N"}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium truncate">
                {tenantName || "Negocio"}
              </span>
              <span className={cn("text-[10px] truncate", isMobile ? "text-muted-foreground" : "text-white/60")}>
                {user?.email || "cargando..."}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Sidebar({ open, onOpenChange, collapsed, onCollapsedChange }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar - always visible on lg+ */}
      <aside className={cn(
        // Sin borde ni fondo propio: va sobre `--nav-bg` del shell, y el panel
        // de contenido se le "desborda" encima con la esquina redondeada.
        "hidden lg:flex lg:flex-col transition-all duration-200",
        collapsed ? "lg:w-16" : "lg:w-56"
      )}>
        <SidebarContent collapsed={collapsed} onCollapsedChange={onCollapsedChange} />
      </aside>

      {/* Mobile sidebar - Sheet drawer */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-56 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent collapsed={false} onCollapsedChange={() => {}} onLinkClick={() => onOpenChange(false)} isMobile />
        </SheetContent>
      </Sheet>
    </>
  );
}
