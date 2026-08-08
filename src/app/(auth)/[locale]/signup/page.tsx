"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { FileUpload } from "@/components/ui/file-upload";
import { ColorPicker } from "@/components/ui/color-picker";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { signupSchema } from "@/lib/validations/schemas";

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

export default function SignupPage() {
  const t = useTranslations();
  const router = useRouter();

  const [nombre, setNombre] = useState("");
  const [segundoNombre, setSegundoNombre] = useState("");
  const [apellidoPaterno, setApellidoPaterno] = useState("");
  const [apellidoMaterno, setApellidoMaterno] = useState("");
  const [nombreEstablecimiento, setNombreEstablecimiento] = useState("");
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [colorPrimario, setColorPrimario] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogoSelect = useCallback((file: File) => {
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }, []);

  const handleLogoRemove = useCallback(() => {
    setLogoFile(null);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
  }, [logoPreview]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const validation = signupSchema.safeParse({
      nombre,
      segundo_nombre: segundoNombre || undefined,
      apellido_paterno: apellidoPaterno,
      apellido_materno: apellidoMaterno,
      nombre_establecimiento: nombreEstablecimiento,
      email,
      email_confirm: emailConfirm,
      password,
      password_confirm: passwordConfirm,
      color_primario: colorPrimario || undefined,
    });

    if (!validation.success) {
      setError(validation.error.issues[0].message);
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();

    const fullName = [nombre, segundoNombre, apellidoPaterno, apellidoMaterno]
      .filter(Boolean)
      .join(" ");

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre: fullName,
          nombre_establecimiento: nombreEstablecimiento,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!authData.user) {
      setError("Error al crear la cuenta");
      setLoading(false);
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
      giro_comercial: "GENERAL",
      logo_url: logoUrl,
      color_primario: colorPrimario,
    });

    if (tenantError) {
      setError(tenantError.message);
      setLoading(false);
      return;
    }

    router.push("/es/onboarding");
    router.refresh();
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t("auth.signupTitle")}</CardTitle>
        <CardDescription>{t("auth.signupSubtitle")}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Nombre */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("common.name")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nombre" className="text-xs">
                  {t("auth.firstName")} *
                </Label>
                <Input
                  id="nombre"
                  placeholder="Juan"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="segundo_nombre" className="text-xs">
                  {t("auth.middleNameOptional")}
                </Label>
                <Input
                  id="segundo_nombre"
                  placeholder="Carlos"
                  value={segundoNombre}
                  onChange={(e) => setSegundoNombre(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apellido_paterno" className="text-xs">
                  {t("auth.lastName")} *
                </Label>
                <Input
                  id="apellido_paterno"
                  placeholder="Pérez"
                  value={apellidoPaterno}
                  onChange={(e) => setApellidoPaterno(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apellido_materno" className="text-xs">
                  {t("auth.maternalLastName")} *
                </Label>
                <Input
                  id="apellido_materno"
                  placeholder="López"
                  value={apellidoMaterno}
                  onChange={(e) => setApellidoMaterno(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Establecimiento */}
          <div className="space-y-1.5">
            <Label htmlFor="nombre_establecimiento">
              {t("auth.businessName")} *
            </Label>
            <Input
              id="nombre_establecimiento"
              placeholder={t("auth.businessNamePlaceholder")}
              value={nombreEstablecimiento}
              onChange={(e) => setNombreEstablecimiento(e.target.value)}
              required
            />
          </div>

          {/* Email */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("common.email")}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">
                {t("common.email")} *
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email_confirm" className="text-xs">
                {t("auth.confirmEmail")} *
              </Label>
              <Input
                id="email_confirm"
                type="email"
                placeholder={t("auth.confirmEmailPlaceholder")}
                value={emailConfirm}
                onChange={(e) => setEmailConfirm(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Contraseña */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("common.password")}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">
                {t("common.password")} *
              </Label>
              <PasswordInput
                id="password"
                placeholder={t("auth.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                showChecklist
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password_confirm" className="text-xs">
                {t("auth.confirmPassword")} *
              </Label>
              <PasswordInput
                id="password_confirm"
                placeholder={t("auth.confirmPasswordPlaceholder")}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Logo */}
          <FileUpload
            onFileSelect={handleLogoSelect}
            onFileRemove={handleLogoRemove}
            preview={logoPreview}
            label={t("auth.logo")}
            dragDropText={t("auth.logoDragDrop")}
            maxSizeText={t("auth.logoMaxSize")}
          />

          {/* Color */}
          <ColorPicker
            value={colorPrimario}
            onChange={setColorPrimario}
            label={t("auth.colorPalette")}
          />
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("common.loading") : t("auth.signup")}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t("auth.hasAccount")}{" "}
            <Link href="/es/login" className="text-primary underline">
              {t("auth.login")}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
