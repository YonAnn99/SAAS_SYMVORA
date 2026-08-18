"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Producto } from "@/lib/types/database";

interface BarcodeScannerResult {
  search: string;
  setSearch: (value: string) => void;
  handleSearch: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

export function useBarcodeScanner(
  products: Producto[],
  onAddProduct: (product: Producto) => void
): BarcodeScannerResult {
  const [search, setSearch] = useState("");

  const handleSearch = () => {
    if (!search.trim()) return;

    const match = products.find(
      (p) => p.codigo_barras?.toLowerCase() === search.trim().toLowerCase()
    );

    if (match) {
      onAddProduct(match);
      setSearch("");
      toast.success(`${match.nombre} agregado`);
    } else {
      toast.error("Producto no encontrado");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  return { search, setSearch, handleSearch, handleKeyDown };
}