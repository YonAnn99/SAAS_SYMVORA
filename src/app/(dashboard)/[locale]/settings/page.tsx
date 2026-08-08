"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Save, Building2, Palette, Puzzle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Tenant, TenantSettingsJSON } from "@/lib/types/database";

export default function SettingsPage() {
  const t = useTranslations();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [settings, setSettings] = useState<TenantSettingsJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Company form state
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    fetchTenantData();
  }, []);

  const fetchTenantData = async () => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    // Get user's tenant membership
    const { data: membership } = await supabase
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      setLoading(false);
      return;
    }

    // Get tenant data
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", membership.tenant_id)
      .single();

    if (tenantData) {
      setTenant(tenantData);
      setCompanyName(tenantData.nombre_comercial || "");
      setPhone(tenantData.telefono || "");
      setAddress(tenantData.direccion || "");
      setEmail(tenantData.email || "");
    }

    // Get tenant settings
    const { data: settingsData } = await supabase
      .from("tenant_settings")
      .select("configuracion_json")
      .eq("tenant_id", membership.tenant_id)
      .single();

    if (settingsData) {
      setSettings(settingsData.configuracion_json as TenantSettingsJSON);
    }

    setLoading(false);
  };

  const handleSaveCompany = async () => {
    if (!tenant) return;
    setSaving(true);

    const supabase = createSupabaseBrowserClient();
    await supabase
      .from("tenants")
      .update({
        nombre_comercial: companyName,
        telefono: phone,
        direccion: address,
        email: email,
      })
      .eq("id", tenant.id);

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
    await supabase
      .from("tenant_settings")
      .update({ configuracion_json: newSettings })
      .eq("tenant_id", tenant.id);
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          {t("settings.title")}
        </h2>
        <p className="text-muted-foreground">
          Configura los ajustes de tu organización
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Building2 className="h-4 w-4" />
            {t("settings.general")}
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="h-4 w-4" />
            {t("settings.appearance")}
          </TabsTrigger>
          <TabsTrigger value="modules" className="gap-2">
            <Puzzle className="h-4 w-4" />
            {t("settings.modules")}
          </TabsTrigger>
        </TabsList>

        {/* General settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.company")}</CardTitle>
              <CardDescription>
                Información básica de tu empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">
                    {t("settings.companyName")}
                  </Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("common.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("common.phone")}</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">{t("common.address")}</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveCompany} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? t("common.loading") : t("common.save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance settings */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.appearance")}</CardTitle>
              <CardDescription>
                Personaliza la apariencia del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("settings.darkMode")}</Label>
                  <p className="text-sm text-muted-foreground">
                    Activa el modo oscuro para la interfaz
                  </p>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>{t("settings.primaryColor")}</Label>
                <div className="flex gap-2">
                  {["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"].map(
                    (color) => (
                      <button
                        key={color}
                        className="h-8 w-8 rounded-full border-2 border-transparent hover:border-foreground"
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
            <CardHeader>
              <CardTitle>{t("settings.modules")}</CardTitle>
              <CardDescription>
                Activa o desactiva módulos del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings?.modulos_activos &&
                Object.entries(settings.modulos_activos).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="capitalize">
                        {key.replace(/_/g, " ")}
                      </Label>
                      <p className="text-sm text-muted-foreground">
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
                ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
