"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LogOut,
  Search,
  Settings,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCambioTema } from "@/hooks/use-cambio-tema";
import { IconoTema } from "@/components/icono-tema";
import { TutorialTrigger } from "@/components/tutorial/tutorial-trigger";
import { AprendeTrigger } from "@/components/tutorial/aprende-trigger";
import { useIsDemo } from "@/hooks/use-is-demo";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { usePermissions } from "@/hooks/use-permissions";
import { moduleLabelKeyForPath } from "@/lib/navigation";
import { ProfileDialog } from "@/components/profile/profile-dialog";
import { useCerrarSesion } from "@/components/layout/cerrar-sesion";

interface HeaderProps {
  onSearchOpen?: () => void;
}

export function Header({ onSearchOpen }: HeaderProps) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { oscuro, montado, alternar } = useCambioTema();
  const { tenantName, tenantLogo, role } = useCurrentTenant();
  const { can } = usePermissions();
  const isDemo = useIsDemo();
  const [profileOpen, setProfileOpen] = useState(false);

  const canManageSettings =
    role === "SUPER_ADMIN" || role === "ORG_ADMIN" || can("org.manage_settings");

  // El título sale de `lib/navigation.ts`, la misma fuente que el menú lateral
  // y la búsqueda global. Antes este componente tenía su propio mapa con las
  // etiquetas en español a pelo, y resolvía con `path.includes(...)` sobre un
  // objeto en orden de declaración: `/settings/payments` mostraba
  // "Configuración", y `/customers` y `/suggestions` mostraban "Dashboard".
  //
  // Si la ruta no se reconoce se devuelve cadena vacía, no "Dashboard":
  // afirmar un módulo equivocado es peor que no mostrar ninguno.
  const labelKey = moduleLabelKeyForPath(pathname);
  const moduleLabel = labelKey ? t(labelKey) : "";

  // Salir (con el aviso de caja abierta) es compartido con el pie del menú
  // lateral: ver `cerrar-sesion.tsx`.
  const { salir: handleLogout, avisoCajaAbierta } = useCerrarSesion();

  const handleLocaleSwitch = (locale: "es" | "en") => {
    router.replace(pathname, { locale });
  };

  // En escritorio, sin desenfoque y con su propia curva: el panel tiene la
  // esquina redondeada sobre la barra lateral, y el `backdrop-blur` arrastraba
  // el color de la barra (lo que queda detrás de la esquina) hacia dentro del
  // header. Aquí nada pasa por debajo, así que el blur no aportaba nada.
  return (
    <header className="flex h-16 items-center justify-between bg-gradient-to-r from-card to-card/50 px-4 md:px-6 backdrop-blur-sm lg:rounded-tl-[28px] lg:backdrop-blur-none">
      <div className="flex items-center gap-4">
        {/* Celular y tablet: solo el logo de SYMVORA, sin la palabra, para no
            saturar el header. El nombre del módulo ya lo
            dice el dock inferior (`dock-movil.tsx`) y repetirlo aquí era
            redundante. El logo es negro sobre transparente: `dark:invert` lo
            pasa a blanco en oscuro, igual que en el menú lateral. */}
        <Link href="/dashboard" className="flex items-center lg:hidden" aria-label="SYMVORA, ir al inicio">
          <Image
            src="/symvora-logo.webp"
            alt=""
            width={120}
            height={28}
            className="h-6 w-auto object-contain dark:invert"
            priority
          />
        </Link>
        {/* Escritorio: el nombre del módulo (el logo ya está en el menú lateral). */}
        <h1 className="hidden items-center gap-2 text-sm font-semibold tracking-wide text-foreground lg:flex">
          {moduleLabel}
          {pathname.includes("/facturas") && (
            <span className="rounded-full bg-yellow-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-yellow-700 dark:text-yellow-400">
              Beta
            </span>
          )}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* En el demo no se ofrece el tutorial: recorre módulos restringidos y
            se atasca. Se OCULTA en vez de poner un aviso de "no disponible" —
            es una ayuda opcional, y anunciar su ausencia llamaría la atención
            sobre algo que nadie iba a echar en falta. Mismo criterio que el
            resto del cliente en demo (ver `demo-restricted-notice.tsx`). */}
        {!isDemo && <TutorialTrigger />}
        {/* Guia escrita del modulo actual, en /es/aprende. */}
        <AprendeTrigger />

        {/* Search trigger */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onSearchOpen}
          className="h-9 gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200"
        >
          <Search className="h-4 w-4" />
          <kbd className="hidden sm:inline-flex h-6 select-none items-center gap-1 rounded border border-border/50 bg-muted/40 px-2 font-mono text-[11px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>

        {/* Language switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-9 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer transition-all duration-200" />}>
            {pathname.startsWith("/en") ? "🇺🇸 EN" : "🇲🇽 ES"}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem onClick={() => handleLocaleSwitch("es")} className="cursor-pointer">
              <span className="text-sm">🇲🇽 Español</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleLocaleSwitch("en")} className="cursor-pointer">
              <span className="text-sm">🇺🇸 English</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Cambio de tema con el efecto "Circle blur" (ver `useCambioTema`). */}
        <Button
          variant="ghost"
          size="icon"
          onClick={alternar}
          className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200"
          aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
          <IconoTema oscuro={oscuro} montado={montado} />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-semibold overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-[0_4px_12px_rgba(91,159,237,0.3)] active:scale-95">
              {tenantLogo ? (
                <Image src={tenantLogo} alt={tenantName || ""} width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
              ) : (
                tenantName?.charAt(0).toUpperCase() || "N"
              )}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48" align="end">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => setProfileOpen(true)}
            >
              <User className="mr-2 h-4 w-4" />
              <span className="text-sm">Perfil</span>
            </DropdownMenuItem>
            {canManageSettings && (
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => router.push("/settings")}
              >
                <Settings className="mr-2 h-4 w-4" />
                <span className="text-sm">{t("layout.settings")}</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive cursor-pointer"
              onClick={() => void handleLogout()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span className="text-sm">{t("auth.logout")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {avisoCajaAbierta}

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </header>
  );
}
