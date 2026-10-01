"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"
import { useEsMovil } from "@/hooks/use-es-movil"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  noBlur,
  ...props
}: DialogPrimitive.Backdrop.Props & { noBlur?: boolean }) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        // 0.28 s con la curva EASE_OUT de beUI: acompaña el despliegue de la ventana.
        "fixed inset-0 isolate z-50 bg-black/10 duration-280 ease-[cubic-bezier(0.16,1,0.3,1)] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        !noBlur && "supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
      {...props}
    />
  )
}

/** La curva de cajon de beUI (`EASE_DRAWER` en `lib/ease.ts`). */
const CURVA_CAJON = "cubic-bezier(0.32, 0.72, 0, 1)"

/**
 * En celular, la ventana es una hoja que sube desde abajo (el Bottom Sheet de
 * beUI, integrado aqui para que TODAS las ventanas lo hereden sin tocarlas):
 *
 *   asa hacia arriba  -> se expande (92 % de la pantalla)
 *   asa hacia abajo   -> regresa a su altura; si ya estaba en ella, se cierra
 *
 * Solo se arrastra desde el asa (como en beUI): desplazar el contenido o
 * seleccionar texto no mueve la ventana. Cerrar pasa por un `Close` de Base UI,
 * asi cada ventana recibe su `onOpenChange(false)` como con la X.
 */
function HojaMovil({
  className,
  children,
  showCloseButton,
  noBlur,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton: boolean
  noBlur?: boolean
}) {
  const superficie = React.useRef<HTMLDivElement>(null)
  const cerrar = React.useRef<HTMLButtonElement>(null)
  const [expandida, setExpandida] = React.useState(false)
  const arrastre = React.useRef<{
    y0: number
    yPrevio: number
    tPrevio: number
    velocidad: number
  } | null>(null)

  const mover = (desplazamiento: number, animar: boolean) => {
    const el = superficie.current
    if (!el) return
    el.style.transition = animar
      ? `transform 0.4s ${CURVA_CAJON}, height 0.4s ${CURVA_CAJON}`
      : "none"
    el.style.transform = desplazamiento ? `translateY(${desplazamiento}px)` : ""
  }

  const alPresionar = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    arrastre.current = { y0: e.clientY, yPrevio: e.clientY, tPrevio: e.timeStamp, velocidad: 0 }
  }

  const alMover = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current
    if (!a) return
    const dy = e.clientY - a.y0
    const dt = Math.max(1, e.timeStamp - a.tPrevio)
    a.velocidad = (e.clientY - a.yPrevio) / dt
    a.yPrevio = e.clientY
    a.tPrevio = e.timeStamp
    // Hacia abajo sigue al dedo; hacia arriba con resistencia (como beUI).
    mover(dy > 0 ? dy : dy * 0.25, false)
  }

  const alSoltar = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current
    arrastre.current = null
    if (!a) return
    const dy = e.clientY - a.y0
    const v = a.velocidad // px/ms; positiva = hacia abajo

    if (dy > 120 || v > 0.6) {
      if (expandida) {
        setExpandida(false)
        mover(0, true)
      } else {
        cerrar.current?.click()
      }
      return
    }
    if (dy < -60 || v < -0.5) setExpandida(true)
    mover(0, true)
  }

  return (
    <DialogPortal>
      <DialogOverlay noBlur={noBlur} />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className="fixed inset-x-0 bottom-0 z-50 outline-none duration-300 data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom motion-reduce:animate-none"
        {...props}
      >
        {/* Superficie (alto, esquinas, arrastre) y, dentro, el asa FUERA del
            area con scroll. Antes el asa era `sticky` con margenes negativos
            dentro del mismo scroll: al enfocar el primer campo el navegador
            desplazaba unos pixeles y el asa tapaba la parte de arriba del
            titulo. */}
        <div
          ref={superficie}
          className={cn(
            "relative flex w-full flex-col overflow-hidden rounded-t-3xl bg-popover text-sm text-popover-foreground ring-1 ring-foreground/10",
            expandida ? "h-[92dvh]" : "max-h-[85dvh]"
          )}
          style={{ transition: `height 0.4s ${CURVA_CAJON}` }}
        >
          {/* El asa: franja tactil de lado a lado, siempre arriba. */}
          <div
            onPointerDown={alPresionar}
            onPointerMove={alMover}
            onPointerUp={alSoltar}
            onPointerCancel={alSoltar}
            className="flex shrink-0 cursor-grab touch-none select-none justify-center pt-2.5 pb-1 active:cursor-grabbing"
            aria-hidden="true"
          >
            <div className="h-1.5 w-10 rounded-full bg-muted-foreground/40" />
          </div>
          <div
            className={cn(
              "grid min-h-0 flex-1 gap-4 p-4 pt-2",
              className,
              // Lo de escritorio (max-w, mx, max-h, esquinas) no aplica aqui.
              "mx-0 w-full max-w-none max-h-none rounded-none overflow-y-auto overscroll-contain",
              "pb-[max(1rem,env(safe-area-inset-bottom))]"
            )}
          >
            {children}
          </div>
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              render={
                <Button
                  variant="ghost"
                  // z-20: por encima de un encabezado `sticky` del contenido (p. ej. el
                  // producto anclado de la hoja de variantes), que lo tapaba.
                  className="absolute top-3 right-2 z-20"
                  size="icon-sm"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
          {/* Cierre por arrastre: el mismo camino que la X. */}
          <DialogPrimitive.Close ref={cerrar} tabIndex={-1} aria-hidden="true" className="sr-only" />
        </div>
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  noBlur,
  despliegue = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  noBlur?: boolean
  /**
   * Tablet/escritorio: la ventana se despliega desde su centro (el "Center
   * Morph Modal" de beUI, `.dialogo-despliegue` en globals.css). `false` para
   * las que traen su propia animacion o no van centradas (el tutorial).
   */
  despliegue?: boolean
}) {
  // En celular, hoja deslizable desde abajo; en tablet y escritorio, la ventana
  // centrada de siempre.
  const esMovil = useEsMovil()
  if (esMovil) {
    return (
      <HojaMovil className={className} showCloseButton={showCloseButton} noBlur={noBlur} {...props}>
        {children}
      </HojaMovil>
    )
  }

  return (
    <DialogPortal>
      <DialogOverlay noBlur={noBlur} />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none sm:max-w-sm",
          despliegue && "dialogo-despliegue",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        // En celular (hoja deslizable) los botones quedan siempre a la vista.
        "max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:rounded-none max-sm:bg-popover",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
