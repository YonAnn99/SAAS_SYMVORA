"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Download, TrendingUp, Package, Users, CreditCard } from "lucide-react";
import { SalesChart } from "@/components/charts/sales-chart";
import { TopProductsChart } from "@/components/charts/top-products-chart";
import { PaymentMethodsChart } from "@/components/charts/payment-methods-chart";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ReportData {
  ventasPorPeriodo: { date: string; ventas: number }[];
  topProductos: { nombre: string; cantidad: number; total: number }[];
  topCategorias: { name: string; value: number }[];
  metodosPago: { name: string; value: number }[];
  clientesFrecuentes: { nombre: string; compras: number; total: number }[];
  resumen: {
    totalVentas: number;
    totalTransacciones: number;
    ticketPromedio: number;
    productosVendidos: number;
  };
}

export default function ReportsPage() {
  const t = useTranslations();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const [reportData, setReportData] = useState<ReportData>({
    ventasPorPeriodo: [],
    topProductos: [],
    topCategorias: [],
    metodosPago: [],
    clientesFrecuentes: [],
    resumen: {
      totalVentas: 0,
      totalTransacciones: 0,
      ticketPromedio: 0,
      productosVendidos: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("mes");

  useEffect(() => {
    if (!tenantLoading && tenantId) {
      fetchReportData();
    }
  }, [tenantLoading, tenantId, periodo]);

  const fetchReportData = async () => {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();

    const today = new Date();
    let startDate: Date;

    switch (periodo) {
      case "semana":
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        break;
      case "trimestre":
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 3);
        break;
      case "ano":
        startDate = new Date(today);
        startDate.setFullYear(today.getFullYear() - 1);
        break;
      default: // mes
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    // Fetch sales data
    const { data: ventas, error: ventasError } = await supabase
      .from("ventas")
      .select("total, metodo_pago, fecha_venta, estado, cliente_id")
      .eq("tenant_id", tenantId)
      .gte("fecha_venta", startDate.toISOString())
      .eq("estado", "COMPLETADA");

    // Fetch detail sales for product data
    const { data: detalleVentas } = await supabase
      .from("detalle_ventas")
      .select("cantidad, precio_unitario, producto_id, venta_id")
      .eq("tenant_id", tenantId);

    // Fetch products for names
    const { data: productos } = await supabase
      .from("productos")
      .select("id, nombre, categoria")
      .eq("tenant_id", tenantId);

    // Fetch customers
    const { data: clientes } = await supabase
      .from("clientes")
      .select("id, nombre")
      .eq("tenant_id", tenantId);

    if (ventasError) {
      toast.error("Error al cargar reportes");
      setLoading(false);
      return;
    }

    if (ventas && detalleVentas && productos) {
      // Calculate sales by period
      const daysDiff = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const groupBy = daysDiff <= 7 ? "day" : daysDiff <= 90 ? "week" : "month";

      const ventasPorPeriodo = groupSalesByPeriod(ventas, startDate, today, groupBy);

      // Calculate top products
      const productoventasMap = new Map<string, { cantidad: number; total: number }>();
      detalleVentas.forEach((dv) => {
        const existing = productoventasMap.get(dv.producto_id) || { cantidad: 0, total: 0 };
        productoventasMap.set(dv.producto_id, {
          cantidad: existing.cantidad + dv.cantidad,
          total: existing.total + (dv.cantidad * dv.precio_unitario),
        });
      });

      const topProductos = Array.from(productoventasMap.entries())
        .map(([productoId, data]) => {
          const producto = productos.find(p => p.id === productoId);
          return {
            nombre: producto?.nombre || "Producto desconocido",
            cantidad: data.cantidad,
            total: data.total,
          };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      // Calculate sales by category
      const categoryMap = new Map<string, number>();
      topProductos.forEach((p) => {
        const producto = productos.find(prod => prod.nombre === p.nombre);
        const categoria = producto?.categoria || "Sin categoría";
        categoryMap.set(categoria, (categoryMap.get(categoria) || 0) + p.total);
      });

      const topCategorias = Array.from(categoryMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      // Calculate payment methods
      const metodosPagoMap = ventas.reduce((acc, v) => {
        acc[v.metodo_pago] = (acc[v.metodo_pago] || 0) + v.total;
        return acc;
      }, {} as Record<string, number>);

      const metodosPago = Object.entries(metodosPagoMap)
        .map(([name, value]) => ({
          name: name.charAt(0) + name.slice(1).toLowerCase(),
          value,
        }))
        .sort((a, b) => b.value - a.value);

      // Calculate frequent customers
      const customerMap = new Map<string, { compras: number; total: number }>();
      ventas.forEach((v) => {
        if (v.cliente_id) {
          const existing = customerMap.get(v.cliente_id) || { compras: 0, total: 0 };
          customerMap.set(v.cliente_id, {
            compras: existing.compras + 1,
            total: existing.total + v.total,
          });
        }
      });

      const clientesFrecuentes = Array.from(customerMap.entries())
        .map(([clienteId, data]) => {
          const cliente = clientes?.find(c => c.id === clienteId);
          return {
            nombre: cliente?.nombre || "Cliente general",
            compras: data.compras,
            total: data.total,
          };
        })
        .sort((a, b) => b.compras - a.compras)
        .slice(0, 10);

      // Calculate summary
      const totalVentas = ventas.reduce((sum, v) => sum + v.total, 0);
      const totalTransacciones = ventas.length;
      const ticketPromedio = totalTransacciones > 0 ? totalVentas / totalTransacciones : 0;
      const productosVendidos = detalleVentas.reduce((sum, dv) => sum + dv.cantidad, 0);

      setReportData({
        ventasPorPeriodo,
        topProductos,
        topCategorias,
        metodosPago,
        clientesFrecuentes,
        resumen: {
          totalVentas,
          totalTransacciones,
          ticketPromedio,
          productosVendidos,
        },
      });
    }

    setLoading(false);
  };

  const groupSalesByPeriod = (
    ventas: any[],
    startDate: Date,
    endDate: Date,
    groupBy: "day" | "week" | "month"
  ) => {
    const groups: { [key: string]: number } = {};

    ventas.forEach((v) => {
      const date = new Date(v.fecha_venta);
      let key: string;

      if (groupBy === "day") {
        key = date.toLocaleDateString("es-MX", { weekday: "short", day: "numeric" });
      } else if (groupBy === "week") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
      } else {
        key = date.toLocaleDateString("es-MX", { month: "short", year: "numeric" });
      }

      groups[key] = (groups[key] || 0) + v.total;
    });

    return Object.entries(groups).map(([date, ventas]) => ({ date, ventas }));
  };

  const handleExport = () => {
    // TODO: Implement CSV/PDF export
    toast.info("Exportación en desarrollo");
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            Reportes y Analytics
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Análisis detallado de ventas, productos y clientes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodo} onValueChange={(v) => v && setPeriodo(v)}>
            <SelectTrigger className="w-[140px] h-8">
              <Calendar className="h-3.5 w-3.5 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semana">Última semana</SelectItem>
              <SelectItem value="mes">Este mes</SelectItem>
              <SelectItem value="trimestre">Último trimestre</SelectItem>
              <SelectItem value="ano">Último año</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 gap-2" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[
          { title: "Total Ventas", value: `$${reportData.resumen.totalVentas.toFixed(2)}`, icon: TrendingUp },
          { title: "Transacciones", value: reportData.resumen.totalTransacciones.toString(), icon: CreditCard },
          { title: "Ticket Promedio", value: `$${reportData.resumen.ticketPromedio.toFixed(2)}`, icon: Package },
          { title: "Productos Vendidos", value: reportData.resumen.productosVendidos.toString(), icon: Package },
        ].map((card, i) => (
          <Card key={card.title} className={`animate-fade-in-up stagger-${i + 2}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {card.title}
              </CardTitle>
              <card.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold tracking-tight font-mono">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="animate-fade-in-up stagger-6">
          <SalesChart
            data={reportData.ventasPorPeriodo}
            title="Ventas por período"
          />
        </div>
        <div className="animate-fade-in-up stagger-7">
          <PaymentMethodsChart
            data={reportData.metodosPago}
            title="Distribución por método de pago"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="animate-fade-in-up stagger-8">
          <TopProductsChart
            data={reportData.topProductos.map(p => ({ nombre: p.nombre, cantidad: p.cantidad }))}
            title="Top 10 productos más vendidos"
          />
        </div>
        <Card className="animate-fade-in-up stagger-9">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top Categorías</CardTitle>
          </CardHeader>
          <CardContent>
            {reportData.topCategorias.length === 0 ? (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                Sin datos disponibles
              </div>
            ) : (
              <div className="space-y-3">
                {reportData.topCategorias.slice(0, 5).map((cat, i) => {
                  const maxVal = reportData.topCategorias[0]?.value || 1;
                  const percentage = (cat.value / maxVal) * 100;
                  return (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{cat.name}</span>
                        <span className="text-muted-foreground font-mono">${cat.value.toFixed(2)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Customers */}
      <Card className="animate-fade-in-up stagger-10">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Clientes Más Frecuentes</CardTitle>
        </CardHeader>
        <CardContent>
          {reportData.clientesFrecuentes.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
              Sin datos de clientes disponibles
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Compras</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.clientesFrecuentes.map((cliente, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 font-medium">{cliente.nombre}</td>
                      <td className="py-2 text-right font-mono">{cliente.compras}</td>
                      <td className="py-2 text-right font-mono">${cliente.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
