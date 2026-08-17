import { Resend } from "resend";
import { getReferralSignupUrl } from "@/lib/referrals";
import { CONTACT_EMAIL, NO_REPLY_EMAIL } from "@/lib/contact";

const resendApiKey = process.env.RESEND_API_KEY;

const BRAND = {
  logo: "https://www.symvora.com.mx/symvora-logo-email.png",
  siteUrl: "https://www.symvora.com.mx",
  accent: "#2563eb",
  ink: "#1a1a1a",
  body: "#4b5563",
  muted: "#9ca3af",
};

function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL || `SYMVORA <${NO_REPLY_EMAIL}>`;
}

export async function sendWelcomeEmail(params: {
  to: string;
  businessName: string;
  referralCode: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resendApiKey) {
    console.warn("[email] RESEND_API_KEY not configured; skipping welcome email");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const referralUrl = params.referralCode
    ? getReferralSignupUrl(params.referralCode)
    : null;

  const referralHtml = referralUrl
    ? `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:24px 0;">
        <p style="font-size:15px;color:${BRAND.ink};margin:0 0 6px;">
          <strong>Invita a otro negocio y ambos ganan un mes gratis</strong>
        </p>
        <p style="font-size:14px;color:${BRAND.body};margin:0 0 16px;line-height:1.6;">
          Comparte tu enlace con otros comercios. Cuando tu invitado pague su primer mes, tú y él reciben 1 mes gratis.
        </p>
        <a href="${referralUrl}"
           style="display:inline-block;background:${BRAND.accent};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">
          Invitar y ganar un mes gratis
        </a>
        <p style="font-size:12px;color:${BRAND.muted};margin:12px 0 0;word-break:break-all;">
          ${referralUrl}
        </p>
      </div>
    `
    : "";

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #eeeeee;border-radius:16px;overflow:hidden;">
      <div style="background:${BRAND.ink};padding:24px;text-align:center;">
        <img src="${BRAND.logo}" alt="SYMVORA" width="140" style="display:inline-block;border:0;" />
      </div>

      <div style="padding:28px 32px 8px;">
        <h1 style="font-size:22px;color:${BRAND.ink};margin:0 0 12px;line-height:1.3;">
          ¡Bienvenido, ${params.businessName}!
        </h1>
        <p style="font-size:15px;color:${BRAND.body};margin:0 0 16px;line-height:1.6;">
          Ya eres cliente SYMVORA. Tu punto de venta, inventario y facturación CFDI 4.0 están listos para trabajar.
        </p>
        <p style="font-size:15px;color:${BRAND.body};margin:0 0 16px;line-height:1.6;">
          Con el programa de referidos, cada negocio que invites y active su suscripción te da <strong style="color:${BRAND.ink};">1 mes gratis</strong> — y a tu invitado también.
        </p>
        <table role="presentation" style="width:100%;margin:0 0 8px;">
          <tr>
            <td style="padding:6px 0;font-size:14px;color:${BRAND.body};">• Punto de venta, inventario y CFDI 4.0 en un solo lugar</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:14px;color:${BRAND.body};">• Sin comisiones por venta</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:14px;color:${BRAND.body};">• Soporte en español</td>
          </tr>
        </table>
        ${referralHtml}
      </div>

      <div style="padding:8px 32px 28px;">
        <p style="font-size:13px;color:${BRAND.muted};margin:24px 0 0;border-top:1px solid #eeeeee;padding-top:16px;line-height:1.6;">
          Si tienes dudas, escríbenos a <a href="mailto:${CONTACT_EMAIL}" style="color:${BRAND.accent};text-decoration:none;">${CONTACT_EMAIL}</a>.<br />
          <a href="${BRAND.siteUrl}/es/terminos" style="color:${BRAND.muted};text-decoration:underline;">Términos y condiciones</a> ·
          <a href="${BRAND.siteUrl}/es/aviso-privacidad" style="color:${BRAND.muted};text-decoration:underline;">Aviso de privacidad</a>
        </p>
        <p style="font-size:12px;color:${BRAND.muted};margin:12px 0 0;">
          © ${new Date().getFullYear()} SYMVORA. Todos los derechos reservados.
        </p>
      </div>
    </div>
  `;

  const resend = new Resend(resendApiKey);

  try {
    await resend.emails.send({
      from: getFromAddress(),
      to: params.to,
      subject: "Ya eres cliente SYMVORA — invita a otro negocio y ambos ganan un mes gratis",
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] Failed to send welcome email:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}