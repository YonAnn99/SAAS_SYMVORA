"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TelefonoInput } from "@/components/ui/telefono-input";
import { aE164, desdeE164 } from "@/lib/telefono";
import { urlWhatsApp } from "@/lib/whatsapp";
import { mensajeErrorCatalogo, subirPortadaCatalogo } from "../catalogo-service";
import { limpiarSlugTecleado, slugValido, SLUG_MIN } from "../slug";
import type { CatalogoConfig } from "../types";

const MENSAJE_MAX = 200;
const AZUL_SYMVORA = "#1E3A8A";
/** Colores sugeridos: todos con buen contraste con texto blanco. */
const MUESTRAS = ["#1E3A8A", "#0F766E", "#15803D", "#B91C1C", "#C2410C", "#7C3AED", "#BE185D", "#0F172A"];
const PATRON_COLOR = /^#[0-9a-f]{6}$/i;

/** ¿El texto blanco se lee sobre este color? (misma cuenta que la página). */
function contrastaConBlanco(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b <= 0.45;
}

/**
 * Pestaña «Personalizar»: color, portada, enlace, WhatsApp, mensaje y qué se
 * muestra. Se guarda con un botón (no al teclear).
 */
export function PersonalizarCatalogo({
  tenantId,
  guardado,
  borrador,
  guardar,
}: {
  tenantId: string;
  guardado: CatalogoConfig | null;
  borrador: CatalogoConfig;
  guardar: (config: CatalogoConfig) => Promise<CatalogoConfig>;
}) {
  const telefono = desdeE164(borrador.whatsapp);
  const [color, setColor] = useState(borrador.color ?? "");
  const [portada, setPortada] = useState<string | null>(borrador.portada_url);
  const [subiendo, setSubiendo] = useState(false);
  const [slug, setSlug] = useState(borrador.slug);
  const [pais, setPais] = useState(telefono.pais);
  const [numero, setNumero] = useState(telefono.numero);
  const [mensaje, setMensaje] = useState(borrador.mensaje ?? "");
  const [mostrarPrecios, setMostrarPrecios] = useState(borrador.mostrar_precios);
  const [mostrarAgotados, setMostrarAgotados] = useState(borrador.mostrar_agotados);
  const [guardando, setGuardando] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  const slugListo = slug.replace(/-+$/, "");
  const whatsapp = numero.trim() ? aE164(pais, numero) : null;
  const colorListo = color.trim() ? color.trim() : null;
  const errorSlug = slugValido(slugListo) ? null : `Usa de ${SLUG_MIN} a 40 letras, números o guiones (ejemplo: mi-tienda).`;
  const errorWhatsapp = numero.trim() && !whatsapp ? "Revisa el número: no parece un celular válido." : null;
  const errorColor = colorListo && !PATRON_COLOR.test(colorListo) ? "Usa un color como #1E3A8A." : null;
  const colorVista = colorListo && !errorColor ? colorListo : AZUL_SYMVORA;

  const cambios =
    !guardado ||
    guardado.slug !== slugListo ||
    (guardado.whatsapp ?? null) !== whatsapp ||
    guardado.mostrar_precios !== mostrarPrecios ||
    guardado.mostrar_agotados !== mostrarAgotados ||
    (guardado.mensaje ?? "") !== mensaje.trim() ||
    (guardado.color ?? null) !== colorListo ||
    (guardado.portada_url ?? null) !== portada;

  const elegirPortada = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Elige una imagen");
    setSubiendo(true);
    try {
      setPortada(await subirPortadaCatalogo(file, tenantId));
    } catch {
      toast.error("No se pudo subir la portada");
    } finally {
      setSubiendo(false);
      if (archivo.current) archivo.current.value = "";
    }
  };

  const guardarCambios = async () => {
    if (errorSlug) return toast.error(errorSlug);
    if (errorWhatsapp) return toast.error(errorWhatsapp);
    if (errorColor) return toast.error(errorColor);
    const activo = guardado?.activo ?? false;
    if (activo && !whatsapp) return toast.error("Un catálogo publicado necesita el WhatsApp que recibe los pedidos");
    setGuardando(true);
    try {
      await guardar({
        ...borrador,
        activo,
        slug: slugListo,
        whatsapp,
        mostrar_precios: mostrarPrecios,
        mostrar_agotados: mostrarAgotados,
        mensaje: mensaje.trim() ? mensaje.trim().slice(0, MENSAJE_MAX) : null,
        color: colorListo,
        portada_url: portada,
      });
      setSlug(slugListo);
      toast.success("Catálogo guardado");
    } catch (error) {
      toast.error(mensajeErrorCatalogo(error));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Imagen y color</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Vista de cómo queda el encabezado */}
          <div
            className="relative flex h-32 items-end overflow-hidden rounded-xl p-4 text-white"
            style={{ backgroundColor: colorVista }}
          >
            {portada && (
              <>
                <Image src={portada} alt="" fill unoptimized sizes="600px" className="object-cover" />
                <div
                  className="absolute inset-0"
                  style={{ background: `linear-gradient(to top, ${colorVista}f2 0%, ${colorVista}99 45%, ${colorVista}33 100%)` }}
                />
              </>
            )}
            <p className="relative text-lg font-bold">Así se ve el encabezado</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Portada (opcional)</Label>
            <div className="flex flex-wrap gap-2">
              <input
                ref={archivo}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void elegirPortada(e.target.files?.[0])}
              />
              <Button size="sm" variant="outline" disabled={subiendo} onClick={() => archivo.current?.click()}>
                {subiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                {portada ? "Cambiar portada" : "Subir portada"}
              </Button>
              {portada && (
                <Button size="sm" variant="outline" onClick={() => setPortada(null)}>
                  <Trash2 className="h-3.5 w-3.5" /> Quitar
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Una foto de tu local o tus productos. Se recorta a lo ancho (3:1). Sin portada se usa el color.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="catalogo-color" className="text-xs">
              Color del catálogo
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              {MUESTRAS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setColor(m)}
                  aria-label={`Color ${m}`}
                  aria-pressed={colorVista.toLowerCase() === m.toLowerCase()}
                  className="h-8 w-8 rounded-full border-2 border-transparent ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-foreground"
                  style={{ backgroundColor: m }}
                />
              ))}
              <input
                id="catalogo-color"
                type="color"
                value={colorVista}
                onChange={(e) => setColor(e.target.value.toUpperCase())}
                className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent"
                aria-label="Elegir otro color"
              />
              {colorListo && (
                <button type="button" onClick={() => setColor("")} className="text-xs text-muted-foreground underline">
                  Usar el de mi negocio
                </button>
              )}
            </div>
            {errorColor ? (
              <p className="text-[11px] text-destructive">{errorColor}</p>
            ) : (
              !contrastaConBlanco(colorVista) && (
                <p className="text-[11px] text-amber-600">
                  Es un color claro: el texto del encabezado se pondrá oscuro. Con portada, mejor uno oscuro.
                </p>
              )
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Enlace y contacto</CardTitle>
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
              <p className="text-[11px] text-muted-foreground">Si lo cambias, el enlace anterior deja de funcionar.</p>
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
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => void guardarCambios()} disabled={guardando || subiendo || !cambios}>
          {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
