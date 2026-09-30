"use client";

/**
 * "Desliza para confirmar" a todo el ancho de su contenedor: el Slide Commit
 * de React Bits (`slide-commit.tsx`) con el medidor de ancho y los colores de
 * claro/oscuro del sistema. Lo usan confirmar venta (verde) y crear producto o
 * variante (azul).
 *
 * `onConfirm` se resuelve si la operacion quedo y se rechaza si no: de eso
 * depende que la pastilla muestre `doneLabel` o `errorLabel` (y regrese).
 * `onDone` llega tras la animacion de exito, con la posicion del control para
 * que el destello nazca de ahi.
 */

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import SlideCommit from "@/components/ui/slide-commit";

interface DeslizarParaConfirmarProps {
  label: string;
  doneLabel: string;
  errorLabel?: string;
  successColor: string;
  disabled?: boolean;
  onConfirm: () => Promise<void>;
  onDone?: (origen: DOMRect | null) => void;
}

export function DeslizarParaConfirmar({
  label,
  doneLabel,
  errorLabel = "No se completó",
  successColor,
  disabled = false,
  onConfirm,
  onDone,
}: DeslizarParaConfirmarProps) {
  const { resolvedTheme } = useTheme();
  const oscuro = resolvedTheme === "dark";

  // El slider hace sus cuentas con un ancho en pixeles: se mide el contenedor
  // para que ocupe todo el ancho del dialogo, tambien en celular.
  // Con un ref de callback: el contenido del dialogo se monta cuando abre, y
  // asi se mide en cuanto existe el elemento (no antes).
  const [caja, setCaja] = useState<HTMLDivElement | null>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    if (!caja) return;
    const medir = () => setAncho(Math.round(caja.getBoundingClientRect().width));
    const observador = new ResizeObserver(medir);
    observador.observe(caja);
    return () => observador.disconnect();
  }, [caja]);

  return (
    <div ref={setCaja} className="w-full">
      {ancho > 0 && (
        <SlideCommit
          width={ancho}
          height={52}
          radius={26}
          label={label}
          doneLabel={doneLabel}
          errorLabel={errorLabel}
          // Oscuro como la referencia; claro, invertido (igual que las
          // pestañas). Van en hex: el componente calcula el color del texto a
          // partir de ellos.
          trackColor={oscuro ? "#262626" : "#f4f4f5"}
          handleColor={oscuro ? "#f5f5f5" : "#18181b"}
          successColor={successColor}
          dangerColor="#e5484d"
          // La pastilla de exito se queda: el dialogo se cierra solo.
          holdMs={0}
          disabled={disabled}
          onConfirm={onConfirm}
          onDone={() => onDone?.(caja?.getBoundingClientRect() ?? null)}
        />
      )}
    </div>
  );
}
