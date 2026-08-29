"use client";

import { Suspense, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle, Clock, ArrowRight } from "lucide-react";

function BillingSuccessContent() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const billingPath = `/${locale}/billing`;
  const isPaid = searchParams.get("payment_status") === "paid";
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push(billingPath);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router, billingPath]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center">
            {isPaid ? (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            )}
          </div>
          <CardTitle className="text-xl mt-4">
            {isPaid ? t("billing.paymentSuccess") : t("billing.paymentPending")}
          </CardTitle>
          <CardDescription>
            {isPaid
              ? t("billing.paymentSuccessDescription")
              : t("billing.paymentPendingDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("billing.redirectingIn", { seconds: countdown })}
          </p>
          <Button
            onClick={() => router.push(billingPath)}
            className="w-full"
          >
            {t("billing.goToBilling")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={null}>
      <BillingSuccessContent />
    </Suspense>
  );
}
