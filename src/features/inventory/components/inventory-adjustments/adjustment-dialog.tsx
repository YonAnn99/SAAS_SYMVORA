"use client";

import { useLocale, useTranslations } from "next-intl";
import { localeIntl } from "@/lib/idioma";
import { useModulos } from "@/hooks/use-modulos";
import { useMemo, useState } from "react";
import { useSucursal } from "@/contexts/sucursal-context";
import { CampoSucursal } from "@/features/sucursales/components/campo-sucursal";
import { destinoPorDefecto } from "@/features/sucursales/seleccion";
import { existenciaEn } from "../../lotes";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import type {
  LoteOption,
  ProductOption,
  VarianteOption,
} from "../../types/inventory.types";
import {
  defaultAjusteFormData,
  type AjusteFormData,
  type MotivoAjuste,
} from "../../types/inventory.types";
import type { AjusteInput } from "../../services/inventory-adjustment-service";

interface AdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductOption[];
  variants: VarianteOption[];
  lots: LoteOption[];
  saving: boolean;
  onProductChange: (productoId: string) => void;
  onSave: (input: AjusteInput) => void;
}

export function AdjustmentDialog({
  open,
  onOpenChange,
  products,
  variants,
  lots,
  saving,
  onProductChange,
  onSave,
}: AdjustmentDialogProps) {
  const t = useTranslations("products.adjustments");
  const locale = useLocale();
  // Sin el modulo de mermas no se ofrece ese motivo, y el formulario arranca
  // en "Conteo fisico" (el valor por defecto era justo "Merma").
  const { modulos } = useModulos();
  const [formData, setFormData] = useState<AjusteFormData>(() =>
    modulos.permite_mermas
      ? defaultAjusteFormData
      : { ...defaultAjusteFormData, motivo: "CONTEO_FISICO" }
  );
  // El local que se ajusta. `undefined` = aun no se ha tocado el campo y vale
  // el destino por defecto (la sucursal que se esta mirando); asi no hace falta
  // un efecto que lo sincronice al abrir.
  const { seleccionada, activas, hayVarias } = useSucursal();
  const [sucursalElegida, setSucursalElegida] = useState<string | null | undefined>(undefined);
  const sucursalId =
    sucursalElegida === undefined ? destinoPorDefecto(seleccionada, activas) : sucursalElegida;

  const selectedProductName = useMemo(
    () => products.find((p) => p.id === formData.producto_id)?.nombre ?? formData.producto_id,
    [products, formData.producto_id]
  );

  const selectedVariantName = useMemo(() => {
    if (!formData.variante_id) return "";
    const variant = variants.find((v) => v.id === formData.variante_id);
    return variant ? `${variant.talla} - ${variant.color} (${variant.sku || "N/A"})` : formData.variante_id;
  }, [variants, formData.variante_id]);

  // 116: el lote se ajusta en la sucursal elegida. Se ofrecen los de la
  // variante elegida, con lo que hay de cada uno en ESA sucursal.
  const lotesDelAjuste = useMemo(
    () =>
      lots
        .filter((l) => (l.variante_id ?? "") === formData.variante_id)
        .map((l) => ({
          ...l,
          enSucursal: existenciaEn(l.existencias_lote, sucursalId),
        })),
    [lots, formData.variante_id, sucursalId]
  );

  const etiquetaLote = (lot: (typeof lotesDelAjuste)[number]) => {
    let display = t("lotHere", { numero: lot.numero_lote, cantidad: lot.enSucursal });
    if (lot.fecha_caducidad) {
      display += ` ${t("lotExpires", { fecha: new Date(`${lot.fecha_caducidad}T12:00:00`).toLocaleDateString(localeIntl(locale)) })}`;
    }
    return display;
  };

  const loteElegido = lotesDelAjuste.find((l) => l.id === formData.lote_id);
  const selectedLotName = loteElegido ? etiquetaLote(loteElegido) : "";

  const updateField = (field: keyof AjusteFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleProductChange = (productoId: string) => {
    setFormData((prev) => ({
      ...prev,
      producto_id: productoId,
      variante_id: "",
      lote_id: "",
    }));
    onProductChange(productoId);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setFormData(defaultAjusteFormData);
      setSucursalElegida(undefined);
    }
    onOpenChange(next);
  };

  const handleSave = () => {
    if (!formData.producto_id) {
      toast.error(t("selectProductError"));
      return;
    }

    if (!formData.cantidad_ajuste || parseFloat(formData.cantidad_ajuste) === 0) {
      toast.error(t("qtyNotZero"));
      return;
    }

    // El ajuste se valida contra las existencias DE UN LOCAL (migracion 082):
    // sin saber cual, no hay contra que comparar.
    if (hayVarias && !sucursalId) {
      toast.error(t("chooseBranch"));
      return;
    }

    onSave({
      productoId: formData.producto_id,
      cantidadAjuste: parseFloat(formData.cantidad_ajuste),
      motivo: formData.motivo as MotivoAjuste,
      notas: formData.notas || null,
      varianteId: formData.variante_id || null,
      loteId: formData.lote_id || null,
      sucursalId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            {t("dialogTitle")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("dialogDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <CampoSucursal
            id="ajuste-sucursal"
            value={sucursalId}
            onChange={setSucursalElegida}
            etiqueta={t("branchLabel")}
            ayuda={t("branchHint")}
          />
          <div className="space-y-1.5">
            <Label className="text-xs">{t("productLabel")}</Label>
            <Select
              value={formData.producto_id}
              onValueChange={(v) => handleProductChange(v ?? "")}
            >
              <SelectTrigger className="h-8 w-full text-sm">
                <SelectValue placeholder={t("selectProduct")}>
                  {selectedProductName}
                </SelectValue>
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
              <Label className="text-xs">{t("variantLabel")}</Label>
              <Select
                value={formData.variante_id}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, variante_id: v ?? "", lote_id: "" }))
                }
              >
                <SelectTrigger className="h-8 w-full text-sm">
                  <SelectValue placeholder={t("noVariant")}>
                    {selectedVariantName || t("noVariant")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("noVariant")}</SelectItem>
                  {variants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {variant.talla} - {variant.color} ({variant.sku || "N/A"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {lotesDelAjuste.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t("lotLabel")}</Label>
              <Select
                value={formData.lote_id}
                onValueChange={(v) => updateField("lote_id", v ?? "")}
              >
                <SelectTrigger className="h-8 w-full text-sm">
                  <SelectValue placeholder={t("noLot")}>
                    {selectedLotName || t("noLot")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("noLot")}</SelectItem>
                  {lotesDelAjuste.map((lot) => (
                    <SelectItem key={lot.id} value={lot.id}>
                      {etiquetaLote(lot)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">{t("reasonLabel")}</Label>
            <Select
              value={formData.motivo}
              onValueChange={(v) => updateField("motivo", v ?? "")}
            >
              <SelectTrigger className="h-8 w-full text-sm">
                <SelectValue>
                  {(v: string) => (v ? t(`reasons.${v}`) : "")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(modulos.permite_mermas || formData.motivo === "MERMA") && (
                  <SelectItem value="MERMA">{t("reasons.MERMA")}</SelectItem>
                )}
                <SelectItem value="CONTEO_FISICO">{t("reasons.CONTEO_FISICO")}</SelectItem>
                <SelectItem value="DEVOLUCION">{t("reasons.DEVOLUCION")}</SelectItem>
                <SelectItem value="DAÑO">{t("reasons.DAÑO")}</SelectItem>
                <SelectItem value="OTRO">{t("reasons.OTRO")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              {t("qtyLabel")}
              <span className="text-muted-foreground ml-2">
                {t("qtyHint")}
              </span>
            </Label>
            <Input
              type="number"
              step="0.01"
              placeholder={t("qtyPlaceholder")}
              value={formData.cantidad_ajuste}
              onChange={(e) => updateField("cantidad_ajuste", e.target.value)}
              className="h-8 text-sm font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("notesLabel")}</Label>
            <Textarea
              placeholder={t("notesPlaceholder")}
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
            onClick={() => handleOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <SpecularActionButton
            tone="add"
            className="h-8"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t("saving") : t("save")}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}