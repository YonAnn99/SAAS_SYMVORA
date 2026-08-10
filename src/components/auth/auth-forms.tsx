"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/ui/password-input";
import { ColorPicker } from "@/components/ui/color-picker";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { loginSchema, signupSchema } from "@/lib/validations/schemas";
import "@/styles/auth-toggle.css";

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

type AuthMode = "login" | "signup";

export function AuthForms({ initialMode = "login" }: { initialMode?: AuthMode }) {
  const t = useTranslations();
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>(initialMode);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

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
  const [colorPrimario, setColorPrimario] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

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
    setLoginLoading(true);

    const validation = loginSchema.safeParse({
      email: loginEmail,
      password: loginPassword,
    });

    if (!validation.success) {
      setLoginError(validation.error.issues[0].message);
      setLoginLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (authError) {
      setLoginError(authError.message);
      setLoginLoading(false);
      return;
    }

    router.push("/es/dashboard");
    router.refresh();
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);
    setSignupLoading(true);

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
      color_primario: colorPrimario || undefined,
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
        data: {
          nombre: fullName,
          nombre_establecimiento: nombreEstablecimiento,
        },
      },
    });

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
      }
    }

    const { error: tenantError } = await supabase.from("tenants").insert({
      nombre_comercial: nombreEstablecimiento,
      subdominio: nombreEstablecimiento
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 30),
      giro_comercial: giroComercial,
      logo_url: logoUrl,
      color_primario: colorPrimario,
    });

    if (tenantError) {
      setSignupError(tenantError.message);
      setSignupLoading(false);
      return;
    }

    router.push("/es/onboarding");
    router.refresh();
  };

  const inputStyle = { width: "100%", marginBottom: "6px" };

  return (
    <div className={`auth-container ${mode === "signup" ? "active" : ""}`} id="authContainer">
      {/* ── SIGN UP FORM ── */}
      <div className="auth-form-container auth-sign-up">
        <div className="auth-form-scroll">
          <form onSubmit={handleSignup} style={{ alignItems: "stretch" }}>
            {signupError && (
              <div style={{
                width: "100%",
                padding: "10px",
                marginBottom: "10px",
                backgroundColor: "#fee2e2",
                color: "#dc2626",
                borderRadius: "8px",
                fontSize: "12px",
                textAlign: "center"
              }}>
                {signupError}
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
                <div style={{ width: "100%", marginBottom: "6px" }}>
                  <Select value={giroComercial} onValueChange={(v) => setGiroComercial(v || "GENERAL")}>
                    <SelectTrigger style={{ width: "100%", height: "40px", backgroundColor: "#f0f0f0", border: "none", borderRadius: "8px", fontSize: "13px", color: "#1a1a1a" }}>
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
                <div style={{ width: "100%", marginBottom: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 500, color: "#1a1a1a", marginBottom: "4px", display: "block" }}>
                    {t("auth.logo")}
                  </label>
                  {logoPreview ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <img
                        src={logoPreview}
                        alt="Logo"
                        style={{ width: "36px", height: "36px", borderRadius: "8px", objectFit: "cover", border: "1px solid #e0e0e0" }}
                      />
                      <button
                        type="button"
                        onClick={handleLogoRemove}
                        style={{ fontSize: "12px", color: "#dc2626", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                      >
                        {t("common.delete") || "Eliminar"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      style={{
                        width: "100%",
                        height: "40px",
                        backgroundColor: "#f0f0f0",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "13px",
                        color: "#888",
                        cursor: "pointer",
                        textAlign: "left",
                        padding: "0 14px",
                      }}
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

              <AccordionItem title={t("auth.customization") || "Personalización"} index={3}>
                <div style={{ width: "100%", margin: "6px 0" }}>
                  <ColorPicker
                    value={colorPrimario}
                    onChange={setColorPrimario}
                    label={t("auth.colorPalette")}
                  />
                </div>
              </AccordionItem>
            </Accordion>

            <button type="submit" className="auth-btn" disabled={signupLoading} style={{ width: "100%", marginTop: "16px" }}>
              {signupLoading ? t("common.loading") : t("auth.signup")}
            </button>

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
        <form onSubmit={handleLogin} style={{ justifyContent: "center" }}>
          <div className="auth-form-center">
            <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "4px", color: "#1a1a1a" }}>
              {t("auth.login")}
            </h1>
          </div>

          <span style={{ color: "#555", fontSize: "13px" }}>
            {t("auth.loginSubtitle")}
          </span>

          {loginError && (
            <div style={{
              width: "100%",
              padding: "10px",
              marginBottom: "10px",
              backgroundColor: "#fee2e2",
              color: "#dc2626",
              borderRadius: "8px",
              fontSize: "12px",
              textAlign: "center"
            }}>
              {loginError}
            </div>
          )}

          <input
            type="email"
            placeholder={t("auth.emailPlaceholder")}
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder={t("auth.passwordPlaceholder")}
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            required
          />

          <a href="#" style={{ alignSelf: "flex-start", margin: "5px 0 15px", color: "#333", fontSize: "13px" }}>
            {t("auth.forgotPassword")}
          </a>

          <button type="submit" className="auth-btn" disabled={loginLoading} style={{ width: "100%" }}>
            {loginLoading ? t("common.loading") : t("auth.login")}
          </button>

          <div className="auth-form-link">
            {t("auth.noAccount")}{" "}
            <button type="button" onClick={() => setMode("signup")}>
              {t("auth.signup")}
            </button>
          </div>
        </form>
      </div>

      {/* ── TOGGLE PANEL ── */}
      <div className="auth-toggle-container">
        <div className="auth-toggle">
          <div className="auth-toggle-panel auth-toggle-left">
            <img src="/symvora-logo.png" alt="SYMVORA" className="auth-logo" />
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
            <img src="/symvora-logo.png" alt="SYMVORA" className="auth-logo" />
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
    </div>
  );
}
