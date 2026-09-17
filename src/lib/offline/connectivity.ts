/**
 * ¿Hay internet de verdad, o solo WiFi?
 *
 * `navigator.onLine` miente: devuelve `true` estando conectado a una red sin
 * salida, que es exactamente lo que pasa en un local con el modem caido. El
 * POS tomaba entonces la rama "en linea", la peticion fallaba, caia en el
 * `catch` generico y LA VENTA SE PERDIA: no se cobraba y tampoco se encolaba.
 *
 * Esta comprobacion ya existia dentro de `use-sale-sync`, pero solo se usaba
 * antes de vaciar la cola. Vive aqui para que el cobro use la MISMA regla.
 */

/** Un dispositivo lento no debe esperar eternamente en la caja. */
const TIEMPO_LIMITE_MS = 5000;

export async function hayConexionReal(): Promise<boolean> {
  // Si el sistema ya dice que no hay red, no hace falta gastar una peticion.
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;

  try {
    const controlador = new AbortController();
    const temporizador = setTimeout(
      () => controlador.abort(),
      TIEMPO_LIMITE_MS
    );

    // Archivo estatico propio: no gasta cuota de Supabase y esquiva la cache.
    const respuesta = await fetch(`/icons/icon-192.png?ping=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: controlador.signal,
    });
    clearTimeout(temporizador);

    // Se comprueba `ok`. Sin esto, un portal cautivo de hotel o de cafeteria
    // que responde 200 a cualquier cosa se tomaria por internet bueno, y las
    // ventas se intentarian en linea contra un servidor inalcanzable.
    return respuesta.ok;
  } catch {
    return false;
  }
}

/**
 * ¿Este error viene de que no hubo red?
 *
 * Se usa como red de seguridad al cobrar: si el intento en linea se cae por la
 * red, la venta se encola en vez de perderse. Se prefiere pecar de generoso —
 * encolar de mas es recuperable (el servidor deduplica por clave de
 * idempotencia); perder una venta cobrada, no.
 */
export function esErrorDeRed(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (!error) return false;

  if (error instanceof TypeError) return true; // `fetch` sin red lanza TypeError

  const e = error as { name?: string; message?: string; status?: number };
  if (e.name === "AbortError" || e.name === "TypeError") return true;

  // PostgREST y supabase-js devuelven objetos planos con `message`. Un error
  // de negocio trae codigo de estado; uno de red, no.
  if (typeof e.status === "number") return false;

  const mensaje = (e.message ?? "").toLowerCase();
  return (
    mensaje.includes("failed to fetch") ||
    mensaje.includes("networkerror") ||
    mensaje.includes("network request failed") ||
    mensaje.includes("load failed")
  );
}
