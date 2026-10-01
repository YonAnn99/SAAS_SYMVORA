"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Command } from "cmdk";
import {
  ArrowLeftRight,
  CalendarClock,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  Layers,
  Lightbulb,
  LockKeyhole,
  Package,
  Palette,
  Printer,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  Store,
  Tags,
  Truck,
  UnlockKeyhole,
  UserPlus,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { usePermissions } from "@/hooks/use-permissions";
import { useModulos } from "@/hooks/use-modulos";
import { filterNavigation } from "@/lib/navigation";
import {
  PALABRAS_CLAVE_MODULOS,
  accionesDisponibles,
  coincideBusqueda,
  type IconoAccion,
} from "@/lib/acciones-rapidas";

const ICONOS_ACCION: Record<IconoAccion, LucideIcon> = {
  "caja-abrir": UnlockKeyhole,
  "caja-cerrar": LockKeyhole,
  movimiento: ArrowLeftRight,
  venta: ShoppingCart,
  producto: Package,
  variante: Palette,
  lote: CalendarClock,
  ajuste: Wrench,
  importar: FileSpreadsheet,
  precios: Tags,
  compra: ShoppingCart,
  proveedor: Truck,
  orden: ClipboardList,
  usuario: UserPlus,
  sucursal: Store,
  modulos: SlidersHorizontal,
  terminal: Smartphone,
  suscripcion: CreditCard,
  sugerencia: Lightbulb,
  impresora: Printer,
};

const CLASE_GRUPO =
  "text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-medium";
const CLASE_ITEM =
  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground";

interface CommandMenuProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function CommandMenu({ open, setOpen }: CommandMenuProps) {
  const t = useTranslations();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { role, loading: tenantLoading } = useCurrentTenant();
  const { can, loading: permsLoading } = usePermissions();

  // Mismo origen y mismo filtro que el menú lateral. Antes esta lista era una
  // copia aparte con 8 de los 14 módulos y SIN filtrar por permisos, así que un
  // cajero veía aquí Usuarios y Configuración y el middleware lo rebotaba al
  // panel al pulsarlos.
  //
  // Mientras el rol no resuelve no se ofrece nada: calcular con `role` en
  // `null` mostraría el subconjunto de CAJERO a cualquiera durante unos cientos
  // de ms (mismo motivo por el que el sidebar pinta un skeleton).
  const navItems =
    tenantLoading || permsLoading
      ? []
      : filterNavigation(role, can);

  // Los botones del sistema que se pueden buscar por lo que hacen ("abrir
  // caja", "corte"...). Mismo filtro de permisos, mas los modulos encendidos.
  const { modulos } = useModulos();
  const acciones = tenantLoading || permsLoading ? [] : accionesDisponibles(can, modulos);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, setOpen]);

  const runAction = useCallback(
    (href: string) => {
      router.push(href);
      setOpen(false);
      setSearch("");
    },
    [router, setOpen]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2">
        <Command
          className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
          // Sin acentos, por palabras sueltas y tambien por palabras clave.
          filter={(value, search, keywords) => coincideBusqueda(value, search, keywords)}
        >
          <div className="flex items-center border-b border-border px-4">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Command.Input
              // Ctrl/Cmd+K y a escribir: sin foco, lo tecleado se perdia.
              autoFocus
              value={search}
              onValueChange={setSearch}
              placeholder={t("search.placeholder")}
              className="flex h-12 w-full rounded-md bg-transparent py-3 pl-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <kbd className="pointer-events-none ml-2 hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              {t("search.noResults")}
            </Command.Empty>

            <Command.Group heading={t("search.navigation")} className={CLASE_GRUPO}>
              {navItems.map((item) => {
                const Icon = item.icon;
                const label = t(item.name);
                return (
                  <Command.Item
                    key={item.href}
                    // Se busca por el nombre traducido, no por un id interno:
                    // quien teclea "reportes" espera encontrar Reportes.
                    value={label}
                    keywords={PALABRAS_CLAVE_MODULOS[item.href]}
                    onSelect={() => runAction(item.href)}
                    className={CLASE_ITEM}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{label}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>

            {acciones.length > 0 && (
              <Command.Group heading="Acciones" className={CLASE_GRUPO}>
                {acciones.map((accion) => {
                  const Icon = ICONOS_ACCION[accion.icono] ?? Layers;
                  return (
                    <Command.Item
                      key={accion.id}
                      value={accion.etiqueta}
                      keywords={accion.palabrasClave}
                      onSelect={() => runAction(accion.href)}
                      className={CLASE_ITEM}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{accion.etiqueta}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
