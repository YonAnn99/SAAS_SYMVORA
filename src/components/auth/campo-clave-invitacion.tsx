"use client";

import { useEffect, useRef, useState } from "react";
import { CodeSlots, type CodeSlotsStatus } from "@/components/ui/code-slots";

/** Las claves de `/api/users/invite`: 8 caracteres de letras y numeros. */
export const LARGO_CLAVE = 8;
const GAP = 6;
const MAX_CASILLA = 44;

/**
 * La clave de invitacion en el acceso de colaboradores, con Code Slots.
 *
 * Colores del formulario de auth (`auth-toggle.css`): casillas grises como los
 * demas campos y relleno negro como el boton INGRESAR.
 *
 * Las casillas miden lo que quepa: 8 de 44 px no entran en el formulario del
 * celular, asi que el tamaño sale del ancho del contenedor (ResizeObserver).
 */
export function CampoClaveInvitacion({
  value,
  onChange,
  status,
  etiqueta,
}: {
  value: string;
  onChange: (clave: string) => void;
  status: CodeSlotsStatus;
  etiqueta: string;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [casilla, setCasilla] = useState(40);

  useEffect(() => {
    const el = contenedorRef.current;
    if (!el) return;
    const medir = new ResizeObserver(([entrada]) => {
      const ancho = entrada.contentRect.width;
      if (!ancho) return;
      setCasilla(
        Math.max(24, Math.min(MAX_CASILLA, Math.floor((ancho - GAP * (LARGO_CLAVE - 1)) / LARGO_CLAVE)))
      );
    });
    medir.observe(el);
    return () => medir.disconnect();
  }, []);

  return (
    <div ref={contenedorRef} className="campo-clave w-full">
      <span className="campo-clave-etiqueta">{etiqueta}</span>
      <div className="flex justify-center">
        <CodeSlots
          length={LARGO_CLAVE}
          alfanumerico
          value={value}
          onChange={onChange}
          status={status}
          ariaLabel={etiqueta}
          slotSize={casilla}
          gap={GAP}
          radius={8}
          accentColor="#1a1a1a"
          inkColor="#1a1a1a"
          slotColor="#f0f0f0"
          digitColor="#ffffff"
          dangerColor="#dc2626"
        />
      </div>
    </div>
  );
}
