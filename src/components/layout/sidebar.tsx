"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, LogOut, User as UserIcon } from "lucide-react";
import { motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useRubberBordes, type Borde } from "@/components/ui/rubber-bordes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { usePermissions } from "@/hooks/use-permissions";
import { filterNavigation, stripLocale } from "@/lib/navigation";
import type { User } from "@supabase/supabase-js";
import { ProfileDialog } from "@/components/profile/profile-dialog";
import { useCerrarSesion } from "@/components/layout/cerrar-sesion";

/** Radio de la pestaña activa: la mitad del alto de una opción (40 px). */
const RADIO_PESTANA = 20;

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

/**
 * Menú lateral, SOLO escritorio (lg+). En celular y tablet lo reemplaza el
 * dock inferior (`dock-movil.tsx`), que reparte los mismos módulos.
 */
function SidebarContent({ collapsed, onCollapsedChange }: SidebarProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const { tenantName, tenantLogo, role, loading: tenantLoading } = useCurrentTenant();
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
  }, [pathname, collapsed, cargando, visibleNav.length, reduce, saltar, viajar, altoNav, opacidad]);

  useEffect(() => detener, [detener]);

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <Image
            src="/symvora-logo.webp"
            alt="SYMVORA"
            width={120}
            height={28}
            className={cn(
              "h-6 w-auto object-contain flex-shrink-0 transition-all duration-200",
              // La barra siempre es oscura: logo en blanco.
              "invert",
              collapsed && "mx-auto"
            )}
            priority
          />
          {!collapsed && (
            <span className="text-sm font-bold tracking-tight whitespace-nowrap text-white">
              SYMVORA
            </span>
          )}
        </Link>
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
      </div>

      {/* Navigation */}
      {/* Sin relleno a la derecha: la pestaña activa toca el borde y se funde
          con el panel. El `py-5` deja sitio a sus curvas. */}
      <ScrollArea className="flex-1">
        {cargando ? (
          <div className="flex flex-col gap-1.5 py-5 pl-3 pr-3">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="h-8 animate-pulse rounded-lg bg-white/10" />
            ))}
          </div>
        ) : (
          <>
            <nav
              ref={navRef}
              className="relative flex flex-col gap-1 py-5 pl-3"
              key={String(collapsed)}
            >
              <motion.span
                aria-hidden
                className="nav-pestana"
                style={{ y: inicio, height: altoPestana, opacity: opacidad }}
              />
              {visibleNav.map((item, idx) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-activo={active}
                    className={cn(
                      // El color de la activa lo pinta la capa de texto activo
                      // por encima; aquí solo va el inactivo.
                      "group relative z-10 flex items-center gap-2.5 rounded-l-full px-4 py-2.5 text-sm font-medium text-white/70 transition-colors duration-200 animate-sidebar-item-in",
                      !active && "hover:bg-white/10 hover:text-white"
                    )}
                    style={{ animationDelay: `${idx * 28}ms` }}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0 text-white/70 transition-colors duration-200 group-hover:text-white" />
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
            </nav>
          </>
        )}
      </ScrollArea>

      <PieNegocio
        collapsed={collapsed}
        tenantName={tenantName}
        tenantLogo={tenantLogo}
        email={user?.email}
      />
    </div>
  );
}

/**
 * Pie del menú de escritorio: tarjeta del negocio en columna (logo grande,
 * nombre, correo) y dos botones, Perfil y Cerrar sesión. Colapsado, solo el
 * logo chico y los botones apilados.
 *
 * Botón de salir con `confirmar`: pregunta antes de cerrar sesión, o abre el
 * aviso de caja abierta si la hay (`cerrar-sesion.tsx`).
 */
function PieNegocio({
  collapsed,
  tenantName,
  tenantLogo,
  email,
}: {
  collapsed: boolean;
  tenantName: string | null | undefined;
  tenantLogo: string | null | undefined;
  email: string | undefined;
}) {
  const [perfilAbierto, setPerfilAbierto] = useState(false);
  const { salir, avisoCajaAbierta } = useCerrarSesion();
  const tamano = collapsed ? 36 : 64;

  const boton =
    "flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 transition-colors duration-200 hover:bg-white/15 active:scale-95 cursor-pointer";

  return (
    <div className={cn("flex flex-col items-center text-white", collapsed ? "gap-2 px-2 pb-4 pt-2" : "gap-3 px-4 pb-5 pt-2")}>
      {tenantLogo ? (
        <Image
          src={tenantLogo}
          alt={tenantName || ""}
          width={tamano}
          height={tamano}
          className={cn("rounded-full object-cover ring-2 ring-white/20 flex-shrink-0", collapsed ? "h-9 w-9" : "h-16 w-16")}
        />
      ) : (
        <div
          className={cn(
            // `bg-white/15`: en oscuro la barra ya ES `--primary` y un círculo
            // de ese color desaparecería.
            "flex items-center justify-center rounded-full bg-white/15 font-semibold ring-2 ring-white/20 flex-shrink-0",
            collapsed ? "h-9 w-9 text-sm" : "h-16 w-16 text-xl"
          )}
        >
          {tenantName?.charAt(0).toUpperCase() || "N"}
        </div>
      )}

      {!collapsed && (
        <div className="flex w-full min-w-0 flex-col items-center text-center">
          <span className="w-full truncate text-sm font-semibold">{tenantName || "Negocio"}</span>
          <span className="w-full truncate text-[11px] text-white/60">{email || "cargando..."}</span>
        </div>
      )}

      <div className={cn("flex items-center gap-2", collapsed ? "flex-col" : "mt-1")}>
        <button
          type="button"
          onClick={() => setPerfilAbierto(true)}
          className={boton}
          aria-label="Mi perfil"
          title="Mi perfil"
        >
          <UserIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => void salir({ confirmar: true })}
          className={cn(boton, "text-red-400 hover:text-red-300")}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      <ProfileDialog open={perfilAbierto} onOpenChange={setPerfilAbierto} />
      {avisoCajaAbierta}
    </div>
  );
}

export function Sidebar({ collapsed, onCollapsedChange }: SidebarProps) {
  return (
    <aside
      className={cn(
        // Sin borde ni fondo propio: va sobre `--nav-bg` del shell, y el panel
        // de contenido se le "desborda" encima con la esquina redondeada.
        "hidden lg:flex lg:flex-col transition-all duration-200",
        collapsed ? "lg:w-16" : "lg:w-56"
      )}
    >
      <SidebarContent collapsed={collapsed} onCollapsedChange={onCollapsedChange} />
    </aside>
  );
}
