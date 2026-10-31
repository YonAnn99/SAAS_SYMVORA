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
const INSTRUCTIONS: { title: string; body: string; webhook?: boolean }[] = [
  {
    title: "Crea una aplicación en Mercado Pago",
    body: "Entra a mercadopago.com.mx/developers con la MISMA cuenta a la que está vinculada tu terminal. Ve a «Tus integraciones» → «Crear aplicación». Ponle un nombre (por ejemplo «SYMVORA»), elige «Pagos presenciales» y, como producto, «Point».",
  },
  {
    title: "Copia el Access Token de producción",
    body: "Dentro de tu aplicación abre «Credenciales de producción» y copia el «Access Token» (empieza con APP_USR-). Las credenciales de prueba no funcionan con una terminal real.",
  },
  {
    title: "Configura el webhook",
    body: "En tu aplicación entra a «Webhooks» → «Configurar notificaciones», pestaña «Modo productivo». Pega esta URL, marca el evento «Order (Mercado Pago)» y guarda. Después copia la «Clave secreta» que aparece en esa misma pantalla.",
    webhook: true,
  },
  {
    title: "Pega las dos claves aquí y guarda",
    body: "Access Token y Clave secreta van en los campos de arriba. Pulsa «Guardar»: se guardan cifradas.",
  },
  {
    title: "Elige tu terminal",
    body: "Con la terminal encendida y con internet, pulsa «Probar conexión»: aparece en la lista. Elígela y pulsa «Probar conexión» otra vez; SYMVORA la pasa a modo Punto de Venta (PDV). Reinicia la terminal para que tome el cambio.",
  },
  {
    title: "Activa y cobra",
    body: "Prende «Habilitar terminal» y guarda. En el punto de venta elige «Tarjeta (terminal)»: el monto llega solo a la terminal. Si el cobro ya apareció en la terminal y quieres cancelarlo, cancélalo en la terminal.",
  },
];

/** Lo que más se atora al conectarla. */
const PROBLEMAS: { si: string; entonces: string }[] = [
  {
    si: "La terminal no aparece al probar la conexión",
    entonces: "La aplicación se creó con otra cuenta de Mercado Pago, o la terminal está apagada o sin internet.",
  },
  {
    si: "El punto de venta se queda «esperando» aunque ya pagaron",
    entonces: "Falta el webhook o la Clave secreta no coincide: revisa el paso 3 y vuelve a pegar la clave.",
  },
  {
    si: "La terminal no recibe el cobro",
    entonces: "No está en modo PDV: repite el paso 5 y reiníciala.",
  },
];

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

  if (isDemo) {
    return <DemoRestrictedNotice />;
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
                  Clave secreta del webhook
                </Label>
                <Input
                  id="mp-webhook-secret"
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder={webhookSecretSet ? "•••••••••••• (guardado)" : "Clave secreta (paso 3)"}
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
                      <SelectValue placeholder="Conecta tus terminales primero">
                        {selectedTerminalName || "Selecciona una terminal"}
                      </SelectValue>
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
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-medium leading-snug">{step.title}</p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {step.body}
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
                              .then(() => toast.success("URL del webhook copiada"))
                              .catch(() => toast.error("No se pudo copiar; selecciónala a mano"));
                          }}
                        >
                          <Copy className="h-3 w-3" />
                          Copiar
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            <Separator className="my-4" />
            <p className="mb-2 text-xs font-medium">Si algo falla</p>
            <ul className="space-y-2">
              {PROBLEMAS.map((p) => (
                <li key={p.si} className="text-[11px] leading-relaxed">
                  <span className="font-medium">{p.si}.</span>{" "}
                  <span className="text-muted-foreground">{p.entonces}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}