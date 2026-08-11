"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DollarSign, ShoppingCart, TrendingUp, Users, AlertCircle, RefreshCw, Package, TrendingDown, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SalesChart } from "@/components/charts/sales-chart";
import { TopProductsChart } from "@/components/charts/top-products-chart";
import { PaymentMethodsChart } from "@/components/charts/payment-methods-chart";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { toast } from "sonner";

interface DashboardStats {
  ventasHoy: number;
  ventasMes: number;
  ticketPromedio: number;
  clientesAtendidos: number;
  productosVendidos: number;
  ventasAnteriores: number;
  crecimientoVentas: number;
  ventasDiarias: { date: string; ventas: number }[];
  topProductos: { nombre: string; cantidad: number }[];
  metodosPago: { name: string; value: number }[];
  ventasPorCategoria: { name: string; value: number }[];
}

export default function DashboardPage() {
  const t = useTranslations();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const [stats, setStats] = useState<DashboardStats>({
    ventasHoy: 0,
    ventasMes: 0,
    ticketPromedio: 0,
    clientesAtendidos: 0,
    productosVendidos: 0,
    ventasAnteriores: 0,
    crecimientoVentas: 0,
    ventasDiarias: [],
    topProductos: [],
    metodosPago: [],
    ventasPorCategoria: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantLoading && tenantId) {
      fetchDashboardData();
    }
  }, [tenantLoading, tenantId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();

    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    // Fetch current month sales
    const { data: ventas, error: queryError } = await supabase
      .from("ventas")
      .select("total, metodo_pago, fecha_venta, estado, cliente_id")
      .eq("tenant_id", tenantId)
      .gte("fecha_venta", firstDayOfMonth.toISOString())
      .eq("estado", "COMPLETADA");

    // Fetch last month sales for comparison
    const { data: ventasAnteriores } = await supabase
      .from("ventas")
      .select("total")
      .eq("tenant_id", tenantId)
      .gte("fecha_venta", firstDayOfLastMonth.toISOString())
      .lte("fecha_venta", lastDayOfLastMonth.toISOString())
      .eq("estado", "COMPLETADA");

    // Fetch products sold count
    const { data: detalleVentas } = await supabase
      .from("detalle_ventas")
      .select("cantidad")
      .eq("tenant_id", tenantId);

    if (queryError) {
      setError("Error al cargar datos del dashboard");
      setLoading(false);
      toast.error("Error al cargar datos del dashboard");
      return;
    }

    if (ventas) {
      const ventasHoy = ventas
        .filter((v) => new Date(v.fecha_venta).toDateString() === today.toDateString())
        .reduce((sum, v) => sum + v.total, 0);

      const ventasMes = ventas.reduce((sum, v) => sum + v.total, 0);
      const ticketPromedio = ventas.length > 0 ? ventasMes / ventas.length : 0;

      // Count unique clients served
      const uniqueClients = new Set(ventas.filter(v => v.cliente_id).map(v => v.cliente_id));

      // Count total products sold
      const productosVendidos = detalleVentas?.reduce((sum, d) => sum + d.cantidad, 0) || 0;

      // Calculate growth vs last month
      const ventasMesAnterior = ventasAnteriores?.reduce((sum, v) => sum + v.total, 0) || 0;
      const crecimientoVentas = ventasMesAnterior > 0 
        ? ((ventasMes - ventasMesAnterior) / ventasMesAnterior) * 100 
        : 0;

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
        clientesAtendidos: uniqueClients.size,
        productosVendidos,
        ventasAnteriores: ventasMesAnterior,
        crecimientoVentas,
        ventasDiarias,
        topProductos: [],
        metodosPago,
        ventasPorCategoria: [],
      });
    }

    setLoading(false);
  };

  const kpis = [
    { title: t("dashboard.salesToday"), value: `$${stats.ventasHoy.toFixed(2)}`, icon: DollarSign, idx: 1, trend: null },
    { title: t("dashboard.salesMonth"), value: `$${stats.ventasMes.toFixed(2)}`, icon: TrendingUp, idx: 2, trend: stats.crecimientoVentas },
    { title: t("dashboard.averageTicket"), value: `$${stats.ticketPromedio.toFixed(2)}`, icon: ShoppingCart, idx: 3, trend: null },
    { title: "Clientes Atendidos", value: stats.clientesAtendidos.toString(), icon: Users, idx: 4, trend: null },
    { title: "Productos Vendidos", value: stats.productosVendidos.toString(), icon: Package, idx: 5, trend: null },
    { title: "Ventas Mes Anterior", value: `$${stats.ventasAnteriores.toFixed(2)}`, icon: CreditCard, idx: 6, trend: null },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            {t("dashboard.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("dashboard.welcome")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2"
          onClick={fetchDashboardData}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">{error}</p>
              <p className="text-xs text-muted-foreground">Verifica tu conexión e intenta de nuevo</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchDashboardData}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className={`animate-fade-in-up stagger-${kpi.idx} transition-all duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 dark:hover:shadow-[0_2px_8px_rgba(255,255,255,0.03)]`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {kpi.title}
              </CardTitle>
              <kpi.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold tracking-tight">{kpi.value}</div>
              {kpi.trend !== null && kpi.trend !== 0 && (
                <p className={`text-xs mt-1 ${kpi.trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {kpi.trend > 0 ? '+' : ''}{kpi.trend.toFixed(1)}% vs mes anterior
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty state for new users */}
      {!loading && stats.ventasMes === 0 && !error && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-2">Bienvenido a SYMVORA</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              Realiza tu primera venta desde el POS para ver tus estadísticas aquí.
              El dashboard mostrará ventas diarias, mensuales y métodos de pago.
            </p>
            <Button>
              <Link href="/pos">Ir al POS</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Charts - only show when there's data */}
      {!loading && stats.ventasMes > 0 && (
        <>
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
        </>
      )}
    </div>
  );
}
