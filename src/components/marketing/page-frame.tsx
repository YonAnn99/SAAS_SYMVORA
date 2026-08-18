/**
 * Marco decorativo fijo que enmarca toda la landing (header incluido) con
 * un borde inset, imitando el look de plantillas tipo "Circular".
 *
 * Usa mix-blend-mode: difference con un borde blanco — el color resultante
 * se invierte automáticamente según lo que haya debajo (se ve gris claro
 * sobre el hero blanco, y gris claro también sobre secciones oscuras),
 * así no hay que recolorear el borde manualmente por sección.
 */
export function PageFrame() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-2 z-[100] rounded-[28px] border border-white mix-blend-difference sm:inset-3 sm:rounded-[32px]"
    />
  );
}
