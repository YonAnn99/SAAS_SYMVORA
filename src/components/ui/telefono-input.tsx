"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PAISES_LADA } from "@/lib/telefono";
import { cn } from "@/lib/utils";

/**
 * Celular con desplegable de lada (Mexico +52 por defecto).
 *
 * Controlado: guarda pais y numero NACIONAL por separado; quien lo usa arma el
 * E.164 con `aE164` al validar. `variante="auth"` toma los estilos de los
 * campos de "Crear cuenta" (fondo gris, 40 px); la normal, los de la app.
 */
export function TelefonoInput({
  pais,
  numero,
  onPaisChange,
  onNumeroChange,
  onBlur,
  placeholder,
  required,
  invalido,
  id,
  variante = "app",
  className,
}: {
  pais: string;
  numero: string;
  onPaisChange: (codigo: string) => void;
  onNumeroChange: (numero: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  required?: boolean;
  invalido?: boolean;
  id?: string;
  variante?: "auth" | "app";
  className?: string;
}) {
  const locale = useLocale();
  const idioma = locale === "en" ? "en" : "es";
  // `items` es obligatorio con el Select de Base UI de este repo: sin el, el
  // boton mostraria "MX" en vez de la bandera y la lada.
  const items = useMemo(
    () => Object.fromEntries(PAISES_LADA.map((p) => [p.codigo, `${p.bandera} +${p.lada}`])),
    []
  );
  const esAuth = variante === "auth";

  const campo = {
    id,
    type: "tel",
    inputMode: "tel" as const,
    autoComplete: "tel-national",
    placeholder,
    value: numero,
    // Solo lo que forma un telefono; el resto se descarta al escribir.
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      onNumeroChange(e.target.value.replace(/[^\d\s()+-]/g, "").slice(0, 20)),
    onBlur,
    required,
    "aria-invalid": invalido || undefined,
  };

  return (
    <div className={cn("flex w-full items-center gap-1.5", className)}>
      <Select items={items} value={pais} onValueChange={(v) => v && onPaisChange(v)}>
        <SelectTrigger
          aria-label={idioma === "en" ? "Country code" : "Lada del país"}
          className={cn(
            "shrink-0 tabular-nums",
            esAuth ? "auth-select-trigger !w-[104px] px-3" : "h-9 w-[104px]"
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start" className="min-w-60">
          {PAISES_LADA.map((p) => (
            <SelectItem key={p.codigo} value={p.codigo}>
              <span aria-hidden>{p.bandera}</span>
              <span className="flex-1">{p.nombre[idioma]}</span>
              <span className="text-muted-foreground tabular-nums">+{p.lada}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {esAuth ? (
        // Los estilos salen de `.auth-container input`; solo se le quita el
        // margen vertical para alinearlo con la lada.
        <input {...campo} style={{ margin: 0, flex: 1, minWidth: 0 }} />
      ) : (
        <Input {...campo} className="h-9 flex-1" />
      )}
    </div>
  );
}
