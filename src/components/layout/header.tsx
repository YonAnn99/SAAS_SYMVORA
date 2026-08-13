"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useTheme } from "next-themes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, User, Sun, Moon, Search, Menu } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { TutorialTrigger } from "@/components/tutorial/tutorial-trigger";
import { useCurrentTenant } from "@/hooks/use-current-tenant";

interface HeaderProps {
  onSearchOpen?: () => void;
  onMenuClick?: () => void;
}

export function Header({ onSearchOpen, onMenuClick }: HeaderProps) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { tenantName, tenantLogo } = useCurrentTenant();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Mapeo de rutas a etiquetas de módulos
  const getModuleLabel = (path: string): string => {
    const moduleLabels: Record<string, string> = {
      "/dashboard": "Dashboard",
      "/pos": "Punto de Venta",
      "/products": "Productos",
      "/purchases": "Compras",
      "/purchase-orders": "Órdenes de Compra",
      "/finances": "Finanzas",
      "/facturas": "Facturación",
      "/users": "Usuarios",
      "/activity": "Bitácora",
      "/settings": "Configuración",
      "/reports": "Reportes",
      "/billing": "Suscripción",
      "/variants": "Variantes",
      "/lots": "Lotes",
      "/inventory-adjustments": "Ajustes de Inventario",
    };

    for (const [route, label] of Object.entries(moduleLabels)) {
      if (path.includes(route)) return label;
    }
    return "Dashboard";
  };

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
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
          {getModuleLabel(pathname)}
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
          <DropdownMenuTrigger nativeButton={false}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-semibold overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-[0_4px_12px_rgba(91,159,237,0.3)] active:scale-95">
              {tenantLogo ? (
                <Image src={tenantLogo} alt={tenantName || ""} width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
              ) : (
                tenantName?.charAt(0).toUpperCase() || "N"
              )}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48" align="end">
            <DropdownMenuItem className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span className="text-sm">Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              <span className="text-sm">{t("layout.settings")}</span>
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
    </header>
  );
}
