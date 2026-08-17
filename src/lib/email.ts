import { Resend } from "resend";
import { getReferralSignupUrl } from "@/lib/referrals";
import { NO_REPLY_EMAIL } from "@/lib/contact";

const resendApiKey = process.env.RESEND_API_KEY;

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

  const referralHtml = params.referralCode
    ? `
      <p style="font-size:16px;color:#111827;margin:0 0 8px;">
        <strong>Invita a otro negocio y ambos ganan un mes gratis.</strong>
      </p>
      <p style="font-size:14px;color:#4b5563;margin:0 0 16px;">
        Comparte este enlace con otros comercios. Cuando tu invitado pague su primer mes, tú y él reciben 1 mes gratis:
      </p>
      <p style="margin:0 0 24px;">
        <a href="${getReferralSignupUrl(params.referralCode)}"
           style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:600;">
          ${getReferralSignupUrl(params.referralCode)}
        </a>
      </p>
    `
    : "";

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <div style="text-align:center;margin-bottom:24px;">
        <img src="https://www.symvora.com.mx/symvora-logo.webp" alt="SYMVORA" width="140" style="border-radius:8px;" />
      </div>
      <h1 style="font-size:22px;color:#111827;margin:0 0 12px;">
        ¡Bienvenido, ${params.businessName}!
      </h1>
      <p style="font-size:15px;color:#374151;margin:0 0 16px;line-height:1.6;">
        Ya eres cliente SYMVORA. Tu punto de venta, inventario y facturación CFDI 4.0 están listos para trabajar.
      </p>
      <p style="font-size:15px;color:#374151;margin:0 0 16px;line-height:1.6;">
        Con el programa de referidos, cada negocio que invite y active su suscripción te da <strong>1 mes gratis</strong> — y a tu invitado también.
      </p>
      ${referralHtml}
      <p style="font-size:13px;color:#9ca3af;margin:24px 0 0;border-top:1px solid #e5e7eb;padding-top:16px;">
        Si tienes dudas, escríbenos por WhatsApp o responde este correo. — Equipo SYMVORA
      </p>
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