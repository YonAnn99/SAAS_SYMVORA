"use client";

import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DollarSign, ShoppingCart, TrendingUp, Users } from "lucide-react";

export default function DashboardPage() {
  const t = useTranslations();

  return (
    <div className="space-y-8">
      <div className="animate-fade-in-up stagger-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t("dashboard.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("dashboard.welcome")}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: t("dashboard.salesToday"), value: "$0.00", sub: "+0% vs ayer", icon: DollarSign, idx: 1 },
          { title: t("dashboard.salesMonth"), value: "$0.00", sub: "+0% vs mes anterior", icon: TrendingUp, idx: 2 },
          { title: t("dashboard.averageTicket"), value: "$0.00", sub: "Promedio por venta", icon: ShoppingCart, idx: 3 },
          { title: t("dashboard.marginEstimate"), value: "0%", sub: "(Ventas - Costos) / Ventas", icon: Users, idx: 4 },
        ].map((kpi) => (
          <Card key={kpi.title} className={`animate-fade-in-up stagger-${kpi.idx} transition-shadow duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_2px_8px_rgba(255,255,255,0.03)]`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {kpi.title}
              </CardTitle>
              <kpi.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold tracking-tight">{kpi.value}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts placeholder */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 animate-fade-in-up stagger-5">
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("dashboard.recentSales")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-[280px] items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
              {t("dashboard.noSales")}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 animate-fade-in-up stagger-6">
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("dashboard.topProducts")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-[280px] items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
              Sin datos disponibles
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
