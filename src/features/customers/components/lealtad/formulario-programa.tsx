"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
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
} from "@/components/ui/combobox";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useMoneda } from "@/hooks/use-moneda";
import { ICONO_SELLO, TarjetaVisual } from "@/features/lealtad/components/tarjeta-visual";
import { ACENTO_POR_DEFECTO, ICONOS_SELLO, iconoDeSello, paletaDeTarjeta } from "@/features/lealtad/lealtad";
import type { ProgramaInput } from "@/features/lealtad/lealtad-service";
import type { PaletaTarjeta, ProgramaLealtad, TipoPremio } from "@/features/lealtad/types";

/** Colores sugeridos para el acento; el selector libre queda al lado. */
const ACENTOS = ["#1E3A8A", "#047857", "#B45309", "#B91C1C", "#6D28D9", "#BE185D", "#0F766E"];
/** Fondos sugeridos (crema, rosa, menta, cafe, verde, indigo, negro); el selector libre queda al lado. */
const FONDOS = ["#FEF3C7", "#FCE7F3", "#DCFCE7", "#3B2416", "#064E3B", "#1E1B4B", "#0A0A0A"];

/** El texto de cada tipo es `customers.loyalty.form.rewardTypes.<tipo>`. */
const TIPOS: TipoPremio[] = ["producto", "monto", "porcentaje"];

interface ProductoOpcion {
  value: string;
  label: string;
}

function inicial(p: ProgramaLealtad | null): ProgramaInput {
  return {
    nombre: p?.nombre ?? "Tarjeta de lealtad",
    sellos_meta: p?.sellos_meta ?? 10,
    premio_descripcion: p?.premio_descripcion ?? "",
    premio_tipo: p?.premio_tipo ?? "producto",
    premio_producto_id: p?.premio_producto_id ?? null,
    premio_valor: p?.premio_valor != null ? Number(p.premio_valor) : null,
    compra_minima: Number(p?.compra_minima ?? 0),
    paleta: p?.paleta ?? "clara",
    color_acento: p?.color_acento ?? ACENTO_POR_DEFECTO,
    icono_sello: iconoDeSello(p?.icono_sello),
    color_fondo: p?.color_fondo ?? null,
    alta_publica: p?.alta_publica ?? false,
    aviso_privacidad_url: p?.aviso_privacidad_url ?? null,
    activo: p?.activo ?? true,
  };
}

/** Descripcion sugerida del premio segun lo elegido ("Café grande gratis"). */
function premioSugerido(
  tipo: TipoPremio,
  producto: string | undefined,
  valor: number | null,
  formatear: (n: number) => string
): string {
  if (tipo === "producto") return producto ? `${producto} gratis` : "";
  if (!valor) return "";
  return tipo === "monto" ? `${formatear(valor)} de descuento` : `${valor}% de descuento`;
}

/**
 * Configuracion del programa de lealtad, con vista previa en vivo de la
 * tarjeta. Solo `loyalty.manage` la edita; el resto del equipo la ve en
 * solo lectura (la base tambien lo exige: RLS de la migracion 115).
 */
export function FormularioPrograma({
  programa,
  puedeEditar,
  guardando,
  onGuardar,
}: {
  programa: ProgramaLealtad | null;
  puedeEditar: boolean;
  guardando: boolean;
  onGuardar: (input: ProgramaInput) => Promise<boolean>;
}) {
  const { tenantId, tenantName, tenantLogo } = useCurrentTenant();
  const t = useTranslations("customers.loyalty.form");
  const { formatear, simbolo } = useMoneda();
  const [form, setForm] = useState<ProgramaInput>(() => inicial(programa));
  // La descripcion se autocompleta hasta que el usuario la escribe a mano.
  const [descripcionManual, setDescripcionManual] = useState(Boolean(programa?.premio_descripcion));
  const [productos, setProductos] = useState<ProductoOpcion[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    let vigente = true;
    createSupabaseBrowserClient()
      .from("productos")
      .select("id, nombre")
      .eq("tenant_id", tenantId)
      .is("archivado_en", null)
      .order("nombre")
      .then(({ data }) => {
        if (!vigente) return;
        setProductos(((data ?? []) as { id: string; nombre: string }[]).map((p) => ({ value: p.id, label: p.nombre })));
      });
    return () => {
      vigente = false;
    };
  }, [tenantId]);

  const nombreProducto = productos.find((p) => p.value === form.premio_producto_id)?.label;
  const sugerida = premioSugerido(form.premio_tipo, nombreProducto, form.premio_valor, formatear);
  const descripcion = descripcionManual ? form.premio_descripcion : sugerida || form.premio_descripcion;

  const cambiar = <K extends keyof ProgramaInput>(campo: K, valor: ProgramaInput[K]) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  const problema = useMemo(() => {
    if (!form.nombre.trim()) return t("errors.name");
    if (!(form.sellos_meta >= 2 && form.sellos_meta <= 50)) return t("errors.goal");
    if (form.premio_tipo === "producto" && !form.premio_producto_id) return t("errors.product");
    if (form.premio_tipo !== "producto" && !(Number(form.premio_valor) > 0)) return t("errors.value");
    if (form.premio_tipo === "porcentaje" && Number(form.premio_valor) > 100) return t("errors.percent");
    if (!descripcion.trim()) return t("errors.description");
    const aviso = form.aviso_privacidad_url?.trim();
    if (aviso && !/^https:\/\/\S+$/.test(aviso)) return t("errors.privacyUrl");
    return null;
  }, [form, descripcion, t]);

  const guardar = () => {
    if (problema) return;
    void onGuardar({
      ...form,
      nombre: form.nombre.trim(),
      premio_descripcion: descripcion.trim(),
      aviso_privacidad_url: form.aviso_privacidad_url?.trim() || null,
    });
  };

  // Vista previa: un cliente de ejemplo con ~70% de sus sellos.
  const sellosEjemplo = Math.max(1, Math.round(form.sellos_meta * 0.7));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <fieldset disabled={!puedeEditar} className="space-y-5 disabled:opacity-80">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("name")}</Label>
            <Input
              value={form.nombre}
              maxLength={60}
              onChange={(e) => cambiar("nombre", e.target.value)}
              placeholder={t("namePlaceholder")}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("goal")}</Label>
            <Input
              type="number"
              min={2}
              max={50}
              value={form.sellos_meta}
              onChange={(e) => cambiar("sellos_meta", Math.round(Number(e.target.value) || 0))}
              className="h-8 text-sm font-mono"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">{t("reward")}</Label>
          <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-muted p-1">
            {TIPOS.map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => cambiar("premio_tipo", tipo)}
                className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  form.premio_tipo === tipo ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`rewardTypes.${tipo}`, { simbolo })}
              </button>
            ))}
          </div>

          {form.premio_tipo === "producto" ? (
            <Combobox
              items={productos}
              value={form.premio_producto_id ?? ""}
              onValueChange={(v) => cambiar("premio_producto_id", (v as string) || null)}
              itemToStringLabel={(v) => productos.find((p) => p.value === v)?.label ?? ""}
              filter={(item, query) =>
                (item as unknown as ProductoOpcion).label.toLowerCase().includes(query.toLowerCase())
              }
            >
              <ComboboxInputGroup className="h-8">
                <ComboboxInput placeholder={t("productSearch")} />
                <ComboboxTrigger />
              </ComboboxInputGroup>
              <ComboboxPortal>
                <ComboboxPositioner>
                  <ComboboxPopup>
                    <ComboboxEmpty>{t("noProducts")}</ComboboxEmpty>
                    <ComboboxList>
                      {(p: ProductoOpcion) => (
                        <ComboboxItem key={p.value} value={p.value}>
                          <ComboboxItemIndicator />
                          <span>{p.label}</span>
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxPopup>
                </ComboboxPositioner>
              </ComboboxPortal>
            </Combobox>
          ) : (
            <Input
              type="number"
              min={0}
              step={form.premio_tipo === "monto" ? "0.01" : "1"}
              value={form.premio_valor ?? ""}
              onChange={(e) => cambiar("premio_valor", e.target.value === "" ? null : Number(e.target.value))}
              placeholder={form.premio_tipo === "monto" ? t("amountPlaceholder") : t("percentPlaceholder")}
              className="h-8 text-sm font-mono"
            />
          )}
          <p className="text-[11px] text-muted-foreground">
            {form.premio_tipo === "producto"
              ? t("productHint")
              : t("discountHint")}
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("description")}</Label>
            <Input
              value={descripcion}
              maxLength={80}
              onChange={(e) => {
                setDescripcionManual(true);
                cambiar("premio_descripcion", e.target.value);
              }}
              placeholder={t("descriptionPlaceholder")}
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t("minPurchase")}</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.compra_minima}
            onChange={(e) => cambiar("compra_minima", Math.max(0, Number(e.target.value) || 0))}
            className="h-8 max-w-40 text-sm font-mono"
          />
          <p className="text-[11px] text-muted-foreground">
            {t("minPurchaseHint")}
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">{t("stamp")}</Label>
          <div className="grid grid-cols-7 gap-1.5" role="radiogroup" aria-label={t("stampDrawing")}>
            {ICONOS_SELLO.map(({ valor }) => {
              const texto = t(`icons.${valor}`);
              const Icono = ICONO_SELLO[valor];
              const elegido = form.icono_sello === valor;
              return (
                <button
                  key={valor}
                  type="button"
                  role="radio"
                  aria-checked={elegido}
                  aria-label={texto}
                  title={texto}
                  onClick={() => cambiar("icono_sello", valor)}
                  className={`flex aspect-square items-center justify-center rounded-lg border-2 transition-colors ${
                    elegido ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-muted-foreground/40"
                  }`}
                >
                  <Icono className="h-4 w-4" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">{t("background")}</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["clara", "oscura"] as PaletaTarjeta[]).map((paleta) => {
              const c = paletaDeTarjeta(paleta, form.color_acento);
              // Una paleta elegida quita el fondo propio.
              const elegida = form.paleta === paleta && !form.color_fondo;
              return (
                <button
                  key={paleta}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, paleta, color_fondo: null }))}
                  className={`flex items-center gap-2 rounded-xl border-2 p-2.5 text-left text-xs font-medium transition-colors ${
                    elegida ? "border-primary" : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <span
                    className="flex h-9 w-14 shrink-0 items-center justify-center gap-1 rounded-lg border"
                    style={{ backgroundColor: c.fondo, borderColor: c.borde }}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.acento }} />
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.acento }} />
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.vacio }} />
                  </span>
                  {paleta === "clara" ? t("light") : t("dark")}
                  {elegida && <Check className="ml-auto h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{t("orYourColor")}</span>
            {FONDOS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => cambiar("color_fondo", color)}
                aria-label={t("backgroundColor", { color })}
                className={`h-7 w-7 rounded-full border-2 transition-transform ${
                  form.color_fondo?.toUpperCase() === color ? "scale-110 border-foreground" : "border-border"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
            <input
              type="color"
              value={form.color_fondo ?? "#FFFFFF"}
              onChange={(e) => cambiar("color_fondo", e.target.value.toUpperCase())}
              aria-label={t("otherBackground")}
              className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent"
            />
          </div>
          {form.color_fondo && (
            <p className="text-[11px] text-muted-foreground">{t("textAdjusts")}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs">{t("stampColor")}</Label>
          <div className="flex flex-wrap items-center gap-2">
            {ACENTOS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => cambiar("color_acento", color)}
                aria-label={t("colorNamed", { color })}
                className={`h-7 w-7 rounded-full border-2 transition-transform ${
                  form.color_acento?.toUpperCase() === color ? "scale-110 border-foreground" : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
            <input
              type="color"
              value={form.color_acento ?? ACENTO_POR_DEFECTO}
              onChange={(e) => cambiar("color_acento", e.target.value.toUpperCase())}
              aria-label={t("otherColor")}
              className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent"
            />
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-border px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{t("qrSignup")}</p>
              <p className="text-[11px] text-muted-foreground">
                {t("qrSignupDesc")}
              </p>
            </div>
            <Switch checked={form.alta_publica} onCheckedChange={(v) => cambiar("alta_publica", Boolean(v))} />
          </div>
          {form.alta_publica && (
            <div className="space-y-1.5 border-t border-border pt-2">
              <Label className="text-xs">{t("privacyUrl")}</Label>
              <Input
                type="url"
                inputMode="url"
                value={form.aviso_privacidad_url ?? ""}
                maxLength={300}
                onChange={(e) => cambiar("aviso_privacidad_url", e.target.value || null)}
                placeholder={t("privacyUrlPlaceholder")}
                className="h-8 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                {t("privacyHint")}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">{t("active")}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("activeHint")}
            </p>
          </div>
          <Switch checked={form.activo} onCheckedChange={(v) => cambiar("activo", Boolean(v))} />
        </div>

        {puedeEditar ? (
          <div className="flex items-center gap-3">
            <Button type="button" onClick={guardar} disabled={guardando || Boolean(problema)} className="gap-1.5">
              {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
              {programa ? t("saveChanges") : t("create")}
            </Button>
            {problema && <p className="text-xs text-muted-foreground">{problema}</p>}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("readOnly")}
          </p>
        )}
      </fieldset>

      <div className="flex flex-col items-center gap-2">
        <p className="self-start text-xs font-medium text-muted-foreground lg:self-center">{t("preview")}</p>
        <TarjetaVisual
          compacta
          datos={{
            negocio: tenantName,
            logoUrl: tenantLogo,
            programa: form.nombre || "Tarjeta de lealtad",
            paleta: form.paleta,
            colorAcento: form.color_acento,
            iconoSello: form.icono_sello,
            colorFondo: form.color_fondo,
            sellos: sellosEjemplo,
            sellosMeta: Math.min(50, Math.max(2, form.sellos_meta || 2)),
            premio: descripcion || "tu premio",
            cliente: "Ana",
            activa: true,
          }}
        />
      </div>
    </div>
  );
}
