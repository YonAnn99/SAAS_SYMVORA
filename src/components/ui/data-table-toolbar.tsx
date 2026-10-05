"use client";

import { Button } from "@/components/ui/button";
import { ChevronDown, FileText, FileSpreadsheet } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  /**
   * Filas marcadas en la tabla. Si se pasa, CSV y PDF abren un menu con
   * "Toda la lista" o "Solo seleccionados"; sin ella, exportan todo al clic,
   * como siempre.
   */
  seleccion?: T[];
  /** Como se llaman las filas en los avisos ("productos"). */
  nombreFilas?: string;
}

type Formato = "csv" | "pdf";

export function DataTableToolbar<T>({
  data,
  columns,
  title,
  filename,
  seleccion,
  nombreFilas = "registros",
}: DataTableToolbarProps<T>) {
  const exportar = async (formato: Formato, filas: T[], soloSeleccion: boolean) => {
    const archivo = soloSeleccion ? `${filename}-seleccionados` : filename;
    const etiqueta = formato === "csv" ? "CSV" : "PDF";
    try {
      if (formato === "csv") exportToCSV(filas, columns, archivo);
      else await exportToPDF(filas, columns, title, archivo);
      toast.success(`${etiqueta} exportado: ${filas.length} ${nombreFilas}`);
    } catch {
      toast.error(`Error al exportar ${etiqueta}`);
    }
  };

  const boton = (formato: Formato) => {
    const Icono = formato === "csv" ? FileSpreadsheet : FileText;
    const etiqueta = formato === "csv" ? "CSV" : "PDF";

    // Sin seleccion posible: el boton de siempre.
    if (!seleccion) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void exportar(formato, data, false)}
          className="h-8 gap-1.5"
        >
          <Icono className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{etiqueta}</span>
        </Button>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="sm" className="h-8 gap-1.5" />}
        >
          <Icono className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{etiqueta}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => void exportar(formato, data, false)}
          >
            Toda la lista ({data.length})
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            disabled={seleccion.length === 0}
            onClick={() => void exportar(formato, seleccion, true)}
          >
            Solo seleccionados ({seleccion.length})
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="flex items-center gap-2">
      {boton("csv")}
      {boton("pdf")}
    </div>
  );
}
