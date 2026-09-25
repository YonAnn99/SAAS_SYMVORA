/**
 * Estilo compartido de los iconos de giro: la franja del hero (`GirosStrip`) y
 * el catalogo completo (`GirosCatalog`) deben verse igual.
 *
 * Minimalista (skill `minimalist-ui`): recuadro neutro calido e icono de linea.
 * Al pasar el raton por el giro, el recuadro se LLENA de abajo hacia arriba
 * con el azul SYMVORA #1e3a8a y el icono queda blanco: el mismo efecto que los
 * botones (`.btn-llenado` + `.llenado-en-grupo`, globals.css). El enlace lleva
 * `group group/giro`: el llenado se dispara con el raton sobre el nombre
 * tambien, no solo sobre el recuadro.
 */
export const RECUADRO_GIRO =
  "btn-llenado llenado-en-grupo [--llenado:#1e3a8a] [--llenado-texto:#FFFFFF] " +
  "rounded-[10px] border flex items-center justify-center " +
  "bg-[#F4F3F0] border-[#EAEAEA] text-[#2F3437] " +
  "group-hover:-translate-y-0.5 group-hover:border-[#1e3a8a] group-hover:shadow-[0_2px_8px_rgba(30,58,138,0.18)] " +
  "dark:bg-[#1E1E1E] dark:border-white/[0.08] dark:text-[#CFCCC6] dark:group-hover:border-[#1e3a8a]";

/** Clases del enlace que envuelve el recuadro (dispara el hover y el llenado). */
export const ENLACE_GIRO = "group group/giro";

export const ETIQUETA_GIRO =
  "leading-tight transition-colors text-[#2F3437] group-hover:text-[#1e3a8a] dark:text-[#CFCCC6] dark:group-hover:text-white";

/** Grosor de trazo de los iconos de giro (lucide usa 2 por defecto). */
export const TRAZO_GIRO = 1.8;
