"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"

import { cn } from "@/lib/utils"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

const Combobox = ComboboxPrimitive.Root

function ComboboxInputGroup({
  className,
  ...props
}: ComboboxPrimitive.InputGroup.Props) {
  return (
    <ComboboxPrimitive.InputGroup
      data-slot="combobox-input-group"
      className={cn(
        "flex h-8 w-full items-center rounded-xl border border-border bg-background pl-2.5 text-sm transition-colors outline-none hover:border-foreground/25 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function ComboboxInput({
  className,
  ...props
}: ComboboxPrimitive.Input.Props) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-input"
      className={cn(
        "h-full min-w-0 flex-1 bg-transparent text-sm outline-none select-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function ComboboxTrigger({
  className,
  children,
  ...props
}: ComboboxPrimitive.Trigger.Props) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={cn(
        // La flecha gira al abrir con un leve rebote (Select de beUI).
        "flex h-full w-7 items-center justify-center text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&>svg]:transition-[rotate] [&>svg]:duration-300 [&>svg]:ease-[cubic-bezier(0.34,1.56,0.64,1)] data-popup-open:[&>svg]:rotate-180 motion-reduce:[&>svg]:transition-none",
        className
      )}
      {...props}
    >
      {children ?? <ChevronDownIcon className="pointer-events-none" />}
    </ComboboxPrimitive.Trigger>
  )
}

function ComboboxPortal(props: ComboboxPrimitive.Portal.Props) {
  return <ComboboxPrimitive.Portal data-slot="combobox-portal" {...props} />
}

function ComboboxPositioner({
  className,
  ...props
}: ComboboxPrimitive.Positioner.Props) {
  return (
    <ComboboxPrimitive.Positioner
      data-slot="combobox-positioner"
      // Separado del campo, como el panel del Select de beUI.
      sideOffset={8}
      className={cn("isolate z-50", className)}
      {...props}
    />
  )
}

function ComboboxPopup({
  className,
  children,
  ...props
}: ComboboxPrimitive.Popup.Props) {
  return (
    <ComboboxPrimitive.Popup
      data-slot="combobox-popup"
      className={cn(
        // Mismo aspecto y despliegue que `SelectContent` (ui/select.tsx): panel
        // redondeado y separado, rebote suave desde el lado del campo, y alto
        // limitado a 18rem para que las listas largas (clientes, proveedores)
        // se desplacen por dentro en vez de desbordarse.
        "relative isolate z-50 max-h-[min(var(--available-height),18rem)] w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-lg",
        "transition-[opacity,scale,translate] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        "data-starting-style:scale-y-95 data-starting-style:opacity-0 data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1",
        "data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:ease-out",
        "motion-reduce:transition-none",
        className
      )}
      {...props}
    >
      {children}
    </ComboboxPrimitive.Popup>
  )
}

function ComboboxEmpty({
  className,
  ...props
}: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn(
        // `empty:hidden`: Base UI siempre monta este elemento y solo le pone
        // texto cuando no hay resultados; sin esto su relleno dejaba un hueco
        // vacio arriba de la lista (p. ej. sobre "Cliente general" en el POS).
        "py-4 pr-4 pl-2 text-sm leading-4 text-muted-foreground empty:hidden",
        className
      )}
      {...props}
    />
  )
}

function ComboboxList({
  className,
  children,
  ...props
}: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn(
        "max-h-[min(var(--available-height),18rem)] overflow-y-auto overscroll-contain p-1 scroll-py-1 outline-none",
        className
      )}
      {...props}
    >
      {children}
    </ComboboxPrimitive.List>
  )
}

function ComboboxItem({
  className,
  children,
  ...props
}: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-lg py-1.5 pr-8 pl-2.5 text-sm text-muted-foreground outline-hidden transition-colors select-none focus:bg-muted focus:text-foreground data-highlighted:bg-muted data-highlighted:text-foreground data-selected:bg-muted data-selected:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
    </ComboboxPrimitive.Item>
  )
}

function ComboboxItemIndicator({
  className,
  ...props
}: ComboboxPrimitive.ItemIndicator.Props) {
  return (
    <ComboboxPrimitive.ItemIndicator
      data-slot="combobox-item-indicator"
      className={cn(
        "pointer-events-none absolute right-2 flex size-4 items-center justify-center",
        className
      )}
      {...props}
    >
      <CheckIcon className="pointer-events-none" />
    </ComboboxPrimitive.ItemIndicator>
  )
}

export {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxPortal,
  ComboboxPopup,
  ComboboxPositioner,
  ComboboxTrigger,
}