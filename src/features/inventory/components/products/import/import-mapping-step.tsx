"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IMPORT_TARGET_FIELDS } from "./import-field-config";
import type { ImportFieldMapping, ImportTargetField } from "../../../types/import.types";

const NONE_VALUE = "__none__";

interface ImportMappingStepProps {
  headers: string[];
  mapping: ImportFieldMapping;
  onChange: (mapping: ImportFieldMapping) => void;
}

export function ImportMappingStep({
  headers,
  mapping,
  onChange,
}: ImportMappingStepProps) {
  const t = useTranslations();

  const updateField = (field: ImportTargetField, column: string) => {
    onChange({
      ...mapping,
      [field]: column === NONE_VALUE ? null : column,
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {t("products.import.mappingHelp")}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
        {IMPORT_TARGET_FIELDS.map(({ field, required, labelKey }) => (
          <div key={field} className="space-y-1.5">
            <Label className="text-xs">
              {t(labelKey)} {required && <span className="text-destructive">*</span>}
            </Label>
            <Select
              value={mapping[field] || NONE_VALUE}
              onValueChange={(value) => value && updateField(field, value)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>
                  {t("products.import.noColumn")}
                </SelectItem>
                {headers.map((header) => (
                  <SelectItem key={header} value={header}>
                    {header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}
