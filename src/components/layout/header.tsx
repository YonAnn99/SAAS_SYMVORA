"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useTheme } from "next-themes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { clearAppPagesCache } from "@/lib/offline/route-cache";
import { borrarSesionOffline } from "@/lib/offline/session-snapshot";
import { abrirAyudaOffline } from "@/components/pwa/offline-capabilities-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CloudOff,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  User,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { TutorialTrigger } from "@/components/tutorial/tutorial-trigger";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { usePermissions } from "@/hooks/use-permissions";
import { moduleLabelKeyForPath } from "@/lib/navigation";
import { useOpenRegister } from "@/features/cash-register/hooks/use-open-register";
import { ProfileDialog } from "@/components/profile/profile-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface HeaderProps {
  onSearchOpen?: () => void;
  onMenuClick?: () => void;
}

export function Header({ onSearchOpen, onMenuClick }: HeaderProps) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { tenantId, tenantName, tenantLogo, role } = useCurrentTenant();
  const { can } = usePermissions();
  const [mounted, setMounted] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const canManageSettings =
    role === "SUPER_ADMIN" || role === "ORG_ADMIN" || can("org.manage_settings");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

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

  const { hasOpenRegister } = useOpenRegister(tenantId);
  const [avisoCajaAbierta, setAvisoCajaAbierta] = useState(false);

  const cerrarSesion = async () => {
    const supabase = createSupabaseBrowserClient();
    // Antes de cerrar sesion: el HTML guardado del panel lleva dentro los datos
    // de quien lo genero. En un mostrador compartido, el siguiente cajero
    // podria ver sin conexion el panel del anterior.
    await clearAppPagesCache();
    // La instantánea trae el negocio y el cajero: en un mostrador
    // compartido no puede heredarla el siguiente turno.
    borrarSesionOffline();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  /**
   * Avisa si queda caja abierta, pero NO impide salir.
   *
   * Bloquear de verdad seria una trampa: sin conexion no se puede cerrar caja
   * (`use-cash-register` lo impide si hay ventas sin subir), asi que el cajero
   * quedaria encerrado hasta que volviera internet. Y tampoco podria bloquear
   * una terminal compartida al alejarse de ella.
   */
  const handleLogout = async () => {
    if (hasOpenRegister === true) {
      setAvisoCajaAbierta(true);
      return;
    }
    await cerrarSesion();
  };

  const handleLocaleSwitch = (locale: "es" | "en") => {
    router.replace(pathname, { locale });
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-border/50 bg-gradient-to-r from-card to-card/50 px-4 md:px-6 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="h-9 w-9 lg:hidden hover:bg-muted/60"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="hidden sm:flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground">
          {moduleLabel}
          {pathname.includes("/facturas") && (
            <span className="rounded-full bg-yellow-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-yellow-700 dark:text-yellow-400">
              Beta
            </span>
          )}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Tutorial trigger */}
        <TutorialTrigger />

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

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200"
          aria-label="Toggle theme"
        >
          {mounted && theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
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
            {/* Sin esta entrada, el diálogo de modo sin conexión (y con él
                el diagnóstico de por qué la app no abre en modo avión) era
                inalcanzable después de la primera vez. */}
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={abrirAyudaOffline}
            >
              <CloudOff className="mr-2 h-4 w-4" />
              <span className="text-sm">Modo sin conexión</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive cursor-pointer"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span className="text-sm">{t("auth.logout")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={avisoCajaAbierta} onOpenChange={setAvisoCajaAbierta}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Tienes la caja abierta</DialogTitle>
            <DialogDescription className="text-sm">
              Si sales sin cerrarla, el corte del día quedará sin cuadrar y el
              siguiente turno arrancará sobre tu caja. Puedes cerrarla ahora o
              salir de todos modos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-8 w-full sm:w-auto"
              onClick={() => void cerrarSesion()}
            >
              Salir de todos modos
            </Button>
            <Button
              className="h-8 w-full sm:w-auto"
              onClick={() => {
                setAvisoCajaAbierta(false);
                router.push("/finances");
              }}
            >
              Ir a cerrar caja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </header>
  );
}
