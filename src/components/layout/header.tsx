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
import { useEffect, useState } from "react";

interface HeaderProps {
  onSearchOpen?: () => void;
  onMenuClick?: () => void;
}

export function Header({ onSearchOpen, onMenuClick }: HeaderProps) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="h-8 w-8 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <h1 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          {t("layout.dashboard")}
        </h1>
      </div>

      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Toggle theme"
        >
          {mounted && theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

        {/* Language switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger nativeButton={false} render={<Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-mono text-muted-foreground hover:text-foreground cursor-pointer" />}>
            {pathname.startsWith("/en") ? "EN" : "ES"}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleLocaleSwitch("es")}>
              <span className="text-sm">🇪🇸 Español</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleLocaleSwitch("en")}>
              <span className="text-sm">🇺🇸 English</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search trigger */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onSearchOpen}
          className="h-8 gap-2 text-muted-foreground hover:text-foreground"
        >
          <Search className="h-3.5 w-3.5" />
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger nativeButton={false} render={<div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium cursor-pointer transition-transform hover:scale-105 active:scale-95" />}>
            A
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48" align="end">
            <DropdownMenuItem>
              <User className="mr-2 h-3.5 w-3.5" />
              <span className="text-sm">Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-3.5 w-3.5" />
              <span className="text-sm">{t("layout.settings")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              <span className="text-sm">{t("auth.logout")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
