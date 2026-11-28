export interface AudioSection {
  id: string;
  labelKey: string;
  src: string;
}

/**
 * Narración de la landing, en el mismo orden en que aparecen las secciones.
 * Las rutas usan slugs ASCII porque los nombres originales traían espacios,
 * acentos y un salto de línea que no son seguros para archivos públicos.
 *
 * AL CAMBIAR UNA NARRACIÓN, SUBIR LA VERSIÓN DEL NOMBRE (`.v2` → `.v3`). El service worker
 * (serwist, `defaultCache`) guarda los .mp3 con CacheFirst y caducidad desde el último uso:
 * con el mismo nombre, quien ya la escuchó seguiría oyendo la voz vieja.
 */
export const NARRATION_SECTIONS: AudioSection[] = [
  {
    id: "features",
    labelKey: "landing.features.title",
    src: "/audio/landing/todo-lo-que-tu-negocio-necesita.v2.mp3",
  },
  {
    id: "why-choose-us",
    labelKey: "landing.whyChooseUs.title",
    src: "/audio/landing/por-que-elegir-symvora.v2.mp3",
  },
  {
    id: "security",
    labelKey: "landing.security.title",
    src: "/audio/landing/tus-datos-estan-protegidos.v2.mp3",
  },
];
