/**
 * Aviso emergente y sonido cuando entra un pedido del catálogo (migración 146). El sonido es un «ding» corto generado
 * con WebAudio (sin archivos). Se puede apagar en el navegador; la preferencia no viaja a la base.
 */
import { toast } from "sonner";

export const CLAVE_SONIDO_PEDIDO = "symvora-pedido-sonido";

export function sonidoPedidoActivo(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_SONIDO_PEDIDO) !== "off";
  } catch {
    return true;
  }
}

export function cambiarSonidoPedido(activo: boolean): void {
  try {
    window.localStorage.setItem(CLAVE_SONIDO_PEDIDO, activo ? "on" : "off");
  } catch {
    // Sin almacenamiento: queda encendido.
  }
}

/** Dos tonos cortos. Si el navegador no deja reproducir audio sin interacción, se omite en silencio. */
export function tocarSonidoPedido(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const suena = (frecuencia: number, inicio: number) => {
      const osc = ctx.createOscillator();
      const gan = ctx.createGain();
      osc.frequency.value = frecuencia;
      gan.gain.setValueAtTime(0.0001, ctx.currentTime + inicio);
      gan.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + inicio + 0.02);
      gan.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + 0.35);
      osc.connect(gan).connect(ctx.destination);
      osc.start(ctx.currentTime + inicio);
      osc.stop(ctx.currentTime + inicio + 0.4);
    };
    suena(880, 0);
    suena(1320, 0.18);
    window.setTimeout(() => void ctx.close(), 900);
  } catch {
    // Sin audio: el aviso visual basta.
  }
}

/** Toast con el resumen (se abre desde Pedidos) y, si está encendido, el sonido. */
export function avisarPedidoNuevo(fila: { titulo?: string | null; mensaje?: string | null }): void {
  toast.success(fila.titulo ?? "Nuevo pedido", {
    description: [fila.mensaje, "Ábrelo en Pedidos para aceptarlo."].filter(Boolean).join(" · "),
    duration: 8000,
  });
  if (sonidoPedidoActivo()) tocarSonidoPedido();
}
