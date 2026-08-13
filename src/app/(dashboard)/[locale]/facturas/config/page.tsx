"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Building2, Server, ShieldCheck, BadgeCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import type { TenantConfiguracionFiscal } from "@/lib/types/database";
import { REGIMENES_FISCALES } from "@/lib/cfdi/catalogs";

interface Emisor {
  rfc: string;
  razon_social: string;
  regimen_fiscal: string;
  codigo_postal: string;
}

type SecretKey = "pac_password" | "certificado_cer" | "certificado_key" | "certificado_password";
type SecretsSet = Record<SecretKey, boolean>;

const emptyConfig: TenantConfiguracionFiscal = {
  cfdi_serie: "A",
  cfdi_metodo_pago: "PUE",
  cfdi_forma_pago_default: "01",
  pac_proveedor: "finkok",
  pac_usuario: "",
  pac_password_id: "",
  certificado_cer_id: "",
  certificado_key_id: "",
  certificado_password_id: "",
  email_envio_facturas: "",
};

const emptySecrets: Record<SecretKey, string> = {
  pac_password: "",
  certificado_cer: "",
  certificado_key: "",
  certificado_password: "",
};

const emptySecretsSet: SecretsSet = {
  pac_password: false,
  certificado_cer: false,
  certificado_key: false,
  certificado_password: false,
};

export default function FacturasConfigPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emisor, setEmisor] = useState<Emisor>({
    rfc: "",
    razon_social: "",
    regimen_fiscal: "601",
    codigo_postal: "",
  });
  const [config, setConfig] = useState<TenantConfiguracionFiscal>(emptyConfig);
  const [secrets, setSecrets] = useState<Record<SecretKey, string>>(emptySecrets);
  const [secretsSet, setSecretsSet] = useState<SecretsSet>(emptySecretsSet);

  useEffect(() => {
    if (tenantLoading || !tenantId) return;

    const fetchConfig = async () => {
      try {
        const response = await fetch("/api/facturas/config", { method: "GET" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Error al cargar");

        if (data.emisor) {
          setEmisor({
            rfc: data.emisor.rfc || "",
            razon_social: data.emisor.razon_social || "",
            regimen_fiscal: data.emisor.regimen_fiscal || "601",
            codigo_postal: data.emisor.codigo_postal || "",
          });
        }
        if (data.configuracion_fiscal) {
          setConfig({ ...emptyConfig, ...data.configuracion_fiscal });
        }
        if (data.secrets_set) {
          setSecretsSet({ ...emptySecretsSet, ...data.secrets_set });
        }
      } catch (error) {
        console.error("Error fetching config:", error);
        toast.error("Error al cargar la configuración fiscal");
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [tenantLoading, tenantId]);

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const payloadSecrets = Object.fromEntries(
        Object.entries(secrets).filter(([, value]) => value.trim().length > 0)
      );

      const response = await fetch("/api/facturas/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          emisor,
          configuracion_fiscal: config,
          secrets: payloadSecrets,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error al guardar");
      toast.success("Configuración fiscal guardada correctamente");
      setSecrets(emptySecrets);
      setSecretsSet({
        pac_password: Boolean(config.pac_password_id) || "pac_password" in payloadSecrets,
        certificado_cer: Boolean(config.certificado_cer_id) || "certificado_cer" in payloadSecrets,
        certificado_key: Boolean(config.certificado_key_id) || "certificado_key" in payloadSecrets,
        certificado_password: Boolean(config.certificado_password_id) || "certificado_password" in payloadSecrets,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const updateSecret = (key: SecretKey, value: string) =>
    setSecrets((prev) => ({ ...prev, [key]: value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Cargando configuración...
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => router.push(`/${locale}/facturas`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                {t("facturas.configFiscal")}
              </h2>
              <span className="inline-flex items-center rounded-full bg-yellow-500/15 px-2 py-0.5 text-[11px] font-semibold text-yellow-700 dark:text-yellow-400">
                Beta
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Configuración para facturación electrónica CFDI 4.0
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="h-8 active:scale-[0.98] transition-transform w-full sm:w-auto"
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>

      <Tabs defaultValue="fiscal" className="w-full animate-fade-in-up stagger-2">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="fiscal">
            <Building2 className="mr-1.5 h-3.5 w-3.5" />
            Datos fiscales
          </TabsTrigger>
          <TabsTrigger value="pac">
            <Server className="mr-1.5 h-3.5 w-3.5" />
            PAC
          </TabsTrigger>
          <TabsTrigger value="certs">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            Certificados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fiscal" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos del emisor</CardTitle>
              <CardDescription>
                RFC, razón social, régimen fiscal y código postal de tu negocio.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rfc">RFC</Label>
                  <Input
                    id="rfc"
                    value={emisor.rfc}
                    onChange={(e) =>
                      setEmisor({ ...emisor, rfc: e.target.value.toUpperCase() })
                    }
                    placeholder="XAXX010101000"
                    className="uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="razon-social">Razón social</Label>
                  <Input
                    id="razon-social"
                    value={emisor.razon_social}
                    onChange={(e) =>
                      setEmisor({ ...emisor, razon_social: e.target.value })
                    }
                    placeholder="Mi Negocio S.A. de C.V."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regimen">Régimen fiscal</Label>
                  <Select
                    value={emisor.regimen_fiscal}
                    onValueChange={(v) =>
                      setEmisor({ ...emisor, regimen_fiscal: v ?? "601" })
                    }
                  >
                    <SelectTrigger id="regimen" className="w-full">
                      <SelectValue placeholder="Selecciona un régimen" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(REGIMENES_FISCALES).map(([key, value]) => (
                        <SelectItem key={key} value={key}>
                          {key} — {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cp">Código postal</Label>
                  <Input
                    id="cp"
                    value={emisor.codigo_postal}
                    onChange={(e) =>
                      setEmisor({ ...emisor, codigo_postal: e.target.value })
                    }
                    placeholder="06600"
                    maxLength={5}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="serie">Serie</Label>
                  <Input
                    id="serie"
                    value={config.cfdi_serie}
                    onChange={(e) =>
                      setConfig({ ...config, cfdi_serie: e.target.value })
                    }
                    placeholder="A"
                    maxLength={4}
                    className="uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="forma-pago">Forma de pago</Label>
                  <Input
                    id="forma-pago"
                    value={config.cfdi_forma_pago_default}
                    onChange={(e) =>
                      setConfig({ ...config, cfdi_forma_pago_default: e.target.value })
                    }
                    placeholder="01"
                    maxLength={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-envio">Email envío</Label>
                  <Input
                    id="email-envio"
                    type="email"
                    value={config.email_envio_facturas}
                    onChange={(e) =>
                      setConfig({ ...config, email_envio_facturas: e.target.value })
                    }
                    placeholder="facturas@midenegocio.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pac" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuración PAC</CardTitle>
              <CardDescription>
                Proveedor de timbrado y credenciales de acceso. Las credenciales se
                guardan cifradas (nunca se muestran de nuevo).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pac-proveedor">Proveedor PAC</Label>
                  <Select
                    value={config.pac_proveedor}
                    onValueChange={(v) =>
                      setConfig({
                        ...config,
                        pac_proveedor: v as TenantConfiguracionFiscal["pac_proveedor"],
                      })
                    }
                  >
                    <SelectTrigger id="pac-proveedor" className="w-full">
                      <SelectValue placeholder="Selecciona un proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="finkok">Finkok</SelectItem>
                      <SelectItem value="swsapien">SWSapien</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pac-usuario">Usuario PAC</Label>
                  <Input
                    id="pac-usuario"
                    value={config.pac_usuario}
                    onChange={(e) =>
                      setConfig({ ...config, pac_usuario: e.target.value })
                    }
                    placeholder="usuario@dominio.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pac-password">Contraseña PAC</Label>
                  <div className="relative">
                    <Input
                      id="pac-password"
                      type="password"
                      value={secrets.pac_password}
                      onChange={(e) => updateSecret("pac_password", e.target.value)}
                      placeholder={secretsSet.pac_password ? "Dejar en blanco para conservar" : "••••••••"}
                    />
                    {secretsSet.pac_password && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 dark:text-green-400">
                        <BadgeCheck className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metodo-pago">Método de pago CFDI</Label>
                  <Select
                    value={config.cfdi_metodo_pago}
                    onValueChange={(v) =>
                      setConfig({
                        ...config,
                        cfdi_metodo_pago: v as TenantConfiguracionFiscal["cfdi_metodo_pago"],
                      })
                    }
                  >
                    <SelectTrigger id="metodo-pago" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUE">PUE — Pago en una sola exhibición</SelectItem>
                      <SelectItem value="PPD">PPD — Pago en parcialidades</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Certificados digitales</CardTitle>
              <CardDescription>
                Certificado de sello digital (.cer), llave privada (.key) y contraseña.
                Se guardan cifrados; deja un campo en blanco para conservar el actual.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cert-cer">Certificado (.cer)</Label>
                  <div className="relative">
                    <Input
                      id="cert-cer"
                      value={secrets.certificado_cer}
                      onChange={(e) => updateSecret("certificado_cer", e.target.value)}
                      placeholder={secretsSet.certificado_cer ? "Dejar en blanco para conservar" : "Contenido base64 del certificado"}
                      className="font-mono text-xs pr-9"
                    />
                    {secretsSet.certificado_cer && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 dark:text-green-400">
                        <BadgeCheck className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cert-key">Llave privada (.key)</Label>
                  <div className="relative">
                    <Input
                      id="cert-key"
                      value={secrets.certificado_key}
                      onChange={(e) => updateSecret("certificado_key", e.target.value)}
                      placeholder={secretsSet.certificado_key ? "Dejar en blanco para conservar" : "Contenido base64 de la llave privada"}
                      className="font-mono text-xs pr-9"
                    />
                    {secretsSet.certificado_key && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 dark:text-green-400">
                        <BadgeCheck className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cert-password">Contraseña de la llave</Label>
                  <div className="relative">
                    <Input
                      id="cert-password"
                      type="password"
                      value={secrets.certificado_password}
                      onChange={(e) => updateSecret("certificado_password", e.target.value)}
                      placeholder={secretsSet.certificado_password ? "Dejar en blanco para conservar" : "••••••••"}
                    />
                    {secretsSet.certificado_password && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 dark:text-green-400">
                        <BadgeCheck className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}