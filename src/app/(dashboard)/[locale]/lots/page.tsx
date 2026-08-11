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
import { Plus, Search, Calendar, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import type { Lote, Producto } from "@/lib/types/database";

interface LoteFormData {
  producto_id: string;
  numero_lote: string;
  cantidad: string;
  fecha_caducidad: string;
  fecha_fabricacion: string;
  costo_unitario: string;
}

const defaultFormData: LoteFormData = {
  producto_id: "",
  numero_lote: "",
  cantidad: "",
  fecha_caducidad: "",
  fecha_fabricacion: "",
  costo_unitario: "",
};

export default function LotsPage() {
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const [lots, setLots] = useState<Lote[]>([]);
  const [products, setProducts] = useState<{ id: string; nombre: string; permite_lotes: boolean }[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingLot, setEditingLot] = useState<Lote | null>(null);
  const [formData, setFormData] = useState<LoteFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Lote | null>(null);

  const fetchLots = useCallback(async () => {
    if (!tenantId) return;
    const supabase = createSupabaseBrowserClient();

    const { data } = await supabase
      .from("lotes")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("fecha_caducidad", { ascending: true });

    if (data) setLots(data);
    setLoading(false);
  }, [tenantId]);

  const fetchProducts = useCallback(async () => {
    if (!tenantId) return;
    const supabase = createSupabaseBrowserClient();

    const { data } = await supabase
      .from("productos")
      .select("id, nombre, permite_lotes")
      .eq("tenant_id", tenantId)
      .eq("permite_lotes", true)
      .order("nombre");

    if (data) setProducts(data);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantLoading) {
      fetchLots();
      fetchProducts();
    }
  }, [tenantLoading, fetchLots, fetchProducts]);

  const filteredLots = lots.filter(
    (lot) =>
      lot.numero_lote.toLowerCase().includes(search.toLowerCase()) ||
      getProductName(lot.producto_id).toLowerCase().includes(search.toLowerCase())
  );

  const openCreateDialog = () => {
    setEditingLot(null);
    setFormData(defaultFormData);
    setShowDialog(true);
  };

  const openEditDialog = (lot: Lote) => {
    setEditingLot(lot);
    setFormData({
      producto_id: lot.producto_id,
      numero_lote: lot.numero_lote,
      cantidad: lot.cantidad.toString(),
      fecha_caducidad: lot.fecha_caducidad || "",
      fecha_fabricacion: lot.fecha_fabricacion || "",
      costo_unitario: lot.costo_unitario.toString(),
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.producto_id) {
      toast.error("Selecciona un producto");
      return;
    }

    if (!formData.numero_lote) {
      toast.error("Ingresa el número de lote");
      return;
    }

    if (!formData.cantidad || parseFloat(formData.cantidad) <= 0) {
      toast.error("La cantidad debe ser mayor a 0");
      return;
    }

    if (!tenantId) {
      toast.error("No se pudo identificar el tenant");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();

    const lotData = {
      tenant_id: tenantId,
      producto_id: formData.producto_id,
      numero_lote: formData.numero_lote,
      cantidad: parseFloat(formData.cantidad) || 0,
      fecha_caducidad: formData.fecha_caducidad || null,
      fecha_fabricacion: formData.fecha_fabricacion || null,
      costo_unitario: parseFloat(formData.costo_unitario) || 0,
    };

    if (editingLot) {
      const { error } = await supabase
        .from("lotes")
        .update(lotData)
        .eq("id", editingLot.id);

      if (error) {
        toast.error("Error al actualizar el lote");
      } else {
        toast.success("Lote actualizado");
        fetchLots();
      }
    } else {
      const { error } = await supabase.from("lotes").insert(lotData);

      if (error) {
        if (error.code === "23505") {
          toast.error("Ya existe un lote con ese número para este producto");
        } else {
          toast.error("Error al crear el lote");
        }
      } else {
        toast.success("Lote creado");
        fetchLots();
      }
    }

    setSaving(false);
    setShowDialog(false);
  };

  const handleDelete = async (lot: Lote) => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("lotes")
      .delete()
      .eq("id", lot.id);

    if (error) {
      toast.error("Error al eliminar el lote");
    } else {
      toast.success("Lote eliminado");
      fetchLots();
    }
    setDeleteConfirm(null);
  };

  const updateField = (field: keyof LoteFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const getProductName = (productId: string) => {
    return products.find((p) => p.id === productId)?.nombre || "Producto desconocido";
  };

  const getDaysUntilExpiry = (fechaCaducidad: string | null) => {
    if (!fechaCaducidad) return null;
    const today = new Date();
    const expiry = new Date(fechaCaducidad);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryBadge = (fechaCaducidad: string | null) => {
    const days = getDaysUntilExpiry(fechaCaducidad);
    if (days === null) return null;
    
    if (days < 0) {
      return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Vencido</Badge>;
    }
    if (days <= 7) {
      return <Badge variant="destructive" className="text-[10px] px-1.5 py-0 bg-orange-500">{days} días</Badge>;
    }
    if (days <= 30) {
      return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-800">{days} días</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800">{days} días</Badge>;
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            Lotes con Caducidad
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona lotes de productos perecederos
          </p>
        </div>
        <Button
          size="sm"
          className="h-8 active:scale-[0.98] transition-transform"
          onClick={openCreateDialog}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Agregar lote
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 animate-fade-in-up stagger-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número de lote o producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Lots table */}
      <Card className="animate-fade-in-up stagger-3">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium">Lotes</CardTitle>
            <span className="text-xs text-muted-foreground font-mono">
              {lots.length} lotes
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              Cargando...
            </div>
          ) : filteredLots.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Calendar className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {lots.length === 0
                  ? "No hay lotes creados"
                  : "No se encontraron lotes"}
              </p>
              <Button
                size="sm"
                className="h-8 mt-1 active:scale-[0.98] transition-transform"
                onClick={openCreateDialog}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Agregar lote
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">Producto</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">N° Lote</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Cantidad
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Fecha Caducidad
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Costo Unitario
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Estado</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLots.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell className="font-medium text-sm">
                      {getProductName(lot.producto_id)}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {lot.numero_lote}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {lot.cantidad}
                    </TableCell>
                    <TableCell className="text-sm">
                      {lot.fecha_caducidad ? (
                        <div className="flex items-center gap-2">
                          {new Date(lot.fecha_caducidad).toLocaleDateString("es-MX")}
                          {getExpiryBadge(lot.fecha_caducidad)}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      ${lot.costo_unitario.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={lot.estado === "ACTIVO" ? "secondary" : "destructive"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {lot.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => openEditDialog(lot)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirm(lot)}
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
              {editingLot ? "Editar lote" : "Crear lote"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingLot
                ? "Actualiza los datos del lote"
                : "Agrega un nuevo lote de producto"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Producto *</Label>
              <Select
                value={formData.producto_id}
                onValueChange={(v) => updateField("producto_id", v ?? "")}
                disabled={!!editingLot}
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
                <Label className="text-xs">Número de lote *</Label>
                <Input
                  placeholder="LOTE-001"
                  value={formData.numero_lote}
                  onChange={(e) => updateField("numero_lote", e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cantidad *</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.cantidad}
                  onChange={(e) => updateField("cantidad", e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha de fabricación</Label>
                <Input
                  type="date"
                  value={formData.fecha_fabricacion}
                  onChange={(e) => updateField("fecha_fabricacion", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha de caducidad</Label>
                <Input
                  type="date"
                  value={formData.fecha_caducidad}
                  onChange={(e) => updateField("fecha_caducidad", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Costo unitario</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.costo_unitario}
                onChange={(e) => updateField("costo_unitario", e.target.value)}
                className="h-8 text-sm font-mono"
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
              {saving ? "Guardando..." : editingLot ? "Guardar cambios" : "Crear lote"}
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
            <DialogTitle className="text-base">Eliminar lote</DialogTitle>
            <DialogDescription className="text-xs">
              ¿Estás seguro de eliminar este lote? Esta acción no se puede deshacer.
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
