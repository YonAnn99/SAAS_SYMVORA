"use client";

import { useTranslations } from "next-intl";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  Bell,
  Volume2,
  VolumeX,
  Boxes,
  CalendarClock,
  CalendarX2,
  FlaskConical,
  ClipboardList,
  Package,
  PackageX,
  ReceiptText,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Stamp,
  Trash2,
  TriangleAlert,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cambiarSonido, sonidoActivo } from "../sonidos";
import { portadaDeNovedad } from "@/lib/novedades";
import Image from "next/image";
import {
  COLOR_ELIMINAR,
  FilaDeslizable,
  usePistaDeslizar,
} from "@/components/ui/fila-deslizable";
import { cn } from "@/lib/utils";
import { useEsEscritorio } from "@/hooks/use-es-movil";
import { etiquetaGlobo, tiempoTranscurrido, type Notificacion, type TipoNotificacion } from "@/lib/notificaciones";
import { useNotificaciones } from "@/features/notificaciones/hooks/use-notificaciones";

const ESTILO: Record<TipoNotificacion, { icono: LucideIcon; clase: string }> = {
  stock_agotado: { icono: PackageX, clase: "bg-red-500/15 text-red-600 dark:text-red-400" },
  stock_bajo: { icono: TriangleAlert, clase: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  caja_cerrada: { icono: Wallet, clase: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  producto: { icono: Package, clase: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  compra: { icono: ShoppingCart, clase: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  orden_compra: { icono: ClipboardList, clase: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  ajuste: { icono: SlidersHorizontal, clase: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  traspaso: { icono: ArrowLeftRight, clase: "bg-teal-500/15 text-teal-600 dark:text-teal-400" },
  lote_caducado: { icono: CalendarX2, clase: "bg-red-500/15 text-red-600 dark:text-red-400" },
  lote_por_caducar: { icono: CalendarClock, clase: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  lote: { icono: Boxes, clase: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  insumo_faltante: { icono: FlaskConical, clase: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  lealtad_alta: { icono: Stamp, clase: "bg-pink-500/15 text-pink-600 dark:text-pink-400" },
  novedad: { icono: Sparkles, clase: "bg-primary/15 text-primary" },
  venta_cancelada: { icono: ReceiptText, clase: "bg-red-500/15 text-red-600 dark:text-red-400" },
  pedido_nuevo: { icono: ClipboardList, clase: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
};

/** Icono del tipo, con el punto de "nueva" en su esquina. Las novedades muestran su imagen. */
function IconoNotificacion({ n, nueva }: { n: Notificacion; nueva: boolean }) {
  const t = useTranslations("notifications");
  const estilo = ESTILO[n.tipo] ?? ESTILO.producto;
  const Icono = estilo.icono;
  const idNovedad = typeof n.datos?.novedad === "string" ? n.datos.novedad : null;
  const portada = n.tipo === "novedad" && idNovedad ? portadaDeNovedad(idNovedad) : null;
  if (portada) {
    return (
      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
        <Image src={portada} alt="" width={64} height={64} className="h-full w-full object-cover" />
        {nueva && (
          <span
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-popover"
            aria-label={t("new")}
          />
        )}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        estilo.clase
      )}
    >
      <Icono className="h-4 w-4" />
      {nueva && (
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-popover"
          aria-label={t("new")}
        />
      )}
    </span>
  );
}

/** El texto ya no cabe en lo que se ve (`truncate` o `line-clamp`). */
function estaRecortado(el: HTMLElement | null): boolean {
  if (!el) return false;
  return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
}

/** «Abrir» dentro de un aviso expandido: lleva a su módulo. */
function BotonAbrir({ enlace, onIr }: { enlace: string; onIr: () => void }) {
  const t = useTranslations("notifications");
  return (
    <Link
      href={enlace}
      onClick={(e) => {
        e.stopPropagation();
        onIr();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
    >
      {t("open")}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

/**
 * Un aviso en escritorio. Si su texto no cabe, el clic lo EXPANDE (con «Abrir»
 * para ir al módulo) y otro clic lo recoge; si cabe, el clic va directo al
 * módulo, como siempre.
 */
function AvisoEscritorio({
  n,
  nueva,
  hace,
  onIr,
  onOcultar,
}: {
  n: Notificacion;
  nueva: boolean;
  hace: string;
  onIr: (n: Notificacion) => void;
  onOcultar: () => void;
}) {
  const t = useTranslations("notifications");
  const [expandida, setExpandida] = useState(false);
  const tituloRef = useRef<HTMLParagraphElement>(null);
  const mensajeRef = useRef<HTMLParagraphElement>(null);

  const alTocar = () => {
    if (expandida) setExpandida(false);
    else if (estaRecortado(tituloRef.current) || estaRecortado(mensajeRef.current)) setExpandida(true);
    else if (n.enlace) onIr(n);
  };
  const alTeclear = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      alTocar();
    }
  };

  return (
    <li className="group relative">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expandida}
        onClick={alTocar}
        onKeyDown={alTeclear}
        className={cn(
          "flex cursor-pointer gap-3 py-3 pl-4 pr-10 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60",
          expandida && "bg-muted/40"
        )}
      >
        <span className="mt-0.5">
          <IconoNotificacion n={n} nueva={nueva} />
        </span>
        <div className="min-w-0 flex-1">
          <p ref={tituloRef} className="text-sm font-medium leading-snug text-foreground">
            {n.titulo}
          </p>
          {n.mensaje && (
            <p
              ref={mensajeRef}
              className={cn(
                "mt-0.5 text-xs text-muted-foreground",
                expandida ? "whitespace-pre-line" : "line-clamp-2"
              )}
            >
              {n.mensaje}
            </p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground/80">{hace}</p>
          {expandida && n.enlace && <BotonAbrir enlace={n.enlace} onIr={() => onIr({ ...n, enlace: null })} />}
        </div>
      </div>
      {/* Fuera del área que expande: cerrar no navega. Visible al pasar el
          mouse, con el teclado, o siempre en pantallas sin hover. */}
      <button
        type="button"
        onClick={onOcultar}
        aria-label={t("dismissAria")}
        title={t("dismiss")}
        className="absolute right-2 top-2.5 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}

const ALTO_AVISO_MOVIL = 72;

/**
 * Un aviso en celular y tablet: misma regla que en escritorio. La pastilla
 * deslizable tiene alto fijo, así que al expandir se mide el texto y se le da
 * el alto que necesita (la pastilla anima el cambio).
 */
function AvisoMovil({
  n,
  hace,
  onIr,
  onOcultar,
  onOpenChange,
  icono,
}: {
  n: Notificacion;
  hace: string;
  onIr: (n: Notificacion) => void;
  onOcultar: () => Promise<unknown> | unknown;
  onOpenChange: (abierta: boolean) => void;
  icono: ReactNode;
}) {
  const t = useTranslations("notifications");
  const [expandida, setExpandida] = useState(false);
  const [alto, setAlto] = useState(ALTO_AVISO_MOVIL);
  const textoRef = useRef<HTMLDivElement>(null);
  const tituloRef = useRef<HTMLParagraphElement>(null);
  const mensajeRef = useRef<HTMLParagraphElement>(null);

  // Tras expandir (o recoger), el alto que pide el texto. Expandido, el bloque
  // ya lleva su aire arriba y abajo (`py-3`): su alto basta.
  useLayoutEffect(() => {
    const el = textoRef.current;
    const siguiente = expandida && el ? Math.max(ALTO_AVISO_MOVIL, Math.ceil(el.offsetHeight)) : ALTO_AVISO_MOVIL;
    setAlto(siguiente);
  }, [expandida, n.titulo, n.mensaje]);

  const alTocar = () => {
    if (expandida) setExpandida(false);
    else if (estaRecortado(tituloRef.current) || estaRecortado(mensajeRef.current)) setExpandida(true);
    else if (n.enlace) onIr(n);
  };

  return (
    <FilaDeslizable
      label={n.titulo}
      alto={alto}
      onOpenChange={onOpenChange}
      onTap={alTocar}
      acciones={[
        {
          id: "eliminar",
          etiqueta: t("delete"),
          color: COLOR_ELIMINAR,
          icono: <Trash2 size={18} strokeWidth={2} />,
          alElegir: () => void onOcultar(),
        },
      ]}
    >
      <span className={cn(expandida && "self-start pt-3")}>{icono}</span>
      <div ref={textoRef} className={cn("min-w-0 flex-1", expandida && "self-start py-3")} aria-expanded={expandida}>
        <p ref={tituloRef} className={cn("text-sm font-medium", expandida ? "leading-snug" : "truncate")}>
          {n.titulo}
        </p>
        {n.mensaje && (
          <p
            ref={mensajeRef}
            className={cn("text-xs text-muted-foreground", expandida ? "mt-0.5 whitespace-pre-line" : "truncate")}
          >
            {n.mensaje}
          </p>
        )}
        <p className="text-[11px] opacity-60">{hace}</p>
        {expandida && n.enlace && <BotonAbrir enlace={n.enlace} onIr={() => onIr({ ...n, enlace: null })} />}
      </div>
    </FilaDeslizable>
  );
}

/**
 * Campana del header. Al abrirla se marcan todas como leídas, pero las que
 * eran nuevas conservan su punto mientras el panel siga abierto (se compara
 * contra el corte de ANTES de abrir).
 *
 * Descartar (solo para este usuario, migración 109):
 * - escritorio: la X que aparece al pasar el mouse;
 * - celular y tablet: deslizar a la izquierda, la misma pastilla de Productos
 *   (`FilaDeslizable`), sin confirmación: quitar un aviso no borra nada.
 */
export function CampanaNotificaciones() {
  const t = useTranslations("notifications");
  const hace = (iso: string) => {
    const { clave, n } = tiempoTranscurrido(iso);
    return t(`ago.${clave}`, { count: n });
  };
  const { lista, leidoHasta, noLeidas, cargando, marcarLeidas, ocultar } = useNotificaciones();
  const esEscritorio = useEsEscritorio();
  const router = useRouter();
  const { verPista, alAbrir } = usePistaDeslizar();
  const [abierta, setAbierta] = useState(false);
  const [corteAlAbrir, setCorteAlAbrir] = useState<string | null>(null);

  const globo = etiquetaGlobo(noLeidas);

  const alCambiar = (abrir: boolean) => {
    setAbierta(abrir);
    if (abrir) {
      setCorteAlAbrir(leidoHasta);
      if (noLeidas > 0) void marcarLeidas();
    }
  };

  const esNueva = (n: Notificacion) =>
    !corteAlAbrir || new Date(n.creado_en).getTime() > new Date(corteAlAbrir).getTime();

  // Con `enlace` null solo cierra el panel: ya navega el `Link` de «Abrir».
  const abrirEnlace = (n: Notificacion) => {
    setAbierta(false);
    if (n.enlace) router.push(n.enlace);
  };

  return (
    <Popover open={abierta} onOpenChange={alCambiar}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200"
            aria-label={globo ? t("unreadAria", { count: noLeidas }) : t("title")}
          />
        }
      >
        <Bell className="h-4 w-4" />
        {globo && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-card">
            {globo}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b border-border/60 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{t("title")}</p>
            <div className="flex items-center gap-2">
              {lista.length > 0 && (
                <span className="text-xs text-muted-foreground">{t("latest", { n: lista.length })}</span>
              )}
              <BotonSonido />
            </div>
          </div>
          {!esEscritorio && verPista && lista.length > 0 && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t("swipeHint")}
            </p>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {cargando && lista.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("loading")}</p>
          ) : lista.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Bell className="h-6 w-6 text-muted-foreground/60" />
              <p className="text-sm font-medium">{t("empty")}</p>
              <p className="text-xs text-muted-foreground">
                {t("emptyDesc")}
              </p>
            </div>
          ) : esEscritorio ? (
            <ul className="divide-y divide-border/50">
              {lista.map((n) => (
                <AvisoEscritorio
                  key={n.id}
                  n={n}
                  nueva={esNueva(n)}
                  hace={hace(n.creado_en)}
                  onIr={abrirEnlace}
                  onOcultar={() => void ocultar(n.id)}
                />
              ))}
            </ul>
          ) : (
            <div className="space-y-2 p-2">
              {lista.map((n) => (
                <AvisoMovil
                  key={n.id}
                  n={n}
                  hace={hace(n.creado_en)}
                  onIr={abrirEnlace}
                  onOcultar={() => ocultar(n.id)}
                  onOpenChange={alAbrir}
                  icono={<IconoNotificacion n={n} nueva={esNueva(n)} />}
                />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Encender o apagar los tonos de ESTE navegador (ver `sonidos.ts`). */
function BotonSonido() {
  const t = useTranslations("notifications");
  const [activo, setActivo] = useState(true);
  useEffect(() => {
    // Lee la preferencia del navegador una vez montado (en el servidor no existe localStorage).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActivo(sonidoActivo());
  }, []);
  const alternar = () => {
    cambiarSonido(!activo);
    setActivo(!activo);
  };
  const etiqueta = activo ? t("sound.on") : t("sound.off");
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={etiqueta}
      title={etiqueta}
      aria-pressed={activo}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {activo ? <Volume2 className="h-3.5 w-3.5" aria-hidden="true" /> : <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />}
    </button>
  );
}
