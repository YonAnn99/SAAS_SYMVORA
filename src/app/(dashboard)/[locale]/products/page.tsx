"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
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
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Package, Pencil, Trash2 } from "lucide-react";
import { DataTableToolbar } from "@/components/ui/data-table-toolbar";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { productSchema } from "@/lib/validations/schemas";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import type { Producto } from "@/lib/types/database";

interface ProductFormData {
  nombre: string;
  descripcion: string;
  codigo_barras: string;
  sku: string;
  unidad_medida: "PIEZA" | "KG" | "GRAMO" | "LITRO" | "SERVICIO";
  precio_venta: string;
  costo_compra: string;
  stock_actual: string;
  stock_minimo: string;
  es_servicio: boolean;
  categoria: string;
}

const defaultFormData: ProductFormData = {
  nombre: "",
  descripcion: "",
  codigo_barras: "",
  sku: "",
  unidad_medida: "PIEZA",
  precio_venta: "",
  costo_compra: "",
  stock_actual: "0",
  stock_minimo: "5",
  es_servicio: false,
  categoria: "",
};

export default function ProductsPage() {
  const t = useTranslations();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const [products, setProducts] = useState<Producto[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Producto | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!tenantId) return;
    const supabase = createSupabaseBrowserClient();

    const { data } = await supabase
      .from("productos")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("nombre");

    if (data) setProducts(data);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantLoading) {
      fetchProducts();
    }
  }, [tenantLoading, fetchProducts]);

  const filteredProducts = products.filter(
    (product) =>
      product.nombre.toLowerCase().includes(search.toLowerCase()) ||
      product.codigo_barras?.toLowerCase().includes(search.toLowerCase()) ||
      product.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const openCreateDialog = () => {
    setEditingProduct(null);
    setFormData(defaultFormData);
    setShowDialog(true);
  };

  const openEditDialog = (product: Producto) => {
    setEditingProduct(product);
    setFormData({
      nombre: product.nombre,
      descripcion: product.descripcion || "",
      codigo_barras: product.codigo_barras || "",
      sku: product.sku || "",
      unidad_medida: product.unidad_medida,
      precio_venta: product.precio_venta.toString(),
      costo_compra: product.costo_compra.toString(),
      stock_actual: product.stock_actual.toString(),
      stock_minimo: product.stock_minimo.toString(),
      es_servicio: product.es_servicio,
      categoria: product.categoria || "",
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    const parsed = productSchema.safeParse({
      ...formData,
      precio_venta: parseFloat(formData.precio_venta) || 0,
      costo_compra: parseFloat(formData.costo_compra) || 0,
      stock_actual: parseFloat(formData.stock_actual) || 0,
      stock_minimo: parseFloat(formData.stock_minimo) || 0,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    if (!tenantId) {
      toast.error("No se pudo identificar el tenant");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();

    const productData = {
      tenant_id: tenantId,
      nombre: formData.nombre,
      descripcion: formData.descripcion || null,
      codigo_barras: formData.codigo_barras || null,
      sku: formData.sku || null,
      unidad_medida: formData.unidad_medida,
      precio_venta: parseFloat(formData.precio_venta) || 0,
      costo_compra: parseFloat(formData.costo_compra) || 0,
      stock_actual: parseFloat(formData.stock_actual) || 0,
      stock_minimo: parseFloat(formData.stock_minimo) || 0,
      es_servicio: formData.es_servicio,
      categoria: formData.categoria || null,
    };

    if (editingProduct) {
      const { error } = await supabase
        .from("productos")
        .update(productData)
        .eq("id", editingProduct.id);

      if (error) {
        toast.error("Error al actualizar el producto");
      } else {
        toast.success("Producto actualizado");
        fetchProducts();
      }
    } else {
      const { error } = await supabase.from("productos").insert(productData);

      if (error) {
        toast.error("Error al crear el producto");
      } else {
        toast.success("Producto creado");
        fetchProducts();
      }
    }

    setSaving(false);
    setShowDialog(false);
  };

  const handleDelete = async (product: Producto) => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("productos")
      .delete()
      .eq("id", product.id);

    if (error) {
      toast.error("Error al eliminar el producto");
    } else {
      toast.success("Producto eliminado");
      fetchProducts();
    }
    setDeleteConfirm(null);
  };

  const updateField = (field: keyof ProductFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const exportColumns = [
    { header: "Nombre", accessor: (p: Producto) => p.nombre },
    { header: "Código de barras", accessor: (p: Producto) => p.codigo_barras || "-" },
    { header: "Unidad", accessor: (p: Producto) => p.unidad_medida },
    { header: "Precio de venta", accessor: (p: Producto) => `$${p.precio_venta.toFixed(2)}` },
    { header: "Stock actual", accessor: (p: Producto) => p.stock_actual },
    { header: "Stock mínimo", accessor: (p: Producto) => p.stock_minimo },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between animate-fade-in-up stagger-1">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("products.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona tu catálogo de productos
          </p>
        </div>
        <Button
          size="sm"
          className="h-8 active:scale-[0.98] transition-transform"
          onClick={openCreateDialog}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("products.addProduct")}
        </Button>
      </div>

      {/* Search + Export */}
      <div className="flex items-center gap-2 animate-fade-in-up stagger-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("common.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <DataTableToolbar
          data={filteredProducts}
          columns={exportColumns}
          title="Productos"
          filename="productos"
        />
      </div>

      {/* Products table */}
      <Card className="animate-fade-in-up stagger-3">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{t("products.title")}</CardTitle>
            <span className="text-xs text-muted-foreground font-mono">
              {products.length} productos
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Package className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {t("products.noProducts")}
              </p>
              <Button
                size="sm"
                className="h-8 mt-1 active:scale-[0.98] transition-transform"
                onClick={openCreateDialog}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("products.addProduct")}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">{t("products.name")}</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">{t("products.barcode")}</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">{t("products.unit")}</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    {t("products.salePrice")}
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    {t("products.currentStock")}
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">{t("common.status")}</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    {t("common.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium text-sm">
                      {product.nombre}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">{product.codigo_barras || "-"}</TableCell>
                    <TableCell className="text-sm">
                      {t(`products.units.${product.unidad_medida}`)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      ${product.precio_venta.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {product.stock_actual}
                    </TableCell>
                    <TableCell>
                      {product.stock_actual <= product.stock_minimo ? (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          {t("products.lowStock")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-[#EDF3EC] text-[#346538] dark:bg-[#346538]/20 dark:text-[#7BC67E]">OK</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => openEditDialog(product)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          {t("common.edit")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirm(product)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingProduct ? "Editar producto" : "Crear producto"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingProduct
                ? "Actualiza los datos del producto"
                : "Agrega un nuevo producto a tu catálogo"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre *</Label>
              <Input
                placeholder="Nombre del producto"
                value={formData.nombre}
                onChange={(e) => updateField("nombre", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descripción</Label>
              <Textarea
                placeholder="Descripción del producto"
                value={formData.descripcion}
                onChange={(e) => updateField("descripcion", e.target.value)}
                className="text-sm min-h-[60px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Código de barras</Label>
                <Input
                  placeholder="EAN-13"
                  value={formData.codigo_barras}
                  onChange={(e) => updateField("codigo_barras", e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">SKU</Label>
                <Input
                  placeholder="SKU-001"
                  value={formData.sku}
                  onChange={(e) => updateField("sku", e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Unidad de medida *</Label>
                <Select
                  value={formData.unidad_medida}
                  onValueChange={(v) => v && updateField("unidad_medida", v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIEZA">Pieza</SelectItem>
                    <SelectItem value="KG">Kilogramo</SelectItem>
                    <SelectItem value="GRAMO">Gramo</SelectItem>
                    <SelectItem value="LITRO">Litro</SelectItem>
                    <SelectItem value="SERVICIO">Servicio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Categoría</Label>
                <Input
                  placeholder="Ej: Bebidas"
                  value={formData.categoria}
                  onChange={(e) => updateField("categoria", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                <Label className="text-xs">Costo de compra *</Label>
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
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-1.5">
                <Label className="text-xs">Stock mínimo</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="5"
                  value={formData.stock_minimo}
                  onChange={(e) => updateField("stock_minimo", e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.es_servicio}
                onCheckedChange={(v) => updateField("es_servicio", v)}
              />
              <Label className="text-xs">Es servicio (no maneja stock)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setShowDialog(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              className="h-8 active:scale-[0.98] transition-transform"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? t("common.loading") : editingProduct ? "Guardar cambios" : "Crear producto"}
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
            <DialogTitle className="text-base">Eliminar producto</DialogTitle>
            <DialogDescription className="text-xs">
              ¿Estás seguro de eliminar <strong>{deleteConfirm?.nombre}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setDeleteConfirm(null)}
            >
              {t("common.cancel")}
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
