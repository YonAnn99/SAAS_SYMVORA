"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
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
import {
  Save,
  Smartphone,
  Key,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Info,
} from "lucide-react";
import { useCurrentTenant } from "@/hooks/use-current-tenant";

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

const INSTRUCTIONS = [
  {
    title: "Crea una aplicación en Mercado Pago",
    body: "Entra a developers.mercadopago.com.mx y crea una aplicación con modalidad \u201cPagos en persona \u2192 Point Smart\u201d.",
  },
  {
    title: "Obtén el Access Token y la clave de webhook",
    body: "En el panel de la aplicación copia el Access Token (llave de producción) y la Webhook Secret Key. Pégalos abajo; se guardan cifrados.",
  },
  {
    title: "Configura la terminal en modo PDV",
    body: "Con la app Mercado Pago Point del celular, pon la terminal en modo Punto de Venta (PDV), no Standalone.",
  },
  {
    title: "Prueba la conexión",
    body: "Usa el botón \u201cProbar conexión\u201d para que detecte tus terminales y selecciona la que usarás en el punto de venta.",
  },
  {
    title: "Guarda y cobra",
    body: "Activa el interruptor y guarda. En el punto de venta aparecerá \u201cTarjeta (terminal)\u201d como método de pago.",
  },
];

export default function PaymentsPage() {
  const t = useTranslations();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();

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

  useEffect(() => {
    if (tenantLoading) return;

    const loadConfig = async () => {
      try {
        const res = await fetch("/api/mercadopago/config", { method: "GET" });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "No se pudo leer la configuración");
        }
        const cfg = data.config as MpConfigStatus;
        setHabilitado(cfg.habilitado);
        setTerminalId(cfg.terminal_id);
        setAccessTokenSet(cfg.access_token_set);
        setWebhookSecretSet(cfg.webhook_secret_set);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Error al cargar configuración"
        );
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [tenantLoading]);

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
        throw new Error(data.error || "No se pudo conectar");
      }
      setTerminalOptions(data.terminals);
      if (data.terminal_id) setTerminalId(data.terminal_id);
      setConnectionOk(true);
      toast.success("Conexión exitosa con Mercado Pago");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo conectar con Mercado Pago"
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
        throw new Error(data.error || "No se pudo guardar la configuración");
      }
      setAccessToken("");
      setWebhookSecret("");
      setAccessTokenSet(accessTokenSet || Boolean(accessToken.trim()));
      setWebhookSecretSet(webhookSecretSet || Boolean(webhookSecret.trim()));
      toast.success("Configuración de Mercado Pago guardada");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al guardar configuración"
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

  const isReady =
    habilitado &&
    (accessTokenSet || Boolean(accessToken.trim())) &&
    (webhookSecretSet || Boolean(webhookSecret.trim())) &&
    Boolean(terminalId);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="animate-fade-in-up stagger-1">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
          Métodos de pago
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configura el cobro con tarjeta usando tu terminal Mercado Pago Point
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 animate-fade-in-up stagger-2">
        {/* Config */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Smartphone className="h-4 w-4 text-primary" />
              Mercado Pago Point
            </CardTitle>
            <CardDescription className="text-xs">
              Cobra en el punto de venta con una terminal física. La venta se
              completa cuando la terminal confirma el pago.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs">Habilitar terminal</Label>
                <p className="text-xs text-muted-foreground">
                  Permite “Tarjeta (terminal)” como método de pago en el POS
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
                  placeholder={accessTokenSet ? "APP_USR-•••••••••••• (guardado)" : "APP_USR-xxxxxxxxxx"}
                  className="h-8 text-sm font-mono"
                  autoComplete="off"
                />
                <p className="text-[11px] text-muted-foreground">
                  Se cifra antes de guardarse
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mp-webhook-secret" className="text-xs">
                  Webhook Secret Key
                </Label>
                <Input
                  id="mp-webhook-secret"
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder={webhookSecretSet ? "•••••••••••• (guardado)" : "Clave del webhook"}
                  className="h-8 text-sm font-mono"
                  autoComplete="off"
                />
                <p className="text-[11px] text-muted-foreground">
                  Verifica las notificaciones de pago
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
                      <SelectValue placeholder="Conecta tus terminales primero" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecciona una terminal</SelectItem>
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
                  Probar conexión
                </Button>
              </div>
              {connectionOk && (
                <p className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Conexión exitosa
                  {terminalOptions.length > 0 &&
                    ` — ${terminalOptions.length} terminal(es) encontrada(s)`}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              {isReady && !habilitado && (
                <p className="text-xs text-muted-foreground">
                  La terminal estará disponible en el POS al habilitarla
                </p>
              )}
              <div className="flex-1" />
              <Button size="sm" className="h-8 active:scale-[0.98] transition-transform" onClick={handleSave} disabled={saving}>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {saving ? t("common.loading") : t("common.save")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Info className="h-4 w-4 text-primary" />
              Cómo configurarlo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {INSTRUCTIONS.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {index + 1}
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium leading-snug">{step.title}</p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}