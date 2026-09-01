"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  SUGGESTION_CATEGORIAS,
  SUGGESTION_PRIORIDADES,
  type SuggestionFormData,
  type SuggestionCategoria,
  type SuggestionPrioridad,
} from "../types/suggestions.types";

interface SuggestionFormProps {
  tenantId: string;
}

export function SuggestionForm({ tenantId }: SuggestionFormProps) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [formData, setFormData] = useState<SuggestionFormData>({
    categoria: "general",
    prioridad: "media",
    titulo: "",
    descripcion: "",
  });

  const handleSubmit = async () => {
    if (formData.titulo.trim().length < 3) {
      toast.error("El título debe tener al menos 3 caracteres");
      return;
    }
    if (formData.descripcion.trim().length < 10) {
      toast.error("La descripción debe tener al menos 10 caracteres");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, ...formData }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al enviar");
      }

      toast.success("Sugerencia enviada correctamente");
      setSent(true);
      setFormData({
        categoria: "general",
        prioridad: "media",
        titulo: "",
        descripcion: "",
      });
      setTimeout(() => setSent(false), 4000);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Error al enviar la sugerencia"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          {t("suggestions.new")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sent && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            {t("suggestions.sent")}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("suggestions.category")}</Label>
            <Select
              value={formData.categoria}
              onValueChange={(v) =>
                setFormData((prev) => ({ ...prev, categoria: v as SuggestionCategoria }))
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUGGESTION_CATEGORIAS.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {t(`suggestions.categories.${cat.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("suggestions.priority")}</Label>
            <Select
              value={formData.prioridad}
              onValueChange={(v) =>
                setFormData((prev) => ({ ...prev, prioridad: v as SuggestionPrioridad }))
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUGGESTION_PRIORIDADES.map((pri) => (
                  <SelectItem key={pri.value} value={pri.value}>
                    {t(`suggestions.priorities.${pri.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t("suggestions.title_field")}</Label>
          <Input
            placeholder={t("suggestions.titlePlaceholder")}
            value={formData.titulo}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, titulo: e.target.value }))
            }
            maxLength={120}
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t("suggestions.description")}</Label>
          <textarea
            placeholder={t("suggestions.descriptionPlaceholder")}
            value={formData.descripcion}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, descripcion: e.target.value }))
            }
            maxLength={2000}
            rows={5}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground text-right">
            {formData.descripcion.length}/2000
          </p>
        </div>

        <div className="flex justify-end">
          <SpecularActionButton
            tone="add"
            className="h-8"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? t("common.sending") : t("suggestions.submit")}
          </SpecularActionButton>
        </div>
      </CardContent>
    </Card>
  );
}
