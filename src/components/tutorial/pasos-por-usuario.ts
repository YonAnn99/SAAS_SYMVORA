import { puedeVerRuta } from "@/lib/navigation";
import type { UserRole } from "@/lib/types/database";
import type { TutorialStep } from "./steps-data";

/**
 * Los pasos del tutorial que le tocan a esta persona.
 *
 * Decide por PERMISO EFECTIVO, con la misma regla que el menu lateral y el dock
 * (`puedeVerRuta`): asi respeta los permisos que el dueño da o quita por
 * persona. Con los permisos por defecto, el cajero ve 9 pasos (caja, venta,
 * catalogo, compras) y no los de Configuracion, Usuarios, Dashboard, Bitacora
 * ni Suscripcion, que lo mandarian a pantallas sin acceso.
 *
 * - Los pasos generales (centrados, sin navegar ni elemento en pantalla) se
 *   quedan siempre.
 * - Los de un modulo piden poder entrar a su ruta y, si lo traen, `permiso`.
 * - `textoSin` cambia el texto para quien no tiene ese permiso.
 */
export function pasosParaUsuario(
  pasos: TutorialStep[],
  role: UserRole | null,
  can: (permission: string) => boolean
): TutorialStep[] {
  return pasos
    .filter((paso) => {
      const general = !paso.navigates && paso.targetSelector === null;
      if (general) return true;
      if (!puedeVerRuta(paso.route, role, can)) return false;
      return !paso.permiso || can(paso.permiso);
    })
    .map((paso) =>
      paso.textoSin && !can(paso.textoSin.permiso)
        ? { ...paso, titleKey: paso.textoSin.titleKey, descriptionKey: paso.textoSin.descriptionKey }
        : paso
    );
}
