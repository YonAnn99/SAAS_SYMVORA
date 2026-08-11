"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DollarSign, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { SalesChart } from "@/components/charts/sales-chart";
import { TopProductsChart } from "@/components/charts/top-products-chart";
import { PaymentMethodsChart } from "@/components/charts/payment-methods-chart";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";

interface DashboardStats {
  ventasHoy: number;
  ventasMes: number;
  ticketPromedio: number;
  margenEstimate: number;
  ventasDiarias: { date: string; ventas: number }[];
  topProductos: { nombre: string; cantidad: number }[];
  metodosPago: { name: string; value: number }[];
}

export default function DashboardPage() {
  const t = useTranslations();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const [stats, setStats] = useState<DashboardStats>({
    ventasHoy: 0,
    ventasMes: 0,
    ticketPromedio: 0,
    margenEstimate: 0,
    ventasDiarias: [],
    topProductos: [],
    metodosPago: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantLoading && tenantId) {
      fetchDashboardData();
    }
  }, [tenantLoading, tenantId]);

  const fetchDashboardData = async () => {
    const supabase = createSupabaseBrowserClient();

    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const { data: ventas } = await supabase
      .from("ventas")
      .select("total, metodo_pago, fecha_venta, estado")
      .eq("tenant_id", tenantId)
      .gte("fecha_venta", firstDayOfMonth.toISOString())
      .eq("estado", "COMPLETADA");

    if (ventas) {
      const ventasHoy = ventas
        .filter((v) => new Date(v.fecha_venta).toDateString() === today.toDateString())
        .reduce((sum, v) => sum + v.total, 0);

      const ventasMes = ventas.reduce((sum, v) => sum + v.total, 0);
      const ticketPromedio = ventas.length > 0 ? ventasMes / ventas.length : 0;

      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date.toISOString().split("T")[0];
      });

      const ventasDiarias = last7Days.map((date) => ({
        date: new Date(date).toLocaleDateString("es-MX", { weekday: "short", day: "numeric" }),
        ventas: ventas
          .filter((v) => new Date(v.fecha_venta).toISOString().split("T")[0] === date)
          .reduce((sum, v) => sum + v.total, 0),
      }));

      const metodosPagoMap = ventas.reduce((acc, v) => {
        const metodo = v.metodo_pago;
        acc[metodo] = (acc[metodo] || 0) + v.total;
        return acc;
      }, {} as Record<string, number>);

      const metodosPago = Object.entries(metodosPagoMap).map(([name, value]) => ({
        name: name.charAt(0) + name.slice(1).toLowerCase(),
        value,
      }));

      setStats({
        ventasHoy,
        ventasMes,
        ticketPromedio,
        margenEstimate: 0,
        ventasDiarias,
        topProductos: [],
        metodosPago,
      });
    }

    setLoading(false);
  };

  const kpis = [
    { title: t("dashboard.salesToday"), value: `$${stats.ventasHoy.toFixed(2)}`, icon: DollarSign, idx: 1 },
    { title: t("dashboard.salesMonth"), value: `$${stats.ventasMes.toFixed(2)}`, icon: TrendingUp, idx: 2 },
    { title: t("dashboard.averageTicket"), value: `$${stats.ticketPromedio.toFixed(2)}`, icon: ShoppingCart, idx: 3 },
    { title: t("dashboard.marginEstimate"), value: `${stats.margenEstimate}%`, icon: Users, idx: 4 },
  ];

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className={`animate-fade-in-up stagger-${kpi.idx} transition-shadow duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_2px_8px_rgba(255,255,255,0.03)]`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {kpi.title}
              </CardTitle>
              <kpi.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold tracking-tight">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 animate-fade-in-up stagger-5">
          <SalesChart
            data={stats.ventasDiarias}
            title={t("dashboard.recentSales")}
          />
        </div>
        <div className="col-span-3 animate-fade-in-up stagger-6">
          <TopProductsChart
            data={stats.topProductos}
            title={t("dashboard.topProducts")}
          />
        </div>
      </div>

      <div className="animate-fade-in-up stagger-7">
        <PaymentMethodsChart
          data={stats.metodosPago}
          title="Métodos de pago"
        />
      </div>
    </div>
  );
}
