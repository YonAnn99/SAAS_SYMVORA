"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { LogOut, Plus, User as UserIcon } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useRubberBordes, type Borde } from "@/components/ui/rubber-bordes";
import { ProfileDialog } from "@/components/profile/profile-dialog";
import { useCerrarSesion } from "@/components/layout/cerrar-sesion";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { usePermissions } from "@/hooks/use-permissions";
import { filterNavigation, navegacionDock, stripLocale } from "@/lib/navigation";

/**
 * Dock de celular y tablet (< lg), pegado al borde inferior. Reemplaza al
 * menú lateral: 4 módulos fijos (`navegacionDock`, mismos permisos que el
 * menú) y un "+" que abre un panel con el resto, el negocio, Perfil y Cerrar
 * sesión. Al abrirlo el "+" gira 45° y queda como la "X" de cerrar, en un
 * círculo claro (referencia: el botón "Crear" de Spotify).
 *
 * La opción activa se resalta con una pastilla del color de la pantalla que
 * viaja con la misma animación elástica del menú lateral y de la barra
 * Catálogo/Lotes/Ajustes (`rubber-bordes.ts`), aquí en horizontal.
 *
 * Capas: fondo del panel `z-[43]`, panel `z-[44]` y dock `z-[45]`, para que
 * la "X" siga encima y se pueda tocar. Los diálogos (perfil, confirmaciones)
 * van en `z-50`, por encima de todo.
 *
 * ⚠️ Su alto (64 px + safe area) está descontado en el relleno inferior de
 * <main> (`dashboard-shell.tsx`) y en `alto-panel.ts`.
 */
export function DockMovil() {
  const t = useTranslations();
  const pathname = usePathname();
  const { tenantName, tenantLogo, role, loading: tenantLoading } = useCurrentTenant();
  const { can, loading: permsLoading } = usePermissions();
  const [masAbierto, setMasAbierto] = useState(false);
  const [perfilAbierto, setPerfilAbierto] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const { salir, avisoCajaAbierta } = useCerrarSesion();

  useEffect(() => {
    createSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => setUser(data.user));
  }, []);

  const cargando = tenantLoading || permsLoading;
  // Con el rol sin resolver, el filtro daría el subconjunto de cajero unos
  // instantes (bug del sidebar del 2026-09-04): se espera a que cargue.
  const { fijos, resto } = cargando ? { fijos: [], resto: [] } : navegacionDock(filterNavigation(role, can));
  const ruta = stripLocale(pathname);
  const enMas = resto.some((i) => i.href === ruta);

  // Pastilla elástica: misma técnica que el menú lateral, en motion values.
  const barraRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { inicio, fin, saltar, viajar, detener } = useRubberBordes();
  const opacidad = useMotionValue(0);
  const ancho = useTransform(() => fin.get() - inicio.get());
  const actual = useRef<Borde | null>(null);

  useLayoutEffect(() => {
    const barra = barraRef.current;
    if (!barra) return;
    const medir = (animar: boolean) => {
      const activo = barra.querySelector<HTMLElement>('[data-activo="true"]');
      if (!activo) {
        opacidad.set(0);
        actual.current = null;
        return;
      }
      const destino = { inicio: activo.offsetLeft, fin: activo.offsetLeft + activo.offsetWidth };
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
    let anchoPrevio = barra.offsetWidth;
    // Solo si cambió el ancho (girar el teléfono): el aviso inicial del
    // observer cortaría el viaje recién lanzado.
    const tamano = new ResizeObserver(() => {
      if (barra.offsetWidth === anchoPrevio) return;
      anchoPrevio = barra.offsetWidth;
      medir(false);
    });
    tamano.observe(barra);
    return () => tamano.disconnect();
  }, [ruta, cargando, fijos.length, enMas, reduce, saltar, viajar, opacidad]);

  useEffect(() => detener, [detener]);

  // Panel de "Más": Escape cierra; al abrir, el foco va a la primera opción y
  // al cerrar vuelve al "+".
  const botonMasRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cerrarMas = () => {
    setMasAbierto(false);
    botonMasRef.current?.focus();
  };
  useEffect(() => {
    if (!masAbierto) return;
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMasAbierto(false);
        botonMasRef.current?.focus();
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [masAbierto]);

  const ranura =
    "relative z-10 flex h-full flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium leading-none transition-colors duration-200";
  const curva = "cubic-bezier(0.23,1,0.32,1)";

  return (
    <>
      <AnimatePresence>
        {masAbierto && (
          <>
            <motion.div
              key="fondo"
              aria-hidden
              className="fixed inset-0 z-[43] bg-black/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2 } }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              onClick={cerrarMas}
            />
            <motion.div
              key="panel"
              ref={panelRef}
              role="dialog"
              aria-label="Más módulos"
              className="fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] z-[44] flex max-h-[calc(100dvh-7rem-env(safe-area-inset-bottom))] origin-bottom flex-col overflow-y-auto rounded-3xl bg-popover p-3 text-popover-foreground shadow-xl lg:hidden"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: [0.23, 1, 0.32, 1] } }}
              exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.15, ease: [0.23, 1, 0.32, 1] } }}
            >
              <div className="flex flex-col gap-0.5">
                {resto.map((item) => {
                  const Icon = item.icon;
                  const activo = item.href === ruta;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMasAbierto(false)}
                      aria-current={activo ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-2 py-1.5 text-sm font-semibold outline-none transition-colors active:bg-muted focus-visible:bg-muted",
                        activo && "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full",
                          activo ? "bg-[var(--nav-bg)] text-white" : "bg-muted text-foreground"
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="truncate">{t(item.name)}</span>
                    </Link>
                  );
                })}
              </div>

              {/* El negocio y la cuenta: lo que en escritorio va al pie del menú. */}
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-muted/60 p-3">
                {tenantLogo ? (
                  <Image
                    src={tenantLogo}
                    alt={tenantName || ""}
                    width={44}
                    height={44}
                    className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[var(--nav-bg)] text-base font-semibold text-white">
                    {tenantName?.charAt(0).toUpperCase() || "N"}
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">{tenantName || "Negocio"}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{user?.email || "cargando..."}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMasAbierto(false);
                    setPerfilAbierto(true);
                  }}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-background transition-colors active:bg-muted"
                  aria-label="Mi perfil"
                  title="Mi perfil"
                >
                  <UserIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMasAbierto(false);
                    void salir({ confirmar: true });
                  }}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-background text-red-500 transition-colors active:bg-muted"
                  aria-label="Cerrar sesión"
                  title="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Pegado al borde inferior, de lado a lado; solo las esquinas de arriba
          redondeadas. El safe area deja libre la barra de gestos del teléfono. */}
      <nav
        aria-label="Módulos"
        className="fixed inset-x-0 bottom-0 z-[45] rounded-t-[28px] bg-[var(--nav-bg)] pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_rgba(0,0,0,0.18)] lg:hidden"
      >
        <div ref={barraRef} className="relative mx-1.5 flex h-16 items-stretch py-1.5">
          <motion.span
            aria-hidden
            className="absolute inset-y-1.5 left-0 rounded-full bg-background"
            style={{ x: inicio, width: ancho, opacity: opacidad }}
          />
          {cargando
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-1 items-center justify-center">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
                </div>
              ))
            : fijos.map((item) => {
                const Icon = item.icon;
                const activo = item.href === ruta;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-activo={activo}
                    aria-current={activo ? "page" : undefined}
                    onClick={() => setMasAbierto(false)}
                    className={cn(ranura, activo ? "text-foreground" : "text-white/70 active:text-white")}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="max-w-full truncate px-1">{t(item.name)}</span>
                  </Link>
                );
              })}
          {!cargando && (
            <button
              ref={botonMasRef}
              type="button"
              data-activo={enMas}
              aria-expanded={masAbierto}
              aria-label={masAbierto ? "Cerrar" : "Más módulos"}
              onClick={() => (masAbierto ? cerrarMas() : setMasAbierto(true))}
              className={cn(ranura, enMas || masAbierto ? "text-foreground" : "text-white/70 active:text-white")}
            >
              {/* El "+" girado 45° ES la "X": no se cambia de icono, se gira.
                  Abierto, el círculo se rellena, crece y baja al centro de la
                  ranura mientras la etiqueta se desvanece. Solo transform,
                  color y opacidad. */}
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-[transform,background-color,color] duration-[250ms]",
                  masAbierto ? "translate-y-[6px] scale-[1.35] bg-background text-foreground" : "bg-transparent"
                )}
                style={{ transitionTimingFunction: curva }}
              >
                <Plus
                  className={cn("h-5 w-5 transition-transform duration-[250ms]", masAbierto && "rotate-45")}
                  style={{ transitionTimingFunction: curva }}
                  strokeWidth={masAbierto ? 2.25 : 2}
                />
              </span>
              <span
                aria-hidden
                className={cn("transition-opacity duration-150", masAbierto && "opacity-0")}
              >
                Más
              </span>
            </button>
          )}
        </div>
      </nav>

      <ProfileDialog open={perfilAbierto} onOpenChange={setPerfilAbierto} />
      {avisoCajaAbierta}
    </>
  );
}
