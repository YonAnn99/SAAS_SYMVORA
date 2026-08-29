"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Download, TrendingUp, Package, Users, CreditCard, ChevronLeft, ChevronRight } from "lucide-react";
import { SalesChart, TopProductsChart, PaymentMethodsChart } from "@/components/charts/dynamic-charts";
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
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

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

const DIA_LABEL = "Día específico";
const WEEKDAY_LABELS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isDateAfterOrEqual(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() >= startOfDay(b).getTime();
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function generateHourSlots(): string[] {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
  }
  return slots;
}

function generateDaySlots(start: Date, end: Date): string[] {
  const slots: string[] = [];
  const current = startOfDay(start);
  const last = startOfDay(end);
  while (current.getTime() <= last.getTime()) {
    slots.push(
      current.toLocaleDateString("es-MX", { weekday: "short", day: "numeric" })
    );
    current.setDate(current.getDate() + 1);
  }
  return slots;
}

function generateWeekSlots(start: Date, end: Date): string[] {
  const slots: string[] = [];
  const current = startOfDay(start);
  const last = startOfDay(end);
  while (current.getTime() <= last.getTime()) {
    const weekStart = new Date(current);
    weekStart.setDate(current.getDate() - current.getDay() + (current.getDay() === 0 ? -6 : 1));
    const key = weekStart.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
    });
    if (!slots.includes(key)) {
      slots.push(key);
    }
    current.setDate(current.getDate() + 1);
  }
  return slots;
}

function generateMonthSlots(start: Date, end: Date): string[] {
  const slots: string[] = [];
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (current.getTime() <= last.getTime()) {
    slots.push(
      current.toLocaleDateString("es-MX", { month: "short", year: "numeric" })
    );
    current.setMonth(current.getMonth() + 1);
  }
  return slots;
}

function groupSalesByPeriod(
  ventas: Array<{ fecha_venta: string; total: number }>,
  startDate: Date,
  endDate: Date,
  groupBy: "hour" | "day" | "week" | "month"
): { date: string; ventas: number }[] {
  const salesMap = new Map<string, number>();

  ventas.forEach((v) => {
    const date = new Date(v.fecha_venta);
    let key: string;

    if (groupBy === "hour") {
      key = `${String(date.getHours()).padStart(2, "0")}:00`;
    } else if (groupBy === "day") {
      key = date.toLocaleDateString("es-MX", { weekday: "short", day: "numeric" });
    } else if (groupBy === "week") {
      const d = new Date(date);
      const dayOfWeek = d.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      d.setDate(d.getDate() + mondayOffset);
      key = d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
    } else {
      key = date.toLocaleDateString("es-MX", { month: "short", year: "numeric" });
    }

    salesMap.set(key, (salesMap.get(key) || 0) + v.total);
  });

  let slots: string[];
  if (groupBy === "hour") {
    slots = generateHourSlots();
  } else if (groupBy === "day") {
    slots = generateDaySlots(startDate, endDate);
  } else if (groupBy === "week") {
    slots = generateWeekSlots(startDate, endDate);
  } else {
    slots = generateMonthSlots(startDate, endDate);
  }

  return slots.map((slot) => ({
    date: slot,
    ventas: salesMap.get(slot) || 0,
  }));
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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const today = useMemo(() => startOfDay(new Date()), []);

  const fetchReportData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const supabase = createSupabaseBrowserClient();

    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (periodo) {
      case "semana":
        endDate = endOfDay(now);
        startDate = startOfDay(now);
        startDate.setDate(startDate.getDate() - 6);
        break;
      case "trimestre":
        endDate = endOfDay(now);
        startDate = startOfDay(now);
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case "ano":
        endDate = endOfDay(now);
        startDate = startOfDay(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case "dia":
        if (!selectedDate) {
          setLoading(false);
          return;
        }
        startDate = startOfDay(selectedDate);
        endDate = endOfDay(selectedDate);
        break;
      default: // mes
        endDate = endOfDay(now);
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate = startOfDay(startDate);
    }

    const [
      { data: ventas, error: ventasError },
      { data: productos },
      { data: clientes },
    ] = await Promise.all([
      supabase
        .from("ventas")
        .select("id, total, metodo_pago, fecha_venta, estado, cliente_id")
        .eq("tenant_id", tenantId)
        .gte("fecha_venta", startDate.toISOString())
        .lte("fecha_venta", endDate.toISOString())
        .eq("estado", "COMPLETADA"),
      supabase
        .from("productos")
        .select("id, nombre, categoria")
        .eq("tenant_id", tenantId),
      supabase
        .from("clientes")
        .select("id, nombre")
        .eq("tenant_id", tenantId),
    ]);

    const ventaIds = (ventas ?? []).map((v) => v.id);
    const { data: detalleVentas } = ventaIds.length
      ? await supabase
          .from("detalle_ventas")
          .select("cantidad, precio_unitario, producto_id, venta_id")
          .in("venta_id", ventaIds)
      : {
          data: [] as {
            cantidad: number;
            precio_unitario: number;
            producto_id: string;
            venta_id: string;
          }[],
        };

    if (ventasError) {
      toast.error("Error al cargar reportes");
      setLoading(false);
      return;
    }

    if (ventas && detalleVentas && productos) {
      const daysDiff = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      let groupBy: "hour" | "day" | "week" | "month";
      if (periodo === "dia") {
        groupBy = "hour";
      } else if (daysDiff <= 7) {
        groupBy = "day";
      } else if (daysDiff <= 90) {
        groupBy = "week";
      } else {
        groupBy = "month";
      }

      const ventasPorPeriodo = groupSalesByPeriod(
        ventas,
        startDate,
        endDate,
        groupBy
      );

      const productoventasMap = new Map<
        string,
        { cantidad: number; total: number }
      >();
      detalleVentas.forEach((dv) => {
        const existing = productoventasMap.get(dv.producto_id) || {
          cantidad: 0,
          total: 0,
        };
        productoventasMap.set(dv.producto_id, {
          cantidad: existing.cantidad + dv.cantidad,
          total: existing.total + dv.cantidad * dv.precio_unitario,
        });
      });

      const topProductos = Array.from(productoventasMap.entries())
        .map(([productoId, data]) => {
          const producto = productos.find((p) => p.id === productoId);
          return {
            nombre: producto?.nombre || "Producto desconocido",
            cantidad: data.cantidad,
            total: data.total,
          };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      const categoryMap = new Map<string, number>();
      topProductos.forEach((p) => {
        const producto = productos.find((prod) => prod.nombre === p.nombre);
        const categoria = producto?.categoria || "Sin categoría";
        categoryMap.set(
          categoria,
          (categoryMap.get(categoria) || 0) + p.total
        );
      });

      const topCategorias = Array.from(categoryMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      const metodosPagoMap = ventas.reduce(
        (acc, v) => {
          acc[v.metodo_pago] = (acc[v.metodo_pago] || 0) + v.total;
          return acc;
        },
        {} as Record<string, number>
      );

      const metodosPago = Object.entries(metodosPagoMap)
        .map(([name, value]) => ({
          name: name.charAt(0) + name.slice(1).toLowerCase(),
          value,
        }))
        .sort((a, b) => b.value - a.value);

      const customerMap = new Map<
        string,
        { compras: number; total: number }
      >();
      ventas.forEach((v) => {
        if (v.cliente_id) {
          const existing = customerMap.get(v.cliente_id) || {
            compras: 0,
            total: 0,
          };
          customerMap.set(v.cliente_id, {
            compras: existing.compras + 1,
            total: existing.total + v.total,
          });
        }
      });

      const clientesFrecuentes = Array.from(customerMap.entries())
        .map(([clienteId, data]) => {
          const cliente = clientes?.find((c) => c.id === clienteId);
          return {
            nombre: cliente?.nombre || "Cliente general",
            compras: data.compras,
            total: data.total,
          };
        })
        .sort((a, b) => b.compras - a.compras)
        .slice(0, 10);

      const totalVentas = ventas.reduce((sum, v) => sum + v.total, 0);
      const totalTransacciones = ventas.length;
      const ticketPromedio =
        totalTransacciones > 0 ? totalVentas / totalTransacciones : 0;
      const productosVendidos = detalleVentas.reduce(
        (sum, dv) => sum + dv.cantidad,
        0
      );

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
  }, [periodo, tenantId, selectedDate]);

  useEffect(() => {
    if (!tenantLoading && tenantId) {
      if (periodo === "dia" && !selectedDate) return;
      fetchReportData();
    }
  }, [tenantLoading, tenantId, fetchReportData, periodo, selectedDate]);

  const handleSelectDay = useCallback(
    (date: Date) => {
      setSelectedDate(date);
      setPeriodo("dia");
      setCalendarOpen(false);
    },
    []
  );

  const handleCalendarButtonClick = useCallback(() => {
    if (periodo !== "dia") {
      setPeriodo("dia");
    }
    setCalendarOpen((prev) => !prev);
  }, [periodo]);

  const handleExport = () => {
    toast.info("Exportación en desarrollo");
  };

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days: Array<{ date: Date; disabled: boolean; isToday: boolean }> = [];

    for (let i = 0; i < firstDay; i++) {
      days.push({ date: new Date(0), disabled: true, isToday: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const isToday = isSameDay(date, today);
      const disabled = isDateAfterOrEqual(date, today);
      days.push({ date, disabled, isToday });
    }

    return days;
  }, [calendarMonth, today]);

  const canGoNextMonth = useMemo(() => {
    const nextMonth = new Date(calendarMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return !isDateAfterOrEqual(
      new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1),
      new Date(today.getFullYear(), today.getMonth(), 1)
    );
  }, [calendarMonth, today]);

  const selectDisplayValue = useMemo(() => {
    if (periodo === "dia" && selectedDate) {
      return formatShortDate(selectedDate);
    }
    return DIA_LABEL;
  }, [periodo, selectedDate]);

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
            <SelectTrigger className="w-[160px] h-8">
              <CalendarIcon className="h-3.5 w-3.5 mr-2" />
              {periodo === "dia" && selectedDate ? (
                <span className="flex flex-1 text-left">{selectDisplayValue}</span>
              ) : (
                <SelectValue />
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semana">Última semana</SelectItem>
              <SelectItem value="mes">Este mes</SelectItem>
              <SelectItem value="trimestre">Último trimestre</SelectItem>
              <SelectItem value="ano">Último año</SelectItem>
              <SelectItem value="dia">{DIA_LABEL}</SelectItem>
            </SelectContent>
          </Select>

          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label="Seleccionar día"
                />
              }
            >
              <CalendarIcon className="h-3.5 w-3.5" />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <div className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() =>
                      setCalendarMonth((prev) => {
                        const next = new Date(prev);
                        next.setMonth(next.getMonth() - 1);
                        return next;
                      })
                    }
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium capitalize">
                    {formatMonthYear(calendarMonth)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={!canGoNextMonth}
                    onClick={() =>
                      setCalendarMonth((prev) => {
                        const next = new Date(prev);
                        next.setMonth(next.getMonth() + 1);
                        return next;
                      })
                    }
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-7 gap-0.5 mb-1">
                  {WEEKDAY_LABELS.map((label) => (
                    <div
                      key={label}
                      className="text-center text-[10px] font-medium text-muted-foreground py-1"
                    >
                      {label}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-0.5">
                  {calendarDays.map((day, i) => {
                    if (day.date.getTime() === 0) {
                      return <div key={`empty-${i}`} />;
                    }

                    const isSelected =
                      selectedDate && isSameDay(day.date, selectedDate);

                    return (
                      <button
                        key={day.date.toISOString()}
                        disabled={day.disabled}
                        onClick={() => handleSelectDay(day.date)}
                        className={`
                          relative h-8 w-8 rounded-md text-xs font-medium transition-colors
                          ${day.disabled ? "text-muted-foreground/30 cursor-not-allowed" : "text-foreground hover:bg-accent cursor-pointer"}
                          ${isSelected ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
                          ${day.isToday && !isSelected ? "ring-1 ring-ring" : ""}
                        `}
                      >
                        {day.date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2"
            onClick={handleExport}
          >
            <Download className="h-3.5 w-3.5" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[
          {
            title: "Total Ventas",
            value: `$${reportData.resumen.totalVentas.toFixed(2)}`,
            icon: TrendingUp,
          },
          {
            title: "Transacciones",
            value: reportData.resumen.totalTransacciones.toString(),
            icon: CreditCard,
          },
          {
            title: "Ticket Promedio",
            value: `$${reportData.resumen.ticketPromedio.toFixed(2)}`,
            icon: Package,
          },
          {
            title: "Productos Vendidos",
            value: reportData.resumen.productosVendidos.toString(),
            icon: Package,
          },
        ].map((card, i) => (
          <Card
            key={card.title}
            className={`animate-fade-in-up stagger-${i + 2}`}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {card.title}
              </CardTitle>
              <card.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold tracking-tight font-mono">
                {card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="animate-fade-in-up stagger-6">
          <SalesChart
            data={reportData.ventasPorPeriodo}
            title={
              periodo === "dia" && selectedDate
                ? `Ventas por hora — ${formatShortDate(selectedDate)}`
                : "Ventas por período"
            }
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
            data={reportData.topProductos.map((p) => ({
              nombre: p.nombre,
              cantidad: p.cantidad,
            }))}
            title="Top 10 productos más vendidos"
          />
        </div>
        <Card className="animate-fade-in-up stagger-9">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Top Categorías
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reportData.topCategorias.length === 0 ? (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                Sin datos disponibles
              </div>
            ) : (
              <div className="space-y-3">
                {reportData.topCategorias.slice(0, 5).map((cat) => {
                  const maxVal = reportData.topCategorias[0]?.value || 1;
                  const percentage = (cat.value / maxVal) * 100;
                  return (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{cat.name}</span>
                        <span className="text-muted-foreground font-mono">
                          ${cat.value.toFixed(2)}
                        </span>
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
          <CardTitle className="text-sm font-medium">
            Clientes Más Frecuentes
          </CardTitle>
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
                    <th className="text-left py-2 font-medium text-muted-foreground">
                      Cliente
                    </th>
                    <th className="text-right py-2 font-medium text-muted-foreground">
                      Compras
                    </th>
                    <th className="text-right py-2 font-medium text-muted-foreground">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.clientesFrecuentes.map((cliente, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 font-medium">{cliente.nombre}</td>
                      <td className="py-2 text-right font-mono">
                        {cliente.compras}
                      </td>
                      <td className="py-2 text-right font-mono">
                        ${cliente.total.toFixed(2)}
                      </td>
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
