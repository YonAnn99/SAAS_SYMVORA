/**
 * Aviso emergente cuando entra un pedido del catálogo (migración 146). El sonido lo toca `sonidos.ts`,
 * igual que el de cualquier otro tipo de aviso.
 */
import { toast } from "sonner";

/** Toast con el resumen (se abre desde Pedidos). */
export function avisarPedidoNuevo(fila: { titulo?: string | null; mensaje?: string | null }): void {
  toast.success(fila.titulo ?? "Nuevo pedido", {
    description: [fila.mensaje, "Ábrelo en Pedidos para aceptarlo."].filter(Boolean).join(" · "),
    duration: 8000,
  });
}
