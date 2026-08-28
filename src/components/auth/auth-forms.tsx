"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/ui/password-input";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getAppUrl } from "@/lib/site";
import { loginSchema, signupSchema } from "@/lib/validations/schemas";
import { LEGAL_DOCUMENT_VERSIONS } from "@/lib/legal/versions";
import "@/styles/auth-toggle.css";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.806.54-1.8368.8595-3.0477.8595-2.3441 0-4.3282-1.5832-5.036-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z"
      />
      <path
        fill="#EA4335"
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <rect width="8" height="8" fill="#F25022" />
      <rect x="10" width="8" height="8" fill="#7FBA00" />
      <rect y="10" width="8" height="8" fill="#00A4EF" />
      <rect x="10" y="10" width="8" height="8" fill="#FFB900" />
    </svg>
  );
}

function convertToWebP(file: File): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      canvas.toBlob(
        (blob) => {
          const webpFile = new File([blob!], "logo.webp", {
            type: "image/webp",
          });
          resolve(webpFile);
        },
        "image/webp",
        0.9
      );
    };

    img.src = url;
  });
}

type AuthMode = "login" | "signup" | "forgot" | "key";

export function AuthForms({
  initialMode = "login",
  referralCode = null,
  referrerBusinessName = null,
}: {
  initialMode?: AuthMode;
  referralCode?: string | null;
  referrerBusinessName?: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();

  const [mode, setMode] = useState<AuthMode>(initialMode);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const turnstileForgotRef = useRef<TurnstileInstance>(null);
  const [forgotCaptchaToken, setForgotCaptchaToken] = useState<string | null>(null);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Key login state
  const [keyEmail, setKeyEmail] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keyLoading, setKeyLoading] = useState(false);

  // Signup state
  const [nombre, setNombre] = useState("");
  const [segundoNombre, setSegundoNombre] = useState("");
  const [apellidoPaterno, setApellidoPaterno] = useState("");
  const [apellidoMaterno, setApellidoMaterno] = useState("");
  const [nombreEstablecimiento, setNombreEstablecimiento] = useState("");
  const [giroComercial, setGiroComercial] = useState<string>("GENERAL");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [showPromoInput, setShowPromoInput] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const turnstileLoginRef = useRef<TurnstileInstance>(null);
  const turnstileSignupRef = useRef<TurnstileInstance>(null);
  const turnstileKeyRef = useRef<TurnstileInstance>(null);
  const [loginCaptchaToken, setLoginCaptchaToken] = useState<string | null>(null);
  const [signupCaptchaToken, setSignupCaptchaToken] = useState<string | null>(null);
  const [keyCaptchaToken, setKeyCaptchaToken] = useState<string | null>(null);

  const loginMaxAttempts = 5;
  const [failedLoginAttempts, setFailedLoginAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [lockRemaining, setLockRemaining] = useState(0);
  const [oauthLoading, setOauthLoading] = useState<"google" | "azure" | null>(null);

  useEffect(() => {
    if (lockUntil <= Date.now()) return;
    const tick = () => {
      const remaining = Math.max(0, Math.round((lockUntil - Date.now()) / 1000));
      setLockRemaining(remaining);
      if (remaining === 0) {
        setLockUntil(0);
        setLockRemaining(0);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lockUntil]);

  const handleLogoSelect = useCallback((file: File) => {
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }, []);

  const handleLogoRemove = useCallback(() => {
    setLogoFile(null);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
  }, [logoPreview]);

  const handleLogoInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!["image/jpeg", "image/png", "image/svg+xml"].includes(file.type)) {
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (Date.now() < lockUntil) {
      setLoginError(
        `${t("auth.tooManyAttempts") || "Demasiados intentos. Intenta de nuevo en"} ${
          lockRemaining || 1
        }s.`
      );
      return;
    }

    if (turnstileSiteKey && !loginCaptchaToken) {
      setLoginError(t("auth.captchaRequired") || "Resuelve el captcha para continuar");
      return;
    }

    const validation = loginSchema.safeParse({
      email: loginEmail,
      password: loginPassword,
    });

    if (!validation.success) {
      setLoginError(validation.error.issues[0].message);
      setLoginLoading(false);
      return;
    }

    setLoginLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
      options: { captchaToken: loginCaptchaToken ?? undefined },
    });

    if (authError) {
      const attempts = failedLoginAttempts + 1;
      setFailedLoginAttempts(attempts);
      if (attempts >= loginMaxAttempts) {
        const backoffSecs = Math.min(
          15 * 60,
          30 * Math.pow(2, attempts - loginMaxAttempts)
        );
        setLockUntil(Date.now() + backoffSecs * 1000);
        setLockRemaining(backoffSecs);
      }
      setLoginError(authError.message);
      setLoginCaptchaToken(null);
      turnstileLoginRef.current?.reset();
      setLoginLoading(false);
      return;
    }

    setFailedLoginAttempts(0);
    setLoginCaptchaToken(null);
    turnstileLoginRef.current?.reset();
    router.push(`/${locale}/dashboard`);
    router.refresh();
  };

  const handleKeyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeyError(null);
    setKeyLoading(true);

    if (turnstileSiteKey && !keyCaptchaToken) {
      setKeyError(t("auth.captchaRequired") || "Resuelve el captcha para continuar");
      setKeyLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/key-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: keyEmail, key: keyValue.toUpperCase() }),
      });

      const data = await res.json();
      console.log("[key-login] API response:", res.status, JSON.stringify(data).substring(0, 200));

      if (!res.ok) {
        setKeyError(data.error || "Error al iniciar sesión");
        setKeyLoading(false);
        return;
      }

      // Sign in with the temporary password the server generated
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
        options: { captchaToken: keyCaptchaToken ?? undefined },
      });

      if (authError) {
        console.error("[key-login] signInWithPassword error:", authError.message, authError.status);
        setKeyError(`Error al iniciar sesión: ${authError.message}`);
        setKeyLoading(false);
        setKeyCaptchaToken(null);
        turnstileKeyRef.current?.reset();
        return;
      }

      setKeyCaptchaToken(null);
      turnstileKeyRef.current?.reset();
      router.push(`/${locale}/dashboard`);
      router.refresh();
    } catch (err) {
      console.error("[key-login] Connection error:", err);
      setKeyError("Error de conexión");
      setKeyLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    if (turnstileSiteKey && !forgotCaptchaToken) {
      setForgotError(t("auth.captchaRequired") || "Resuelve el captcha para continuar");
      return;
    }

    setForgotLoading(true);

    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${getAppUrl()}/${locale}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo,
      captchaToken: forgotCaptchaToken ?? undefined,
    });

    if (error) {
      setForgotError(error.message);
      setForgotLoading(false);
      turnstileForgotRef.current?.reset();
      setForgotCaptchaToken(null);
      return;
    }

    setForgotLoading(false);
    setForgotSent(true);
    turnstileForgotRef.current?.reset();
    setForgotCaptchaToken(null);
  };

  const handleOAuth = async (provider: "google" | "azure") => {
    setLoginError(null);
    setOauthLoading(provider);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });

      if (error) {
        const isUnknownUser =
          error.message.toLowerCase().includes("user not found") ||
          error.message.toLowerCase().includes("user_not_found") ||
          error.message.toLowerCase().includes("not allowed");
        setLoginError(
          isUnknownUser
            ? t("auth.oauthAccountNotFound")
            : error.message
        );
        setOauthLoading(null);
      }
    } catch (err) {
      console.error("OAuth error:", err);
      setLoginError(t("auth.oauthGenericError") || "Error al iniciar sesión con el proveedor");
      setOauthLoading(null);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);
    setSignupLoading(true);

    if (turnstileSiteKey && !signupCaptchaToken) {
      setSignupError(t("auth.captchaRequired") || "Resuelve el captcha para continuar");
      setSignupLoading(false);
      return;
    }

    const validation = signupSchema.safeParse({
      nombre,
      segundo_nombre: segundoNombre || undefined,
      apellido_paterno: apellidoPaterno,
      apellido_materno: apellidoMaterno,
      nombre_establecimiento: nombreEstablecimiento,
      giro_comercial: giroComercial,
      email: signupEmail,
      password: signupPassword,
      password_confirm: passwordConfirm,
      acceptTerms,
    });

    if (!validation.success) {
      setSignupError(validation.error.issues[0].message);
      setSignupLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();

    const fullName = [nombre, segundoNombre, apellidoPaterno, apellidoMaterno]
      .filter(Boolean)
      .join(" ");

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        data: {
          nombre: fullName,
          nombre_establecimiento: nombreEstablecimiento,
          giro_comercial: giroComercial,
        },
        captchaToken: signupCaptchaToken ?? undefined,
      },
    });

    setSignupCaptchaToken(null);
    turnstileSignupRef.current?.reset();

    if (authError) {
      setSignupError(authError.message);
      setSignupLoading(false);
      return;
    }

    if (!authData.user) {
      setSignupError("Error al crear la cuenta");
      setSignupLoading(false);
      return;
    }

    // Validar el código promocional ANTES de crear el tenant: si es inválido
    // el usuario puede corregirlo y reintentar sin dejar registros huérfanos.
    const promoTrimmed = promoCode.trim();
    if (promoTrimmed) {
      const { data: promoCheck } = await supabase.rpc("validar_codigo_promo", {
        p_codigo: promoTrimmed,
      });
      const check = promoCheck as { valido: boolean; razon?: string } | null;
      if (!check?.valido) {
        setSignupError(
          check?.razon === "usado"
            ? t("auth.promoUsed")
            : check?.razon === "expirado"
              ? t("auth.promoExpired")
              : t("auth.promoInvalid")
        );
        setSignupLoading(false);
        return;
      }
    }

    // Registrar la aceptación de documentos legales como evidencia de auditoría.
    // Si falla, no bloqueamos el signup — el consentimiento ya quedó registrado en el click
    // del checkbox y la existencia de la cuenta; el registro en BD es solo evidencia adicional.
    try {
      await fetch("/api/legal/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termsVersion: LEGAL_DOCUMENT_VERSIONS.terms,
          privacyVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
          cookiesVersion: LEGAL_DOCUMENT_VERSIONS.cookies,
        }),
      });
    } catch (err) {
      console.error("Failed to record legal acceptance:", err);
    }

    // Upload logo if provided
    let logoUrl: string | null = null;
    if (logoFile) {
      const webpFile = await convertToWebP(logoFile);
      const filePath = `${authData.user.id}/logo.webp`;
      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(filePath, webpFile, { contentType: "image/webp" });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("logos")
          .getPublicUrl(filePath);
        logoUrl = urlData.publicUrl;

        await supabase.auth.updateUser({
          data: { logo_url: logoUrl },
        });
      }
    }

    // Create tenant via complete_onboarding RPC
    const configuracionJson = {
      giro_comercial: giroComercial,
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
    };

    const subdominio = nombreEstablecimiento
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 30);

    const { data: tenant, error: rpcError } = await supabase.rpc(
      "complete_onboarding",
      {
        p_user_id: authData.user.id,
        p_nombre_comercial: nombreEstablecimiento,
        p_subdominio: subdominio,
        p_giro_comercial: giroComercial,
        p_configuracion_json: configuracionJson,
        p_logo_url: logoUrl,
        p_referral_code: referralCode || null,
      }
    );

    if (rpcError) {
      setSignupError(rpcError.message);
      setSignupLoading(false);
      return;
    }

    if (!tenant?.id) {
      setSignupError("Error al crear el negocio");
      setSignupLoading(false);
      return;
    }

    // Email de bienvenida (fire-and-forget): nunca bloquea ni rompe el signup.
    fetch("/api/email/welcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant.id }),
      keepalive: true,
    }).catch((err) => console.error("Welcome email failed:", err));

    // La suscripción trial (7 días) se crea server-side dentro de
    // complete_onboarding (migración 028) — no insertar aquí.

    // Aplicar código promocional: consume el código y extiende el trial.
    // Si aplica, entra directo al sistema sin pasar por el checkout de Conekta.
    if (promoTrimmed) {
      try {
        const promoRes = await fetch("/api/promo/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenant_id: tenant.id, codigo: promoTrimmed }),
        });
        const promoData = await promoRes.json();
        if (promoRes.ok && promoData.ok) {
          router.push(`/${locale}/dashboard`);
          router.refresh();
          return;
        }
        console.error("Promo apply failed:", promoData.error);
      } catch (err) {
        console.error("Error applying promo:", err);
      }
    }

    // Create Conekta checkout
    try {
      const response = await fetch("/api/conekta/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenant.id, type: "card", locale }),
      });

      const data = await response.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }
    } catch (err) {
      console.error("Error creating checkout:", err);
    }

    // Fallback: go to billing page
    router.push(`/${locale}/billing`);
    router.refresh();
  };

  const inputStyle = { width: "100%", marginBottom: "6px" };

  return (
    <div
      className={`auth-container ${mode === "signup" ? "active" : ""} ${
        mode === "forgot" ? "forgot" : ""
      }`}
      id="authContainer"
    >
      {/* ── MOBILE-ONLY: curved logo header ── */}
      <div className="auth-mobile-header">
        <img src="/symvora-logo.webp" alt="SYMVORA" className="auth-mobile-logo" />
        <span className="auth-mobile-brand">SYMVORA</span>
      </div>

      {/* ── MOBILE-ONLY: pill toggle (replaces the desktop toggle panel on small screens) ── */}
      <div className="auth-mobile-pill-toggle" role="tablist" aria-label={`${t("auth.login")} / ${t("auth.signup")} / ${t("auth.keyLogin")}`}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          className={mode === "login" ? "active" : ""}
          onClick={() => setMode("login")}
        >
          {t("auth.login")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          className={mode === "signup" ? "active" : ""}
          onClick={() => setMode("signup")}
        >
          {t("auth.signup")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "key"}
          className={mode === "key" ? "active" : ""}
          onClick={() => setMode("key")}
        >
          {t("auth.keyLogin")}
        </button>
      </div>

      {/* ── SIGN UP FORM ── */}
      <div className="auth-form-container auth-sign-up">
        <div className="auth-form-scroll">
          <form onSubmit={handleSignup} style={{ alignItems: "stretch" }}>
            {signupError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive text-center">
                {signupError}
              </div>
            )}

            {referralCode && referrerBusinessName && (
              <div
                className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 text-center leading-relaxed"
                role="note"
              >
                {t("auth.referralInvite", { business: referrerBusinessName })}
              </div>
            )}

            <Accordion defaultIndex={0}>
              <AccordionItem title={t("auth.personalData") || "Datos personales"} index={0}>
                <div className="auth-grid-2">
                  <input
                    type="text"
                    placeholder={t("auth.firstName") + " *"}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder={t("auth.middleNameOptional")}
                    value={segundoNombre}
                    onChange={(e) => setSegundoNombre(e.target.value)}
                  />
                </div>
                <div className="auth-grid-2">
                  <input
                    type="text"
                    placeholder={t("auth.lastName") + " *"}
                    value={apellidoPaterno}
                    onChange={(e) => setApellidoPaterno(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder={t("auth.maternalLastName") + " *"}
                    value={apellidoMaterno}
                    onChange={(e) => setApellidoMaterno(e.target.value)}
                    required
                  />
                </div>
              </AccordionItem>

              <AccordionItem title={t("auth.business") || "Empresa"} index={1}>
                <input
                  type="text"
                  placeholder={t("auth.businessName") + " *"}
                  value={nombreEstablecimiento}
                  onChange={(e) => setNombreEstablecimiento(e.target.value)}
                  required
                  style={inputStyle}
                />
                <div className="auth-field-block">
                  <Select value={giroComercial} onValueChange={(v) => setGiroComercial(v || "GENERAL")}>
                    <SelectTrigger className="auth-select-trigger">
                      <SelectValue placeholder={t("auth.businessTypePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ABARROTES">{t("auth.businessTypes.ABARROTES")}</SelectItem>
                      <SelectItem value="VERDULERIA">{t("auth.businessTypes.VERDULERIA")}</SelectItem>
                      <SelectItem value="MASCOTAS">{t("auth.businessTypes.MASCOTAS")}</SelectItem>
                      <SelectItem value="ROPA">{t("auth.businessTypes.ROPA")}</SelectItem>
                      <SelectItem value="FERRETERIA">{t("auth.businessTypes.FERRETERIA")}</SelectItem>
                      <SelectItem value="FARMACIA">{t("auth.businessTypes.FARMACIA")}</SelectItem>
                      <SelectItem value="GENERAL">{t("auth.businessTypes.GENERAL")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="auth-field-block">
                  <label className="auth-field-label">
                    {t("auth.logo")}
                  </label>
                  {logoPreview ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <img
                        src={logoPreview}
                        alt="Logo"
                        className="auth-logo-preview-img"
                      />
                      <button
                        type="button"
                        onClick={handleLogoRemove}
                        className="auth-logo-remove-btn"
                      >
                        {t("common.delete") || "Eliminar"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="auth-logo-select-btn"
                    >
                      {t("auth.logoDragDrop") || "Seleccionar logo (opcional)"}
                    </button>
                  )}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.svg"
                    onChange={handleLogoInputChange}
                    style={{ display: "none" }}
                  />
                </div>
              </AccordionItem>

              <AccordionItem title={t("auth.security") || "Seguridad"} index={2}>
                <input
                  type="email"
                  placeholder={t("auth.email") + " *"}
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                  style={inputStyle}
                />
                <div style={{ width: "100%", marginBottom: "6px" }}>
                  <PasswordInput
                    placeholder={t("auth.password") + " *"}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    showChecklist
                    required
                  />
                </div>
                <div style={{ width: "100%", marginBottom: "6px" }}>
                  <PasswordInput
                    placeholder={t("auth.confirmPasswordLabel") + " *"}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    required
                  />
                </div>
              </AccordionItem>
            </Accordion>

            <div style={{ marginTop: "20px", textAlign: "left" }}>
              {!showPromoInput ? (
                <button
                  type="button"
                  onClick={() => setShowPromoInput(true)}
                  className="auth-inline-link"
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  {t("auth.promoHaveCode")}
                </button>
              ) : (
                <input
                  type="text"
                  placeholder={t("auth.promoPlaceholder")}
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  maxLength={40}
                  autoComplete="off"
                  style={{ ...inputStyle, marginBottom: 0 }}
                />
              )}
            </div>

            <label
              htmlFor="acceptTerms"
              className="auth-terms-label"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                fontSize: "13px",
                lineHeight: "1.6",
                marginTop: "20px",
                paddingTop: "16px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <input
                id="acceptTerms"
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                required
                aria-required="true"
                style={{ marginTop: "3px", flexShrink: 0, width: "16px", height: "16px" }}
              />
              <span>
                {t("auth.acceptTermsIntro")}{" "}
                <Link
                  href={`/${locale}/terminos`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="auth-inline-link"
                >
                  {t("auth.acceptTermsTerms")}
                </Link>
                {t("auth.acceptTermsAnd")}{" "}
                <Link
                  href={`/${locale}/aviso-privacidad`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="auth-inline-link"
                >
                  {t("auth.acceptTermsPrivacy")}
                </Link>
                {t("auth.acceptTermsSuffix")}
              </span>
            </label>

            {turnstileSiteKey && (
              <div style={{ width: "100%", display: "flex", justifyContent: "center", marginTop: "16px" }}>
                <Turnstile
                  id="cf-turnstile-signup"
                  siteKey={turnstileSiteKey}
                  onSuccess={setSignupCaptchaToken}
                  onError={() => setSignupCaptchaToken(null)}
                  onExpire={() => setSignupCaptchaToken(null)}
                  ref={turnstileSignupRef}
                />
              </div>
            )}

            <button type="submit" className="auth-btn" disabled={signupLoading || !acceptTerms} style={{ width: "100%", marginTop: "16px" }}>
              {signupLoading ? t("common.loading") : t("auth.signup")}
            </button>

            <div className="auth-privacy-note">
              {t("auth.privacyAcknowledgment")}{" "}
              <Link
                href={`/${locale}/aviso-privacidad`}
                target="_blank"
                rel="noopener noreferrer"
                className="auth-inline-link"
              >
                {t("auth.privacyLink")}
              </Link>
            </div>

            <div className="auth-form-link">
              {t("auth.hasAccount")}{" "}
              <button type="button" onClick={() => setMode("login")}>
                {t("auth.login")}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── SIGN IN FORM ── */}
      <div className="auth-form-container auth-sign-in">
        {mode === "forgot" ? (
          <form onSubmit={handleForgot} style={{ justifyContent: "center" }}>
            <div className="auth-form-center">
              <h1 className="auth-form-title-text">
                {t("auth.forgotTitle")}
              </h1>
            </div>

            <span className="auth-form-subtitle-text">
              {t("auth.forgotSubtitle")}
            </span>

            {forgotError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive text-center">
                {forgotError}
              </div>
            )}

            {forgotSent ? (
              <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 text-center">
                {t("auth.forgotSent")}
              </div>
            ) : (
              <>
                <input
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                />

                {turnstileSiteKey && (
                  <div style={{ width: "100%", marginBottom: "12px" }}>
                    <Turnstile
                      id="cf-turnstile-forgot"
                      siteKey={turnstileSiteKey}
                      onSuccess={setForgotCaptchaToken}
                      onError={() => setForgotCaptchaToken(null)}
                      onExpire={() => setForgotCaptchaToken(null)}
                      ref={turnstileForgotRef}
                    />
                  </div>
                )}

                <button type="submit" className="auth-btn" disabled={forgotLoading} style={{ width: "100%" }}>
                  {forgotLoading ? t("common.loading") : t("auth.sendResetLink")}
                </button>
              </>
            )}

            <div className="auth-form-link">
              <button type="button" onClick={() => setMode("login")}>
                {t("auth.backToLogin")}
              </button>
            </div>
          </form>
        ) : mode === "key" ? (
          <form onSubmit={handleKeyLogin} style={{ justifyContent: "center" }}>
            <div className="auth-form-center">
              <h1 className="auth-form-title-text">
                {t("auth.keyLoginTitle")}
              </h1>
            </div>

            <span className="auth-form-subtitle-text">
              {t("auth.keyLoginSubtitle")}
            </span>

            {keyError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive text-center">
                {keyError}
              </div>
            )}

            <input
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              value={keyEmail}
              onChange={(e) => setKeyEmail(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder={t("auth.inviteKeyPlaceholder")}
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value.toUpperCase())}
              maxLength={8}
              autoComplete="off"
              required
              style={{ letterSpacing: "2px", textTransform: "uppercase" }}
            />

            {turnstileSiteKey && (
              <div style={{ width: "100%", marginBottom: "12px" }}>
                <Turnstile
                  id="cf-turnstile-key"
                  siteKey={turnstileSiteKey}
                  onSuccess={setKeyCaptchaToken}
                  onError={() => setKeyCaptchaToken(null)}
                  onExpire={() => setKeyCaptchaToken(null)}
                  ref={turnstileKeyRef}
                />
              </div>
            )}

            <button type="submit" className="auth-btn" disabled={keyLoading} style={{ width: "100%", marginTop: "12px" }}>
              {keyLoading ? t("common.loading") : t("auth.enterWithKey")}
            </button>

            <div className="auth-form-link">
              <button type="button" onClick={() => setMode("login")}>
                {t("auth.backToLogin")}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLogin} style={{ justifyContent: "center" }}>
          <div className="auth-form-center">
            <h1 className="auth-form-title-text">
              {t("auth.login")}
            </h1>
          </div>

          <span className="auth-form-subtitle-text">
            {t("auth.loginSubtitle")}
          </span>

          {loginError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive text-center">
              {loginError}
            </div>
          )}

          <div className="auth-social-icons auth-social-icons-buttons">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              disabled={oauthLoading !== null}
              className="auth-social-btn"
              aria-label={t("auth.continueWithGoogle")}
            >
              <GoogleIcon />
              <span>{t("auth.continueWithGoogle")}</span>
            </button>
          </div>

          <div className="auth-divider">
            <span>{t("auth.orContinueWith")}</span>
          </div>

          <input
            type="email"
            placeholder={t("auth.emailPlaceholder")}
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            required
          />
          <PasswordInput
            placeholder={t("auth.passwordPlaceholder")}
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            required
            className="auth-password-input"
          />

          <div className="auth-login-row">
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="auth-forgot-link"
            >
              {t("auth.forgotPassword")}
            </button>
          </div>

          <label className="auth-remember-me">
            <span>{t("auth.rememberMe")}</span>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span className="auth-remember-switch" aria-hidden="true" />
          </label>

          {turnstileSiteKey && (
            <div style={{ width: "100%", marginBottom: "12px" }}>
              <Turnstile
                id="cf-turnstile-login"
                siteKey={turnstileSiteKey}
                onSuccess={setLoginCaptchaToken}
                onError={() => setLoginCaptchaToken(null)}
                onExpire={() => setLoginCaptchaToken(null)}
                ref={turnstileLoginRef}
              />
            </div>
          )}

          <button type="submit" className="auth-btn" disabled={loginLoading} style={{ width: "100%" }}>
            {loginLoading ? t("common.loading") : t("auth.login")}
          </button>

          <div className="auth-form-link">
            {t("auth.noAccount")}{" "}
            <button type="button" onClick={() => setMode("signup")}>
              {t("auth.signup")}
            </button>
          </div>

          <div className="auth-divider" style={{ marginTop: "16px" }}>
            <span>{t("auth.or")}</span>
          </div>

          <div className="auth-form-link">
            <button type="button" onClick={() => setMode("key")} className="auth-key-login-link">
              {t("auth.employeeLogin")}
            </button>
          </div>
        </form>
        )}
      </div>

      {/* ── TOGGLE PANEL ── */}
      {mode !== "forgot" && (
      <div className="auth-toggle-container">
        <div className="auth-toggle">
          <div className="auth-toggle-panel auth-toggle-left">
            <img src="/symvora-logo.webp" alt="SYMVORA" className="auth-logo" />
            <h1>{t("auth.signupTitle")}</h1>
            <p>{t("auth.signupSubtitle")}</p>
            <button
              type="button"
              className="auth-btn hidden"
              onClick={() => setMode("signup")}
            >
              {t("auth.signup")}
            </button>
          </div>

          <div className="auth-toggle-panel auth-toggle-right">
            <img src="/symvora-logo.webp" alt="SYMVORA" className="auth-logo" />
            <h1>{t("auth.loginTitle")}</h1>
            <p>{t("auth.loginSubtitle")}</p>
            <button
              type="button"
              className="auth-btn hidden"
              onClick={() => setMode("login")}
            >
              {t("auth.login")}
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
