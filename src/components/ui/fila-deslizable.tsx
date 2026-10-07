"use client";

/**
 * La fila de una tabla en celular: una "pastilla" que se desliza a la
 * izquierda (Swipe Row de React Bits, `swipe-row.tsx`).
 *
 *   deslizar a la mitad  -> Eliminar | Editar
 *   deslizar completo    -> Eliminar
 *
 * Reune lo que repetia cada lista: colores del tema, tamaños y las dos
 * acciones. Si borrar falla (`onEliminar` devuelve `false`), la fila, que ya
 * se habia colapsado, se vuelve a montar y reaparece.
 */

import { useCallback, useState, useSyncExternalStore, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { Pencil, Trash2 } from "lucide-react";
import SwipeRow, { type SwipeAction } from "@/components/ui/swipe-row";
import { useConfirmar, type OpcionesConfirmar } from "@/components/ui/confirmar";

export const COLOR_ELIMINAR = "#e5484d";
export const COLOR_EDITAR = "#2563EB";
/** Archivar (deslizar a la derecha en productos y variantes). */
export const COLOR_ARCHIVAR = "#d97706";

export interface AccionFila {
  id: string;
  etiqueta: string;
  color: string;
  icono: ReactNode;
  /** `false` si no se pudo: la fila (que ya se colapso) reaparece. */
  alElegir: () => void | Promise<boolean | void>;
  /**
   * La fila sigue existiendo despues de la accion (p. ej. "Devolver" deja la
   * compra como CANCELADA): al terminar se vuelve a montar para reaparecer.
   */
  permanece?: boolean;
  /**
   * Pide confirmacion ("¿Seguro?") antes de ejecutarla. Si se cancela, la fila
   * (que ya pudo haberse colapsado) reaparece y no pasa nada.
   */
  confirmar?: OpcionesConfirmar;
}

interface FilaDeslizableProps {
  /** Para lectores de pantalla (nombre de lo que representa la fila). */
  label: string;
  /**
   * Acciones a medida; la primera es la principal (deslizar completo). Sin
   * ellas: Eliminar (principal) y Editar con `onEliminar` / `onEditar`.
   */
  acciones?: AccionFila[];
  onEditar?: () => void;
  /** `false` si no se pudo borrar: la fila reaparece. */
  onEliminar?: () => void | Promise<boolean | void>;
  /** Tocar la fila sin deslizar (p. ej. abrir su detalle). */
  onTap?: () => void;
  /**
   * Accion al deslizar hacia la DERECHA (el lado contrario), p. ej. "Recibir".
   * La fila regresa sola; no se colapsa.
   */
  accionInicio?: AccionFila;
  /** Al cambiar (y no ser 0), la fila se asoma hacia `accionInicio` para avisar que se habilito. */
  avisoInicio?: number;
  onOpenChange?: (abierta: boolean) => void;
  /** Alto de la pastilla en px (72 por defecto, el de las tablas). */
  alto?: number;
  children: ReactNode;
}

export function FilaDeslizable({
  label,
  acciones: accionesAMedida,
  accionInicio,
  avisoInicio,
  onEditar,
  onEliminar,
  onTap,
  onOpenChange,
  alto = 72,
  children,
}: FilaDeslizableProps) {
  const { resolvedTheme } = useTheme();
  const oscuro = resolvedTheme !== "light";
  // El cajon (capa detras de la fila) va del MISMO color que la fila: en las
  // esquinas redondeadas el navegador mezcla ambos al suavizar el borde, y con
  // otro color se asomaba un halo. Editar pinta su propio fondo azul.
  const colorFila = oscuro ? "#1c1c1f" : "#f4f4f5";

  // La accion principal colapsa la fila ANTES de ejecutarse. Si falla, o si
  // la fila sigue existiendo (`permanece`), otra `key` la vuelve a montar.
  const [intento, setIntento] = useState(0);
  const confirmar = useConfirmar();
  const ejecutar = useCallback(
    async (accion: AccionFila) => {
      if (accion.confirmar && !(await confirmar(accion.confirmar))) {
        setIntento((n) => n + 1);
        return;
      }
      const resultado = await accion.alElegir();
      if (resultado === false || accion.permanece) setIntento((n) => n + 1);
    },
    [confirmar]
  );

  const lista: AccionFila[] = accionesAMedida ?? [
    {
      id: "eliminar",
      etiqueta: "Eliminar",
      color: COLOR_ELIMINAR,
      icono: <Trash2 size={18} strokeWidth={2} />,
      alElegir: () => onEliminar?.(),
      confirmar: { titulo: `¿Eliminar ${label}?` },
    },
    {
      id: "editar",
      etiqueta: "Editar",
      color: COLOR_EDITAR,
      icono: <Pencil size={18} strokeWidth={2} />,
      alElegir: () => onEditar?.(),
    },
  ];

  const acciones: SwipeAction[] = lista.map((a) => ({
    id: a.id,
    label: a.etiqueta,
    color: a.color,
    icon: a.icono,
    onSelect: () => void ejecutar(a),
  }));

  return (
    <SwipeRow
      key={intento}
      label={label}
      actions={acciones}
      actionColor={lista[0]?.color ?? COLOR_ELIMINAR}
      drawerColor={colorFila}
      rowColor={colorFila}
      textColor={oscuro ? "#f5f5f5" : "#18181b"}
      height={alto}
      radius={14}
      actionWidth={76}
      onOpenChange={onOpenChange}
      onTap={onTap}
      nudgeStart={avisoInicio}
      startAction={
        accionInicio
          ? {
              id: accionInicio.id,
              label: accionInicio.etiqueta,
              color: accionInicio.color,
              icon: accionInicio.icono,
              onSelect: () => void accionInicio.alElegir(),
            }
          : undefined
      }
    >
      {children}
    </SwipeRow>
  );
}

/** Evita que un toque en un control de la fila (casilla, corazon) la deslice. */
export const noArrastrar = (e: React.PointerEvent) => e.stopPropagation();

// La pista "desliza para editar o eliminar" se ve hasta la primera vez que
// alguien abre una fila (en cualquier lista). Se recuerda en este navegador.
const CLAVE_PISTA = "symvora_pista_deslizar_visto";
const oyentesPista = new Set<() => void>();
function pistaVista(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_PISTA) === "1";
  } catch {
    return false;
  }
}
function marcarPistaVista() {
  try {
    window.localStorage.setItem(CLAVE_PISTA, "1");
  } catch {
    // Sin almacenamiento (modo privado): la pista sigue apareciendo.
  }
  oyentesPista.forEach((avisar) => avisar());
}

/**
 * `verPista`: si mostrar la ayuda. `alAbrir`: para el `onOpenChange` de las
 * filas; la primera fila abierta la oculta para siempre.
 */
export function usePistaDeslizar() {
  const verPista = !useSyncExternalStore(
    (avisar) => {
      oyentesPista.add(avisar);
      return () => oyentesPista.delete(avisar);
    },
    pistaVista,
    () => true
  );
  const alAbrir = useCallback(
    (abierta: boolean) => {
      if (abierta && verPista) marcarPistaVista();
    },
    [verPista]
  );
  return { verPista, alAbrir };
}

export const TEXTO_PISTA_DESLIZAR = "Desliza a la izquierda para editar o eliminar";
/** Para las listas que ademas archivan al deslizar a la derecha. */
export const TEXTO_PISTA_DESLIZAR_ARCHIVAR = "Desliza ← para editar o eliminar, → para archivar";
