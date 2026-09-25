/**
 * Estilo compartido de los iconos de giro: la franja del hero (`GirosStrip`) y
 * el catalogo completo (`GirosCatalog`) deben verse igual.
 *
 * Minimalista (skill `minimalist-ui`): recuadro neutro calido e icono de linea.
 * Al pasar el raton (el enlace lleva `group`) se pinta del azul SYMVORA
 * #1e3a8a. En oscuro ese azul sobre fondo casi negro no se lee como trazo, asi
 * que ahi se rellena el recuadro y el icono queda blanco.
 */
export const RECUADRO_GIRO =
  "rounded-[10px] border flex items-center justify-center transition-all duration-200 " +
  "bg-[#F4F3F0] border-[#EAEAEA] text-[#2F3437] " +
  "group-hover:-translate-y-0.5 group-hover:bg-white group-hover:border-[#1e3a8a] group-hover:text-[#1e3a8a] group-hover:shadow-[0_2px_8px_rgba(30,58,138,0.10)] " +
  "dark:bg-[#1E1E1E] dark:border-white/[0.08] dark:text-[#CFCCC6] " +
  "dark:group-hover:bg-[#1e3a8a] dark:group-hover:border-[#1e3a8a] dark:group-hover:text-white";

export const ETIQUETA_GIRO =
  "leading-tight transition-colors text-[#2F3437] group-hover:text-[#1e3a8a] dark:text-[#CFCCC6] dark:group-hover:text-white";

/** Grosor de trazo de los iconos de giro (lucide usa 2 por defecto). */
export const TRAZO_GIRO = 1.8;
