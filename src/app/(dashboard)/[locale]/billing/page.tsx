"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { toast } from "sonner";
import {
  CreditCard,
  Clock,
  CheckCircle,
  ExternalLink,
  Calendar,
} from "lucide-react";

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
}

export default function BillingPage() {
  const t = useTranslations();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

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
      }
    } catch {
      // Subscription might not exist yet for new users
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
        body: JSON.stringify({ tenant_id: tenantId, type: "card" }),
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

  const handlePayOxxo = async () => {
    if (!tenantId) return;
    setProcessing(true);
    try {
      const response = await fetch("/api/conekta/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, type: "oxxo" }),
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

  const handleCancelSubscription = async () => {
    if (!confirm(t("billing.confirmCancel"))) return;
    setProcessing(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId);

      if (error) throw error;

      await supabase
        .from("tenants")
        .update({ subscription_status: "canceled" })
        .eq("id", tenantId);

      toast.success(t("billing.subscriptionCanceled"));
      fetchSubscription();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setProcessing(false);
    }
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
              <Button
                onClick={handleAddCard}
                disabled={processing || !tenantId}
                className="w-full"
                variant="outline"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {t("billing.addCard")}
              </Button>

              <Button
                onClick={handlePayOxxo}
                disabled={processing || !tenantId}
                className="w-full"
                variant="outline"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {t("billing.payOxxo")}
              </Button>
            </div>

            {subscription?.status !== "canceled" && (
              <>
                <Separator />
                <Button
                  onClick={handleCancelSubscription}
                  disabled={processing}
                  variant="destructive"
                  className="w-full"
                  size="sm"
                >
                  {t("billing.cancelSubscription")}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="animate-fade-in-up stagger-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            {t("billing.paymentHistory")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-8">
            {t("billing.noPayments")}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
