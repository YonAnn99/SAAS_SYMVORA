"use client";

import { CLAVES_MODULO, normalizarModulos, type ClaveModulo } from "@/lib/modulos";
import { useModulos } from "@/hooks/use-modulos";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Building2, Printer, Puzzle, Smartphone } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { MercadoPagoPointSettings } from "@/features/payments/components/mercado-pago-point-settings";
import { ImpresoraConfig } from "@/features/pos/components/impresora-config";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useTenantContext } from "@/contexts/tenant-context";
import { toast } from "sonner";
import { FileUpload } from "@/components/ui/file-upload";
import { AvisoDerechosLogo } from "@/components/compliance/aviso-derechos-logo";
import { subirLogoNegocio } from "@/lib/logo-negocio";
import type { Tenant, TenantSettingsJSON } from "@/lib/types/database";
import { EncabezadoModulo } from "@/components/dashboard/encabezado-modulo";
import { SelectSimple } from "@/components/ui/select-simple";
import { useConfirmar } from "@/components/ui/confirmar";
import { MONEDAS, formatMoneda, monedaDe, type Moneda } from "@/lib/money";

const PESTANAS = ["general", "modules", "payments", "printer"];

/** Pestaña de Configuración: en celular, menos relleno para que las cuatro quepan. */
const CLASE_PESTANA = "gap-1.5 text-xs max-sm:group-data-[variant=default]/tabs-list:px-1.5";

export default function SettingsPage() {
  // La pestaña sale de `?tab=`: asi /settings/payments (que redirige con
  // ?tab=payments) abre directo la de Mercado Pago, y al recargar se queda en
  // la misma.
  const searchParams = useSearchParams();
  const [pestana, setPestana] = useState(() => {
    const pedida = searchParams.get("tab");
    return pedida && PESTANAS.includes(pedida) ? pedida : "general";
  });
  const cambiarPestana = (valor: unknown) => {
    const siguiente = typeof valor === "string" ? valor : "general";
    setPestana(siguiente);
    // Sin navegar: solo deja la URL al dia para recargar o compartir.
    const url = new URL(window.location.href);
    if (siguiente === "general") url.searchParams.delete("tab");
    else url.searchParams.set("tab", siguiente);
    window.history.replaceState(null, "", url);
  };
  const t = useTranslations();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const { setModulo, setTerminalExterna } = useModulos();
  const { refetch: refetchTenantContext } = useTenantContext();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [settings, setSettings] = useState<TenantSettingsJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("MXN");
  const confirmar = useConfirmar();

  useEffect(() => {
    if (tenantLoading || !tenantId) return;

    const fetchData = async () => {
      const supabase = createSupabaseBrowserClient();

      const { data: tenantData } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", tenantId)
        .single();

      if (tenantData) {
        setTenant(tenantData);
        setCompanyName(tenantData.nombre_comercial || "");
        setPhone(tenantData.telefono || "");
        setAddress(tenantData.direccion || "");
        setEmail(tenantData.email || "");
        setMoneda(monedaDe(tenantData.moneda));
      }

      const { data: settingsData } = await supabase
        .from("tenant_settings")
        .select("configuracion_json")
        .eq("tenant_id", tenantId)
        .single();

      if (settingsData) {
        setSettings(settingsData.configuracion_json as TenantSettingsJSON);
      }

      setLoading(false);
    };

    fetchData();
  }, [tenantLoading, tenantId]);

  const handleSaveCompany = async () => {
    if (!tenant) return;
    const supabase = createSupabaseBrowserClient();

    // Cambiar la moneda NO convierte montos: si ya hay ventas, se avisa antes.
    const monedaAnterior = monedaDe(tenant.moneda);
    if (moneda !== monedaAnterior) {
      const { count } = await supabase
        .from("ventas")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id);
      if ((count ?? 0) > 0) {
        const si = await confirmar({
          titulo: t("settings.currency.confirmTitle"),
          descripcion: t("settings.currency.confirmDesc", {
            antes: formatMoneda(100, monedaAnterior),
            despues: formatMoneda(100, moneda),
          }),
          accion: t("settings.currency.confirmAction"),
          tono: "aviso",
        });
        if (!si) return;
      }
    }

    setSaving(true);
    const { error } = await supabase
      .from("tenants")
      .update({
        nombre_comercial: companyName,
        telefono: phone,
        direccion: address,
        email: email,
        moneda,
      })
      .eq("id", tenant.id);

    if (error) {
      toast.error(t("settings.msg.saveError", { error: error.message }));
    } else {
      toast.success(t("settings.msg.saved"));
      setTenant({ ...tenant, moneda });
      // El menu lateral y el dock leen el nombre del contexto del negocio.
      void refetchTenantContext();
    }
    setSaving(false);
  };

  const handleLogoUpload = async (file: File) => {
    if (!tenant) return;
    setLogoUploading(true);

    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error(t("settings.msg.noUser"));
      setLogoUploading(false);
      return;
    }

    try {
      let logoUrl: string;
      try {
        logoUrl = await subirLogoNegocio(supabase, user.id, file);
      } catch (err) {
        toast.error(
          t("settings.msg.logoUploadError", {
            error: err instanceof Error ? err.message : t("settings.msg.tryAgain"),
          })
        );
        return;
      }

      const { error: updateError } = await supabase
        .from("tenants")
        .update({ logo_url: logoUrl })
        .eq("id", tenant.id);

      if (updateError) {
        toast.error(t("settings.msg.logoSaveError", { error: updateError.message }));
        return;
      }

      setTenant({ ...tenant, logo_url: logoUrl });
      void refetchTenantContext();
      toast.success(t("settings.msg.logoUpdated"));
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoRemove = async () => {
    if (!tenant) return;
    setLogoUploading(true);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("tenants")
      .update({ logo_url: null })
      .eq("id", tenant.id);

    if (error) {
      toast.error(t("settings.msg.logoRemoveError", { error: error.message }));
    } else {
      setTenant({ ...tenant, logo_url: null });
      void refetchTenantContext();
      toast.success(t("settings.msg.logoRemoved"));
    }
    setLogoUploading(false);
  };

  const handleToggleModule = async (module: ClaveModulo, value: boolean) => {
    if (!tenant || !settings) return;
    // El resto del sistema lee los modulos de un store compartido: se
    // actualiza ya, para que el POS y Productos cambien sin recargar.
    setModulo(module, value);

    const newSettings = {
      ...settings,
      modulos_activos: {
        ...settings.modulos_activos,
        [module]: value,
      },
    };

    setSettings(newSettings);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("tenant_settings")
      .update({ configuracion_json: newSettings })
      .eq("tenant_id", tenant.id);

    if (error) {
      setModulo(module, !value);
      toast.error(t("settings.msg.moduleError", { error: error.message }));
    }
  };

  // Terminal de tarjeta NO integrada (banco, Clip...). Mismo escritor que los
  // modulos (`settings` + un solo update del jsonb) para no pisarse entre si.
  const handleToggleTerminalExterna = async (value: boolean) => {
    if (!tenant || !settings) return;
    setTerminalExterna(value);

    const newSettings: TenantSettingsJSON = {
      ...settings,
      pos_config: { ...(settings.pos_config ?? {}), terminal_externa: value },
    };
    setSettings(newSettings);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("tenant_settings")
      .update({ configuracion_json: newSettings })
      .eq("tenant_id", tenant.id);

    if (error) {
      setTerminalExterna(!value);
      setSettings(settings);
      toast.error(t("settings.msg.terminalError", { error: error.message }));
    }
  };

  if (!tenantLoading && !tenantId) {
    return (
      <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
        {t("settings.notFound")}
      </div>
    );
  }

  if (tenantLoading || loading) {
    return (
      <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="animate-fade-in-up stagger-1">
        <EncabezadoModulo
          titulo={t("settings.title")}
          descripcion={t("settings.subtitle")}
        />
      </div>

      <Tabs
        value={pestana}
        onValueChange={cambiarPestana}
        className="w-full animate-fade-in-up stagger-2"
      >
        {/* En celular: a todo el ancho, sin íconos, con menos relleno y
            «Mercado Pago» corto (como Productos y Reportes). Con íconos y
            «Mercado Pago Point» la lista medía más que la pantalla y toda la
            página se desplazaba de lado. */}
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="general" className={CLASE_PESTANA}>
            <Building2 className="h-3.5 w-3.5 max-sm:hidden" />
            {t("settings.general")}
          </TabsTrigger>
          <TabsTrigger id="settings-tab-modules" value="modules" className={CLASE_PESTANA}>
            <Puzzle className="h-3.5 w-3.5 max-sm:hidden" />
            {t("settings.modules")}
          </TabsTrigger>
          {/* Antes era el modulo "Metodos de pago" del menu (/settings/payments,
              que ahora redirige aqui). */}
          <TabsTrigger value="payments" className={CLASE_PESTANA}>
            <Smartphone className="h-3.5 w-3.5 max-sm:hidden" />
            <span className="sm:hidden">Mercado Pago</span>
            <span className="max-sm:hidden">{t("settings.mercadoPagoPoint")}</span>
          </TabsTrigger>
          {/* Antes era un boton en la barra del Punto de venta. */}
          <TabsTrigger value="printer" className={CLASE_PESTANA}>
            <Printer className="h-3.5 w-3.5 max-sm:hidden" />
            {t("settings.printer")}
          </TabsTrigger>
        </TabsList>

        {/* General settings */}
        <TabsContent value="general">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">{t("settings.company")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="companyName" className="text-xs">
                      {t("settings.companyName")}
                    </Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs">{t("common.email")}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs">{t("common.phone")}</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="currency" className="text-xs">{t("settings.currency.label")}</Label>
                    <SelectSimple
                      id="currency"
                      value={moneda}
                      onChange={(v) => setMoneda(monedaDe(v))}
                      opciones={MONEDAS.map((m) => ({ value: m, label: t(`settings.currency.options.${m}`) }))}
                    />
                    <p className="text-[11px] text-muted-foreground">{t("settings.currency.hint")}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="address" className="text-xs">{t("common.address")}</Label>
                    <Input
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <SpecularActionButton tone="add" onClick={handleSaveCompany} disabled={saving} className="h-8 active:scale-[0.98] transition-transform">

                    {saving ? t("common.loading") : t("common.save")}
                  </SpecularActionButton>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">{t("settings.logo")}</CardTitle>
              </CardHeader>
              <CardContent>
                <FileUpload
                  preview={tenant?.logo_url ?? null}
                  onFileSelect={handleLogoUpload}
                  onFileRemove={handleLogoRemove}
                  dragDropText={t("auth.logoDragDrop")}
                  maxSizeText={t("auth.logoMaxSize")}
                />
                <AvisoDerechosLogo />
                {logoUploading && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("common.loading")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Modules settings */}
        <TabsContent value="modules">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{t("settings.modules")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <p className="pb-2 text-[11px] text-muted-foreground">
                {t("settings.modulesHint")}
              </p>
              {settings &&
                CLAVES_MODULO.map((key, i) => {
                  // Lo que no este guardado cuenta como encendido (`normalizarModulos`).
                  const activo = normalizarModulos(settings.modulos_activos)[key];
                  return (
                    <div key={key}>
                      {i > 0 && <Separator />}
                      <div className="flex items-center justify-between gap-4 py-3">
                        <div className="min-w-0 space-y-0.5">
                          <Label className="text-xs">{t(`settings.moduleInfo.${key}.name`)}</Label>
                          <p className="text-[11px] text-muted-foreground">
                            {t(`settings.moduleInfo.${key}.effect`)}
                          </p>
                        </div>
                        <Switch
                          className="shrink-0"
                          checked={activo}
                          onCheckedChange={(checked) => handleToggleModule(key, checked)}
                        />
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Se monta solo al abrir la pestaña: asi la configuracion de Mercado
            Pago se consulta nada mas cuando hace falta. */}
        <TabsContent value="payments" className="space-y-6">
          <Card>
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div className="space-y-0.5">
                <Label className="text-xs">{t("settings.externalTerminal")}</Label>
                <p className="text-[11px] text-muted-foreground">
                  {t("settings.externalTerminalHint")}
                </p>
              </div>
              <Switch
                checked={settings?.pos_config?.terminal_externa === true}
                disabled={!settings}
                onCheckedChange={(checked) => void handleToggleTerminalExterna(checked)}
              />
            </CardContent>
          </Card>
          {pestana === "payments" && <MercadoPagoPointSettings />}
        </TabsContent>

        <TabsContent value="printer">
          {pestana === "printer" && <ImpresoraConfig />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
