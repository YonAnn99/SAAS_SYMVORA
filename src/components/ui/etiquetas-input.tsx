"use client";

import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Campo de valores como etiquetas: se escribe y se agrega con Enter o coma;
 * Backspace con el campo vacio quita la ultima. Sin repetidos (sin distinguir
 * mayusculas). `max` = 1 lo vuelve de un solo valor (editar una variante).
 */
interface EtiquetasInputProps {
  valores: string[];
  onChange: (valores: string[]) => void;
  /** Limpia/normaliza lo escrito antes de agregarlo. */
  normalizar?: (valor: string) => string;
  /** Contenido antes del texto de cada etiqueta (p. ej. el punto de color). */
  prefijo?: (valor: string) => ReactNode;
  placeholder?: string;
  max?: number;
  ayuda?: string;
  ariaLabel?: string;
  className?: string;
}

export function EtiquetasInput({
  valores,
  onChange,
  normalizar = (v) => v.trim(),
  prefijo,
  placeholder,
  max,
  ayuda = "Ingresa cada valor y presiona Enter.",
  ariaLabel,
  className,
}: EtiquetasInputProps) {
  const [texto, setTexto] = useState("");
  const lleno = max !== undefined && valores.length >= max;

  const agregar = (crudo: string) => {
    const nuevos = crudo
      .split(",")
      .map(normalizar)
      .filter(Boolean);
    if (nuevos.length === 0) return;
    const lista = [...valores];
    for (const n of nuevos) {
      if (max !== undefined && lista.length >= max) break;
      if (!lista.some((v) => v.toLowerCase() === n.toLowerCase())) lista.push(n);
    }
    onChange(lista);
    setTexto("");
  };

  return (
    <div className={className}>
      <div
        className={cn(
          "flex min-h-8 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1 text-sm transition-colors",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30"
        )}
      >
        {valores.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#1e3a8a]/40 bg-[#1e3a8a]/10 py-0.5 pl-2 pr-1 text-xs font-medium text-foreground dark:border-blue-500/40 dark:bg-blue-500/10"
          >
            {prefijo?.(v)}
            {v}
            <button
              type="button"
              onClick={() => onChange(valores.filter((x) => x !== v))}
              aria-label={`Quitar ${v}`}
              className="rounded p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        {!lleno && (
          <input
            value={texto}
            onChange={(e) => {
              const v = e.target.value;
              if (v.includes(",")) agregar(v);
              else setTexto(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregar(texto);
              } else if (e.key === "Backspace" && !texto && valores.length > 0) {
                onChange(valores.slice(0, -1));
              }
            }}
            onBlur={() => agregar(texto)}
            placeholder={valores.length === 0 ? placeholder : ""}
            aria-label={ariaLabel}
            className="h-6 min-w-[6rem] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        )}
      </div>
      {!lleno && ayuda && <p className="mt-1 text-[11px] text-muted-foreground">{ayuda}</p>}
    </div>
  );
}
