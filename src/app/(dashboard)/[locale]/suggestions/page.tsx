"use client";

import { useTranslations } from "next-intl";
import { Lightbulb } from "lucide-react";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { SuggestionForm } from "@/features/suggestions";
import { EncabezadoModulo } from "@/components/dashboard/encabezado-modulo";

export default function SuggestionsPage() {
  const t = useTranslations();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();

  if (tenantLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="animate-fade-in-up stagger-1">
        <EncabezadoModulo
          titulo={t("suggestions.title")}
          descripcion={t("suggestions.subtitle")}
          icono={<Lightbulb className="h-5 w-5" />}
        />
      </div>

      <div className="animate-fade-in-up stagger-2 max-w-2xl">
        {tenantId && <SuggestionForm tenantId={tenantId} />}
      </div>
    </div>
  );
}
