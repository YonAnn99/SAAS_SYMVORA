"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { completarRegistroSchema } from "@/lib/validations/schemas";
import { crearNegocio } from "@/features/onboarding/crear-negocio";
import { GIRO_POR_DEFECTO } from "@/features/marketing/giros";
import { GiroSelect } from "./giro-select";
import "@/styles/auth-toggle.css";


/**
 * "Completa tu registro" para quien entro con Google sin tener negocio.
 *
 * Es el formulario de crear cuenta SIN la parte de seguridad (correo y
 * contraseña ya los puso Google) y sin captcha: ya hay una sesion verificada, y
 * `complete_onboarding` solo deja crear UN negocio por usuario (migracion 087).
 * El alta en si la hace `crearNegocio`, la misma que usa el registro con correo.
 */
export function CompletarRegistroForm({
  userId,
  email,
  nombreInicial,
}: {
  userId: string;
  email: string;
  nombreInicial: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [nombre, setNombre] = useState(nombreInicial);
  const [nombreEstablecimiento, setNombreEstablecimiento] = useState("");
  // Slug de uno de los 20 giros (ver `GiroSelect`).
  const [giro, setGiro] = useState<string>(GIRO_POR_DEFECTO);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoRemove = useCallback(() => {
    setLogoFile(null);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
  }, [logoPreview]);

  // Mismas reglas que el registro con correo: JPG, PNG o SVG de hasta 2 MB.
  const handleLogoInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/svg+xml"].includes(file.type)) return;
    if (file.size > 2 * 1024 * 1024) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setError(null);

    const validation = completarRegistroSchema.safeParse({
      nombre,
      nombre_establecimiento: nombreEstablecimiento,
      giro,
      acceptTerms,
    });
    if (!validation.success) {
      setError(validation.error.issues[0].message);
      return;
    }

    setEnviando(true);
    const supabase = createSupabaseBrowserClient();

    // El nombre va al mismo sitio que en el registro con correo
    // (`user_metadata.nombre`), antes del alta: el correo de bienvenida lo usa.
    await supabase.auth.updateUser({ data: { nombre: validation.data.nombre } });

    const resultado = await crearNegocio({
      userId,
      nombreEstablecimiento: validation.data.nombre_establecimiento,
      giro: validation.data.giro,
      logoFile,
      promoCode,
      referralCode: null,
      mensajesPromo: {
        usado: t("auth.promoUsed"),
        expirado: t("auth.promoExpired"),
        invalido: t("auth.promoInvalid"),
      },
    });

    if (!resultado.ok) {
      setError(resultado.error);
      setEnviando(false);
      return;
    }

    // IMPRESCINDIBLE: el token se emitio cuando aun no tenia negocio, y le
    // faltan `user_role` y `tenant_id`. La base decide los permisos leyendo
    // `user_role` del token (`authorize()`), asi que sin renovarlo entraria
    // como SUPER_ADMIN en la interfaz y la base le negaria todo.
    await supabase.auth.refreshSession();

    router.replace(`/${locale}/dashboard`);
    router.refresh();
  };

  const usarOtraCuenta = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace(`/${locale}/auth?mode=login`);
    router.refresh();
  };

  return (
    <div className="auth-container auth-completar">
      <form onSubmit={handleSubmit}>
        <img src="/symvora-logo.webp" alt="SYMVORA" className="auth-completar-logo" />
        <h1 className="auth-form-title-text">{t("auth.completeSignup.title")}</h1>
        <span className="auth-form-subtitle-text">
          {t("auth.completeSignup.subtitle", { email })}
        </span>

        {error && (
          <div className="w-full rounded-lg bg-destructive/10 p-3 text-xs text-destructive text-center mt-3">
            {error}
          </div>
        )}

        <div className="auth-completar-campos">
          <label className="auth-field-label" htmlFor="completar-nombre">
            {t("auth.completeSignup.yourName")} *
          </label>
          <input
            id="completar-nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoComplete="name"
            required
          />

          <label className="auth-field-label" htmlFor="completar-negocio">
            {t("auth.businessName")} *
          </label>
          <input
            id="completar-negocio"
            type="text"
            value={nombreEstablecimiento}
            onChange={(e) => setNombreEstablecimiento(e.target.value)}
            autoComplete="organization"
            required
          />

          <div className="auth-field-block">
            <GiroSelect
              value={giro}
              onChange={setGiro}
              placeholder={t("auth.businessTypePlaceholder")}
              triggerClassName="auth-select-trigger"
            />
          </div>

          <div className="auth-field-block">
            <label className="auth-field-label">{t("auth.logo")}</label>
            {logoPreview ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <img src={logoPreview} alt="Logo" className="auth-logo-preview-img" />
                <button type="button" onClick={handleLogoRemove} className="auth-logo-remove-btn">
                  {t("common.delete")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="auth-logo-select-btn"
              >
                {t("auth.logoDragDrop")}
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

          <div style={{ marginTop: "12px", textAlign: "left" }}>
            {!showPromoInput ? (
              <button
                type="button"
                onClick={() => setShowPromoInput(true)}
                className="auth-inline-link"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "13px" }}
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
              />
            )}
          </div>

          <label htmlFor="completar-terminos" className="auth-terms-label auth-completar-terminos">
            <input
              id="completar-terminos"
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              required
              aria-required="true"
            />
            <span>
              {t("auth.acceptTermsIntro")}{" "}
              <Link href={`/${locale}/terminos`} target="_blank" rel="noopener noreferrer" className="auth-inline-link">
                {t("auth.acceptTermsTerms")}
              </Link>
              {t("auth.acceptTermsAnd")}{" "}
              <Link href={`/${locale}/aviso-privacidad`} target="_blank" rel="noopener noreferrer" className="auth-inline-link">
                {t("auth.acceptTermsPrivacy")}
              </Link>
              {t("auth.acceptTermsSuffix")}
            </span>
          </label>
        </div>

        <button
          type="submit"
          className="auth-btn"
          disabled={enviando || !acceptTerms}
          style={{ width: "100%", marginTop: "16px" }}
        >
          {enviando ? t("common.loading") : t("auth.completeSignup.submit")}
        </button>

        <div className="auth-form-link">
          <button type="button" onClick={() => void usarOtraCuenta()} disabled={enviando}>
            {t("auth.completeSignup.notYou")}
          </button>
        </div>
      </form>
    </div>
  );
}
