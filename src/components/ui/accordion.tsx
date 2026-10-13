"use client";

import { Children, useState, createContext, useContext, useCallback, useId } from "react";
import { motion, useReducedMotion, type Transition } from "motion/react";
import { ChevronDown } from "lucide-react";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

/**
 * Secciones desplegables, una abierta a la vez. Lo usan la creacion de cuenta
 * (`variante="auth"`, colores propios de esa pantalla) y los formularios del
 * panel (`variante="panel"`, colores del tema: se lee en claro y oscuro).
 *
 * Animacion de beUI «Bouncy Accordion» (beui.dev/components/motion/bouncy-accordion):
 * las filas cerradas forman un bloque; la abierta se separa con un hueco, sus
 * esquinas se redondean y el contenido crece con rebote. Se porta su mecanica
 * (aqui el contenido son formularios, no un texto) y se animan las propiedades
 * reales en vez de `layout`: la proyeccion falla dentro de un dialogo con scroll.
 */

type Variante = "auth" | "panel";

interface AccordionContextValue {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  variante: Variante;
  /** Cuantas secciones tiene: la ultima cierra el bloque. */
  total: number;
  /** 1 = acordeon suelto; 2+ = dentro de la seccion de otro (tarjeta de variante). */
  nivel: number;
}

const AccordionContext = createContext<AccordionContextValue>({
  activeIndex: 0,
  setActiveIndex: () => {},
  variante: "auth",
  total: 0,
  nivel: 0,
});

// Resortes de beUI. El hueco y la altura al CERRAR van sin rebote: un margen
// negativo encimaria las filas y una altura negativa es invalida en CSS (se
// veria todo el contenido de golpe).
const FILA: Transition = { type: "spring", duration: 0.55, bounce: 0.38 };
const HUECO: Transition = { type: "spring", duration: 0.5, bounce: 0 };
const ABRIR: Transition = { type: "spring", duration: 0.58, bounce: 0.32 };
const CERRAR: Transition = { type: "spring", duration: 0.46, bounce: 0 };
const FUNDIDO: Transition = { duration: 0.18, ease: EASE_OUT };
const FLECHA: Transition = { type: "spring", duration: 0.42, bounce: 0.28 };
const SIN_MOVIMIENTO: Transition = { duration: 0 };

const RADIO = 16;
const SEPARACION = 10;

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
  const padre = useContext(AccordionContext);
  const [activeInterno, setActiveInterno] = useState(defaultIndex);
  const activeIndex = activeControlado ?? activeInterno;
  const setActiveIndex = useCallback(
    (index: number) => {
      if (activeControlado === undefined) setActiveInterno(index);
      onActiveIndexChange?.(index);
    },
    [activeControlado, onActiveIndexChange]
  );
  // `toArray` aplana `tarjetas.map(...)` y descarta null/false.
  const total = Children.toArray(children).length;

  return (
    <AccordionContext.Provider
      value={{ activeIndex, setActiveIndex, variante, total, nivel: padre.nivel + 1 }}
    >
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
  const { activeIndex, setActiveIndex, variante, total, nivel } = useContext(AccordionContext);
  const reducir = useReducedMotion();
  const id = useId();
  const isOpen = activeIndex === index;
  const panel = variante === "panel";

  // Grupos como en beUI: la abierta va sola; las cerradas se juntan.
  const anteriorAbierta = activeIndex === index - 1;
  const iniciaGrupo = isOpen || index === 0 || anteriorAbierta;
  const cierraGrupo = isOpen || index === total - 1 || activeIndex === index + 1;
  const separada = index > 0 && (isOpen || anteriorAbierta);

  const toggle = useCallback(() => {
    setActiveIndex(isOpen ? -1 : index);
  }, [isOpen, index, setActiveIndex]);

  const t = (transicion: Transition) => (reducir ? SIN_MOVIMIENTO : transicion);
  const idBoton = `${id}-boton`;
  const idContenido = `${id}-contenido`;

  return (
    <motion.div
      initial={false}
      animate={{
        marginTop: separada ? SEPARACION : 0,
        borderTopLeftRadius: iniciaGrupo ? RADIO : 0,
        borderTopRightRadius: iniciaGrupo ? RADIO : 0,
        borderBottomLeftRadius: cierraGrupo ? RADIO : 0,
        borderBottomRightRadius: cierraGrupo ? RADIO : 0,
      }}
      transition={{ default: t(FILA), marginTop: t(HUECO) }}
      data-state={isOpen ? "open" : "closed"}
      // Entre dos filas unidas queda una linea tenue (el borde de arriba de la
      // de abajo); la de arriba no lleva borde inferior, asi no se duplica.
      data-unida={!iniciaGrupo || undefined}
      className={cn(
        "overflow-hidden border-x border-t",
        cierraGrupo && "border-b",
        panel
          ? cn(
              nivel > 1 ? "bg-muted/30" : "bg-card",
              "border-border",
              !iniciaGrupo && "border-t-border/50"
            )
          : "auth-accordion-item",
        className
      )}
    >
      <button
        id={idBoton}
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls={idContenido}
        className="flex w-full items-center justify-between gap-3 text-left outline-none focus-visible:bg-muted/40"
        // Inline: la pantalla de registro estiliza los <button> de su formulario.
        style={{ background: "none", border: "none", padding: "12px 16px", cursor: "pointer" }}
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
          <motion.span
            aria-hidden
            initial={false}
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={t(FLECHA)}
            className="grid shrink-0 place-items-center"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4",
                panel ? "text-muted-foreground" : "auth-accordion-chevron text-gray-500"
              )}
            />
          </motion.span>
        </span>
      </button>
      {/* Altura 0 <-> "auto": sin tope (una seccion larga no se corta) y, abierta,
          sigue al contenido si crece (la foto, la seccion de una variante). */}
      <motion.div
        id={idContenido}
        role="region"
        aria-labelledby={idBoton}
        initial={false}
        animate={{ height: isOpen ? "auto" : 0 }}
        transition={t(isOpen ? ABRIR : CERRAR)}
        style={{ overflow: "hidden" }}
        // Solo en el panel: la creacion de cuenta usa `required` nativo, y un
        // campo inerte vacio bloquearia el envio sin avisar.
        inert={(panel && !isOpen) || undefined}
      >
        <motion.div
          initial={false}
          animate={{ opacity: isOpen ? 1 : 0 }}
          transition={t(FUNDIDO)}
          style={{ padding: "0 16px 16px" }}
        >
          {children}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
