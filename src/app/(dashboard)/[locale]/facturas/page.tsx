"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, FileText, Stamp, XCircle, Trash2, Settings2, Download, FileDown, Eye } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useIsDemo } from "@/hooks/use-is-demo";
import { DemoRestrictedNotice } from "@/components/demo/demo-restricted-notice";
import {
  CustomerSelector,
  NewCustomerDialog,
  useCustomers,
} from "@/features/customers";
import type { Factura, Producto } from "@/lib/types/database";
import {
  CLAVE_PROD_SERV_COMMON,
  CLAVE_UNIDAD_SAT,
  FORMAS_PAGO,
  USOS_CFDI,
} from "@/features/facturacion/catalogs";

interface FacturaLinea {
  producto_id: string;
  descripcion: string;
  clave_prod_serv: string;
  clave_unidad: string;
  unidad: string;
  cantidad: string;
  precio_unitario: string;
  descuento: string;
}

const defaultLinea: FacturaLinea = {
  producto_id: "",
  descripcion: "",
  clave_prod_serv: "84111506",
  clave_unidad: "E48",
  unidad: "Servicio",
  cantidad: "1",
  precio_unitario: "0",
  descuento: "0",
};

export default function FacturasPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const isDemo = useIsDemo();
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState<Factura | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterEstado, setFilterEstado] = useState<string>("all");

  const { customers } = useCustomers(tenantId);

  // Create form state
  const [clienteId, setClienteId] = useState("");
  const [ventaId, setVentaId] = useState("");
  const [formaPago, setFormaPago] = useState("01");
  const [metodoPago, setMetodoPago] = useState<"PUE" | "PPD">("PUE");
  const [lineas, setLineas] = useState<FacturaLinea[]>([{ ...defaultLinea }]);

  const fetchFacturas = useCallback(async () => {
    if (!tenantId) return;
    const supabase = createSupabaseBrowserClient();

    const { data } = await supabase
      .from("facturas")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (data) setFacturas(data);
    setLoading(false);
  }, [tenantId]);

  const fetchProductos = useCallback(async () => {
    if (!tenantId) return;
    const supabase = createSupabaseBrowserClient();

    const { data } = await supabase
      .from("productos")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("nombre");

    if (data) setProductos(data);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantLoading) {
      fetchFacturas();
      fetchProductos();
    }
  }, [tenantLoading, fetchFacturas, fetchProductos]);

  const filteredFacturas = facturas.filter((f) => {
    const matchesSearch =
      f.serie.toLowerCase().includes(search.toLowerCase()) ||
      f.uuid_cfdi?.toLowerCase().includes(search.toLowerCase()) ||
      f.receptor_rfc.toLowerCase().includes(search.toLowerCase()) ||
      f.receptor_razon_social.toLowerCase().includes(search.toLowerCase());
    const matchesEstado = filterEstado === "all" || f.estado === filterEstado;
    return matchesSearch && matchesEstado;
  });

  const addLinea = () => {
    setLineas([...lineas, { ...defaultLinea }]);
  };

  const removeLinea = (index: number) => {
    if (lineas.length > 1) {
      setLineas(lineas.filter((_, i) => i !== index));
    }
  };

  const updateLinea = (index: number, field: keyof FacturaLinea, value: string) => {
    const newLineas = [...lineas];
    newLineas[index] = { ...newLineas[index], [field]: value };

    // Auto-fill from product
    if (field === "producto_id" && value) {
      const producto = productos.find((p) => p.id === value);
      if (producto) {
        newLineas[index].descripcion = producto.nombre;
        newLineas[index].precio_unitario = producto.precio_venta.toString();
        newLineas[index].clave_prod_serv = producto.clave_prod_serv || "84111506";
        newLineas[index].clave_unidad = producto.clave_unidad || "H87";
        newLineas[index].unidad = producto.unidad_medida === "SERVICIO" ? "Servicio" : "Pieza";
      }
    }

    setLineas(newLineas);
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let descuento = 0;
    let impuesto = 0;

    lineas.forEach((linea) => {
      const cant = parseFloat(linea.cantidad) || 0;
      const precio = parseFloat(linea.precio_unitario) || 0;
      const desc = parseFloat(linea.descuento) || 0;
      const sub = cant * precio;
      subtotal += sub;
      descuento += desc;
      impuesto += (sub - desc) * 0.16;
    });

    return { subtotal, descuento, impuesto, total: subtotal - descuento + impuesto };
  };

  const handleCreate = async () => {
    if (!tenantId || !clienteId) {
      toast.error("Selecciona un cliente");
      return;
    }

    const validLineas = lineas.filter(
      (l) => l.descripcion && parseFloat(l.precio_unitario) > 0
    );

    if (validLineas.length === 0) {
      toast.error("Agrega al menos una línea con descripción y precio");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/facturas/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          cliente_id: clienteId,
          venta_id: ventaId || undefined,
          forma_pago: formaPago,
          metodo_pago: metodoPago,
          lineas: validLineas.map((l) => ({
            producto_id: l.producto_id || undefined,
            descripcion: l.descripcion,
            clave_prod_serv: l.clave_prod_serv,
            clave_unidad: l.clave_unidad,
            unidad: l.unidad,
            cantidad: parseFloat(l.cantidad) || 1,
            precio_unitario: parseFloat(l.precio_unitario) || 0,
            descuento: parseFloat(l.descuento) || 0,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al crear factura");
      }

      toast.success("Factura creada correctamente");
      setShowCreateDialog(false);
      resetForm();
      fetchFacturas();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear factura");
    } finally {
      setSaving(false);
    }
  };

  const handleStamp = async (factura: Factura) => {
    if (isDemo) {
      toast.error("Las acciones de facturación no están disponibles en el modo demo.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/facturas/stamp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factura_id: factura.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al timbrar");
      }

      toast.success(`Factura timbrada. UUID: ${data.uuid}`);
      fetchFacturas();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al timbrar");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!showCancelDialog || !cancelMotivo) return;
    if (isDemo) {
      toast.error("Las acciones de facturación no están disponibles en el modo demo.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/facturas/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factura_id: showCancelDialog.id,
          motivo: cancelMotivo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cancelar");
      }

      toast.success(data.message);
      setShowCancelDialog(null);
      setCancelMotivo("");
      fetchFacturas();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al cancelar");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setClienteId("");
    setVentaId("");
    setFormaPago("01");
    setMetodoPago("PUE");
    setLineas([{ ...defaultLinea }]);
  };

  const totals = calculateTotals();

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "BORRADOR":
        return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Borrador</Badge>;
      case "TIMBRADA":
        return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Timbrada</Badge>;
      case "CANCELADA":
        return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Cancelada</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{estado}</Badge>;
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {isDemo && <DemoRestrictedNotice />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            {t("facturas.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Facturación electrónica CFDI 4.0
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 active:scale-[0.98] transition-transform w-full sm:w-auto"
            onClick={() => router.push(`/${locale}/facturas/config`)}
          >
            <Settings2 className="mr-1.5 h-3.5 w-3.5" />
            {t("facturas.configFiscal")}
          </Button>
          <Button
            size="sm"
            className="h-8 active:scale-[0.98] transition-transform w-full sm:w-auto"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nueva Factura
          </Button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-2 animate-fade-in-up stagger-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por serie, UUID, RFC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={filterEstado} onValueChange={(v) => setFilterEstado(v || "all")}>
          <SelectTrigger className="w-[140px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="BORRADOR">Borrador</SelectItem>
            <SelectItem value="TIMBRADA">Timbrada</SelectItem>
            <SelectItem value="CANCELADA">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Facturas table */}
      <Card className="animate-fade-in-up stagger-3">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Facturas</CardTitle>
            <span className="text-xs text-muted-foreground font-mono">
              {facturas.length} facturas
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : filteredFacturas.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <FileText className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No hay facturas registradas</p>
              <Button
                size="sm"
                className="h-8 mt-1 active:scale-[0.98] transition-transform"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Nueva Factura
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase tracking-wider">Serie/Folio</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Cliente</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">RFC</TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider">Total</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Estado</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Fecha</TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFacturas.map((factura) => (
                    <TableRow key={factura.id}>
                      <TableCell className="font-medium text-sm font-mono">
                        {factura.serie}-{factura.folio}
                      </TableCell>
                      <TableCell className="text-sm">
                        {factura.receptor_razon_social}
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {factura.receptor_rfc}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        ${factura.total.toFixed(2)}
                      </TableCell>
                      <TableCell>{getEstadoBadge(factura.estado)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(factura.fecha_emision).toLocaleDateString("es-MX")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => router.push(`/${locale}/facturas/${factura.id}`)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Ver
                          </Button>
                          {factura.estado === "BORRADOR" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleStamp(factura)}
                              disabled={saving}
                            >
                              <Stamp className="h-3 w-3 mr-1" />
                              Timbrar
                            </Button>
                          )}
                          {factura.estado === "TIMBRADA" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() =>
                                  window.open(`/api/facturas/${factura.id}/xml`, "_blank")
                                }
                                title={t("facturas.viewXml")}
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() =>
                                  window.open(`/api/facturas/${factura.id}/pdf`, "_blank")
                                }
                                title={t("facturas.downloadPdf")}
                              >
                                <FileDown className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-destructive hover:text-destructive"
                                onClick={() => setShowCancelDialog(factura)}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Cancelar
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto mx-4 sm:mx-0">
          <DialogHeader>
            <DialogTitle className="text-base">Nueva Factura</DialogTitle>
            <DialogDescription className="text-xs">
              Crea una factura electrónica CFDI 4.0
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Client selector */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cliente *</Label>
                <CustomerSelector
                  customers={customers}
                  selectedCustomer={clienteId}
                  onSelectCustomer={setClienteId}
                  onNewCustomer={() => setShowNewCustomerDialog(true)}
                  showLabel={false}
                  allowGeneral={false}
                  placeholder="Selecciona cliente"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Venta (opcional)</Label>
                <Input
                  placeholder="ID de venta"
                  value={ventaId}
                  onChange={(e) => setVentaId(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Payment method */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Forma de pago</Label>
                <Select value={formaPago} onValueChange={(v) => setFormaPago(v || "01")}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FORMAS_PAGO)
                      .filter(([k]) => ["01", "03", "04", "18", "19", "99"].includes(k))
                      .map(([key, value]) => (
                        <SelectItem key={key} value={key}>
                          {key} - {value}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Método de pago</Label>
                <Select value={metodoPago} onValueChange={(v) => setMetodoPago((v || "PUE") as "PUE" | "PPD")}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUE">PUE - Pago en una sola exhibición</SelectItem>
                    <SelectItem value="PPD">PPD - Pago en parcialidades</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Conceptos</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={addLinea}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Agregar
                </Button>
              </div>
              {lineas.map((linea, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Concepto {index + 1}</span>
                    {lineas.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-destructive"
                        onClick={() => removeLinea(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Producto</Label>
                      <Select
                        value={linea.producto_id}
                        onValueChange={(v) => updateLinea(index, "producto_id", v || "")}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {productos.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px]">Descripción *</Label>
                      <Input
                        value={linea.descripcion}
                        onChange={(e) => updateLinea(index, "descripcion", e.target.value)}
                        className="h-7 text-xs"
                        placeholder="Descripción del concepto"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Cantidad</Label>
                      <Input
                        type="number"
                        value={linea.cantidad}
                        onChange={(e) => updateLinea(index, "cantidad", e.target.value)}
                        className="h-7 text-xs font-mono"
                        min="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Precio unitario</Label>
                      <Input
                        type="number"
                        value={linea.precio_unitario}
                        onChange={(e) => updateLinea(index, "precio_unitario", e.target.value)}
                        className="h-7 text-xs font-mono"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Descuento</Label>
                      <Input
                        type="number"
                        value={linea.descuento}
                        onChange={(e) => updateLinea(index, "descuento", e.target.value)}
                        className="h-7 text-xs font-mono"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Clave SAT</Label>
                      <Input
                        value={linea.clave_prod_serv}
                        onChange={(e) => updateLinea(index, "clave_prod_serv", e.target.value)}
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t pt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-mono">${totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Descuento:</span>
                <span className="font-mono text-destructive">-${totals.descuento.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IVA (16%):</span>
                <span className="font-mono">${totals.impuesto.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t pt-1">
                <span>Total:</span>
                <span className="font-mono">${totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setShowCreateDialog(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              className="h-8 active:scale-[0.98] transition-transform"
              onClick={handleCreate}
              disabled={saving}
            >
              {saving ? t("common.loading") : "Crear Factura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Customer Dialog */}
      <NewCustomerDialog
        open={showNewCustomerDialog}
        onOpenChange={setShowNewCustomerDialog}
        tenantId={tenantId}
        onCreated={(customer) => {
          setClienteId(customer.id);
        }}
      />

      {/* Cancel Dialog */}
      <Dialog open={!!showCancelDialog} onOpenChange={() => setShowCancelDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">Cancelar Factura</DialogTitle>
            <DialogDescription className="text-xs">
              ¿Estás seguro de cancelar la factura{" "}
              <strong>
                {showCancelDialog?.serie}-{showCancelDialog?.folio}
              </strong>
              ? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Motivo de cancelación *</Label>
              <Textarea
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                placeholder="Describe el motivo de la cancelación"
                className="text-sm min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setShowCancelDialog(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-8"
              onClick={handleCancel}
              disabled={saving || !cancelMotivo}
            >
              {saving ? t("common.loading") : "Cancelar Factura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
