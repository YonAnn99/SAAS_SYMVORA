import { Resend } from "resend";
import { getReferralSignupUrl } from "@/lib/referrals";
import { CONTACT_EMAIL, HELLO_EMAIL, NO_REPLY_EMAIL } from "@/lib/contact";

const resendApiKey = process.env.RESEND_API_KEY;

// Identidad de marca SYMVORA (misma paleta que web/login: negro tinta,
// blanco hueso, zinc para texto secundario).
const BRAND = {
  logo: "https://www.symvora.com.mx/symvora-logo-email.png",
  siteUrl: "https://www.symvora.com.mx",
  appUrl: "https://app.symvora.com.mx",
  ink: "#111111",
  surface: "#141414",
  bone: "#F0EFED",
  body: "#3f3f46",
  muted: "#a1a1aa",
  border: "#e4e4e7",
  subtleBg: "#fafafa",
};

function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL || `SYMVORA <${NO_REPLY_EMAIL}>`;
}

export type WelcomeEmailType = "signup" | "first_payment";

function buildEmailHtml(params: {
  type: WelcomeEmailType;
  businessName: string;
  referralCode: string | null;
}): { html: string; subject: string; preheader: string } {
  const { type, businessName } = params;

  const isSignup = type === "signup";

  const heading = isSignup
    ? `¡Bienvenido, ${businessName}!`
    : `Pago confirmado, ${businessName}`;

  const intro = isSignup
    ? "Tu cuenta SYMVORA está lista. Activa tu prueba de 7 días con todo incluido: punto de venta, inventario y facturación CFDI 4.0 en un solo lugar."
    : "Tu membresía SYMVORA está activa. Tu punto de venta, inventario y facturación CFDI 4.0 están listos para trabajar desde hoy.";

  const preheader = isSignup
    ? "Tu trial de 7 días está activo — entra y empieza a vender"
    : "Tu membresía está activa — entra y empieza a vender";

  const subject = isSignup
    ? "Tu trial de 7 días está activo — bienvenido a SYMVORA"
    : "Pago confirmado — tu SYMVORA ya está activo";

  const trialBox = isSignup
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="background:${BRAND.bone};border-radius:12px;padding:16px 20px;">
            <p style="font-size:14px;color:${BRAND.ink};margin:0;line-height:1.6;">
              <strong>7 días gratis, sin cargo.</strong> Tu prueba dura una semana — si no quieres continuar, cancela antes sin costo.
            </p>
          </td>
        </tr>
      </table>`
    : "";

  const ctaHref = `${BRAND.appUrl}/es/dashboard`;
  const ctaLabel = isSignup ? "Entrar al sistema" : "Ir al sistema";

  const referralUrl = params.referralCode
    ? getReferralSignupUrl(params.referralCode)
    : null;

  const referralHtml = referralUrl
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
        <tr>
          <td style="background:${BRAND.subtleBg};border:1px solid ${BRAND.border};border-radius:12px;padding:20px;">
            <p style="font-size:15px;color:${BRAND.ink};margin:0 0 6px;font-weight:700;">
              Invita a otro negocio y ambos ganan un mes gratis
            </p>
            <p style="font-size:14px;color:${BRAND.body};margin:0 0 16px;line-height:1.6;">
              Comparte tu enlace con otros comercios. Cuando tu invitado pague su primer mes, tú y él reciben 1 mes gratis.
            </p>
            <a href="${referralUrl}"
               style="display:inline-block;background:${BRAND.ink};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:14px;font-weight:600;">
              Invitar y ganar un mes gratis
            </a>
            <p style="font-size:12px;color:${BRAND.muted};margin:12px 0 0;word-break:break-all;">
              ${referralUrl}
            </p>
          </td>
        </tr>
      </table>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
      <span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${BRAND.border};">
              <!-- Header -->
              <tr>
                <td style="background:${BRAND.surface};padding:28px;text-align:center;">
                  <img src="${BRAND.logo}" alt="SYMVORA" width="140" style="display:inline-block;border:0;" />
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:32px;">
                  <h1 style="font-size:22px;color:${BRAND.ink};margin:0 0 12px;line-height:1.3;">
                    ${heading}
                  </h1>
                  <p style="font-size:15px;color:${BRAND.body};margin:0 0 24px;line-height:1.6;">
                    ${intro}
                  </p>
                  ${trialBox}
                  <!-- CTA principal -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                    <tr>
                      <td align="center">
                        <a href="${ctaHref}"
                           style="display:inline-block;background:${BRAND.ink};color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:999px;font-size:15px;font-weight:700;letter-spacing:0.5px;">
                          ${ctaLabel}
                        </a>
                      </td>
                    </tr>
                  </table>
                  <!-- Propósitos de valor -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 4px;">
                    <tr>
                      <td style="padding:6px 0;font-size:14px;color:${BRAND.body};line-height:1.6;">✓&nbsp; Punto de venta, inventario y CFDI 4.0 en un solo lugar</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:14px;color:${BRAND.body};line-height:1.6;">✓&nbsp; Sin comisiones por venta</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:14px;color:${BRAND.body};line-height:1.6;">✓&nbsp; Soporte en español</td>
                    </tr>
                  </table>
                  ${referralHtml}
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding:0 32px 28px;">
                  <p style="font-size:13px;color:${BRAND.muted};margin:0;border-top:1px solid ${BRAND.border};padding-top:16px;line-height:1.6;">
                    Si tienes dudas, escríbenos a <a href="mailto:${CONTACT_EMAIL}" style="color:${BRAND.ink};text-decoration:none;">${CONTACT_EMAIL}</a>.<br />
                    <a href="${BRAND.siteUrl}/es/terminos" style="color:${BRAND.muted};text-decoration:underline;">Términos y condiciones</a> ·
                    <a href="${BRAND.siteUrl}/es/aviso-privacidad" style="color:${BRAND.muted};text-decoration:underline;">Aviso de privacidad</a>
                  </p>
                  <p style="font-size:12px;color:${BRAND.muted};margin:12px 0 0;">
                    © ${new Date().getFullYear()} SYMVORA. Todos los derechos reservados.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return { html, subject, preheader };
}

export async function sendWelcomeEmail(params: {
  to: string;
  businessName: string;
  referralCode: string | null;
  type?: WelcomeEmailType;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resendApiKey) {
    console.warn("[email] RESEND_API_KEY not configured; skipping welcome email");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const { html, subject } = buildEmailHtml({
    type: params.type ?? "first_payment",
    businessName: params.businessName,
    referralCode: params.referralCode,
  });

  const resend = new Resend(resendApiKey);

  try {
    await resend.emails.send({
      from: getFromAddress(),
      to: params.to,
      subject,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] Failed to send welcome email:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendInviteKeyEmail(params: {
  to: string;
  key: string;
  role: string;
  locale: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resendApiKey) {
    console.warn("[email] RESEND_API_KEY not configured; skipping invite key email");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const roleLabel = params.role === "ORG_ADMIN" ? "Administrador" : "Cajero";
  const loginUrl = `${BRAND.appUrl}/${params.locale}/auth?mode=login`;
  const subject = "Tu clave de acceso a SYMVORA";
  const preheader = `Tu clave para acceder a SYMVORA: ${params.key}`;

  const html = `
    <!DOCTYPE html>
    <html lang="${params.locale}">
    <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
      <span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${BRAND.border};">
              <!-- Header -->
              <tr>
                <td style="background:${BRAND.surface};padding:28px;text-align:center;">
                  <img src="${BRAND.logo}" alt="SYMVORA" width="140" style="display:inline-block;border:0;" />
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:32px;">
                  <h1 style="font-size:22px;color:${BRAND.ink};margin:0 0 12px;line-height:1.3;">
                    Tu clave de acceso
                  </h1>
                  <p style="font-size:15px;color:${BRAND.body};margin:0 0 24px;line-height:1.6;">
                    Hola, tu administrador te ha invitado a SYMVORA como <strong>${roleLabel}</strong>.
                    Usa la siguiente clave para acceder al sistema:
                  </p>
                  <!-- Key Box -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                    <tr>
                      <td style="background:${BRAND.bone};border-radius:12px;padding:20px;text-align:center;">
                        <p style="font-size:12px;color:${BRAND.muted};margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Tu clave de acceso</p>
                        <p style="font-size:32px;color:${BRAND.ink};margin:0;font-family:monospace;font-weight:700;letter-spacing:4px;">${params.key}</p>
                      </td>
                    </tr>
                  </table>
                  <!-- Instructions -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                    <tr>
                      <td style="padding:6px 0;font-size:14px;color:${BRAND.body};line-height:1.6;">1. Ve a la página de inicio de sesión</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:14px;color:${BRAND.body};line-height:1.6;">2. Haz clic en "¿Eres empleado? Ingresa tu clave"</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:14px;color:${BRAND.body};line-height:1.6;">3. Ingresa tu correo y esta clave</td>
                    </tr>
                  </table>
                  <!-- CTA -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                    <tr>
                      <td align="center">
                        <a href="${loginUrl}"
                           style="display:inline-block;background:${BRAND.ink};color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:999px;font-size:15px;font-weight:700;letter-spacing:0.5px;">
                          Ir al inicio de sesión
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="font-size:13px;color:${BRAND.muted};margin:0;line-height:1.6;">
                    Tu clave es permanente. Úsala cada vez que inicies sesión. Si necesitas ayuda, contacta a tu administrador.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding:0 32px 28px;">
                  <p style="font-size:13px;color:${BRAND.muted};margin:0;border-top:1px solid ${BRAND.border};padding-top:16px;line-height:1.6;">
                    Si tienes dudas, escríbenos a <a href="mailto:${CONTACT_EMAIL}" style="color:${BRAND.ink};text-decoration:none;">${CONTACT_EMAIL}</a>.<br />
                    <a href="${BRAND.siteUrl}/es/terminos" style="color:${BRAND.muted};text-decoration:underline;">Términos y condiciones</a> ·
                    <a href="${BRAND.siteUrl}/es/aviso-privacidad" style="color:${BRAND.muted};text-decoration:underline;">Aviso de privacidad</a>
                  </p>
                  <p style="font-size:12px;color:${BRAND.muted};margin:12px 0 0;">
                    © ${new Date().getFullYear()} SYMVORA. Todos los derechos reservados.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const resend = new Resend(resendApiKey);

  try {
    await resend.emails.send({
      from: getFromAddress(),
      to: params.to,
      subject,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] Failed to send invite key email:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const CATEGORIA_LABELS: Record<string, string> = {
  general: "General",
  bug: "Bug",
  mejora: "Mejora",
  feature: "Feature",
};

const PRIORIDAD_LABELS: Record<string, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
};

export async function sendSuggestionEmail(params: {
  tenantName: string;
  userEmail: string;
  categoria: string;
  prioridad: string;
  titulo: string;
  descripcion: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resendApiKey) {
    console.warn("[email] RESEND_API_KEY not configured; skipping suggestion email");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const categoriaLabel = CATEGORIA_LABELS[params.categoria] || params.categoria;
  const prioridadLabel = PRIORIDAD_LABELS[params.prioridad] || params.prioridad;
  const subject = `[${categoriaLabel}] ${params.titulo}`;

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${BRAND.border};">
              <tr>
                <td style="background:${BRAND.surface};padding:28px;text-align:center;">
                  <img src="${BRAND.logo}" alt="SYMVORA" width="140" style="display:inline-block;border:0;" />
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <h1 style="font-size:20px;color:${BRAND.ink};margin:0 0 8px;line-height:1.3;">
                    Nueva sugerencia
                  </h1>
                  <p style="font-size:14px;color:${BRAND.body};margin:0 0 24px;line-height:1.6;">
                    <strong>${params.tenantName}</strong> (${params.userEmail}) envió una sugerencia:
                  </p>
                  <!-- Metadata -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                    <tr>
                      <td style="background:${BRAND.bone};border-radius:10px;padding:16px 20px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="font-size:13px;color:${BRAND.muted};padding:0 0 8px;width:90px;vertical-align:top;">Categoría</td>
                            <td style="font-size:14px;color:${BRAND.ink};font-weight:600;padding:0 0 8px;">${categoriaLabel}</td>
                          </tr>
                          <tr>
                            <td style="font-size:13px;color:${BRAND.muted};padding:0 0 8px;vertical-align:top;">Prioridad</td>
                            <td style="font-size:14px;color:${BRAND.ink};font-weight:600;padding:0 0 8px;">${prioridadLabel}</td>
                          </tr>
                          <tr>
                            <td style="font-size:13px;color:${BRAND.muted};padding:0;vertical-align:top;">Título</td>
                            <td style="font-size:14px;color:${BRAND.ink};font-weight:600;padding:0;">${params.titulo}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  <!-- Descripción -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                    <tr>
                      <td style="padding:0;">
                        <p style="font-size:13px;color:${BRAND.muted};margin:0 0 6px;text-transform:uppercase;letter-spacing:0.5px;">Descripción</p>
                        <p style="font-size:14px;color:${BRAND.body};margin:0;line-height:1.7;white-space:pre-wrap;">${params.descripcion}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 28px;">
                  <p style="font-size:13px;color:${BRAND.muted};margin:0;border-top:1px solid ${BRAND.border};padding-top:16px;line-height:1.6;">
                    © ${new Date().getFullYear()} SYMVORA · Sugerencias
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const resend = new Resend(resendApiKey);

  try {
    await resend.emails.send({
      from: getFromAddress(),
      to: HELLO_EMAIL,
      replyTo: params.userEmail,
      subject,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] Failed to send suggestion email:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
