"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Plus, Search, Wrench, ArrowUp, ArrowDown } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import type { AjusteInventario, Producto, VarianteProducto, Lote } from "@/lib/types/database";

interface AjusteFormData {
  producto_id: string;
  variante_id: string;
  lote_id: string;
  motivo: "MERMA" | "CONTEO_FISICO" | "DEVOLUCION" | "DAÑO" | "OTRO";
  cantidad_ajuste: string;
  notas: string;
}

const defaultFormData: AjusteFormData = {
  producto_id: "",
  variante_id: "",
  lote_id: "",
  motivo: "MERMA",
  cantidad_ajuste: "",
  notas: "",
};

const motivoLabels: Record<string, string> = {
  MERMA: "Merma",
  CONTEO_FISICO: "Conteo Físico",
  DEVOLUCION: "Devolución",
  DAÑO: "Daño",
  OTRO: "Otro",
};

export default function InventoryAdjustmentsPage() {
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const [adjustments, setAdjustments] = useState<AjusteInventario[]>([]);
  const [products, setProducts] = useState<{ id: string; nombre: string }[]>([]);
  const [variants, setVariants] = useState<{ id: string; talla: string | null; color: string | null; sku: string | null }[]>([]);
  const [lots, setLots] = useState<{ id: string; numero_lote: string; cantidad: number; fecha_caducidad: string | null }[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState<AjusteFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);

  const fetchAdjustments = useCallback(async () => {
    if (!tenantId) return;
    const supabase = createSupabaseBrowserClient();

    const { data } = await supabase
      .from("ajustes_inventario")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("creado_en", { ascending: false });

    if (data) setAdjustments(data);
    setLoading(false);
  }, [tenantId]);

  const fetchProducts = useCallback(async () => {
    if (!tenantId) return;
    const supabase = createSupabaseBrowserClient();

    const { data } = await supabase
      .from("productos")
      .select("id, nombre")
      .eq("tenant_id", tenantId)
      .order("nombre");

    if (data) setProducts(data);
  }, [tenantId]);

  const fetchVariants = useCallback(async () => {
    if (!tenantId || !formData.producto_id) {
      setVariants([]);
      return;
    }
    const supabase = createSupabaseBrowserClient();

    const { data } = await supabase
      .from("variantes_producto")
      .select("id, talla, color, sku")
      .eq("tenant_id", tenantId)
      .eq("producto_id", formData.producto_id)
      .order("talla");

    if (data) setVariants(data);
  }, [tenantId, formData.producto_id]);

  const fetchLots = useCallback(async () => {
    if (!tenantId || !formData.producto_id) {
      setLots([]);
      return;
    }
    const supabase = createSupabaseBrowserClient();

    const { data } = await supabase
      .from("lotes")
      .select("id, numero_lote, cantidad, fecha_caducidad")
      .eq("tenant_id", tenantId)
      .eq("producto_id", formData.producto_id)
      .eq("estado", "ACTIVO")
      .order("fecha_caducidad", { ascending: true });

    if (data) setLots(data);
  }, [tenantId, formData.producto_id]);

  useEffect(() => {
    if (!tenantLoading) {
      fetchAdjustments();
      fetchProducts();
    }
  }, [tenantLoading, fetchAdjustments, fetchProducts]);

  useEffect(() => {
    fetchVariants();
    fetchLots();
  }, [formData.producto_id, fetchVariants, fetchLots]);

  const filteredAdjustments = adjustments.filter(
    (adj) =>
      getProductName(adj.producto_id).toLowerCase().includes(search.toLowerCase()) ||
      adj.motivo.toLowerCase().includes(search.toLowerCase())
  );

  const openCreateDialog = () => {
    setFormData(defaultFormData);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.producto_id) {
      toast.error("Selecciona un producto");
      return;
    }

    if (!formData.cantidad_ajuste || parseFloat(formData.cantidad_ajuste) === 0) {
      toast.error("La cantidad de ajuste no puede ser 0");
      return;
    }

    if (!tenantId) {
      toast.error("No se pudo identificar el tenant");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();

    const { data, error } = await supabase.rpc("ajustar_inventario", {
      p_producto_id: formData.producto_id,
      p_cantidad_ajuste: parseFloat(formData.cantidad_ajuste),
      p_motivo: formData.motivo,
      p_notas: formData.notas || null,
      p_variante_id: formData.variante_id || null,
      p_lote_id: formData.lote_id || null,
    });

    if (error) {
      toast.error(error.message || "Error al ajustar inventario");
    } else {
      toast.success("Inventario ajustado correctamente");
      fetchAdjustments();
      setShowDialog(false);
    }

    setSaving(false);
  };

  const updateField = (field: keyof AjusteFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const getProductName = (productId: string) => {
    return products.find((p) => p.id === productId)?.nombre || "Producto desconocido";
  };

  const getAdjustmentType = (cantidad: number) => {
    if (cantidad > 0) {
      return <ArrowUp className="h-4 w-4 text-green-500" />;
    }
    return <ArrowDown className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            Ajustes de Inventario
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Registra ajustes de stock con motivo obligatorio
          </p>
        </div>
        <Button
          size="sm"
          className="h-8 active:scale-[0.98] transition-transform"
          onClick={openCreateDialog}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Nuevo ajuste
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 animate-fade-in-up stagger-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por producto o motivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Adjustments table */}
      <Card className="animate-fade-in-up stagger-3">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium">Historial de Ajustes</CardTitle>
            <span className="text-xs text-muted-foreground font-mono">
              {adjustments.length} ajustes
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              Cargando...
            </div>
          ) : filteredAdjustments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Wrench className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {adjustments.length === 0
                  ? "No hay ajustes registrados"
                  : "No se encontraron ajustes"}
              </p>
              <Button
                size="sm"
                className="h-8 mt-1 active:scale-[0.98] transition-transform"
                onClick={openCreateDialog}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Nuevo ajuste
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">Fecha</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Producto</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Motivo</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Anterior
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Ajuste
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Nuevo
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdjustments.map((adj) => (
                  <TableRow key={adj.id}>
                    <TableCell className="text-sm">
                      {new Date(adj.creado_en).toLocaleDateString("es-MX")}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {getProductName(adj.producto_id)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {motivoLabels[adj.motivo]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {adj.cantidad_anterior}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      <div className="flex items-center justify-end gap-1">
                        {getAdjustmentType(adj.cantidad_ajuste)}
                        <span className={adj.cantidad_ajuste > 0 ? "text-green-600" : "text-red-600"}>
                          {adj.cantidad_ajuste > 0 ? "+" : ""}{adj.cantidad_ajuste}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono font-medium">
                      {adj.cantidad_nueva}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {adj.notas || "-"}
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
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Nuevo ajuste de inventario</DialogTitle>
            <DialogDescription className="text-xs">
              Registra un ajuste de stock con el motivo correspondiente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Producto *</Label>
              <Select
                value={formData.producto_id}
                onValueChange={(v) => updateField("producto_id", v ?? "")}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {variants.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Variante (opcional)</Label>
              <Select
                value={formData.variante_id}
                onValueChange={(v) => updateField("variante_id", v ?? "")}
              >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Sin variante" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin variante</SelectItem>
                    {variants.map((variant) => (
                      <SelectItem key={variant.id} value={variant.id}>
                        {variant.talla} - {variant.color} ({variant.sku || "N/A"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {lots.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Lote (opcional)</Label>
              <Select
                value={formData.lote_id}
                onValueChange={(v) => updateField("lote_id", v ?? "")}
              >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Sin lote" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin lote</SelectItem>
                    {lots.map((lot) => (
                      <SelectItem key={lot.id} value={lot.id}>
                        {lot.numero_lote} - {lot.cantidad} unidades
                        {lot.fecha_caducidad && ` (Exp: ${new Date(lot.fecha_caducidad).toLocaleDateString("es-MX")})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Motivo *</Label>
              <Select
                value={formData.motivo}
                onValueChange={(v) => updateField("motivo", v as AjusteFormData["motivo"])}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MERMA">Merma</SelectItem>
                  <SelectItem value="CONTEO_FISICO">Conteo Físico</SelectItem>
                  <SelectItem value="DEVOLUCION">Devolución</SelectItem>
                  <SelectItem value="DAÑO">Daño</SelectItem>
                  <SelectItem value="OTRO">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Cantidad de ajuste * 
                <span className="text-muted-foreground ml-2">
                  (positivo para agregar, negativo para reducir)
                </span>
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Ej: 10 o -5"
                value={formData.cantidad_ajuste}
                onChange={(e) => updateField("cantidad_ajuste", e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notas</Label>
              <Textarea
                placeholder="Descripción del ajuste..."
                value={formData.notas}
                onChange={(e) => updateField("notas", e.target.value)}
                className="text-sm min-h-[60px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setShowDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-8 active:scale-[0.98] transition-transform"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Guardando..." : "Registrar ajuste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
