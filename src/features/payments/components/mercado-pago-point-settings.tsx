"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Smartphone, Key, Loader2, RefreshCw, CheckCircle2, Info, Copy } from "lucide-react";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useIsDemo } from "@/hooks/use-is-demo";
import { DemoRestrictedNotice } from "@/components/demo/demo-restricted-notice";

interface MpConfigStatus {
  habilitado: boolean;
  terminal_id: string;
  access_token_set: boolean;
  webhook_secret_set: boolean;
}

interface MpTerminalOption {
  id: string;
  operating_mode: string;
  description: string;
}

/**
 * A donde avisa Mercado Pago cuando se paga, cancela o vence un cobro. Siempre
 * la de produccion: Mercado Pago no puede llegar a un `localhost`.
 */
const URL_WEBHOOK = "https://app.symvora.com.mx/api/mercadopago/webhook";

/**
 * Pasos para conectar la terminal, con los nombres de los menus de Mercado
 * Pago. La version anterior no decia la URL del webhook ni que evento elegir,
 * y pedia poner la terminal en modo PDV desde la app, cuando "Probar conexion"
 * ya lo hace (`setTerminalOperatingMode` en /api/mercadopago/test-connection).
 */
/** Texto de cada paso: `settings.mp.steps.<n>.title/body`; el 3 lleva la URL del webhook. */
const INSTRUCTIONS: { paso: number; webhook?: boolean }[] = [
  { paso: 0 },
  { paso: 1 },
  { paso: 2, webhook: true },
  { paso: 3 },
  { paso: 4 },
  { paso: 5 },
];


/** Lo que más se atora al conectarla. */
/** Texto de cada problema: `settings.mp.problems.<n>.if/then`. */
const PROBLEMAS = [0, 1, 2] as const;


/**
 * Cobro con terminal Mercado Pago Point: habilitarla, sus claves, elegir la
 * terminal y probar la conexion. Antes era la pagina "Metodos de pago"
 * (/settings/payments); ahora es la pestaña "Mercado Pago Point" de
 * Configuracion, y esa ruta redirige aqui.
 *
 * La configuracion se lee al montarse, o sea al abrir la pestaña: quien no la
 * abre no dispara la consulta.
 */
export function MercadoPagoPointSettings() {
  const t = useTranslations();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const isDemo = useIsDemo();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [habilitado, setHabilitado] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const [terminalOptions, setTerminalOptions] = useState<MpTerminalOption[]>([]);
  const [connectionOk, setConnectionOk] = useState(false);
  const [accessTokenSet, setAccessTokenSet] = useState(false);
  const [webhookSecretSet, setWebhookSecretSet] = useState(false);

  const selectedTerminalName = useMemo(() => {
    if (!terminalId) return "";
    const terminal = terminalOptions.find((t) => t.id === terminalId);
    if (!terminal) return terminalId;
    return `${terminal.description || terminal.id}${terminal.operating_mode === "PDV" ? " (PDV)" : " (no-PDV)"}`;
  }, [terminalId, terminalOptions]);
  const tm = useTranslations("settings.mp");
  const { moneda } = useCurrentTenant();

  useEffect(() => {
    if (tenantLoading) return;

    const loadConfig = async () => {
      try {
        const res = await fetch("/api/mercadopago/config", { method: "GET" });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || tm("readError"));
        }
        const cfg = data.config as MpConfigStatus;
        setHabilitado(cfg.habilitado);
        setTerminalId(cfg.terminal_id);
        setAccessTokenSet(cfg.access_token_set);
        setWebhookSecretSet(cfg.webhook_secret_set);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : tm("loadError")
        );
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [tenantLoading, tm]);

  const handleTestConnection = async () => {
    if (!tenantId) return;
    setTesting(true);
    setConnectionOk(false);
    try {
      const res = await fetch("/api/mercadopago/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          terminal_id: terminalId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || tm("connectError"));
      }
      setTerminalOptions(data.terminals);
      if (data.terminal_id) setTerminalId(data.terminal_id);
      setConnectionOk(true);
      toast.success(tm("connected"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : tm("connectMpError")
      );
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/mercadopago/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          habilitado,
          terminal_id: terminalId,
          access_token: accessToken.trim() ? accessToken : undefined,
          webhook_secret: webhookSecret.trim() ? webhookSecret : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || tm("saveError"));
      }
      setAccessToken("");
      setWebhookSecret("");
      setAccessTokenSet(accessTokenSet || Boolean(accessToken.trim()));
      setWebhookSecretSet(webhookSecretSet || Boolean(webhookSecret.trim()));
      toast.success(tm("saved"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : tm("saveErrorGeneric")
      );
    } finally {
      setSaving(false);
    }
  };

  if (tenantLoading || loading) {
    return (
      <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (isDemo) {
    return <DemoRestrictedNotice />;
  }

  // Mercado Pago Point solo opera en México y en pesos (migración 133).
  if (moneda !== "MXN") {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">{tm("onlyMxn")}</CardContent>
      </Card>
    );
  }

  const isReady =
    habilitado &&
    (accessTokenSet || Boolean(accessToken.trim())) &&
    (webhookSecretSet || Boolean(webhookSecret.trim())) &&
    Boolean(terminalId);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Config */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Smartphone className="h-4 w-4 text-primary" />
              Mercado Pago Point
            </CardTitle>
            <CardDescription className="text-xs">
              {tm("desc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs">{tm("enable")}</Label>
                <p className="text-xs text-muted-foreground">
                  {tm("enableHint")}
                </p>
              </div>
              <Switch checked={habilitado} onCheckedChange={setHabilitado} />
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="mp-access-token" className="text-xs">
                  <Key className="inline h-3 w-3 mr-1" />
                  Access Token
                </Label>
                <Input
                  id="mp-access-token"
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder={accessTokenSet ? tm("tokenSaved") : "APP_USR-xxxxxxxxxx"}
                  className="h-8 text-sm font-mono"
                  autoComplete="off"
                />
                <p className="text-[11px] text-muted-foreground">
                  {tm("encrypted")}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mp-webhook-secret" className="text-xs">
                  {tm("secret")}
                </Label>
                <Input
                  id="mp-webhook-secret"
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder={webhookSecretSet ? tm("secretSaved") : tm("secretPlaceholder")}
                  className="h-8 text-sm font-mono"
                  autoComplete="off"
                />
                <p className="text-[11px] text-muted-foreground">
                  {tm("secretHint")}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Terminal</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    value={terminalId || "none"}
                    onValueChange={(v) => setTerminalId(v && v !== "none" ? v : "")}
                    disabled={!terminalOptions.length}
                  >
                    <SelectTrigger className="h-8 text-sm w-full">
                      <SelectValue placeholder={tm("connectFirst")}>
                        {selectedTerminalName || tm("selectTerminal")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tm("selectTerminal")}</SelectItem>
                      {terminalOptions.map((terminal) => (
                        <SelectItem key={terminal.id} value={terminal.id}>
                          {terminal.description || terminal.id}
                          {terminal.operating_mode === "PDV"
                            ? " (PDV)"
                            : " (no-PDV)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={handleTestConnection}
                  disabled={testing}
                >
                  {testing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  )}
                  {tm("test")}
                </Button>
              </div>
              {connectionOk && (
                <p className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {tm("success")}
                  {terminalOptions.length > 0 &&
                    ` — ${tm("found", { count: terminalOptions.length })}`}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              {isReady && !habilitado && (
                <p className="text-xs text-muted-foreground">
                  {tm("availableWhenEnabled")}
                </p>
              )}
              <div className="flex-1" />
              <SpecularActionButton tone="add" className="h-8 active:scale-[0.98] transition-transform" onClick={handleSave} disabled={saving}>

                {saving ? t("common.loading") : t("common.save")}
              </SpecularActionButton>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Info className="h-4 w-4 text-primary" />
              {tm("howTo")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {INSTRUCTIONS.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {index + 1}
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-medium leading-snug">{tm(`steps.${step.paso}.title`)}</p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {tm(`steps.${step.paso}.body`)}
                    </p>
                    {step.webhook && (
                      <div className="mt-1.5 flex items-center gap-1.5 rounded-md border border-border bg-muted/40 p-1.5">
                        <code className="min-w-0 flex-1 truncate font-mono text-[11px]">{URL_WEBHOOK}</code>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 shrink-0 gap-1 text-[11px]"
                          onClick={() => {
                            navigator.clipboard
                              .writeText(URL_WEBHOOK)
                              .then(() => toast.success(tm("urlCopied")))
                              .catch(() => toast.error(tm("copyError")));
                          }}
                        >
                          <Copy className="h-3 w-3" />
                          {tm("copy")}
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            <Separator className="my-4" />
            <p className="mb-2 text-xs font-medium">{tm("ifFails")}</p>
            <ul className="space-y-2">
              {PROBLEMAS.map((p) => (
                <li key={p} className="text-[11px] leading-relaxed">
                  <span className="font-medium">{tm(`problems.${p}.if`)}.</span>{" "}
                  <span className="text-muted-foreground">{tm(`problems.${p}.then`)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}