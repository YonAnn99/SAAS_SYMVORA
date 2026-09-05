"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { logActivity } from "@/lib/supabase/activity-logger";
import { guessFieldMapping } from "./import-field-config";
import { ImportUploadStep } from "./import-upload-step";
import { ImportMappingStep } from "./import-mapping-step";
import { ImportPreviewStep } from "./import-preview-step";
import { ImportResultsStep } from "./import-results-step";
import { buildImportRows } from "./import-row-processor";
import type { ParsedImportFile } from "./import-file-parser";
import {
  bulkCreateProducts,
  bulkUpdateProducts,
  createProductWithGeneratedBarcode,
  fetchExistingBarcodes,
  fetchSupplierNameMap,
} from "../../../services/product-import-service";
import type {
  DuplicateResolution,
  ImportFieldMapping,
  ImportResult,
  ImportRow,
} from "../../../types/import.types";

type WizardStep = "upload" | "mapping" | "preview" | "results";

interface ImportProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  onImported: () => void;
}

export function ImportProductsDialog({
  open,
  onOpenChange,
  tenantId,
  onImported,
}: ImportProductsDialogProps) {
  const t = useTranslations();
  const [step, setStep] = useState<WizardStep>("upload");
  const [parsed, setParsed] = useState<ParsedImportFile | null>(null);
  const [mapping, setMapping] = useState<ImportFieldMapping>({});
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const reset = () => {
    setStep("upload");
    setParsed(null);
    setMapping({});
    setRows([]);
    setResult(null);
    setProcessing(false);
    setProgress({ done: 0, total: 0 });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleParsed = (_file: File, parsedFile: ParsedImportFile) => {
    setParsed(parsedFile);
    setMapping(guessFieldMapping(parsedFile.headers));
    setStep("mapping");
  };

  const handleContinueFromMapping = async () => {
    if (!parsed || !mapping.nombre) {
      toast.error(t("products.import.mapNameRequired"));
      return;
    }
    setProcessing(true);
    try {
      const [existingBarcodes, supplierMap] = await Promise.all([
        fetchExistingBarcodes(tenantId),
        fetchSupplierNameMap(tenantId),
      ]);
      const builtRows = buildImportRows({
        rawRows: parsed.rows,
        mapping,
        existingBarcodes,
        supplierMap,
      });
      setRows(builtRows);
      setStep("preview");
    } catch {
      toast.error(t("products.import.parseError"));
    } finally {
      setProcessing(false);
    }
  };

  const handleResolutionChange = (rowIndex: number, resolution: DuplicateResolution) => {
    setRows((prev) =>
      prev.map((row) => (row.index === rowIndex ? { ...row, resolution } : row))
    );
  };

  const handleApplyToAll = (resolution: DuplicateResolution) => {
    setRows((prev) =>
      prev.map((row) => (row.status === "duplicate" ? { ...row, resolution } : row))
    );
  };

  const handleImport = async () => {
    setProcessing(true);
    setProgress({ done: 0, total: 0 });

    const toCreate = rows.filter(
      (row): row is ImportRow & { data: NonNullable<ImportRow["data"]> } =>
        row.status === "new" && row.data !== null
    );
    const toGenerate = rows.filter(
      (row): row is ImportRow & { data: NonNullable<ImportRow["data"]> } =>
        row.status === "duplicate" && row.resolution === "generate" && row.data !== null
    );
    const toUpdate = rows.filter(
      (row): row is ImportRow & { data: NonNullable<ImportRow["data"]> } =>
        row.status === "duplicate" && row.resolution === "update" && row.data !== null
    );
    const skippedCount =
      rows.length - toCreate.length - toGenerate.length - toUpdate.length;

    const errors: { row: number; message: string }[] = [];
    let created = 0;
    let updated = 0;

    try {
      if (toCreate.length > 0) {
        const outcome = await bulkCreateProducts(
          tenantId,
          toCreate.map((row) => ({ rowIndex: row.index, input: row.data })),
          undefined,
          (done, total) => setProgress({ done, total })
        );
        created += outcome.createdCount;
        outcome.errors.forEach((chunkError) => {
          const message = chunkError.message.includes("uq_productos_tenant_codigo_barras")
            ? "Código de barras duplicado (ya existe en tu catálogo o se repite en el archivo)"
            : chunkError.message;
          chunkError.rowIndexes.forEach((rowIndex) => {
            errors.push({ row: rowIndex, message });
          });
        });
      }

      for (const row of toGenerate) {
        try {
          await createProductWithGeneratedBarcode(tenantId, row.data);
          created += 1;
        } catch (error: unknown) {
          errors.push({
            row: row.index,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (toUpdate.length > 0) {
        const outcome = await bulkUpdateProducts(
          toUpdate.map((row) => ({
            rowIndex: row.index,
            productId: row.duplicateOf!.id,
            input: row.data,
          }))
        );
        updated += outcome.updatedCount;
        outcome.errors.forEach((updateError) => {
          errors.push({ row: updateError.rowIndex, message: updateError.message });
        });
      }

      if (created + updated > 0) {
        await logActivity({
          action: "CREATE",
          entity: "producto",
          entityName: `Importación masiva (${created + updated} productos)`,
        });
      }

      setResult({ created, updated, skipped: skippedCount, errors });
      setStep("results");
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    const hadSuccess = result && result.created + result.updated > 0;
    handleOpenChange(false);
    if (hadSuccess) onImported();
  };

  const importableCount = rows.filter(
    (row) =>
      row.status === "new" ||
      (row.status === "duplicate" && row.resolution && row.resolution !== "skip")
  ).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-4 sm:mx-0">
        <DialogHeader>
          <DialogTitle className="text-base">{t("products.import.title")}</DialogTitle>
          <DialogDescription className="text-xs">
            {step === "upload" && t("products.import.uploadStep")}
            {step === "mapping" && t("products.import.mappingStep")}
            {step === "preview" && t("products.import.previewStep")}
            {step === "results" && t("products.import.resultsStep")}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && <ImportUploadStep onParsed={handleParsed} />}

        {step === "mapping" && parsed && (
          <ImportMappingStep headers={parsed.headers} mapping={mapping} onChange={setMapping} />
        )}

        {step === "preview" && (
          <>
            <ImportPreviewStep
              rows={rows}
              onResolutionChange={handleResolutionChange}
              onApplyToAll={handleApplyToAll}
            />
            {processing && progress.total > 0 && (
              <Progress value={(progress.done / progress.total) * 100}>
                <ProgressLabel>{t("products.import.importing")}</ProgressLabel>
                <ProgressValue />
              </Progress>
            )}
          </>
        )}

        {step === "results" && result && <ImportResultsStep result={result} />}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" size="sm" className="h-8" onClick={() => handleOpenChange(false)}>
              {t("common.cancel")}
            </Button>
          )}
          {step === "mapping" && (
            <>
              <Button variant="outline" size="sm" className="h-8" onClick={() => setStep("upload")}>
                {t("common.back")}
              </Button>
              <SpecularActionButton
                tone="add"
                className="h-8"
                onClick={handleContinueFromMapping}
                disabled={processing}
              >
                {processing ? t("common.loading") : t("common.next")}
              </SpecularActionButton>
            </>
          )}
          {step === "preview" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={processing}
                onClick={() => setStep("mapping")}
              >
                {t("common.back")}
              </Button>
              <SpecularActionButton
                tone="add"
                className="h-8"
                onClick={handleImport}
                disabled={processing || importableCount === 0}
              >
                {processing
                  ? t("common.loading")
                  : t("products.import.importCount", { count: importableCount })}
              </SpecularActionButton>
            </>
          )}
          {step === "results" && (
            <SpecularActionButton tone="add" className="h-8" onClick={handleClose}>
              {t("common.close")}
            </SpecularActionButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
