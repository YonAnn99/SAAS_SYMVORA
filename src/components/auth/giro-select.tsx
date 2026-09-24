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
import { GIROS_REGISTRO } from "@/features/marketing/giros";

/**
 * Giro del negocio al registrarse: los 20 de la landing (antes solo 7).
 *
 * El valor es el SLUG (`papelerias`); `crearNegocio` guarda su configuracion
 * en `tenants.giro_comercial` y enciende los modulos que recomienda su pagina.
 *
 * `items` es obligatorio con el Select de Base UI de este repo: sin el, el
 * boton muestra el valor crudo (`tiendas-de-ropa`) en vez del nombre.
 */
export function GiroSelect({
  value,
  onChange,
  placeholder,
  triggerClassName,
}: {
  value: string;
  onChange: (slug: string) => void;
  placeholder?: string;
  triggerClassName?: string;
}) {
  const locale = useLocale();
  const idioma = locale === "en" ? "en" : "es";
  const items = useMemo(
    () => Object.fromEntries(GIROS_REGISTRO.map((g) => [g.slug, g.nombre[idioma]])),
    [idioma]
  );

  return (
    <Select items={items} value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {GIROS_REGISTRO.map((g) => (
          <SelectItem key={g.slug} value={g.slug}>
            {g.nombre[idioma]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
