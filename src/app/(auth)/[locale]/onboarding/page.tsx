"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { tenantSchema } from "@/lib/validations/schemas";
import {
  Store,
  ShoppingCart,
  Shirt,
  Hammer,
  Pill,
  Package,
  ChevronRight,
  Check,
} from "lucide-react";

const giros = [
  {
    id: "ABARROTES",
    icon: Store,
    nameKey: "onboarding.giros.ABARROTES",
    descKey: "onboarding.giroDescription.ABARROTES",
  },
  {
    id: "VERDULERIA",
    icon: ShoppingCart,
    nameKey: "onboarding.giros.VERDULERIA",
    descKey: "onboarding.giroDescription.VERDULERIA",
  },
  {
    id: "MASCOTAS",
    icon: Package,
    nameKey: "onboarding.giros.MASCOTAS",
    descKey: "onboarding.giroDescription.MASCOTAS",
  },
  {
    id: "ROPA",
    icon: Shirt,
    nameKey: "onboarding.giros.ROPA",
    descKey: "onboarding.giroDescription.ROPA",
  },
  {
    id: "FERRETERIA",
    icon: Hammer,
    nameKey: "onboarding.giros.FERRETERIA",
    descKey: "onboarding.giroDescription.FERRETERIA",
  },
  {
    id: "FARMACIA",
    icon: Pill,
    nameKey: "onboarding.giros.FARMACIA",
    descKey: "onboarding.giroDescription.FARMACIA",
  },
  {
    id: "GENERAL",
    icon: Package,
    nameKey: "onboarding.giros.GENERAL",
    descKey: "onboarding.giroDescription.GENERAL",
  },
];

const defaultSettings: Record<string, any> = {
  ABARROTES: {
    modulos_activos: {
      permite_granel: false,
      permite_variantes: false,
      permite_lotes_caducidad: true,
      permite_mermas: true,
      permite_servicios: false,
      permite_credito_fiado: true,
    },
    pos_config: {
      teclado_rapido: true,
      lector_barras: true,
      impresion_automatica: true,
    },
  },
  VERDULERIA: {
    modulos_activos: {
      permite_granel: true,
      permite_variantes: false,
      permite_lotes_caducidad: false,
      permite_mermas: true,
      permite_servicios: false,
      permite_credito_fiado: true,
    },
    pos_config: {
      teclado_rapido: true,
      lector_barras: false,
      impresion_automatica: true,
    },
  },
  MASCOTAS: {
    modulos_activos: {
      permite_granel: false,
      permite_variantes: true,
      permite_lotes_caducidad: true,
      permite_mermas: false,
      permite_servicios: true,
      permite_credito_fiado: true,
    },
    pos_config: {
      teclado_rapido: false,
      lector_barras: true,
      impresion_automatica: true,
    },
  },
  ROPA: {
    modulos_activos: {
      permite_granel: false,
      permite_variantes: true,
      permite_lotes_caducidad: false,
      permite_mermas: false,
      permite_servicios: false,
      permite_credito_fiado: false,
    },
    pos_config: {
      teclado_rapido: false,
      lector_barras: true,
      impresion_automatica: true,
    },
  },
  FERRETERIA: {
    modulos_activos: {
      permite_granel: true,
      permite_variantes: false,
      permite_lotes_caducidad: false,
      permite_mermas: true,
      permite_servicios: true,
      permite_credito_fiado: true,
    },
    pos_config: {
      teclado_rapido: true,
      lector_barras: true,
      impresion_automatica: true,
    },
  },
  FARMACIA: {
    modulos_activos: {
      permite_granel: false,
      permite_variantes: false,
      permite_lotes_caducidad: true,
      permite_mermas: false,
      permite_servicios: false,
      permite_credito_fiado: true,
    },
    pos_config: {
      teclado_rapido: false,
      lector_barras: true,
      impresion_automatica: true,
    },
  },
  GENERAL: {
    modulos_activos: {
      permite_granel: false,
      permite_variantes: false,
      permite_lotes_caducidad: false,
      permite_mermas: false,
      permite_servicios: true,
      permite_credito_fiado: true,
    },
    pos_config: {
      teclado_rapido: false,
      lector_barras: false,
      impresion_automatica: true,
    },
  },
};

export default function OnboardingPage() {
  const t = useTranslations();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [nombreComercial, setNombreComercial] = useState("");
  const [subdominio, setSubdominio] = useState("");
  const [selectedGiro, setSelectedGiro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trialCode, setTrialCode] = useState("");

  const handleNext = () => {
    if (step === 1) {
      const validation = tenantSchema.pick({ nombre_comercial: true, subdominio: true }).safeParse({
        nombre_comercial: nombreComercial,
        subdominio: subdominio,
      });
      if (!validation.success) {
        setError(validation.error.issues[0].message);
        return;
      }
      setError(null);
    }
    if (step === 2 && !selectedGiro) {
      setError("Selecciona un giro comercial");
      return;
    }
    setError(null);
    setStep(step + 1);
  };

  const handleComplete = async () => {
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Debes iniciar sesión");
      setLoading(false);
      return;
    }

    const configuracionJson = {
      giro_comercial: selectedGiro,
      modulos_activos: defaultSettings[selectedGiro!].modulos_activos,
      pos_config: defaultSettings[selectedGiro!].pos_config,
    };

    const { data: tenant, error: rpcError } = await supabase.rpc(
      "complete_onboarding",
      {
        p_user_id: user.id,
        p_nombre_comercial: nombreComercial,
        p_subdominio: subdominio,
        p_giro_comercial: selectedGiro!,
        p_configuracion_json: configuracionJson,
      }
    );

    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }

    if (tenant?.id) {
      const { error: subError } = await supabase
        .from("subscriptions")
        .insert({
          tenant_id: tenant.id,
          status: "trial",
          payment_method: "card",
          trial_start: new Date().toISOString(),
          trial_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (subError) {
        console.error("Error creating subscription:", subError);
      }

      await supabase
        .from("tenants")
        .update({ subscription_status: "trial" })
        .eq("id", tenant.id);

      if (trialCode.trim()) {
        await supabase.rpc("redeem_trial_code", {
          p_code: trialCode.trim(),
          p_user_id: user.id,
          p_tenant_id: tenant.id,
        });
      }
    }

    router.push("/es/billing");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("onboarding.title")}</CardTitle>
          <CardDescription>
            Paso {step} de 4
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Step 1: Company data */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in-up">
              <h3 className="text-lg font-semibold">{t("onboarding.step1")}</h3>
              <div className="space-y-2">
                <Label htmlFor="nombre">{t("onboarding.companyName")}</Label>
                <Input
                  id="nombre"
                  placeholder={t("onboarding.companyNamePlaceholder")}
                  value={nombreComercial}
                  onChange={(e) => setNombreComercial(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subdomain">{t("onboarding.subdomain")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="subdomain"
                    placeholder={t("onboarding.subdomainPlaceholder")}
                    value={subdominio}
                    onChange={(e) =>
                      setSubdominio(
                        e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                      )
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {t("onboarding.subdomainSuffix")}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Select giro */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in-up">
              <h3 className="text-lg font-semibold">{t("onboarding.selectGiro")}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {giros.map((giro) => {
                  const Icon = giro.icon;
                  return (
                    <button
                      key={giro.id}
                      onClick={() => setSelectedGiro(giro.id)}
                      className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                        selectedGiro === giro.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0 text-primary" />
                      <div>
                        <p className="font-medium">{t(giro.nameKey)}</p>
                        <p className="text-sm text-muted-foreground">
                          {t(giro.descKey)}
                        </p>
                      </div>
                      {selectedGiro === giro.id && (
                        <Check className="ml-auto h-4 w-4 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in-up">
              <h3 className="text-lg font-semibold">{t("onboarding.step3")}</h3>
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("onboarding.companyName")}:
                  </span>
                  <span className="font-medium">{nombreComercial}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("onboarding.subdomain")}:
                  </span>
                  <span className="font-medium">
                    {subdominio}{t("onboarding.subdomainSuffix")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("onboarding.selectGiro")}:
                  </span>
                  <span className="font-medium">
                    {t(`onboarding.giros.${selectedGiro}`)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="trialCode">{t("onboarding.trialCode") || "Código de prueba (opcional)"}</Label>
                <Input
                  id="trialCode"
                  placeholder="SYM-XXXX-XXXX"
                  value={trialCode}
                  onChange={(e) => setTrialCode(e.target.value.toUpperCase())}
                />
                <p className="text-xs text-muted-foreground">
                  {t("onboarding.trialCodeHint") || "Si tienes un código de promoción, ingrésalo aquí"}
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 4 && (
            <div className="space-y-4 text-center animate-fade-in-up">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-8 w-8" />
                </div>
              </div>
              <h3 className="text-lg font-semibold">{t("onboarding.complete")}</h3>
              <p className="text-muted-foreground">
                {t("onboarding.completeDescription")}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          {step > 1 && step < 4 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              {t("common.back")}
            </Button>
          )}
          {step < 4 ? (
            <Button onClick={handleNext} className="ml-auto">
              {step === 3 ? t("common.finish") : t("common.next")}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleComplete} className="w-full" disabled={loading}>
              {loading ? t("common.loading") : t("common.next")}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
