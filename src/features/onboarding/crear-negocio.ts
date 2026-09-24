import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { LEGAL_DOCUMENT_VERSIONS } from "@/lib/legal/versions";
import { convertToWebP } from "@/lib/image";
import { modulosParaGiro } from "@/lib/modulos";
import { GIRO_POR_DEFECTO, giroDeRegistro } from "@/features/marketing/giros";

/**
 * Da de alta el negocio de un usuario que YA tiene sesion: el ultimo tramo del
 * registro, comun a las dos puertas de entrada.
 *
 * - Registro con correo (`handleSignup`): se llama justo despues de `signUp`.
 * - Entrada con Google: Supabase crea el usuario al volver de Google, pero no
 *   su negocio. La pantalla "Completa tu registro" lo termina con esto.
 *
 * Antes este codigo vivia solo en `handleSignup` y por eso quien entraba con
 * Google se quedaba sin negocio, sin rol y con el menu a medias.
 */

export interface DatosNegocio {
  userId: string;
  nombreEstablecimiento: string;
  /** Slug del giro (`papelerias`); ver `GIROS` en `features/marketing/giros.ts`. */
  giro: string;
  logoFile: File | null;
  promoCode: string;
  referralCode: string | null;
  /** Textos ya traducidos para los motivos de rechazo del codigo promocional. */
  mensajesPromo: { usado: string; expirado: string; invalido: string };
}

export type ResultadoCrearNegocio =
  | { ok: true; tenantId: string }
  | { ok: false; error: string };

export async function crearNegocio(datos: DatosNegocio): Promise<ResultadoCrearNegocio> {
  const supabase = createSupabaseBrowserClient();

  // Validar el código promocional ANTES de crear el tenant: si es inválido
  // el usuario puede corregirlo y reintentar sin dejar registros huérfanos.
  const promoTrimmed = datos.promoCode.trim();
  if (promoTrimmed) {
    const { data: promoCheck } = await supabase.rpc("validar_codigo_promo", {
      p_codigo: promoTrimmed,
    });
    const check = promoCheck as { valido: boolean; razon?: string } | null;
    if (!check?.valido) {
      return {
        ok: false,
        error:
          check?.razon === "usado"
            ? datos.mensajesPromo.usado
            : check?.razon === "expirado"
              ? datos.mensajesPromo.expirado
              : datos.mensajesPromo.invalido,
      };
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
  if (datos.logoFile) {
    const webpFile = await convertToWebP(datos.logoFile);
    const filePath = `${datos.userId}/logo.webp`;
    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(filePath, webpFile, { contentType: "image/webp" });

    if (uploadError) {
      console.error("Logo upload failed:", uploadError);
      toast.warning(
        "No se pudo subir el logo. Podrás agregarlo después desde Configuración."
      );
    } else {
      const { data: urlData } = supabase.storage.from("logos").getPublicUrl(filePath);
      logoUrl = urlData.publicUrl;

      await supabase.auth.updateUser({
        data: { logo_url: logoUrl },
      });
    }
  }

  // El giro elegido (uno de los 20 de la landing) se guarda de dos formas:
  // su CONFIGURACION en `tenants.giro_comercial` (los 7 valores de siempre) y
  // el giro exacto en `giro_detalle`. Un slug desconocido cae en General.
  const giro = giroDeRegistro(datos.giro) ?? giroDeRegistro(GIRO_POR_DEFECTO)!;
  const giroComercial = giro.config;

  // Create tenant via complete_onboarding RPC
  const configuracionJson = {
    giro_comercial: giroComercial,
    giro_detalle: giro.slug,
    // Los modulos de su configuracion MAS los que recomienda la pagina de su
    // giro en la landing: nace con lo que se le prometio (una ferreteria con
    // venta por metro, una florería con servicios). Ver `@/lib/modulos`.
    modulos_activos: modulosParaGiro(giro),
    pos_config: {
      teclado_rapido: true,
      lector_barras: true,
      impresion_automatica: true,
    },
  };

  const subdominio = datos.nombreEstablecimiento
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 30);

  const { data: tenant, error: rpcError } = await supabase.rpc("complete_onboarding", {
    p_user_id: datos.userId,
    p_nombre_comercial: datos.nombreEstablecimiento,
    p_subdominio: subdominio,
    p_giro_comercial: giroComercial,
    p_configuracion_json: configuracionJson,
    p_logo_url: logoUrl,
    p_referral_code: datos.referralCode || null,
  });

  if (rpcError) return { ok: false, error: rpcError.message };
  if (!tenant?.id) return { ok: false, error: "Error al crear el negocio" };

  // Email de bienvenida (fire-and-forget): nunca bloquea ni rompe el signup.
  fetch("/api/email/welcome", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant_id: tenant.id }),
    keepalive: true,
  }).catch((err) => console.error("Welcome email failed:", err));

  // La suscripción trial (14 días) se crea server-side dentro de
  // complete_onboarding (migración 028) — no insertar aquí.

  // Aplicar código promocional: consume el código y extiende el trial. Si
  // falla, la cuenta entra igual con su trial normal.
  if (promoTrimmed) {
    try {
      const promoRes = await fetch("/api/promo/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenant.id, codigo: promoTrimmed }),
      });
      const promoData = await promoRes.json();
      if (!promoRes.ok || !promoData.ok) {
        console.error("Promo apply failed:", promoData.error);
      }
    } catch (err) {
      console.error("Error applying promo:", err);
    }
  }

  return { ok: true, tenantId: tenant.id as string };
}
