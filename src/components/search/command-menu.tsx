"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Command } from "cmdk";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ShoppingCartIcon,
  Wallet,
  Users,
  Settings,
  Search,
  FileText,
  Receipt,
} from "lucide-react";

interface CommandMenuProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const NAVIGATION_ITEMS = [
  { id: "dashboard", href: "/dashboard", icon: LayoutDashboard, labelKey: "layout.dashboard" },
  { id: "pos", href: "/pos", icon: ShoppingCart, labelKey: "layout.pos" },
  { id: "products", href: "/products", icon: Package, labelKey: "layout.products" },
  { id: "purchases", href: "/purchases", icon: ShoppingCartIcon, labelKey: "layout.purchases" },
  { id: "finances", href: "/finances", icon: Wallet, labelKey: "layout.finances" },
  { id: "facturas", href: "/facturas", icon: Receipt, labelKey: "layout.facturas" },
  { id: "users", href: "/users", icon: Users, labelKey: "layout.users" },
  { id: "settings", href: "/settings", icon: Settings, labelKey: "layout.settings" },
  { id: "activity", href: "/activity", icon: FileText, labelKey: "common.activityLog" },
];

export function CommandMenu({ open, setOpen }: CommandMenuProps) {
  const t = useTranslations();
  const router = useRouter();
  const [search, setSearch] = useState("");

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
      router.push(`/es${href}`);
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
              {NAVIGATION_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={item.id}
                    value={item.id}
                    onSelect={() => runAction(item.href)}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{t(item.labelKey)}</span>
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
