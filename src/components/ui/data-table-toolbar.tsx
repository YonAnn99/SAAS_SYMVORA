"use client";

import { Button } from "@/components/ui/button";
import { Download, FileText, FileSpreadsheet } from "lucide-react";
import { exportToCSV } from "@/lib/export/csv";
import { exportToPDF } from "@/lib/export/pdf";
import { toast } from "sonner";

interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
}

interface DataTableToolbarProps<T> {
  data: T[];
  columns: ExportColumn<T>[];
  title: string;
  filename: string;
}

export function DataTableToolbar<T>({
  data,
  columns,
  title,
  filename,
}: DataTableToolbarProps<T>) {
  const handleExportCSV = () => {
    try {
      exportToCSV(data, columns, filename);
      toast.success("CSV exportado correctamente");
    } catch {
      toast.error("Error al exportar CSV");
    }
  };

  const handleExportPDF = () => {
    try {
      exportToPDF(data, columns, title, filename);
      toast.success("PDF exportado correctamente");
    } catch {
      toast.error("Error al exportar PDF");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportCSV}
        className="h-8 gap-1.5"
      >
        <FileSpreadsheet className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">CSV</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportPDF}
        className="h-8 gap-1.5"
      >
        <FileText className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">PDF</span>
      </Button>
    </div>
  );
}
