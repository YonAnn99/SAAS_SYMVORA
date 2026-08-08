"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validations/schemas";

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      setError(validation.error.issues[0].message);
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/es/dashboard");
    router.refresh();
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background text-sm font-bold">
            S
          </div>
          <span className="text-lg font-semibold tracking-tight">SYMVORA</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("auth.loginTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.loginSubtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">
            {t("common.email")}
          </Label>
          <Input
            id="email"
            type="email"
            placeholder={t("auth.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium">
              {t("common.password")}
            </Label>
            <Link
              href="/es/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("auth.forgotPassword")}
            </Link>
          </div>
          <PasswordInput
            id="password"
            placeholder={t("auth.passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11"
            required
          />
        </div>

        <Button
          type="submit"
          className="h-11 w-full text-sm font-medium"
          disabled={loading}
        >
          {loading ? t("common.loading") : t("auth.login")}
        </Button>
      </form>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {t("auth.noAccount")}{" "}
          <Link
            href="/es/signup"
            className="font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
          >
            {t("auth.signup")}
          </Link>
        </p>
      </div>
    </div>
  );
}
