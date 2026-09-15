"use client";

import { useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Celdas que se editan al dar clic, sin abrir el dialogo.
 *
 * Es el primer patron de este tipo en el repo; si aparece otra tabla con
 * edicion express, se reutiliza esto en vez de duplicarlo.
 *
 * TRES DECISIONES QUE PARECEN DETALLE Y NO LO SON:
 *
 * 1. Los controles van a `h-7` (28px), la misma altura que la miniatura del
 *    producto. Con la altura por defecto (`h-8`) la fila CRECE al entrar en
 *    edicion y toda la tabla da un salto a cada clic.
 * 2. El campo hereda `text-right font-mono` en precio y stock. Si no, el
 *    numero se va a la izquierda al empezar a editar y parece otro dato.
 * 3. Sin permiso se pinta texto plano, sin `hover` ni cursor: la politica RLS
 *    `productos_update` exige `inventory.manage`, asi que ofrecer la edicion a
 *    quien no lo tiene solo produce un error tras escribir.
 */

interface ComunProps {
  /** Si es falso, la celda es solo texto. */
  canEdit: boolean;
  /** Mientras se guarda: atenuado y bloqueado. */
  saving?: boolean;
  /** Pista al pasar el cursor. La traduce quien monta la celda. */
  hint?: string;
  className?: string;
}

interface EditableTextCellProps extends ComunProps {
  /** El texto con el que se abre el campo. */
  value: string;
  /** Lo que se ve en reposo (puede llevar formato: "$80.00"). */
  children: ReactNode;
  onCommit: (texto: string) => void;
  numerico?: boolean;
}

export function EditableTextCell({
  value,
  children,
  onCommit,
  canEdit,
  saving = false,
  numerico = false,
  hint,
  className,
}: EditableTextCellProps) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(value);

  // Enter cierra el campo, y cerrarlo dispara el `blur` del input que se esta
  // desmontando: sin esta bandera el valor se guardaria DOS veces, y con Esc
  // se guardaria justo lo que se acababa de cancelar.
  const resueltoRef = useRef(false);

  if (!canEdit) {
    return <>{children}</>;
  }

  function abrir() {
    if (saving) return;
    setBorrador(value);
    resueltoRef.current = false;
    setEditando(true);
  }

  function confirmar() {
    if (resueltoRef.current) return;
    resueltoRef.current = true;
    setEditando(false);
    // Se manda siempre, incluso sin cambio aparente: quien decide si hay algo
    // que guardar es `hayCambio`, que compara el valor YA parseado ("80.00" y
    // "80" son el mismo precio).
    onCommit(borrador);
  }

  function cancelar() {
    resueltoRef.current = true;
    setEditando(false);
  }

  if (editando) {
    return (
      <Input
        autoFocus
        value={borrador}
        onChange={(e) => setBorrador(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            confirmar();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancelar();
          }
        }}
        inputMode={numerico ? "decimal" : undefined}
        className={cn("h-7 px-1.5 text-sm", className)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={abrir}
      disabled={saving}
      title={hint}
      className={cn(
        // `w-full` NO es decorativo: sin el, el area clicable mide lo que mide
        // el texto. En un stock de "1" eso es un blanco de 8px dentro de una
        // columna de 100, y el clic "sobre el numero" no hacia nada. Con el
        // ancho completo se puede pinchar en cualquier punto de la celda.
        "-mx-1 w-full cursor-text rounded px-1 py-0.5 text-left transition-colors hover:bg-muted/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        saving && "pointer-events-none opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

interface EditableSelectCellProps extends ComunProps {
  value: string;
  options: { value: string; label: string }[];
  onCommit: (valor: string) => void;
  children: ReactNode;
}

/**
 * Variante de lista. A diferencia del texto, aqui NO hay dos pasos: el
 * desplegable se abre con el primer clic. Obligar a un clic para "entrar en
 * edicion" y otro para abrir el menu duplicaria el trabajo sin dar nada.
 */
export function EditableSelectCell({
  value,
  options,
  onCommit,
  canEdit,
  saving = false,
  children,
  hint,
  className,
}: EditableSelectCellProps) {
  if (!canEdit) {
    return <>{children}</>;
  }

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (typeof v === "string" && v !== value) onCommit(v);
      }}
      disabled={saving}
    >
      <SelectTrigger
        size="sm"
        title={hint}
        className={cn(
          "-mx-1.5 border-transparent bg-transparent px-1.5 hover:bg-muted/60 dark:bg-transparent dark:hover:bg-muted/60",
          saving && "opacity-50",
          className
        )}
      >
        {/*
          La funcion NO es opcional: `Select.Value` sin ella pinta el valor
          crudo del enum mientras el popup no se ha abierto nunca (las
          etiquetas viven en los `SelectItem`, que solo se montan al abrir).
          En la tabla eso salia como "PIEZA" y "KG" en vez de "Pieza" y
          "Kilogramo".
        */}
        <SelectValue>
          {(v) => options.find((o) => o.value === v)?.label ?? String(v ?? "")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
