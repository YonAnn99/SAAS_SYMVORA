"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FileSpreadsheet, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { parseImportFile } from "./import-file-parser";
import type { ParsedImportFile } from "./import-file-parser";

const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

interface ImportUploadStepProps {
  onParsed: (file: File, parsed: ParsedImportFile) => void;
}

export function ImportUploadStep({ onParsed }: ImportUploadStepProps) {
  const t = useTranslations();
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const hasValidExtension = ACCEPTED_EXTENSIONS.some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      );
      if (!hasValidExtension) {
        toast.error(t("products.import.invalidFormat"));
        return;
      }
      setLoading(true);
      try {
        const parsed = await parseImportFile(file);
        if (parsed.rows.length === 0) {
          toast.error(t("products.import.emptyFile"));
          return;
        }
        onParsed(file, parsed);
      } catch {
        toast.error(t("products.import.parseError"));
      } finally {
        setLoading(false);
      }
    },
    [onParsed, t]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 transition-colors disabled:opacity-60",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        {loading ? (
          <FileSpreadsheet className="h-8 w-8 animate-pulse text-muted-foreground" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground" />
        )}
        <p className="text-sm text-muted-foreground text-center">
          {loading
            ? t("products.import.parsing")
            : t("products.import.dragDropText")}
        </p>
        <p className="text-xs text-muted-foreground/60">
          {t("products.import.acceptedFormats")}
        </p>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}
