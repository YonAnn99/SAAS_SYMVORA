"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";

const navigation = [
  { name: "layout.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "layout.pos", href: "/pos", icon: ShoppingCart },
  { name: "layout.products", href: "/products", icon: Package },
  { name: "layout.purchases", href: "/purchases", icon: ShoppingCartIcon },
  { name: "layout.finances", href: "/finances", icon: Wallet },
  { name: "layout.users", href: "/users", icon: Users },
  { name: "common.activityLog", href: "/activity", icon: FileText },
  { name: "layout.settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const t = useTranslations();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => {
    return pathname.includes(href);
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-card transition-all duration-300 ease-out",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        {!collapsed && (
          <Link href="/es/dashboard" className="text-sm font-semibold tracking-tight">
            SYMVORA
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
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
                href={`/es${item.href}`}
                className={cn(
                  "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                {!collapsed && <span>{t(item.name)}</span>}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User info */}
      <div className="border-t border-border p-3">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
              A
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium truncate">Admin</span>
              <span className="text-[10px] text-muted-foreground truncate">
                admin@symvora.com
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
