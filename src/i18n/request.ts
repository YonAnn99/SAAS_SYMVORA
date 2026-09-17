import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { aplicarConstantes } from "./constantes";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // Validate that the incoming locale is valid
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    // Las constantes del producto (la duracion de la prueba) se rellenan
    // AQUI, antes de que next-intl vea los mensajes. Asi ningun componente
    // tiene que pasarlas y no puede olvidarse. Ver ./constantes.ts.
    messages: aplicarConstantes(
      (await import(`@/messages/${locale}.json`)).default
    ),
  };
});
