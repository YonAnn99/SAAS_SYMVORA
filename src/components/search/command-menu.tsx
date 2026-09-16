"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { usePermissions } from "@/hooks/use-permissions";
import { filterNavigation } from "@/lib/navigation";

interface CommandMenuProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function CommandMenu({ open, setOpen }: CommandMenuProps) {
  const t = useTranslations();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { role, loading: tenantLoading } = useCurrentTenant();
  const { can, loading: permsLoading } = usePermissions();

  // Mismo origen y mismo filtro que el menú lateral. Antes esta lista era una
  // copia aparte con 8 de los 14 módulos y SIN filtrar por permisos, así que un
  // cajero veía aquí Usuarios y Configuración y el middleware lo rebotaba al
  // panel al pulsarlos.
  //
  // Mientras el rol no resuelve no se ofrece nada: calcular con `role` en
  // `null` mostraría el subconjunto de CAJERO a cualquiera durante unos cientos
  // de ms (mismo motivo por el que el sidebar pinta un skeleton).
  const navItems =
    tenantLoading || permsLoading ? [] : filterNavigation(role, can);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, setOpen]);

  const runAction = useCallback(
    (href: string) => {
      router.push(href);
      setOpen(false);
      setSearch("");
    },
    [router, setOpen]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2">
        <Command
          className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
          filter={(value, search) => {
            if (value.toLowerCase().includes(search.toLowerCase())) return 1;
            return 0;
          }}
        >
          <div className="flex items-center border-b border-border px-4">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder={t("search.placeholder")}
              className="flex h-12 w-full rounded-md bg-transparent py-3 pl-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="pointer-events-none ml-2 hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              {t("search.noResults")}
            </Command.Empty>

            <Command.Group heading={t("search.navigation")} className="text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-medium">
              {navItems.map((item) => {
                const Icon = item.icon;
                const label = t(item.name);
                return (
                  <Command.Item
                    key={item.href}
                    // Se busca por el nombre traducido, no por un id interno:
                    // quien teclea "reportes" espera encontrar Reportes.
                    value={label}
                    onSelect={() => runAction(item.href)}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{label}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
