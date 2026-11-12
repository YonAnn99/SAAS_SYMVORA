"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Categoria del producto: desplegable con "Crear categoria" arriba y las que
 * ya existen abajo (como el POS de Mercado Libre). Crear abre una ventana con
 * el nombre (hasta 50).
 *
 * No hay tabla de categorias: viven en `productos.categoria`. La nueva queda
 * guardada al guardar el producto; mientras tanto se agrega a esta lista.
 */

const CREAR = "__crear__";
const NINGUNA = "__ninguna__";
const MAX = 50;

interface SelectorCategoriaProps {
  value: string;
  onChange: (categoria: string) => void;
  /** Las que ya usan los productos del negocio. */
  categorias: string[];
}

export function SelectorCategoria({ value, onChange, categorias }: SelectorCategoriaProps) {
  const t = useTranslations("products.categorySelector");
  const [nuevas, setNuevas] = useState<string[]>([]);
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");

  // Las del negocio, las recien creadas y la actual (p. ej. al editar), sin repetir.
  const lista = [...new Set([...categorias, ...nuevas, ...(value ? [value] : [])])].sort((a, b) =>
    a.localeCompare(b, "es")
  );
  const limpio = nombre.replace(/\s+/g, " ").trim();
  const repetida = lista.some((c) => c.toLowerCase() === limpio.toLowerCase());

  const crear = () => {
    if (!limpio || repetida) return;
    setNuevas((prev) => [...prev, limpio]);
    onChange(limpio);
    setCreando(false);
    setNombre("");
  };

  return (
    <>
      <Select
        items={{ [NINGUNA]: t("none"), [CREAR]: t("create"), ...Object.fromEntries(lista.map((c) => [c, c])) }}
        value={value || NINGUNA}
        onValueChange={(v) => {
          if (v === CREAR) setCreando(true);
          else if (typeof v === "string") onChange(v === NINGUNA ? "" : v);
        }}
      >
        <SelectTrigger className="h-8 w-full text-sm" aria-label={t("label")}>
          <SelectValue placeholder={t("none")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CREAR} className="font-medium text-[#1e3a8a] dark:text-blue-400">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {t("create")}
          </SelectItem>
          <SelectSeparator />
          <SelectItem value={NINGUNA}>{t("none")}</SelectItem>
          {lista.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog
        open={creando}
        onOpenChange={(abierto) => {
          setCreando(abierto);
          if (!abierto) setNombre("");
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{t("dialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="nueva-categoria" className="text-xs">
              {t("nameLabel")}
            </Label>
            <Input
              id="nueva-categoria"
              autoFocus
              value={nombre}
              maxLength={MAX}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  crear();
                }
              }}
              placeholder={t("placeholder")}
              className="h-9 text-sm"
            />
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-destructive">{repetida && limpio ? t("exists") : ""}</span>
              <span className="text-muted-foreground">
                {nombre.length} / {MAX}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setCreando(false)}>
              {t("cancel")}
            </Button>
            <SpecularActionButton tone="add" className="h-8" disabled={!limpio || repetida} onClick={crear}>
              {t("createShort")}
            </SpecularActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
