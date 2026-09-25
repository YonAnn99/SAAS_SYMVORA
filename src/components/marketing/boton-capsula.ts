/**
 * Botones de la landing: TODOS con el mismo aspecto de capsula (texto en
 * seminegrita y, si llevan flecha, en linea a la derecha) y el llenado de abajo
 * hacia arriba de `.btn-llenado` (globals.css). Antes convivian capsulas,
 * rectangulos y dos formas de poner la flecha.
 *
 * Uso: `${CAPSULA} ${CAPSULA_GRANDE} ${PRINCIPAL}`. El enlace lleva `group`
 * para que la flecha (`FLECHA_CAPSULA`) se desplace al pasar el raton.
 */
export const CAPSULA =
  "group btn-llenado inline-flex items-center justify-center gap-2 rounded-full border font-semibold whitespace-nowrap active:translate-y-px " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 dark:ring-offset-zinc-900";

/** CTA del hero, precios y paginas de giro. */
export const CAPSULA_GRANDE = "h-14 px-8 text-base";
/** Encabezados, "Ver los 20" y el WhatsApp de preguntas frecuentes. */
export const CAPSULA_CHICA = "h-10 px-5 text-sm";

/** Azul marino de la marca. En claro se llena del azul SYMVORA; en oscuro, de blanco. */
export const PRINCIPAL =
  "bg-primary text-white border-transparent shadow-md hover:shadow-lg " +
  "[--llenado:#1e3a8a] [--llenado-texto:#FFFFFF] dark:[--llenado:#FFFFFF] dark:[--llenado-texto:#1E3A8A]";

/** Blanca con borde; se invierte (negro en claro, blanco en oscuro). */
export const SECUNDARIA =
  "bg-white dark:bg-neutral-900 text-black dark:text-neutral-50 border-neutral-200 dark:border-neutral-800 " +
  "[--llenado:#111111] [--llenado-texto:#FFFFFF] dark:[--llenado:#FFFFFF] dark:[--llenado-texto:#111111]";

/**
 * Como la secundaria, pero se llena del azul SYMVORA en los dos modos: "Ver
 * los 20" va junto a los iconos de giro, que se llenan de ese mismo azul.
 */
export const SECUNDARIA_AZUL =
  "bg-white dark:bg-neutral-900 text-black dark:text-neutral-50 border-neutral-200 dark:border-neutral-800 hover:border-[#1e3a8a] dark:hover:border-[#1e3a8a] " +
  "[--llenado:#1e3a8a] [--llenado-texto:#FFFFFF]";

/** Blanca sobre fondo negro (encabezados, bloque final del giro); se llena de negro. */
export const CLARA =
  "bg-white text-zinc-950 border-white [--llenado:#09090B] [--llenado-texto:#FFFFFF]";

/** Verde WhatsApp; se llena de su verde oscuro. */
export const WHATSAPP =
  "bg-[#25D366] text-white border-[#25D366] [--llenado:#128C7E] [--llenado-texto:#FFFFFF]";

/** Contorno que se llena del verde WhatsApp. */
export const WHATSAPP_CONTORNO =
  "bg-white dark:bg-transparent text-black dark:text-neutral-100 border-neutral-200 dark:border-neutral-700 hover:border-[#25D366] " +
  "[--llenado:#25D366] [--llenado-texto:#111111]";

/** Flecha en linea que avanza al pasar el raton. */
export const FLECHA_CAPSULA = "shrink-0 transition-transform duration-300 group-hover:translate-x-1";
