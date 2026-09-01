"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useIsDemo } from "@/hooks/use-is-demo";
import { DemoRestrictedNotice } from "@/components/demo/demo-restricted-notice";
import { generateReferralCode, getReferralSignupUrl } from "@/lib/referrals";
import { toast } from "sonner";
import { Clock, CheckCircle, Calendar, History, Gift, Copy, Check, MessageCircle, Users, Info, Link2 } from "lucide-react";

interface Subscription {
  id: string;
  status: string;
  payment_method: string;
  trial_start: string;
  trial_end: string;
  current_period_end: string | null;
  last_payment_at: string | null;
  next_payment_due: string | null;
  conekta_customer_id: string | null;
  creditos_mes_gratis: number;
}

interface ReferralRecord {
  id: string;
  estado: string;
  registrado_en: string | null;
  convertido_en: string | null;
}

interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: string;
  reference: string | null;
  conekta_order_id: string | null;
  paid_at: string | null;
  created_at: string;
}

export default function BillingPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const isDemo = useIsDemo();
const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [referralCode, setReferralCode] = useState<string>("");
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [copied, setCopied] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplying, setPromoApplying] = useState(false);

  const fetchSubscription = async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    try {
      const supabase = createSupabaseBrowserClient();

      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();

      if (data) {
        setSubscription(data);

        const { data: paymentData } = await supabase
          .from("payment_history")
          .select("*")
          .eq("subscription_id", data.id)
          .order("created_at", { ascending: false });

        if (paymentData) setPayments(paymentData);
      }

      const { data: tenantData } = await supabase
        .from("tenants")
        .select("codigo_referido")
        .eq("id", tenantId)
        .single();

      setReferralCode(
        tenantData?.codigo_referido || generateReferralCode(tenantId)
      );

      const { data: referralData } = await supabase
        .from("referidos")
        .select("id, estado, registrado_en, convertido_en")
        .eq("tenant_referidor_id", tenantId)
        .order("creado_en", { ascending: false });

      if (referralData) setReferrals(referralData);
    } catch (error) {
      console.error("Error fetching subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!tenantLoading && tenantId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchSubscription();
    }
  }, [tenantLoading, tenantId]);

  const getDaysLeft = () => {
    if (!subscription?.trial_end) return 0;
    const end = new Date(subscription.trial_end);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "trial":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "past_due":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "expired":
      case "canceled":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return t("billing.active");
      case "trial":
        return t("billing.trial");
      case "past_due":
        return t("billing.pastDue");
      case "expired":
        return t("billing.expired");
      case "canceled":
        return t("billing.canceled");
      default:
        return status;
    }
  };

  const handleAddCard = async () => {
    if (!tenantId) return;
    setProcessing(true);
    try {
      const response = await fetch("/api/conekta/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, type: "card", locale }),
      });

      const data = await response.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast.error(data.error || t("common.error"));
        setProcessing(false);
      }
    } catch {
      toast.error(t("common.error"));
      setProcessing(false);
    }
  };

  const handlePayCash = async () => {
    if (!tenantId) return;
    setProcessing(true);
    try {
      const response = await fetch("/api/conekta/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, type: "cash", locale }),
      });

      const data = await response.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast.error(data.error || t("common.error"));
        setProcessing(false);
      }
    } catch {
      toast.error(t("common.error"));
      setProcessing(false);
    }
  };

  const handleApplyPromo = async () => {
    if (!tenantId || !promoCode.trim()) return;
    setPromoApplying(true);
    try {
      const response = await fetch("/api/promo/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, codigo: promoCode }),
      });
      const data = await response.json();

      if (response.ok && data.ok) {
        toast.success(t("billing.promoApplied", { days: data.trial_days }));
        setPromoCode("");
        fetchSubscription();
      } else {
        const razon = data.error;
        toast.error(
          razon === "usado"
            ? t("billing.promoUsed")
            : razon === "expirado"
              ? t("billing.promoExpired")
              : razon === "suscripcion_activa"
                ? t("billing.promoActiveSub")
                : t("billing.promoInvalid")
        );
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setPromoApplying(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!tenantId) return;
    setProcessing(true);
    try {
      const response = await fetch("/api/conekta/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("common.error"));

      toast.success(t("billing.subscriptionCanceled"));
      setShowCancelDialog(false);
      fetchSubscription();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setProcessing(false);
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge variant="outline" className="border-green-500/40 text-green-600 text-[10px]">
            Pagado
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-500/40 text-[10px]">
            Pendiente
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="text-destructive border-destructive/40 text-[10px]">
            Fallido
          </Badge>
        );
      case "credited":
        return (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 text-[10px]">
            {t("referrals.credited")}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-[10px]">
            {status}
          </Badge>
        );
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "card":
        return "Tarjeta";
      case "cash":
        return "Efectivo";
      case "bank_transfer":
        return "Transferencia";
      case "pay_by_bank":
        return "Pago directo BBVA";
      case "spei":
        return "SPEI";
      case "apple":
        return "Apple Pay";
      case "google":
        return "Google Pay";
      case "bnpl":
        return "Crédito directo";
      case "default":
        return "Tarjeta";
      default:
        return method;
    }
  };

  const referralUrl = getReferralSignupUrl(referralCode);

  const handleCopyReferral = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("common.error"));
    }
  };

  const handleShareWhatsApp = () => {
    const message = encodeURIComponent(
      `${t("referrals.whatsappMessage")} ${referralUrl}`
    );
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  if (!tenantLoading && !tenantId) {
    return (
      <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
        No se encontró la suscripción del tenant.
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

  if (isDemo) {
    return (
      <div className="space-y-6">
        <DemoRestrictedNotice />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="animate-fade-in-up stagger-1">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
          {t("billing.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("billing.description")}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="animate-fade-in-up stagger-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {t("billing.subscriptionStatus")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("billing.status")}:
              </span>
              <Badge
                variant="outline"
                className={getStatusColor(subscription?.status || "expired")}
              >
                {getStatusLabel(subscription?.status || "expired")}
              </Badge>
            </div>

            {subscription?.status === "trial" && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-blue-500" />
                <span>
                  {t("billing.trialEndsIn", { days: getDaysLeft() })}
                </span>
              </div>
            )}

            {subscription?.current_period_end && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {t("billing.nextBilling")}:{" "}
                  {new Date(
                    subscription.current_period_end
                  ).toLocaleDateString()}
                </span>
              </div>
            )}

            {subscription?.last_payment_at && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>
                  {t("billing.lastPayment")}:{" "}
                  {new Date(
                    subscription.last_payment_at
                  ).toLocaleDateString()}
                </span>
              </div>
            )}

            {payments[0]?.status === "pending" && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <p className="font-medium text-amber-600">
                    {t("billing.paymentPending")}
                  </p>
                  <p className="text-muted-foreground">
                    {t("billing.paymentPendingDescription")}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="animate-fade-in-up stagger-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {t("billing.paymentMethod")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("billing.plan")}:
              </span>
              <span className="text-sm font-medium">SYMVORA Basico - $400/mes</span>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex flex-col gap-4">
                <SpecularActionButton
                  tone="money"
                  onClick={handleAddCard}
                  disabled={processing || !tenantId}
                  className="w-full h-9"
                >
                  {t("billing.addCard")}
                </SpecularActionButton>

                <SpecularActionButton
                  tone="money"
                  onClick={handlePayCash}
                  disabled={processing || !tenantId}
                  className="w-full h-9"
                >
                  {t("billing.payCash")}
                </SpecularActionButton>
              </div>

              {subscription?.status !== "active" && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={t("billing.promoPlaceholder")}
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    maxLength={40}
                    autoComplete="off"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <Button
                    onClick={handleApplyPromo}
                    disabled={promoApplying || !promoCode.trim()}
                    className="shrink-0"
                    variant="outline"
                    size="sm"
                  >
                    {promoApplying ? t("common.loading") : t("billing.promoApply")}
                  </Button>
                </div>
              )}
            </div>

            {subscription?.status !== "canceled" && (
              <>
                <Separator />
                <SpecularActionButton
                  tone="destructive"
                  onClick={() => setShowCancelDialog(true)}
                  disabled={processing}
                  className="w-full h-8"
                >
                  {t("billing.cancelSubscription")}
                </SpecularActionButton>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="animate-fade-in-up stagger-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Gift className="h-4 w-4 text-muted-foreground" />
            {t("referrals.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("referrals.subtitle")}
          </p>

          {referralCode ? (
            <>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm font-mono">
                  {referralUrl}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0"
                  onClick={handleCopyReferral}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span className="ml-1.5">
                    {copied ? t("referrals.copied") : t("referrals.copy")}
                  </span>
                </Button>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleShareWhatsApp}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                {t("referrals.shareWhatsapp")}
              </Button>

              {subscription?.status !== "active" && (
                <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                  <span>{t("referrals.inactiveNote")}</span>
                </div>
              )}
            </>
          ) : null}

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {t("referrals.referralsCount")}
              </div>
              <div className="mt-1 text-xl font-semibold">
                {referrals.length}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Gift className="h-3.5 w-3.5" />
                {t("referrals.monthsWon")}
              </div>
              <div className="mt-1 text-xl font-semibold">
                {referrals.filter((r) => r.estado === "CONVERTIDO").length}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle className="h-3.5 w-3.5" />
                {t("referrals.creditsAvailable")}
              </div>
              <div className="mt-1 text-xl font-semibold">
                {subscription?.creditos_mes_gratis ?? 0}
              </div>
            </div>
          </div>

          {referrals.length > 0 && (
            <div className="space-y-2">
              {referrals.map((r) => {
                const refDate = r.registrado_en || r.convertido_en;
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span className="text-muted-foreground">
                      {refDate
                        ? new Date(refDate).toLocaleDateString(locale)
                        : "—"}
                    </span>
                    <Badge
                      variant={r.estado === "CONVERTIDO" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {r.estado === "CONVERTIDO"
                        ? t("referrals.converted")
                        : t("referrals.registered")}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up stagger-5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            {t("billing.paymentHistory")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              {t("billing.noPayments")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase tracking-wider">Fecha</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Método</TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider">Monto</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Estado</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Referencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(payment.paid_at || payment.created_at).toLocaleString("es-MX", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {getPaymentMethodLabel(payment.payment_method)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        ${payment.amount.toFixed(2)} {payment.currency}
                      </TableCell>
                      <TableCell>{getPaymentStatusBadge(payment.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {payment.conekta_order_id || payment.reference || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("billing.cancelSubscription")}</DialogTitle>
            <DialogDescription>{t("billing.confirmCancel")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setShowCancelDialog(false)}
              disabled={processing}
            >
              {t("common.cancel")}
            </Button>
            <SpecularActionButton
              tone="destructive"
              className="h-8"
              onClick={handleCancelSubscription}
              disabled={processing}
            >
              {processing ? t("common.loading") : t("billing.cancelSubscription")}
            </SpecularActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
