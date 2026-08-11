"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Search, Palette, Pencil, Trash2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import type { VarianteProducto, Producto } from "@/lib/types/database";

interface VarianteFormData {
  producto_id: string;
  sku: string;
  codigo_barras: string;
  talla: string;
  color: string;
  precio_venta: string;
  costo_compra: string;
  stock_actual: string;
}

const defaultFormData: VarianteFormData = {
  producto_id: "",
  sku: "",
  codigo_barras: "",
  talla: "",
  color: "",
  precio_venta: "",
  costo_compra: "",
  stock_actual: "0",
};

export default function VariantsPage() {
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const [variants, setVariants] = useState<VarianteProducto[]>([]);
  const [products, setProducts] = useState<{ id: string; nombre: string; permite_variantes: boolean }[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingVariant, setEditingVariant] = useState<VarianteProducto | null>(null);
  const [formData, setFormData] = useState<VarianteFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<VarianteProducto | null>(null);

  const fetchVariants = useCallback(async () => {
    if (!tenantId) return;
    const supabase = createSupabaseBrowserClient();

    const { data } = await supabase
      .from("variantes_producto")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("creado_en", { ascending: false });

    if (data) setVariants(data);
    setLoading(false);
  }, [tenantId]);

  const fetchProducts = useCallback(async () => {
    if (!tenantId) return;
    const supabase = createSupabaseBrowserClient();

    const { data } = await supabase
      .from("productos")
      .select("id, nombre, permite_variantes")
      .eq("tenant_id", tenantId)
      .eq("permite_variantes", true)
      .order("nombre");

    if (data) setProducts(data);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantLoading) {
      fetchVariants();
      fetchProducts();
    }
  }, [tenantLoading, fetchVariants, fetchProducts]);

  const filteredVariants = variants.filter(
    (variant) =>
      variant.talla?.toLowerCase().includes(search.toLowerCase()) ||
      variant.color?.toLowerCase().includes(search.toLowerCase()) ||
      variant.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const openCreateDialog = () => {
    setEditingVariant(null);
    setFormData(defaultFormData);
    setShowDialog(true);
  };

  const openEditDialog = (variant: VarianteProducto) => {
    setEditingVariant(variant);
    setFormData({
      producto_id: variant.producto_id,
      sku: variant.sku || "",
      codigo_barras: variant.codigo_barras || "",
      talla: variant.talla || "",
      color: variant.color || "",
      precio_venta: variant.precio_venta.toString(),
      costo_compra: variant.costo_compra.toString(),
      stock_actual: variant.stock_actual.toString(),
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.producto_id) {
      toast.error("Selecciona un producto");
      return;
    }

    if (!formData.precio_venta || parseFloat(formData.precio_venta) <= 0) {
      toast.error("El precio de venta debe ser mayor a 0");
      return;
    }

    if (!tenantId) {
      toast.error("No se pudo identificar el tenant");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();

    const variantData = {
      tenant_id: tenantId,
      producto_id: formData.producto_id,
      sku: formData.sku || null,
      codigo_barras: formData.codigo_barras || null,
      talla: formData.talla || null,
      color: formData.color || null,
      precio_venta: parseFloat(formData.precio_venta) || 0,
      costo_compra: parseFloat(formData.costo_compra) || 0,
      stock_actual: parseFloat(formData.stock_actual) || 0,
    };

    if (editingVariant) {
      const { error } = await supabase
        .from("variantes_producto")
        .update(variantData)
        .eq("id", editingVariant.id);

      if (error) {
        toast.error("Error al actualizar la variante");
      } else {
        toast.success("Variante actualizada");
        fetchVariants();
      }
    } else {
      const { error } = await supabase.from("variantes_producto").insert(variantData);

      if (error) {
        if (error.code === "23505") {
          toast.error("Ya existe una variante con esa talla y color para este producto");
        } else {
          toast.error("Error al crear la variante");
        }
      } else {
        toast.success("Variante creada");
        fetchVariants();
      }
    }

    setSaving(false);
    setShowDialog(false);
  };

  const handleDelete = async (variant: VarianteProducto) => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("variantes_producto")
      .delete()
      .eq("id", variant.id);

    if (error) {
      toast.error("Error al eliminar la variante");
    } else {
      toast.success("Variante eliminada");
      fetchVariants();
    }
    setDeleteConfirm(null);
  };

  const updateField = (field: keyof VarianteFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const getProductName = (productId: string) => {
    return products.find((p) => p.id === productId)?.nombre || "Producto desconocido";
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            Variantes de Producto
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona tallas, colores y otras variantes de tus productos
          </p>
        </div>
        <Button
          size="sm"
          className="h-8 active:scale-[0.98] transition-transform"
          onClick={openCreateDialog}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Agregar variante
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 animate-fade-in-up stagger-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por talla, color o SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Variants table */}
      <Card className="animate-fade-in-up stagger-3">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium">Variantes</CardTitle>
            <span className="text-xs text-muted-foreground font-mono">
              {variants.length} variantes
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              Cargando...
            </div>
          ) : filteredVariants.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Palette className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {variants.length === 0
                  ? "No hay variantes creadas"
                  : "No se encontraron variantes"}
              </p>
              <Button
                size="sm"
                className="h-8 mt-1 active:scale-[0.98] transition-transform"
                onClick={openCreateDialog}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Agregar variante
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">Producto</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Talla</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Color</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">SKU</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Precio
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Stock
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVariants.map((variant) => (
                  <TableRow key={variant.id}>
                    <TableCell className="font-medium text-sm">
                      {getProductName(variant.producto_id)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {variant.talla || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {variant.color ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full border"
                            style={{ backgroundColor: variant.color }}
                          />
                          {variant.color}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">
                      {variant.sku || "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      ${variant.precio_venta.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {variant.stock_actual}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => openEditDialog(variant)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirm(variant)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
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

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingVariant ? "Editar variante" : "Crear variante"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingVariant
                ? "Actualiza los datos de la variante"
                : "Agrega una nueva variante a tu catálogo"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Producto *</Label>
              <Select
                value={formData.producto_id}
                onValueChange={(v) => updateField("producto_id", v ?? "")}
                disabled={!!editingVariant}
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Talla</Label>
                <Input
                  placeholder="Ej: S, M, L, XL"
                  value={formData.talla}
                  onChange={(e) => updateField("talla", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Color</Label>
                <Input
                  placeholder="Ej: Rojo, Azul"
                  value={formData.color}
                  onChange={(e) => updateField("color", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">SKU</Label>
                <Input
                  placeholder="SKU-001-S"
                  value={formData.sku}
                  onChange={(e) => updateField("sku", e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Código de barras</Label>
                <Input
                  placeholder="EAN-13"
                  value={formData.codigo_barras}
                  onChange={(e) => updateField("codigo_barras", e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Precio de venta *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.precio_venta}
                  onChange={(e) => updateField("precio_venta", e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Costo de compra</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.costo_compra}
                  onChange={(e) => updateField("costo_compra", e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Stock actual</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.stock_actual}
                  onChange={(e) => updateField("stock_actual", e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
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
              {saving ? "Guardando..." : editingVariant ? "Guardar cambios" : "Crear variante"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">Eliminar variante</DialogTitle>
            <DialogDescription className="text-xs">
              ¿Estás seguro de eliminar esta variante? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setDeleteConfirm(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-8"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
