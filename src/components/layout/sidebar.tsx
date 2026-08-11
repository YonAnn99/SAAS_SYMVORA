"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ShoppingCartIcon,
  Wallet,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
  FileText,
  Palette,
  Calendar,
  Wrench,
  TrendingUp,
  CreditCard,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

const navigation = [
  { name: "layout.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "layout.pos", href: "/pos", icon: ShoppingCart },
  { name: "layout.products", href: "/products", icon: Package },
  { name: "layout.purchases", href: "/purchases", icon: ShoppingCartIcon },
  { name: "layout.purchaseOrders", href: "/purchase-orders", icon: FileText },
  { name: "layout.finances", href: "/finances", icon: Wallet },
  { name: "layout.users", href: "/users", icon: Users },
  { name: "common.activityLog", href: "/activity", icon: FileText },
  { name: "layout.settings", href: "/settings", icon: Settings },
  { name: "layout.reports", href: "/reports", icon: TrendingUp },
  { name: "layout.billing", href: "/billing", icon: CreditCard },
];

const inventoryNavigation = [
  { name: "layout.variants", href: "/variants", icon: Palette },
  { name: "layout.lots", href: "/lots", icon: Calendar },
  { name: "layout.adjustments", href: "/inventory-adjustments", icon: Wrench },
];

interface SidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SidebarContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const t = useTranslations();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  const isActive = (href: string) => {
    return pathname.includes(href);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4 bg-gradient-to-r from-primary/5 to-transparent">
        {!collapsed && (
          <Link href="/dashboard" className="text-sm font-bold tracking-tight gradient-text" onClick={onLinkClick}>
            ✦ SYMVORA
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-all duration-200 hover:text-foreground hover:bg-muted/50"
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="flex flex-col gap-0.5">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onLinkClick}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-gradient-to-r from-primary/90 to-primary text-primary-foreground shadow-[0_2px_8px_rgba(91,159,237,0.25)]"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 flex-shrink-0 transition-transform duration-200", active ? "text-primary-foreground scale-110" : "text-muted-foreground group-hover:text-foreground")} />
                {!collapsed && <span>{t(item.name)}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Inventory section */}
        {!collapsed && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              📦 Inventario
            </p>
            <nav className="flex flex-col gap-0.5">
              {inventoryNavigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onLinkClick}
                    className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      active
                        ? "bg-gradient-to-r from-primary/90 to-primary text-primary-foreground shadow-[0_2px_8px_rgba(91,159,237,0.25)]"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 flex-shrink-0 transition-transform duration-200", active ? "text-primary-foreground scale-110" : "text-muted-foreground group-hover:text-foreground")} />
                    <span>{t(item.name)}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </ScrollArea>

      {/* User info */}
      <div className="border-t border-border p-3">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium truncate">
                {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuario"}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                {user?.email || "cargando..."}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Sidebar({ open, onOpenChange }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar - always visible on lg+ */}
      <aside className="hidden lg:flex lg:flex-col lg:border-r lg:border-border lg:bg-card lg:w-56">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar - Sheet drawer */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-56 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent onLinkClick={() => onOpenChange(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
