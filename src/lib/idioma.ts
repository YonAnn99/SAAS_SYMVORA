/**
 * Idioma de la interfaz → locale de `Intl` para fechas y numeros.
 * La moneda sigue siendo MXN en los dos idiomas: solo cambia el formato
 * ("jue 5" → "Thu 5", "1,234.5" igual en los dos).
 */
export function localeIntl(locale: string | null | undefined): "es-MX" | "en-US" {
  return locale === "en" ? "en-US" : "es-MX";
}
