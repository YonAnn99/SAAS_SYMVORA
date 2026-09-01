"use client";

import { useTranslations } from "next-intl";
import { Lightbulb } from "lucide-react";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { SuggestionForm } from "@/features/suggestions";

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
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          {t("suggestions.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("suggestions.subtitle")}
        </p>
      </div>

      <div className="animate-fade-in-up stagger-2 max-w-2xl">
        {tenantId && <SuggestionForm tenantId={tenantId} />}
      </div>
    </div>
  );
}
