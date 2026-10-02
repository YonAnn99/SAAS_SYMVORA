"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react"

import { cn } from "@/lib/utils"
import { useRubberBordes, type Borde } from "@/components/ui/rubber-bordes"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list relative inline-flex w-fit items-center justify-center p-[3px] group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        // Rubber Segment de React Bits (tamaño `md`: alto 36, radio 10, inset
        // 3). Oscuro, como la referencia: riel gris oscuro y pastilla clara.
        // Claro, invertido: riel gris claro y pastilla oscura, para que el
        // movimiento se note igual en los dos modos.
        default:
          "rounded-[10px] bg-[var(--rs-track)] group-data-horizontal/tabs:h-9 [--rs-track:#f4f4f5] [--rs-thumb:#18181b] [--rs-ink:#18181b] [--rs-ink-active:#fafafa] dark:[--rs-track:#27272a] dark:[--rs-thumb:#fafafa] dark:[--rs-ink:#fafafa] dark:[--rs-ink-active:#18181b]",
        line: "gap-1 rounded-lg bg-transparent text-muted-foreground group-data-horizontal/tabs:h-8",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/*
 * La "pastilla" de la pestaña activa se mueve con la animacion de Rubber
 * Segment de React Bits (registro @react-bits, `RubberSegment-TS-TW`): al
 * cambiar de pestaña se ESTIRA desde la actual hasta la nueva y, al llegar, el
 * borde de atras pasa de largo unos pixeles y se APLASTA de vuelta.
 *
 * Se porta solo la animacion y no el componente: RubberSegment es un
 * `radiogroup`, y cambiar cada barra por el haria perder la semantica de
 * pestañas de Base UI (role="tab", el enlace con su panel, las flechas del
 * teclado). Aqui las pestañas siguen siendo las mismas; lo unico nuevo es el
 * indicador que se pinta detras. El arrastre del original queda fuera: en una
 * barra de pestañas se cambia con clic o teclado.
 *
 * La fisica (estirar, caer, aplastar) vive en `rubber-bordes.ts`, compartida
 * con el menu lateral; aqui los bordes son izquierda (`inicio`) y derecha (`fin`).
 */
/** Copia visual de una etiqueta, en la posicion de su pestaña. */
type Copia = { html: string; left: number; width: number }

/** Radio de la pastilla: radio del riel (10) menos el inset (3). */
const RADIO_PASTILLA = 7
const INSET = 3

function RubberIndicator() {
  // La barra se toma del propio indicador (su padre), no de un ref pasado
  // desde `TabsList`: `Tabs.List` de Base UI no entregaba ese ref, el efecto
  // salia al inicio y la pastilla nunca se medía ni se veía.
  const capaRef = React.useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const {
    inicio: edgeL,
    fin: edgeR,
    saltar: jump,
    viajar: travel,
    detener,
  } = useRubberBordes()
  const anchoInterior = useMotionValue(0)
  // Igual que el original: no se mueve una pastilla detras del texto, se
  // recorta una capa completa (fondo de pastilla + texto en color activo).
  // Asi, mientras se estira, las letras que quedan bajo la pastilla cambian
  // de color justo en su borde.
  const clipPath = useTransform(
    () =>
      `inset(0 ${Math.max(0, anchoInterior.get() - edgeR.get())}px 0 ${Math.max(0, edgeL.get())}px round ${RADIO_PASTILLA}px)`
  )
  const [copias, setCopias] = React.useState<Copia[]>([])
  const [visible, setVisible] = React.useState(false)

  const actual = React.useRef<Borde | null>(null)

  React.useLayoutEffect(() => {
    const list = capaRef.current?.parentElement
    if (!list) return

    // `animar`: solo cuando cambio la pestaña. Al montar, al redimensionar o
    // al cargar la fuente, la pastilla se coloca sin animacion.
    const medir = (animar: boolean) => {
      const pestanas = Array.from(
        list.querySelectorAll<HTMLElement>('[data-slot="tabs-trigger"]')
      )
      // `aria-selected` lo pone Base UI siempre en la pestaña activa.
      const activo = pestanas.find(
        (p) => p.getAttribute("aria-selected") === "true"
      )
      if (!activo) {
        setVisible(false)
        return
      }
      const caja = list.getBoundingClientRect()
      const relativo = (el: HTMLElement) => {
        const r = el.getBoundingClientRect()
        return {
          inicio: r.left - caja.left - INSET,
          fin: r.right - caja.left - INSET,
        }
      }

      anchoInterior.set(caja.width - INSET * 2)

      // Copia de cada etiqueta en su sitio; solo se actualiza si cambio.
      const nuevas = pestanas.map((p) => {
        const b = relativo(p)
        return { html: p.innerHTML, left: b.inicio, width: b.fin - b.inicio }
      })
      setCopias((previas) =>
        previas.length === nuevas.length &&
        previas.every(
          (c, i) =>
            c.html === nuevas[i].html &&
            c.left === nuevas[i].left &&
            c.width === nuevas[i].width
        )
          ? previas
          : nuevas
      )

      const destino = relativo(activo)
      const origen = actual.current
      actual.current = destino
      setVisible(true)
      if (
        animar &&
        !reduce &&
        origen &&
        (origen.inicio !== destino.inicio || origen.fin !== destino.fin)
      ) {
        travel(origen, destino)
      } else {
        jump(destino)
      }
    }

    medir(false)

    const tamano = new ResizeObserver(() => medir(false))
    tamano.observe(list)
    // El cambio de pestaña se ve en sus atributos: sirve con `Tabs`
    // controlado o no, sin pasarle nada a la barra.
    // Se observa toda la lista (no cada pestaña) para cubrir tambien las que
    // aparecen despues, como "Lotes", que depende de los modulos activos. Las
    // copias de la capa no llevan esos atributos, asi que no se disparan solas.
    const cambio = new MutationObserver((registros) => {
      const cambioPestana = registros.some((r) => r.type === "attributes")
      medir(cambioPestana)
    })
    cambio.observe(list, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-active", "aria-selected"],
      childList: true,
    })
    document.fonts?.ready.then(() => medir(false))

    return () => {
      tamano.disconnect()
      cambio.disconnect()
      detener()
    }
  }, [reduce, travel, jump, detener, anchoInterior])

  return (
    <motion.div
      ref={capaRef}
      aria-hidden="true"
      data-slot="tabs-indicator"
      className={cn(
        "pointer-events-none absolute inset-[3px] z-20 bg-[var(--rs-thumb)] text-[var(--rs-ink-active)]",
        !visible && "opacity-0"
      )}
      style={{ clipPath }}
    >
      {copias.map((c, i) => (
        <span
          key={i}
          className="absolute inset-y-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-[13px] font-medium leading-none [&_svg]:size-4 [&_svg]:shrink-0"
          style={{ left: c.left, width: c.width }}
          // Contenido de nuestras propias pestañas (icono y texto), no de
          // un usuario: es una copia visual, oculta a lectores de pantalla.
          dangerouslySetInnerHTML={{ __html: c.html }}
        />
      ))}
    </motion.div>
  )
}

function TabsList({
  className,
  variant = "default",
  children,
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {variant === "default" && <RubberIndicator />}
      {children}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex flex-1 items-center justify-center gap-1.5 border border-transparent font-medium whitespace-nowrap outline-none disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // Rubber Segment: el fondo y el texto de la activa los pinta la capa
        // de `RubberIndicator` por encima; aqui solo va el texto inactivo.
        "group-data-[variant=default]/tabs-list:h-full group-data-[variant=default]/tabs-list:rounded-[7px] group-data-[variant=default]/tabs-list:px-3.5 group-data-[variant=default]/tabs-list:text-[13px] group-data-[variant=default]/tabs-list:leading-none group-data-[variant=default]/tabs-list:text-[var(--rs-ink)] group-data-[variant=default]/tabs-list:opacity-70 group-data-[variant=default]/tabs-list:transition-opacity group-data-[variant=default]/tabs-list:hover:opacity-90",
        "group-data-[variant=line]/tabs-list:h-[calc(100%-1px)] group-data-[variant=line]/tabs-list:rounded-md group-data-[variant=line]/tabs-list:px-1.5 group-data-[variant=line]/tabs-list:py-0.5 group-data-[variant=line]/tabs-list:text-sm group-data-[variant=line]/tabs-list:text-foreground/60 group-data-[variant=line]/tabs-list:transition-colors group-data-[variant=line]/tabs-list:hover:text-foreground group-data-[variant=line]/tabs-list:data-active:text-foreground dark:group-data-[variant=line]/tabs-list:text-muted-foreground dark:group-data-[variant=line]/tabs-list:hover:text-foreground dark:group-data-[variant=line]/tabs-list:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
