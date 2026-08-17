"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/ui/password-input";

const PASSWORD_RULES: Array<{ test: RegExp }> = [
  { test: /.{8,}/ },
  { test: /[A-Z]/ },
  { test: /[a-z]/ },
  { test: /[0-9]/ },
  { test: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/ },
];

function isValidPassword(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test.test(password));
}

type Status = "loading" | "ready" | "invalid" | "success";

export default function ResetPasswordPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [status, setStatus] = useState<Status>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && event === "PASSWORD_RECOVERY" && session) {
        setStatus("ready");
      }
    });

    const tryRecover = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        setStatus("ready");
        return;
      }
      const code = new URL(window.location.href).searchParams.get("code");
      if (code) {
        const { data: exchanged, error } =
          await supabase.auth.exchangeCodeForSession(code);
        if (active && !error && exchanged.session) {
          setStatus("ready");
        }
      }
    };

    tryRecover();

    const timer = window.setTimeout(() => {
      if (active) {
        setStatus((current) => (current === "loading" ? "invalid" : current));
      }
    }, 4000);

    return () => {
      active = false;
      window.clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidPassword(password)) {
      setError(t("auth.passwordRequirements"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.passwordsNoMatch"));
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setStatus("success");
    window.setTimeout(() => {
      router.push(`/${locale}/auth?mode=login`);
    }, 2000);
  };

  return (
    <div className="reset-page">
      <div className="reset-card">
        <img src="/symvora-logo.webp" alt="SYMVORA" className="reset-logo" />

        {status === "loading" && (
          <p className="reset-muted">{t("common.loading")}</p>
        )}

        {status === "invalid" && (
          <>
            <h1>{t("auth.resetTitle")}</h1>
            <p className="reset-muted">{t("auth.resetInvalidLink")}</p>
            <Link href={`/${locale}/auth?mode=login`} className="reset-btn">
              {t("auth.backToLogin")}
            </Link>
          </>
        )}

        {status === "success" && (
          <>
            <h1>{t("auth.resetTitle")}</h1>
            <p className="reset-muted">{t("auth.resetSuccess")}</p>
            <Link href={`/${locale}/auth?mode=login`} className="reset-btn">
              {t("auth.resetGoToLogin")}
            </Link>
          </>
        )}

        {status === "ready" && (
          <form onSubmit={handleSubmit} className="reset-form">
            <h1>{t("auth.resetTitle")}</h1>
            <p className="reset-muted">{t("auth.resetSubtitle")}</p>

            {error && (
              <div className="reset-error">{error}</div>
            )}

            <PasswordInput
              id="reset-password"
              placeholder={t("auth.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              showChecklist
              required
              className="reset-input"
            />

            <PasswordInput
              id="reset-password-confirm"
              placeholder={t("auth.confirmPasswordPlaceholder")}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="reset-input"
            />

            <button type="submit" className="reset-btn" disabled={loading}>
              {loading ? t("common.loading") : t("auth.resetPassword")}
            </button>
          </form>
        )}
      </div>

      <style>{`
        .reset-page {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .reset-card {
          background: #fff;
          border-radius: 30px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
          padding: 40px;
          width: 100%;
          max-width: 440px;
          box-sizing: border-box;
          font-family: 'Montserrat', sans-serif;
          text-align: center;
        }
        .reset-logo {
          height: 48px;
          margin-bottom: 20px;
        }
        .reset-card h1 {
          margin: 0 0 8px;
          font-size: 22px;
          font-weight: 700;
          color: #1a1a1a;
        }
        .reset-muted {
          margin: 16px 0;
          font-size: 14px;
          line-height: 20px;
          color: #555;
        }
        .reset-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
          text-align: left;
        }
        .reset-form .reset-muted {
          margin: 0;
        }
        .reset-form h1 {
          text-align: center;
        }
        .reset-input {
          width: 100%;
        }
        .reset-error {
          background: rgba(220, 38, 38, 0.1);
          color: #dc2626;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 12px;
          text-align: center;
        }
        .reset-btn {
          display: inline-block;
          background: #1a1a1a;
          color: #fff;
          font-family: 'Montserrat', sans-serif;
          font-size: 13px;
          padding: 12px 24px;
          border: 1px solid transparent;
          border-radius: 8px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-top: 10px;
          cursor: pointer;
          transition: all 0.3s ease;
          width: 100%;
          box-sizing: border-box;
          text-align: center;
          text-decoration: none;
        }
        .reset-btn:hover {
          background: #333;
        }
        .reset-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
