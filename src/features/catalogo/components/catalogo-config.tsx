"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import { Copy, ExternalLink, Loader2, Share2, Store } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TelefonoInput } from "@/components/ui/telefono-input";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useIsDemo } from "@/hooks/use-is-demo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { aE164, desdeE164, PAIS_POR_DEFECTO } from "@/lib/telefono";
import { normalizarTelefonoMx, urlWhatsApp } from "@/lib/whatsapp";
import { qrSvg } from "@/features/lealtad/qr";
import { cn } from "@/lib/utils";
import { guardarConfigCatalogo, mensajeErrorCatalogo, obtenerConfigCatalogo } from "../catalogo-service";
import { limpiarSlugTecleado, slugDesdeNombre, slugValido, urlCatalogo, SLUG_MIN } from "../slug";
import type { CatalogoConfig } from "../types";

const MENSAJE_MAX = 200;

/** Slug inicial: el nombre del negocio, o uno genérico si el nombre no sirve. */
function slugInicial(nombre: string, tenantId: string): string {
  const desdeNombre = slugDesdeNombre(nombre);
  return slugValido(desdeNombre) ? desdeNombre : `negocio-${tenantId.slice(0, 6)}`;
}

/**
 * Configuración → Catálogo en línea (migración 124): encender el catálogo, el
 * enlace público, el WhatsApp que recibe los pedidos y qué se muestra. Los
 * productos se ocultan uno por uno desde Productos.
 */
export function CatalogoConfigPanel() {
  const locale = useLocale();
  const esDemo = useIsDemo();
  const { tenantId, tenantName } = useCurrentTenant();
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState<CatalogoConfig | null>(null);

  const [activo, setActivo] = useState(false);
  const [slug, setSlug] = useState("");
  const [pais, setPais] = useState(PAIS_POR_DEFECTO);
  const [numero, setNumero] = useState("");
  const [mostrarPrecios, setMostrarPrecios] = useState(true);
  const [mostrarAgotados, setMostrarAgotados] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    let vigente = true;
    void (async () => {
      try {
        const config = await obtenerConfigCatalogo(tenantId);
        let telefono = config?.whatsapp ?? null;
        if (!telefono) {
          // Primera vez: se propone el teléfono del negocio si es un celular válido.
          const { data } = await createSupabaseBrowserClient()
            .from("tenants")
            .select("telefono")
            .eq("id", tenantId)
            .maybeSingle();
          const mx = normalizarTelefonoMx(data?.telefono);
          telefono = mx ? `+${mx}` : null;
        }
        if (!vigente) return;
        const tel = desdeE164(telefono);
        setGuardado(config);
        setActivo(config?.activo ?? false);
        setSlug(config?.slug ?? slugInicial(tenantName, tenantId));
        setPais(tel.pais);
        setNumero(tel.numero);
        setMostrarPrecios(config?.mostrar_precios ?? true);
        setMostrarAgotados(config?.mostrar_agotados ?? true);
        setMensaje(config?.mensaje ?? "");
      } catch {
        if (vigente) toast.error("No se pudo cargar el catálogo");
      } finally {
        if (vigente) setCargando(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [tenantId, tenantName]);

  const enlacePublicado = guardado?.activo ? urlCatalogo(guardado.slug, locale) : null;

  useEffect(() => {
    if (!enlacePublicado) return;
    let vigente = true;
    void qrSvg(enlacePublicado).then((s) => vigente && setSvg(s));
    return () => {
      vigente = false;
    };
  }, [enlacePublicado]);

  const slugListo = slug.replace(/-+$/, "");
  const whatsapp = numero.trim() ? aE164(pais, numero) : null;
  const errorSlug = slugValido(slugListo)
    ? null
    : `Usa de ${SLUG_MIN} a 40 letras, números o guiones (ejemplo: mi-tienda).`;
  const errorWhatsapp = numero.trim() && !whatsapp ? "Revisa el número: no parece un celular válido." : null;

  const guardar = async (activoNuevo = activo) => {
    if (!tenantId) return;
    if (errorSlug) return toast.error(errorSlug);
    if (errorWhatsapp) return toast.error(errorWhatsapp);
    if (activoNuevo && !whatsapp) return toast.error("Escribe el WhatsApp que recibirá los pedidos");
    setGuardando(true);
    try {
      const nuevo = await guardarConfigCatalogo({
        tenant_id: tenantId,
        activo: activoNuevo,
        slug: slugListo,
        whatsapp,
        mostrar_precios: mostrarPrecios,
        mostrar_agotados: mostrarAgotados,
        mensaje: mensaje.trim() ? mensaje.trim().slice(0, MENSAJE_MAX) : null,
      });
      setGuardado(nuevo);
      setActivo(nuevo.activo);
      setSlug(nuevo.slug);
      toast.success(
        nuevo.activo === (guardado?.activo ?? false)
          ? "Catálogo guardado"
          : nuevo.activo
            ? "¡Tu catálogo ya está en línea!"
            : "Catálogo apagado: el enlace ya no muestra productos"
      );
    } catch (error) {
      setActivo(guardado?.activo ?? false);
      toast.error(mensajeErrorCatalogo(error));
    } finally {
      setGuardando(false);
    }
  };

  const copiar = async () => {
    if (!enlacePublicado) return;
    try {
      await navigator.clipboard.writeText(enlacePublicado);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  if (esDemo) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          El catálogo en línea no está disponible en la demo. Crea tu cuenta gratis para publicar el tuyo.
        </CardContent>
      </Card>
    );
  }

  if (cargando) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cambios =
    !guardado ||
    guardado.slug !== slugListo ||
    (guardado.whatsapp ?? null) !== whatsapp ||
    guardado.mostrar_precios !== mostrarPrecios ||
    guardado.mostrar_agotados !== mostrarAgotados ||
    (guardado.mensaje ?? "") !== mensaje.trim();

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-start justify-between gap-4 py-4">
          <div className="min-w-0 space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Store className="h-4 w-4 text-muted-foreground" />
              Catálogo en línea
            </p>
            <p className="text-xs text-muted-foreground">
              Una página con tus productos, precios y disponibilidad. Tus clientes arman su pedido y te lo mandan por
              WhatsApp. No cobra en línea ni descuenta inventario: tú confirmas y cobras como siempre.
            </p>
          </div>
          <Switch
            checked={activo}
            disabled={guardando}
            onCheckedChange={(checked) => {
              setActivo(checked);
              void guardar(checked);
            }}
            aria-label="Publicar catálogo en línea"
          />
        </CardContent>
      </Card>

      {enlacePublicado && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Comparte tu catálogo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div
              className="mx-auto w-32 shrink-0 rounded-xl border border-border bg-white p-2.5 sm:mx-0 [&_svg]:h-auto [&_svg]:w-full"
              // SVG generado aquí con `qrcode` a partir del enlace público.
              dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
            />
            <div className="min-w-0 flex-1 space-y-3">
              <p className="break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs">{enlacePublicado}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void copiar()}>
                  <Copy className="h-3.5 w-3.5" /> Copiar enlace
                </Button>
                <a
                  href={enlacePublicado}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir catálogo
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Mira nuestro catálogo y haz tu pedido: ${enlacePublicado}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                >
                  <Share2 className="h-3.5 w-3.5" /> Compartir por WhatsApp
                </a>
              </div>
              <p className="text-xs text-muted-foreground">
                Ponlo en tu estado de WhatsApp, en Facebook o imprime el QR para tu mostrador.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Ajustes del catálogo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="catalogo-slug" className="text-xs">
              Enlace de tu catálogo
            </Label>
            <div className="flex min-w-0 items-center overflow-hidden rounded-lg border border-input focus-within:ring-2 focus-within:ring-ring/40">
              <span className="shrink-0 bg-muted px-2.5 py-2 text-xs text-muted-foreground max-sm:hidden">
                symvora.com.mx/catalogo/
              </span>
              <input
                id="catalogo-slug"
                value={slug}
                onChange={(e) => setSlug(limpiarSlugTecleado(e.target.value))}
                className="h-9 min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            {errorSlug ? (
              <p className="text-[11px] text-destructive">{errorSlug}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Si lo cambias, el enlace anterior deja de funcionar.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="catalogo-whatsapp" className="text-xs">
              WhatsApp que recibe los pedidos
            </Label>
            <TelefonoInput
              id="catalogo-whatsapp"
              pais={pais}
              numero={numero}
              onPaisChange={setPais}
              onNumeroChange={setNumero}
              invalido={Boolean(errorWhatsapp)}
              placeholder="55 1234 5678"
            />
            {errorWhatsapp ? (
              <p className="text-[11px] text-destructive">{errorWhatsapp}</p>
            ) : (
              whatsapp && (
                <a
                  href={urlWhatsApp(whatsapp.replace(/\D/g, ""), "Prueba del catálogo en línea")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary underline-offset-2 hover:underline"
                >
                  Probar que abre el chat correcto
                </a>
              )
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="catalogo-mensaje" className="text-xs">
              Mensaje de bienvenida (opcional)
            </Label>
            <Textarea
              id="catalogo-mensaje"
              value={mensaje}
              maxLength={MENSAJE_MAX}
              rows={2}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Ej. Entregas a domicilio en la colonia. Horario de 9 a 8."
            />
            <p className="text-right text-[11px] text-muted-foreground">
              {mensaje.length}/{MENSAJE_MAX}
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-xs">Mostrar precios</Label>
              <p className="text-[11px] text-muted-foreground">Apagado, tus clientes preguntan el precio en el pedido.</p>
            </div>
            <Switch checked={mostrarPrecios} onCheckedChange={setMostrarPrecios} aria-label="Mostrar precios" />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-xs">Mostrar productos agotados</Label>
              <p className="text-[11px] text-muted-foreground">Salen al final, marcados como «Agotado».</p>
            </div>
            <Switch checked={mostrarAgotados} onCheckedChange={setMostrarAgotados} aria-label="Mostrar productos agotados" />
          </div>

          <p className="text-[11px] text-muted-foreground">
            Se publican todos tus productos activos. Para ocultar uno, edítalo en Productos y apaga «Mostrar en el
            catálogo en línea».
          </p>

          <div className="flex justify-end">
            <Button onClick={() => void guardar()} disabled={guardando || !cambios || Boolean(errorSlug)}>
              {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
