/**
 * Como se instala SYMVORA en este aparato cuando el navegador NO ofrece el
 * boton de instalar (`beforeinstallprompt` solo existe en Chrome/Edge y en
 * Chrome de Android). Puro, con test.
 */

export type Plataforma =
  | "chromium-escritorio"
  | "safari-mac"
  | "firefox"
  | "ios"
  | "android"
  | "otro";

export function detectarPlataforma(userAgent: string): Plataforma {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (ua.includes("android")) return "android";
  if (ua.includes("firefox") || ua.includes("fxios")) return "firefox";
  if (/edg\/|chrome\/|chromium\//.test(ua)) return "chromium-escritorio";
  if (ua.includes("macintosh") && ua.includes("safari")) return "safari-mac";
  return "otro";
}

/** Los pasos a mano para cada plataforma. */
export function pasosParaInstalar(plataforma: Plataforma): { titulo: string; pasos: string[] } {
  switch (plataforma) {
    case "chromium-escritorio":
      return {
        titulo: "En Chrome o Edge",
        pasos: [
          "Busca el ícono «Instalar» (una pantalla con una flecha) a la derecha de la barra de direcciones.",
          "Si no aparece, abre el menú ⋮ → «Transmitir, guardar y compartir» → «Instalar página como app».",
          "Confirma con «Instalar». SYMVORA queda en tu escritorio y en el menú Inicio.",
        ],
      };
    case "safari-mac":
      return {
        titulo: "En Safari (Mac)",
        pasos: [
          "En la barra de menú, abre «Archivo» → «Agregar al Dock».",
          "Confirma con «Agregar». SYMVORA queda en tu Dock y en Aplicaciones.",
        ],
      };
    case "firefox":
      return {
        titulo: "Firefox no instala aplicaciones web",
        pasos: [
          "Abre esta misma página en Google Chrome o Microsoft Edge.",
          "Ahí aparece el botón «Instalar SYMVORA».",
        ],
      };
    case "ios":
      return {
        titulo: "En iPhone o iPad (Safari)",
        pasos: [
          "Toca el botón Compartir (el cuadro con la flecha hacia arriba).",
          "Elige «Agregar a pantalla de inicio» y confirma con «Agregar».",
        ],
      };
    case "android":
      return {
        titulo: "En Android (Chrome)",
        pasos: [
          "Abre el menú ⋮ de Chrome.",
          "Elige «Instalar app» o «Agregar a la pantalla principal».",
        ],
      };
    default:
      return {
        titulo: "En tu navegador",
        pasos: ["Abre esta página en Google Chrome o Microsoft Edge para instalar SYMVORA."],
      };
  }
}

/**
 * La pagina de instalacion vive en el host de la APP: la PWA instalada desde
 * `www` seria otra app (otro origen) y abriria el panel fuera de su alcance.
 */
export function urlInstalar(hostname: string): string {
  return hostname === "localhost" || hostname.endsWith(".vercel.app")
    ? "/es/instalar"
    : "https://app.symvora.com.mx/es/instalar";
}
