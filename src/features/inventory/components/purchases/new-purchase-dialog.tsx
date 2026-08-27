"use client";

import { useTranslations } from "next-intl";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { Proveedor } from "../../types/inventory.types";
import type { PurchaseInput } from "../../services/purchase-service";

interface NewPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: Proveedor[];
  onConfirm: (input: PurchaseInput) => void;
}

export function NewPurchaseDialog({
  open,
  onOpenChange,
  suppliers,
  onConfirm,
}: NewPurchaseDialogProps) {
  const t = useTranslations();
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchaseTotal, setPurchaseTotal] = useState("");

  // Get supplier name for display in SelectValue
  const selectedSupplierName = useMemo(() => {
    const supplier = suppliers.find((s) => s.id === selectedSupplier);
    return supplier?.nombre ?? "";
  }, [selectedSupplier, suppliers]);

  const handleConfirm = () => {
    onConfirm({
      proveedorId: selectedSupplier,
      numeroFactura: invoiceNumber,
      total: parseFloat(purchaseTotal) || 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">
            {t("purchases.addPurchase")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Registra una nueva compra con proveedor
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("purchases.supplier")}</Label>
            <Select
              value={selectedSupplier}
              onValueChange={(v) => setSelectedSupplier(v || "")}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Seleccionar proveedor">
                  {selectedSupplierName}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("purchases.invoiceNumber")}</Label>
            <Input
              placeholder="Número de factura"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("purchases.total")}</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={purchaseTotal}
              onChange={(e) => setPurchaseTotal(e.target.value)}
              className="h-8 text-sm font-mono"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            size="sm"
            className="h-8 active:scale-[0.98] transition-transform"
            onClick={handleConfirm}
          >
            {t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}