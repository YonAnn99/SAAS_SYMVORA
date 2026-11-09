import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  COLUMNAS_UNICOS,
  COLUMNAS_VARIANTES,
  HOJA_INSTRUCCIONES,
  HOJA_UNICOS,
  HOJA_VARIANTES,
  NOMBRE_UNIDAD,
  filasInstrucciones,
} from "@/features/inventory/plantilla-productos";
import { guessFieldMapping } from "@/features/inventory/components/products/import/import-field-config";
import { parseUnidadMedida } from "@/features/inventory/components/products/import/import-row-processor";
import { parseImportFile } from "@/features/inventory/components/products/import/import-file-parser";
import { UNIDADES } from "@/lib/unidades";

/**
 * La plantilla de Excel y el lector de la importacion deben hablar el mismo
 * idioma: cada encabezado de "Productos unicos" se reconoce solo, y cada
 * unidad que las Instrucciones dicen que se puede escribir se lee bien.
 */
describe("plantilla de productos", () => {
  it("cada columna de «Productos únicos» se mapea sola a su campo", () => {
    expect(guessFieldMapping([...COLUMNAS_UNICOS])).toEqual({
      nombre: "Nombre",
      descripcion: "Descripción",
      unidad_medida: "¿Cómo se vende?",
      categoria: "Categoría",
      contenido_cantidad: "Contenido (cantidad)",
      contenido_unidad: "Contenido (unidad)",
      precio_venta: "Precio de venta",
      costo_compra: "Costo de compra",
      stock_actual: "Stock actual",
      stock_minimo: "Stock mínimo",
      es_servicio: "¿Es servicio? (Sí/No)",
      permite_lotes: "¿Maneja lotes? (Sí/No)",
      codigo_barras: "Código de barras",
      sku: "SKU",
    });
  });

  it("cada unidad escrita como dicen las Instrucciones vuelve a su código", () => {
    for (const unidad of UNIDADES) {
      expect(parseUnidadMedida(NOMBRE_UNIDAD[unidad])).toBe(unidad);
    }
  });

  it("las Instrucciones mencionan las hojas y las columnas obligatorias", () => {
    const texto = filasInstrucciones().flat().join(" ");
    expect(texto).toContain(HOJA_UNICOS);
    expect(texto).toContain(HOJA_VARIANTES);
    expect(texto).toContain("Nombre general");
    expect(texto).toContain("Kilogramo");
  });

  it("el lector reconoce la plantilla y lee también la hoja de variantes", async () => {
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.aoa_to_sheet([[...COLUMNAS_UNICOS], ["Arroz", "", "Kilogramo", "", "", "", 32]]),
      HOJA_UNICOS
    );
    const fila = Object.fromEntries(COLUMNAS_VARIANTES.map((c) => [c, ""]));
    Object.assign(fila, { "Nombre general": "Coca Cola", "Atributo 1": "Capacidad", "Valor 1": "600 ml", "Precio de venta": 18 });
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.aoa_to_sheet([COLUMNAS_VARIANTES, COLUMNAS_VARIANTES.map((c) => fila[c])]),
      HOJA_VARIANTES
    );
    XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filasInstrucciones()), HOJA_INSTRUCCIONES);
    const buffer = XLSX.write(libro, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const parsed = await parseImportFile(new File([buffer], "plantilla.xlsx"));

    expect(parsed.esPlantilla).toBe(true);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].Nombre).toBe("Arroz");
    expect(parsed.variantes?.rows).toHaveLength(1);
    expect(parsed.variantes?.rows[0]["Nombre general"]).toBe("Coca Cola");
    expect(parsed.variantes?.rowNumbers).toEqual([2]);
  });

  it("un Excel cualquiera no se toma por la plantilla", async () => {
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([["Nombre", "Precio"], ["Arroz", 32]]), "Hoja1");
    const buffer = XLSX.write(libro, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const parsed = await parseImportFile(new File([buffer], "catalogo.xlsx"));

    expect(parsed.esPlantilla).toBeUndefined();
    expect(parsed.variantes).toBeUndefined();
    expect(parsed.rows).toHaveLength(1);
  });
});
