"use client";

import { useState, createContext, useContext, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Secciones desplegables, una abierta a la vez. Lo usan la creacion de cuenta
 * (`variante="auth"`, colores propios de esa pantalla) y los formularios del
 * panel (`variante="panel"`, colores del tema: se lee en claro y oscuro).
 */

type Variante = "auth" | "panel";

interface AccordionContextValue {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  variante: Variante;
}

const AccordionContext = createContext<AccordionContextValue>({
  activeIndex: 0,
  setActiveIndex: () => {},
  variante: "auth",
});

interface AccordionProps {
  children: React.ReactNode;
  defaultIndex?: number;
  /** Modo controlado: la seccion abierta la decide quien lo usa (-1 = ninguna). */
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  variante?: Variante;
  className?: string;
}

export function Accordion({
  children,
  defaultIndex = 0,
  activeIndex: activeControlado,
  onActiveIndexChange,
  variante = "auth",
  className,
}: AccordionProps) {
  const [activeInterno, setActiveInterno] = useState(defaultIndex);
  const activeIndex = activeControlado ?? activeInterno;
  const setActiveIndex = useCallback(
    (index: number) => {
      if (activeControlado === undefined) setActiveInterno(index);
      onActiveIndexChange?.(index);
    },
    [activeControlado, onActiveIndexChange]
  );

  return (
    <AccordionContext.Provider value={{ activeIndex, setActiveIndex, variante }}>
      <div className={cn("w-full", className)}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemProps {
  children: React.ReactNode;
  title: string;
  index: number;
  /** Texto corto junto al titulo con la seccion CERRADA (lo ya capturado). */
  resumen?: React.ReactNode;
  className?: string;
}

export function AccordionItem({ children, title, index, resumen, className }: AccordionItemProps) {
  const { activeIndex, setActiveIndex, variante } = useContext(AccordionContext);
  const isOpen = activeIndex === index;
  const panel = variante === "panel";

  const toggle = useCallback(() => {
    setActiveIndex(isOpen ? -1 : index);
  }, [isOpen, index, setActiveIndex]);

  return (
    <div
      className={cn(
        panel ? "border-b border-border" : "auth-accordion-item border-b border-gray-200",
        className
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 py-3 text-left"
        style={{ background: "none", border: "none", padding: "12px 0", cursor: "pointer" }}
      >
        <span
          className={
            panel ? "shrink-0 text-sm font-semibold text-foreground" : "auth-accordion-title"
          }
        >
          {title}
        </span>
        <span className="flex min-w-0 items-center gap-2">
          {resumen && !isOpen && (
            <span className="min-w-0 truncate text-xs text-muted-foreground">{resumen}</span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              panel ? "text-muted-foreground" : "auth-accordion-chevron text-gray-500"
            )}
            style={{
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              flexShrink: 0,
            }}
          />
        </span>
      </button>
      {/* `grid-template-rows` 0fr -> 1fr: se anima igual que antes pero sin
          tope de altura (con `max-height: 500px` una seccion larga se cortaba). */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: isOpen ? "1fr" : "0fr",
          transition: "grid-template-rows 0.3s ease, opacity 0.2s ease",
          opacity: isOpen ? 1 : 0,
        }}
        // Solo en el panel: la creacion de cuenta usa `required` nativo, y un
        // campo inerte vacio bloquearia el envio sin avisar.
        inert={(panel && !isOpen) || undefined}
      >
        <div style={{ overflow: "hidden", minHeight: 0 }}>
          <div style={{ paddingBottom: "12px" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
