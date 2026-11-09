"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  DuplicateResolution,
  ImportRow,
  ImportRowStatus,
  VariantGroup,
} from "../../../types/import.types";

interface ImportPreviewStepProps {
  rows: ImportRow[];
  /** Productos con variantes de la plantilla (uno por grupo de filas). */
  groups?: VariantGroup[];
  onResolutionChange: (rowIndex: number, resolution: DuplicateResolution) => void;
  onApplyToAll: (resolution: DuplicateResolution) => void;
}

export function ImportPreviewStep({
  rows,
  groups = [],
  onResolutionChange,
  onApplyToAll,
}: ImportPreviewStepProps) {
  const t = useTranslations();

  const counts = useMemo(() => {
    const contar = (status: ImportRowStatus) =>
      rows.filter((r) => r.status === status).length +
      groups.filter((g) => g.status === status).length;
    return {
      newCount: contar("new"),
      // El "aplicar a todos" es solo para los productos unicos.
      duplicateRows: rows.filter((r) => r.status === "duplicate").length,
      duplicateCount: contar("duplicate"),
      invalidCount: contar("invalid"),
    };
  }, [rows, groups]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {t("products.import.statusNew")}: {counts.newCount}
        </Badge>
        <Badge className="bg-[#FBF3DB] text-[#956400] dark:bg-[#956400]/20 dark:text-[#E5C46B]">
          {t("products.import.statusDuplicate")}: {counts.duplicateCount}
        </Badge>
        <Badge variant="destructive">
          {t("products.import.statusInvalid")}: {counts.invalidCount}
        </Badge>

        {counts.duplicateRows > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t("products.import.applyToAll")}
            </span>
            <Select onValueChange={(v) => v && onApplyToAll(v as DuplicateResolution)}>
              <SelectTrigger className="h-7 text-xs w-40">
                <SelectValue placeholder={t("products.import.chooseResolution")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">{t("products.import.resolutionSkip")}</SelectItem>
                <SelectItem value="update">{t("products.import.resolutionUpdate")}</SelectItem>
                <SelectItem value="generate">{t("products.import.resolutionGenerate")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="max-h-[45vh] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">#</TableHead>
                <TableHead>{t("products.name")}</TableHead>
                <TableHead>{t("products.barcode")}</TableHead>
                <TableHead>{t("products.import.status")}</TableHead>
                <TableHead>{t("products.import.detail")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.index}>
                  <TableCell className="text-xs text-muted-foreground">{row.index}</TableCell>
                  <TableCell className="text-sm">
                    {row.data?.nombre || <span className="text-destructive">—</span>}
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {row.data?.codigo_barras || "-"}
                  </TableCell>
                  <TableCell>
                    {row.status === "new" && (
                      <Badge variant="secondary">{t("products.import.statusNew")}</Badge>
                    )}
                    {row.status === "duplicate" && (
                      <Badge className="bg-[#FBF3DB] text-[#956400] dark:bg-[#956400]/20 dark:text-[#E5C46B]">
                        {t("products.import.statusDuplicate")}
                      </Badge>
                    )}
                    {row.status === "invalid" && (
                      <Badge variant="destructive">{t("products.import.statusInvalid")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs whitespace-normal">
                    {row.status === "invalid" && (
                      <span className="text-destructive">{row.errorMessage}</span>
                    )}
                    {row.status === "duplicate" && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {t("products.import.matchesExisting", {
                            name: row.duplicateOf?.nombre || "",
                          })}
                        </span>
                        <Select
                          value={row.resolution || "skip"}
                          onValueChange={(v) =>
                            v && onResolutionChange(row.index, v as DuplicateResolution)
                          }
                        >
                          <SelectTrigger className="h-7 text-xs w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="skip">
                              {t("products.import.resolutionSkip")}
                            </SelectItem>
                            <SelectItem value="update">
                              {t("products.import.resolutionUpdate")}
                            </SelectItem>
                            <SelectItem value="generate">
                              {t("products.import.resolutionGenerate")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {row.status === "new" && row.supplierWarning && (
                      <span className="text-muted-foreground">{row.supplierWarning}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {groups.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("products.import.variantGroupsTitle")}
          </p>
          <div className="max-h-[35vh] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">#</TableHead>
                  <TableHead>{t("products.name")}</TableHead>
                  <TableHead>{t("products.import.variantsColumn")}</TableHead>
                  <TableHead>{t("products.import.status")}</TableHead>
                  <TableHead>{t("products.import.detail")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={group.filas[0]}>
                    <TableCell className="text-xs text-muted-foreground">
                      {group.filas[0]}
                    </TableCell>
                    <TableCell className="text-sm">
                      {group.nombre || <span className="text-destructive">—</span>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {t("products.import.variantsCount", { count: group.tarjetas.length })}
                    </TableCell>
                    <TableCell>
                      <EstadoBadge status={group.status} />
                    </TableCell>
                    <TableCell className="text-xs whitespace-normal">
                      {group.errorMessage && (
                        <span
                          className={
                            group.status === "invalid"
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }
                        >
                          {group.errorMessage}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

function EstadoBadge({ status }: { status: ImportRowStatus }) {
  const t = useTranslations();
  if (status === "new") {
    return <Badge variant="secondary">{t("products.import.statusNew")}</Badge>;
  }
  if (status === "duplicate") {
    return (
      <Badge className="bg-[#FBF3DB] text-[#956400] dark:bg-[#956400]/20 dark:text-[#E5C46B]">
        {t("products.import.statusDuplicate")}
      </Badge>
    );
  }
  return <Badge variant="destructive">{t("products.import.statusInvalid")}</Badge>;
}
