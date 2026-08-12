"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
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
import { Save, Building2, Palette, Puzzle, Sun, Moon } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { toast } from "sonner";
import type { Tenant, TenantSettingsJSON } from "@/lib/types/database";

export default function SettingsPage() {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [settings, setSettings] = useState<TenantSettingsJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");

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
    setSaving(true);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("tenants")
      .update({
        nombre_comercial: companyName,
        telefono: phone,
        direccion: address,
        email: email,
      })
      .eq("id", tenant.id);

    if (error) {
      toast.error("Error al guardar: " + error.message);
    } else {
      toast.success("Cambios guardados");
    }
    setSaving(false);
  };

  const handleToggleModule = async (module: string, value: boolean) => {
    if (!tenant || !settings) return;

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
      toast.error("Error al actualizar módulo: " + error.message);
    }
  };

  if (tenantLoading || loading) {
    return (
      <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
        No se encontró la configuración del tenant.
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="animate-fade-in-up stagger-1">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
          {t("settings.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configura los ajustes de tu organización
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full animate-fade-in-up stagger-2">
        <TabsList>
          <TabsTrigger value="general" className="gap-1.5 text-xs">
            <Building2 className="h-3.5 w-3.5" />
            {t("settings.general")}
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-1.5 text-xs">
            <Palette className="h-3.5 w-3.5" />
            {t("settings.appearance")}
          </TabsTrigger>
          <TabsTrigger value="modules" className="gap-1.5 text-xs">
            <Puzzle className="h-3.5 w-3.5" />
            {t("settings.modules")}
          </TabsTrigger>
        </TabsList>

        {/* General settings */}
        <TabsContent value="general">
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
                <Button onClick={handleSaveCompany} disabled={saving} size="sm" className="h-8 active:scale-[0.98] transition-transform">
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  {saving ? t("common.loading") : t("common.save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance settings */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{t("settings.appearance")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs">{t("settings.darkMode")}</Label>
                  <p className="text-xs text-muted-foreground">
                    Activa el modo oscuro para la interfaz
                  </p>
                </div>
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs">{t("settings.primaryColor")}</Label>
                <div className="flex gap-2">
                  {["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"].map(
                    (color) => (
                      <button
                        key={color}
                        className="h-7 w-7 rounded-full border-2 border-transparent transition-all hover:scale-110 hover:border-foreground/20"
                        style={{ backgroundColor: color }}
                      />
                    )
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Modules settings */}
        <TabsContent value="modules">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{t("settings.modules")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {settings?.modulos_activos &&
                Object.entries(settings.modulos_activos).map(([key, value], i) => (
                  <div key={key}>
                    {i > 0 && <Separator />}
                    <div className="flex items-center justify-between py-3">
                      <div className="space-y-0.5">
                        <Label className="text-xs capitalize">
                          {key.replace(/_/g, " ")}
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          {key === "permite_granel" &&
                            "Productos vendidos por peso o volumen"}
                          {key === "permite_variantes" &&
                            "Variantes de talla y color"}
                          {key === "permite_lotes_caducidad" &&
                            "Control de lotes y fechas de caducidad"}
                          {key === "permite_mermas" &&
                            "Registro de mermas y pérdidas"}
                          {key === "permite_servicios" &&
                            "Productos de tipo servicio"}
                          {key === "permite_credito_fiado" &&
                            "Ventas a crédito / fiado"}
                        </p>
                      </div>
                      <Switch
                        checked={value as boolean}
                        onCheckedChange={(checked) =>
                          handleToggleModule(key, checked)
                        }
                      />
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
