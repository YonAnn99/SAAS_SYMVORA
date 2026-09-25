/**
 * Pone el idioma real en `<html lang>` para las paginas que no son en español.
 *
 * El layout raiz deja `lang="es"` fijo: no recibe el segmento `[locale]` y
 * leerlo de las cabeceras (`getLocale()`) volvia dinamica toda la app. Este
 * script en linea se ejecuta al analizar el HTML, antes de pintar y de
 * hidratar, asi que lectores de pantalla y buscadores ven el idioma correcto.
 * (Para el idioma de cada URL, Google se guia por los `hreflang`.)
 */
export function IdiomaHtml({ locale }: { locale: string }) {
  if (locale === "es") return null;
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `document.documentElement.lang=${JSON.stringify(locale)}`,
      }}
    />
  );
}
