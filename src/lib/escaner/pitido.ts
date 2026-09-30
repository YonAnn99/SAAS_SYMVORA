/**
 * Bip del escaner, generado con WebAudio (sin archivos): agudo y corto al leer
 * bien, grave y doble cuando el codigo no sirve. Si el navegador bloquea el
 * audio, simplemente no suena.
 */

let contexto: AudioContext | null = null;

function obtenerContexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  contexto ??= new Ctor();
  if (contexto.state === "suspended") void contexto.resume().catch(() => {});
  return contexto;
}

function tono(frecuencia: number, inicio: number, duracion: number) {
  const ctx = obtenerContexto();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const volumen = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = frecuencia;
  const t0 = ctx.currentTime + inicio;
  volumen.gain.setValueAtTime(0.0001, t0);
  volumen.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01);
  volumen.gain.exponentialRampToValueAtTime(0.0001, t0 + duracion);
  osc.connect(volumen).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duracion + 0.02);
}

function vibrar(patron: number | number[]) {
  try {
    navigator.vibrate?.(patron);
  } catch {
    // iPhone no vibra desde la web: se ignora.
  }
}

/**
 * Desbloquea el audio dentro de un toque (iOS no deja sonar sin gesto previo).
 * Se llama al abrir el escaner.
 */
export function prepararPitido(): void {
  obtenerContexto();
}

export function pitidoOk(): void {
  tono(1760, 0, 0.09);
  vibrar(40);
}

export function pitidoError(): void {
  tono(330, 0, 0.12);
  tono(330, 0.16, 0.12);
  vibrar([60, 60, 60]);
}
