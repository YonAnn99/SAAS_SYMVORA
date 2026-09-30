/**
 * En modo continuo la camara ve el MISMO codigo varias veces por segundo
 * mientras se sigue apuntando. Esto deja pasar un codigo solo si no se leyo en
 * la ventana de espera; otro codigo distinto pasa de inmediato.
 *
 * Para cobrar dos iguales se retira el producto y se vuelve a apuntar (o se
 * sube la cantidad en el carrito).
 */
export function crearFiltroRepetidos(esperaMs = 1500) {
  let ultimo: string | null = null;
  let visto = 0;
  return (codigo: string, ahora: number = Date.now()): boolean => {
    if (codigo === ultimo && ahora - visto < esperaMs) {
      // Sigue a la vista: se extiende la espera para que no se cuele al pasar
      // exactamente los 1.5 s con el producto quieto frente a la camara.
      visto = ahora;
      return false;
    }
    ultimo = codigo;
    visto = ahora;
    return true;
  };
}
