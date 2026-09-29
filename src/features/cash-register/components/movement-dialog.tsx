"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
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
import {
  CONCEPTOS_SALIDA,
  CONCEPTO_SALIDA_POR_DEFECTO,
  descripcionDeMovimiento,
  esConceptoSalida,
  type ConceptoSalida,
} from "../conceptos";

interface MovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    tipo: "ENTRADA" | "SALIDA",
    monto: number,
    descripcion: string,
    concepto: ConceptoSalida | null
  ) => void;
}

export function MovementDialog({
  open,
  onOpenChange,
  onConfirm,
}: MovementDialogProps) {
  const t = useTranslations();
  const [movementType, setMovementType] = useState<"ENTRADA" | "SALIDA">(
    "ENTRADA"
  );
  const [movementAmount, setMovementAmount] = useState("");
  const [movementDescription, setMovementDescription] = useState("");
  const [concepto, setConcepto] = useState<ConceptoSalida>(
    CONCEPTO_SALIDA_POR_DEFECTO
  );
  const esSalida = movementType === "SALIDA";

  // Mapas de etiquetas: sin ellos el Select de Base UI muestra el valor crudo
  // ("SALIDA", "DEPOSITO_BANCO") en el boton.
  const tipos = {
    ENTRADA: t("finances.movementTypes.ENTRADA"),
    SALIDA: t("finances.movementTypes.SALIDA"),
  };
  const conceptos = Object.fromEntries(
    CONCEPTOS_SALIDA.map((c) => [c, t(`finances.movementConcepts.${c}`)])
  ) as Record<ConceptoSalida, string>;

  const confirmar = () => {
    const conceptoFinal = esSalida ? concepto : null;
    const descripcion = descripcionDeMovimiento(
      conceptoFinal,
      movementDescription,
      conceptoFinal ? conceptos[conceptoFinal] : ""
    );
    if (descripcion === null) {
      toast.error(
        esSalida
          ? "Describe en qué se usó el dinero"
          : "La descripción es requerida"
      );
      return;
    }
    onConfirm(
      movementType,
      parseFloat(movementAmount) || 0,
      descripcion,
      conceptoFinal
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">
            {t("finances.addMovement")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Registra un movimiento de entrada o salida
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select
              items={tipos}
              value={movementType}
              onValueChange={(v) => setMovementType(v as "ENTRADA" | "SALIDA")}
            >
              <SelectTrigger className="h-8 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ENTRADA">
                  {t("finances.movementTypes.ENTRADA")}
                </SelectItem>
                <SelectItem value="SALIDA">
                  {t("finances.movementTypes.SALIDA")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Por que sale el dinero: depositarlo al banco, que lo retire el
              dueño u otro gasto. Queda en el movimiento (`concepto`). */}
          {esSalida && (
            <div className="space-y-1.5">
              <Label className="text-xs">Motivo</Label>
              <Select
                items={conceptos}
                value={concepto}
                onValueChange={(v) => esConceptoSalida(v) && setConcepto(v)}
              >
                <SelectTrigger className="h-8 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONCEPTOS_SALIDA.map((c) => (
                    <SelectItem key={c} value={c}>
                      {conceptos[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("common.total")}</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={movementAmount}
              onChange={(e) => setMovementAmount(e.target.value)}
              className="h-8 text-sm font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              {t("common.description")}
              {esSalida && concepto !== "OTRO_GASTO" && (
                <span className="ml-1 font-normal text-muted-foreground">
                  (opcional)
                </span>
              )}
            </Label>
            <Input
              placeholder={
                esSalida && concepto === "OTRO_GASTO"
                  ? "Ej. pago de luz, papelería"
                  : "Descripción del movimiento"
              }
              value={movementDescription}
              onChange={(e) => setMovementDescription(e.target.value)}
              className="h-8 text-sm"
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
          <SpecularActionButton
            tone="add"
            className="h-8"
            onClick={confirmar}
          >
            {t("common.confirm")}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}