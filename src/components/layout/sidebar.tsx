"use client";

import { useState, useEffect } from "react";
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
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ShoppingCartIcon,
  Wallet,
  Settings,
  Users,
  Contact,
  ChevronLeft,
  ChevronRight,
  FileText,
  Palette,
  Calendar,
  Wrench,
  TrendingUp,
  CreditCard,
  Receipt,
  Smartphone,
  Lightbulb,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { hasRole } from "@/lib/rbac";
import type { User } from "@supabase/supabase-js";
import type { LucideIcon } from "lucide-react";
import type { UserRole } from "@/lib/types/database";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  beta?: boolean;
  minRole?: UserRole;
  hidden?: boolean;
}

const navigation: NavItem[] = [
  { name: "layout.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "layout.pos", href: "/pos", icon: ShoppingCart },
  { name: "layout.products", href: "/products", icon: Package },
  { name: "layout.customers", href: "/customers", icon: Contact },
  { name: "layout.purchases", href: "/purchases", icon: ShoppingCartIcon, minRole: "ORG_ADMIN" },
  { name: "layout.purchaseOrders", href: "/purchase-orders", icon: FileText, minRole: "ORG_ADMIN" },
  { name: "layout.finances", href: "/finances", icon: Wallet, minRole: "ORG_ADMIN" },
  { name: "layout.facturas", href: "/facturas", icon: Receipt, beta: true, minRole: "ORG_ADMIN", hidden: true },
  { name: "layout.users", href: "/users", icon: Users, minRole: "SUPER_ADMIN" },
  { name: "common.activityLog", href: "/activity", icon: FileText },
  { name: "layout.settings", href: "/settings", icon: Settings, minRole: "ORG_ADMIN" },
  { name: "layout.payments", href: "/settings/payments", icon: Smartphone, minRole: "ORG_ADMIN" },
  { name: "layout.reports", href: "/reports", icon: TrendingUp },
  { name: "layout.suggestions", href: "/suggestions", icon: Lightbulb },
  { name: "layout.billing", href: "/billing", icon: CreditCard, minRole: "SUPER_ADMIN" },
];

const inventoryNavigation: NavItem[] = [
  { name: "layout.variants", href: "/variants", icon: Palette, minRole: "ORG_ADMIN" },
  { name: "layout.lots", href: "/lots", icon: Calendar, minRole: "ORG_ADMIN" },
  { name: "layout.adjustments", href: "/inventory-adjustments", icon: Wrench, minRole: "ORG_ADMIN" },
];

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
  const { tenantName, tenantLogo, role, loading: tenantLoading } = useCurrentTenant();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  const stripLocale = (p: string) => p.replace(/^\/(es|en)/, "") || "/";
  const isActive = (href: string) => {
    return stripLocale(pathname) === href;
  };

  const visibleNav = navigation.filter(
    (item) => !item.hidden && (!item.minRole || hasRole(role, item.minRole))
  );

  const visibleInventory = inventoryNavigation.filter(
    (item) => !item.minRole || hasRole(role, item.minRole)
  );

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4 bg-gradient-to-r from-primary/5 to-transparent">
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0" onClick={onLinkClick}>
          <Image
            src="/symvora-logo.webp"
            alt="SYMVORA"
            width={120}
            height={28}
            className={cn("h-6 w-auto object-contain flex-shrink-0 transition-all duration-200 dark:invert", collapsed && "mx-auto")}
            priority
          />
          {!collapsed && (
            <span className="text-sm font-bold tracking-tight text-foreground whitespace-nowrap">
              SYMVORA
            </span>
          )}
        </Link>
        {!isMobile && (
          <button
            onClick={() => onCollapsedChange(!collapsed)}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-all duration-200 hover:text-foreground hover:bg-muted/50"
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
      <ScrollArea className="flex-1 px-2 py-3">
        {tenantLoading ? (
          <div className="flex flex-col gap-1.5 px-1">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="h-8 animate-pulse rounded-lg bg-muted/40"
              />
            ))}
          </div>
        ) : (
          <>
            <nav className="flex flex-col gap-0.5" key={String(collapsed)}>
              {visibleNav.map((item, idx) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onLinkClick}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 animate-sidebar-item-in",
                      active
                        ? "bg-gradient-to-r from-primary/90 to-primary text-primary-foreground shadow-[0_2px_8px_rgba(91,159,237,0.25)]"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                    style={{ animationDelay: `${idx * 28}ms` }}
                  >
                    <Icon className={cn("h-4 w-4 flex-shrink-0 transition-transform duration-200", active ? "text-primary-foreground scale-110" : "text-muted-foreground group-hover:text-foreground")} />
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
            </nav>

            {/* Inventory section */}
            {!collapsed && visibleInventory.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  📦 Inventario
                </p>
                <nav className="flex flex-col gap-0.5" key={String(collapsed)}>
                  {visibleInventory.map((item, idx) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onLinkClick}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 animate-sidebar-item-in",
                          active
                            ? "bg-gradient-to-r from-primary/90 to-primary text-primary-foreground shadow-[0_2px_8px_rgba(91,159,237,0.25)]"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        )}
                        style={{ animationDelay: `${(visibleNav.length + idx) * 28}ms` }}
                      >
                        <Icon className={cn("h-4 w-4 flex-shrink-0 transition-transform duration-200", active ? "text-primary-foreground scale-110" : "text-muted-foreground group-hover:text-foreground")} />
                        <span>{t(item.name)}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            )}
          </>
        )}
      </ScrollArea>

      {/* User info */}
      <div className="border-t border-border p-3">
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
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium flex-shrink-0">
                {tenantName?.charAt(0).toUpperCase() || "N"}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium truncate">
                {tenantName || "Negocio"}
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

export function Sidebar({ open, onOpenChange, collapsed, onCollapsedChange }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar - always visible on lg+ */}
      <aside className={cn(
        "hidden lg:flex lg:flex-col lg:border-r lg:border-border lg:bg-card transition-all duration-200",
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
