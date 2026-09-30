"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Producto } from "@/lib/types/database";
import type { ResultadoEscaneo } from "@/components/escaner/escaner-camara";
import type { VarianteProducto } from "../types/pos.types";

export interface CodigoResuelto {
  product: Producto;
  /** La variante cuyo codigo propio coincidio; `null` = el del producto. */
  variant: VarianteProducto | null;
}

/**
 * De un codigo leido (lector fisico, camara o tecleado) al producto. Sin
 * distinguir mayusculas ni espacios de los extremos.
 *
 * Primero el codigo del producto y despues el de las variantes: una talla con
 * codigo propio entra directo, sin preguntar cual.
 */
export function resolverCodigo(
  codigo: string,
  products: Producto[],
  variantsByProduct: Record<string, VarianteProducto[]>
): CodigoResuelto | null {
  const buscado = codigo.trim().toLowerCase();
  if (!buscado) return null;

  const product = products.find((p) => p.codigo_barras?.trim().toLowerCase() === buscado);
  if (product) return { product, variant: null };

  for (const [productoId, variantes] of Object.entries(variantsByProduct)) {
    const variant = variantes.find((v) => v.codigo_barras?.trim().toLowerCase() === buscado);
    if (!variant) continue;
    const dueno = products.find((p) => p.id === productoId);
    if (dueno) return { product: dueno, variant };
  }
  return null;
}

interface BarcodeScannerResult {
  search: string;
  setSearch: (value: string) => void;
  handleSearch: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * El buscador del POS como lector: el lector fisico "teclea" el codigo y manda
 * Enter. `agregarPorCodigo` es el mismo que usa la camara, asi que ambos
 * siguen las mismas reglas (lista de precios, stock, variantes).
 */
export function useBarcodeScanner(
  agregarPorCodigo: (codigo: string) => ResultadoEscaneo
): BarcodeScannerResult {
  const [search, setSearch] = useState("");

  const handleSearch = () => {
    if (!search.trim()) {
      toast.error("Escribe o escanea un código de barras");
      return;
    }
    const r = agregarPorCodigo(search);
    if (r.tipo === "error") {
      toast.error(r.mensaje);
      return;
    }
    setSearch("");
    if (r.tipo === "ok") toast.success(r.mensaje);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  return { search, setSearch, handleSearch, handleKeyDown };
}
