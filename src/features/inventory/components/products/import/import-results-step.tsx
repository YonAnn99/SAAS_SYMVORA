"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2, XCircle } from "lucide-react";
import type { ImportResult } from "../../../types/import.types";

interface ImportResultsStepProps {
  result: ImportResult;
}

export function ImportResultsStep({ result }: ImportResultsStepProps) {
  const t = useTranslations();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3 text-center">
          <p className="text-lg font-semibold text-emerald-600">{result.created}</p>
          <p className="text-xs text-muted-foreground">{t("products.import.created")}</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-lg font-semibold text-primary">{result.updated}</p>
          <p className="text-xs text-muted-foreground">{t("products.import.updated")}</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-lg font-semibold text-muted-foreground">{result.skipped}</p>
          <p className="text-xs text-muted-foreground">{t("products.import.skipped")}</p>
        </div>
      </div>

      {result.errors.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {t("products.import.noErrors")}
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 text-sm text-destructive">
            <XCircle className="h-4 w-4 shrink-0" />
            {t("products.import.errorsFound", { count: result.errors.length })}
          </p>
          <div className="max-h-40 overflow-y-auto rounded-md border">
            <ul className="divide-y text-xs">
              {result.errors.map((error, idx) => (
                <li key={idx} className="p-2">
                  <span className="font-medium">
                    {t("products.import.row")} {error.row}:
                  </span>{" "}
                  <span className="text-muted-foreground">{error.message}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
