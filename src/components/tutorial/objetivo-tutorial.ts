/**
 * El elemento al que apunta un paso del tutorial, o `null` si no hay uno
 * visible (entonces el paso se muestra centrado).
 *
 * Con el menú lateral solo en escritorio, `document.querySelector` devolvia el
 * enlace del menú aunque estuviera oculto (0×0 en la esquina), y el diálogo y
 * la flecha se iban a (16, 16). Aqui se toma el primer elemento que de verdad
 * se ve.
 *
 * Los pasos "right" apuntan a enlaces del menú lateral: debajo de `lg` no hay
 * menú, y anclar el diálogo "a la derecha" de un ícono del dock no tiene
 * sentido, asi que ahí no se anclan.
 */
export function buscarObjetivo(
  selector: string | null | undefined,
  posicion: "right" | "bottom" | "center",
  esEscritorio: boolean
): Element | null {
  if (!selector || posicion === "center") return null;
  if (posicion === "right" && !esEscritorio) return null;
  for (const el of document.querySelectorAll(selector)) {
    const r = el.getBoundingClientRect();
    if (el.getClientRects().length > 0 && r.width > 0 && r.height > 0) return el;
  }
  return null;
}
