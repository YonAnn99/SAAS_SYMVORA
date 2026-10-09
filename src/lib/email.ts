import { Resend } from "resend";
import { getReferralSignupUrl } from "@/lib/referrals";
import { CONTACT_EMAIL, HELLO_EMAIL, NO_REPLY_EMAIL, SUPPORT_EMAIL } from "@/lib/contact";
import { TIMEOUTS, withTimeout } from "@/lib/http/timeout";
import { DIAS_PRUEBA } from "@/lib/trial";
import { PRECIO_PROMO_MXN, precioListaMXN } from "@/features/payments/promocion";
import type { AvisoCobro } from "@/lib/avisos-cobro";
import { formatearCantidad } from "@/lib/unidades";

const resendApiKey = process.env.RESEND_API_KEY;

type EmailPayload = Parameters<Resend["emails"]["send"]>[0];

/**
 * Unico punto de envio. Existe para que ningun correo pueda bloquear
 * indefinidamente a quien lo dispara: varios de estos envios ocurren dentro del
 * webhook de Conekta, antes de devolver el 200. Si Resend se demora, Conekta no
 * recibe confirmacion y reintenta el evento entero.
 *
 * El timeout no cancela la peticion a Resend (el SDK no acepta AbortSignal),
 * solo deja de esperarla. Es aceptable: un correo duplicado es mucho menos
 * grave que un webhook de cobro reintentado.
 */
async function deliver(resend: Resend, payload: EmailPayload) {
  return withTimeout(resend.emails.send(payload), TIMEOUTS.resend, "Resend");
}

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

/**
 * Escapa texto que escribe el usuario (nombres, notas de cierre, sucursales)
 * antes de meterlo en el HTML del correo. Sin esto, una nota con `<a href>`
 * llegaria al dueño como un enlace de verdad dentro de un correo de SYMVORA.
 */
function esc(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type WelcomeEmailType = "signup" | "first_payment";

function buildEmailHtml(params: {
  type: WelcomeEmailType;
  businessName: string;
  referralCode: string | null;
  billingPeriod?: "monthly" | "yearly";
  amountCents?: number;
}): { html: string; subject: string; preheader: string } {
  const { type, businessName } = params;

  const isSignup = type === "signup";

  const heading = isSignup
    ? `¡Bienvenido, ${businessName}!`
    : `Pago confirmado, ${businessName}`;

  const intro = isSignup
    ? `Tu cuenta SYMVORA está lista. Activa tu prueba de ${DIAS_PRUEBA} días con todo incluido: punto de venta, inventario y reportes en un solo lugar.`
    : "Tu membresía SYMVORA está activa. Tu punto de venta e inventario están listos para trabajar desde hoy.";

  const preheader = isSignup
    ? `Tu trial de ${DIAS_PRUEBA} días está activo — entra y empieza a vender`
    : "Tu membresía está activa — entra y empieza a vender";

  const subject = isSignup
    ? `Tu trial de ${DIAS_PRUEBA} días está activo — bienvenido a SYMVORA`
    : "Pago confirmado — tu SYMVORA ya está activo";

  const trialBox = isSignup
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="background:${BRAND.bone};border-radius:12px;padding:16px 20px;">
            <p style="font-size:14px;color:${BRAND.ink};margin:0;line-height:1.6;">
              <strong>${DIAS_PRUEBA} días gratis, sin cargo.</strong> Si no quieres continuar, cancela antes sin costo.
            </p>
          </td>
        </tr>
      </table>`
    : "";

  const planLabel =
    params.billingPeriod === "yearly" ? "SYMVORA Anual" : "SYMVORA Mensual";
  const planAmount =
    typeof params.amountCents === "number"
      ? (params.amountCents / 100).toLocaleString("es-MX", {
          style: "currency",
          currency: "MXN",
        })
      : null;

  const planBox =
    !isSignup && planAmount
      ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="background:${BRAND.bone};border-radius:12px;padding:16px 20px;">
            <p style="font-size:14px;color:${BRAND.ink};margin:0;line-height:1.6;">
              <strong>${planLabel} — ${planAmount} MXN.</strong> Este es el cargo que se acaba de procesar a tu cuenta.
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
                  ${planBox}
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
                      <td style="padding:6px 0;font-size:14px;color:${BRAND.body};line-height:1.6;">✓&nbsp; Punto de venta, inventario y reportes en un solo lugar</td>
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
  billingPeriod?: "monthly" | "yearly";
  amountCents?: number;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resendApiKey) {
    console.warn("[email] RESEND_API_KEY not configured; skipping welcome email");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const { html, subject } = buildEmailHtml({
    type: params.type ?? "first_payment",
    businessName: params.businessName,
    referralCode: params.referralCode,
    billingPeriod: params.billingPeriod,
    amountCents: params.amountCents,
  });

  const resend = new Resend(resendApiKey);

  try {
    await deliver(resend, {
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
    await deliver(resend, {
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
  bug: "Error",
  mejora: "Mejora",
  feature: "Aporte de valor",
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
    await deliver(resend, {
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

export async function sendCancellationEmail(params: {
  to: string;
  businessName: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resendApiKey) {
    console.warn("[email] RESEND_API_KEY not configured; skipping cancellation email");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

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
                  <h1 style="font-size:22px;color:${BRAND.ink};margin:0 0 12px;line-height:1.3;">
                    Tu suscripción fue cancelada, ${params.businessName}
                  </h1>
                  <p style="font-size:15px;color:${BRAND.body};margin:0 0 24px;line-height:1.6;">
                    Cancelamos tu membresía SYMVORA. No se hará ningún cargo adicional a tu tarjeta.
                  </p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                    <tr>
                      <td style="background:${BRAND.subtleBg};border:1px solid ${BRAND.border};border-radius:12px;padding:20px;">
                        <p style="font-size:14px;color:${BRAND.ink};margin:0;line-height:1.6;">
                          Si cambias de opinión, puedes reactivar tu cuenta cuando quieras — tu información sigue guardada.
                        </p>
                      </td>
                    </tr>
                  </table>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 4px;">
                    <tr>
                      <td align="center">
                        <a href="${BRAND.appUrl}/es/billing"
                           style="display:inline-block;background:${BRAND.ink};color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:999px;font-size:15px;font-weight:700;letter-spacing:0.5px;">
                          Reactivar mi cuenta
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 28px;">
                  <p style="font-size:13px;color:${BRAND.muted};margin:0;border-top:1px solid ${BRAND.border};padding-top:16px;line-height:1.6;">
                    Si esto fue un error o tienes dudas, escríbenos a <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND.ink};text-decoration:none;">${SUPPORT_EMAIL}</a>.
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
    await deliver(resend, {
      from: getFromAddress(),
      to: params.to,
      subject: "Tu suscripción SYMVORA ha sido cancelada",
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] Failed to send cancellation email:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const CANCELLATION_REASON_LABELS: Record<string, string> = {
  precio: "El precio es muy alto",
  no_uso: "Ya no uso el sistema / cerré el negocio",
  funciones: "Me faltan funciones que necesito",
  problemas_tecnicos: "Tuve problemas técnicos",
  otra_opcion: "Encontré otra opción que se ajusta mejor",
  otro: "Otro",
};

export async function sendCancellationFeedbackEmail(params: {
  tenantName: string;
  userEmail: string;
  reason: string;
  otherText?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resendApiKey) {
    console.warn("[email] RESEND_API_KEY not configured; skipping cancellation feedback email");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const reasonLabel = CANCELLATION_REASON_LABELS[params.reason] || params.reason;

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
                    Cancelación de suscripción
                  </h1>
                  <p style="font-size:14px;color:${BRAND.body};margin:0 0 24px;line-height:1.6;">
                    <strong>${params.tenantName}</strong> (${params.userEmail}) canceló su suscripción.
                  </p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                    <tr>
                      <td style="background:${BRAND.bone};border-radius:10px;padding:16px 20px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="font-size:13px;color:${BRAND.muted};padding:0;width:90px;vertical-align:top;">Motivo</td>
                            <td style="font-size:14px;color:${BRAND.ink};font-weight:600;padding:0;">${reasonLabel}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  ${
                    params.otherText
                      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                    <tr>
                      <td style="padding:0;">
                        <p style="font-size:13px;color:${BRAND.muted};margin:0 0 6px;text-transform:uppercase;letter-spacing:0.5px;">Detalle</p>
                        <p style="font-size:14px;color:${BRAND.body};margin:0;line-height:1.7;white-space:pre-wrap;">${params.otherText}</p>
                      </td>
                    </tr>
                  </table>`
                      : ""
                  }
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 28px;">
                  <p style="font-size:13px;color:${BRAND.muted};margin:0;border-top:1px solid ${BRAND.border};padding-top:16px;line-height:1.6;">
                    © ${new Date().getFullYear()} SYMVORA · Cancelaciones
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
    await deliver(resend, {
      from: getFromAddress(),
      to: SUPPORT_EMAIL,
      replyTo: params.userEmail,
      subject: `[Cancelación] ${params.tenantName}`,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] Failed to send cancellation feedback email:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// =============================================
// Avisos de fin de prueba
// ---------------------------------------------
// Estos dos comparten un shell (`buildNoticeHtml`) en vez de repetir la
// maquetación completa como hacen las plantillas de arriba. El shell ya estaba
// duplicado tres veces en este archivo; añadir el sexto y el séptimo no tenía
// sentido. Las plantillas existentes NO se migraron a propósito: son las de
// cobro y funcionan, y refactorizarlas de paso era arriesgar algo que no falla.
// =============================================

/** Maquetación común de los avisos: cabecera, cuerpo, CTA y pie de marca. */
function buildNoticeHtml(params: {
  preheader: string;
  heading: string;
  intro: string;
  highlight?: string;
  ctaLabel: string;
  ctaHref: string;
  /**
   * La lista de "tus datos siguen intactos / sin comisiones / cancela cuando
   * quieras". Tiene sentido en los avisos de la suscripcion; en un corte de
   * caja sobra, asi que esos correos la apagan.
   */
  mostrarBeneficios?: boolean;
}): string {
  const { preheader, heading, intro, highlight, ctaLabel, ctaHref } = params;
  const mostrarBeneficios = params.mostrarBeneficios ?? true;

  const highlightBox = highlight
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="background:${BRAND.bone};border-radius:12px;padding:16px 20px;">
            <p style="font-size:14px;color:${BRAND.ink};margin:0;line-height:1.6;">${highlight}</p>
          </td>
        </tr>
      </table>`
    : "";

  return `
    <!DOCTYPE html>
    <html lang="es">
    <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
      <span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
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
                  <h1 style="font-size:22px;color:${BRAND.ink};margin:0 0 12px;line-height:1.3;">${heading}</h1>
                  <p style="font-size:15px;color:${BRAND.body};margin:0 0 24px;line-height:1.6;">${intro}</p>
                  ${highlightBox}
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
                  ${mostrarBeneficios ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 4px;">
                    <tr><td style="padding:6px 0;font-size:14px;color:${BRAND.body};line-height:1.6;">&#10003;&nbsp; Tus datos y tu catálogo siguen intactos</td></tr>
                    <tr><td style="padding:6px 0;font-size:14px;color:${BRAND.body};line-height:1.6;">&#10003;&nbsp; Sin comisiones por venta</td></tr>
                    <tr><td style="padding:6px 0;font-size:14px;color:${BRAND.body};line-height:1.6;">&#10003;&nbsp; Cancela cuando quieras</td></tr>
                  </table>` : ""}
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 28px;">
                  <p style="font-size:13px;color:${BRAND.muted};margin:0;border-top:1px solid ${BRAND.border};padding-top:16px;line-height:1.6;">
                    Si tienes dudas, escríbenos a <a href="mailto:${CONTACT_EMAIL}" style="color:${BRAND.ink};text-decoration:none;">${CONTACT_EMAIL}</a>.<br />
                    <a href="${BRAND.siteUrl}/es/terminos" style="color:${BRAND.muted};text-decoration:underline;">Términos y condiciones</a> &middot;
                    <a href="${BRAND.siteUrl}/es/aviso-privacidad" style="color:${BRAND.muted};text-decoration:underline;">Aviso de privacidad</a>
                  </p>
                  <p style="font-size:12px;color:${BRAND.muted};margin:12px 0 0;">
                    &copy; ${new Date().getFullYear()} SYMVORA. Todos los derechos reservados.
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
}

/**
 * "Tu prueba termina pronto" — se manda a 2 días del vencimiento.
 *
 * Deliberadamente NO alarmista: el negocio todavía tiene acceso completo y el
 * objetivo es que no le pille por sorpresa, no presionarlo.
 */
export async function sendTrialEndingEmail(params: {
  to: string;
  businessName: string;
  daysLeft: number;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resendApiKey) {
    console.warn("[email] RESEND_API_KEY no configurada; se omite el aviso de fin de prueba");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const dias =
    params.daysLeft === 1 ? "mañana" : `en ${params.daysLeft} días`;

  const html = buildNoticeHtml({
    preheader: `Tu prueba de SYMVORA termina ${dias}`,
    heading: `Tu prueba termina ${dias}, ${params.businessName}`,
    intro:
      "Queremos avisarte con tiempo para que no te agarre a media venta. Puedes activar tu suscripción ahora y seguir trabajando sin ninguna interrupción.",
    highlight:
      "<strong>No pierdes nada de lo que ya hiciste.</strong> Tus productos, ventas y clientes se quedan donde están; al activar la suscripción sigues justo donde lo dejaste.",
    ctaLabel: "Activar mi suscripción",
    ctaHref: `${BRAND.appUrl}/es/billing`,
  });

  const resend = new Resend(resendApiKey);

  try {
    await deliver(resend, {
      from: getFromAddress(),
      to: params.to,
      subject: `Tu prueba de SYMVORA termina ${dias}`,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] Falló el aviso de prueba por vencer:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * "Tu prueba terminó" — se manda el día que vence.
 *
 * Es el correo que faltaba y que dejaba a la gente bloqueada sin explicación:
 * el middleware la manda a `/billing` y hasta ahora nada le decía por qué.
 */
export async function sendTrialEndedEmail(params: {
  to: string;
  businessName: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resendApiKey) {
    console.warn("[email] RESEND_API_KEY no configurada; se omite el aviso de prueba terminada");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const html = buildNoticeHtml({
    preheader: "Tu prueba terminó — reactiva tu acceso cuando quieras",
    heading: `Tu prueba terminó, ${params.businessName}`,
    intro:
      `Los ${DIAS_PRUEBA} días de prueba llegaron a su fin, así que por ahora tu cuenta está en solo lectura: puedes entrar, ver tus reportes y descargar tu información, pero no registrar ventas. Activar tu suscripción lo restablece al instante.`,
    highlight:
      "<strong>Tu información sigue guardada.</strong> Nada se borra: productos, ventas, clientes e inventario te esperan tal cual los dejaste.",
    ctaLabel: "Reactivar mi acceso",
    ctaHref: `${BRAND.appUrl}/es/billing`,
  });

  const resend = new Resend(resendApiKey);

  try {
    await deliver(resend, {
      from: getFromAddress(),
      to: params.to,
      subject: "Tu prueba de SYMVORA terminó — reactiva tu acceso",
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] Falló el aviso de prueba terminada:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Avisos de cobro de clientes que ya pagaban (cron `avisos-cobro`, reglas en
 * `lib/avisos-cobro.ts`): renovacion, gracia, solo lectura, oferta de regreso
 * y ultimo aviso. Un solo envio con el contenido de cada caso, porque todos
 * comparten plantilla, destinatario y manejo de errores.
 *
 * El tono va de informativo (renovacion) a oferta (regreso): nunca amenaza. El
 * mensaje central es siempre el mismo — tu informacion esta a salvo y vuelves
 * justo donde lo dejaste.
 */
export async function sendAvisoCobroEmail(params: {
  to: string;
  businessName: string;
  tipo: AvisoCobro;
  /** Fin del periodo pagado (renovacion). */
  venceEl?: Date | null;
  /** `past_due`: fallo la tarjeta; si no, vencio un pago manual. */
  cobroFallido?: boolean;
  /** Hasta cuando se conservan los datos (solo lectura / ultimo). */
  limiteDatos?: Date | null;
  /** Vigencia de la oferta de regreso (regreso / ultimo). */
  ofertaHasta?: Date | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resendApiKey) {
    console.warn("[email] RESEND_API_KEY no configurada; se omite el aviso de cobro");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const fecha = (d?: Date | null) =>
    d ? d.toLocaleDateString("es-MX", { day: "numeric", month: "long", timeZone: "America/Mexico_City" }) : "";
  const negocio = params.businessName;
  const billing = `${BRAND.appUrl}/es/billing`;
  const oferta = `tu primer mes de regreso a $${PRECIO_PROMO_MXN} en vez de $${precioListaMXN("monthly")}`;

  let subject: string;
  let contenido: Parameters<typeof buildNoticeHtml>[0];

  switch (params.tipo) {
    case "renovacion":
      subject = `Tu mensualidad de SYMVORA vence el ${fecha(params.venceEl)}`;
      contenido = {
        preheader: `Genera tu referencia de pago antes del ${fecha(params.venceEl)}`,
        heading: `Tu mes vence el ${fecha(params.venceEl)}, ${negocio}`,
        intro:
          "Como pagas en efectivo o transferencia, el cobro no es automático. Genera tu referencia con tiempo para seguir vendiendo sin interrupciones.",
        highlight:
          "<strong>¿Prefieres olvidarte de esto?</strong> Con tarjeta el cobro es automático cada mes y puedes cancelar cuando quieras.",
        ctaLabel: "Pagar mi mensualidad",
        ctaHref: billing,
      };
      break;
    case "gracia":
      subject = params.cobroFallido
        ? "No pudimos procesar tu pago de SYMVORA"
        : "Tu mensualidad de SYMVORA venció";
      contenido = {
        preheader: "Tienes 3 días para pagar sin perder el acceso",
        heading: params.cobroFallido
          ? `No pudimos cobrar tu mensualidad, ${negocio}`
          : `Tu mensualidad venció, ${negocio}`,
        intro:
          "No te preocupes: durante los próximos 3 días todo sigue funcionando igual. Solo necesitas completar el pago para no perder el acceso.",
        highlight: params.cobroFallido
          ? "Suele pasar cuando la tarjeta venció o no tenía fondos. Puedes pagar con otra tarjeta, en OXXO o por transferencia."
          : "Puedes pagar con tarjeta, en OXXO o por transferencia.",
        ctaLabel: "Pagar ahora",
        ctaHref: billing,
      };
      break;
    case "solo_lectura":
      subject = "Tu cuenta de SYMVORA está en solo lectura";
      contenido = {
        preheader: "Tu información está a salvo — reactiva para volver a vender",
        heading: `Tu cuenta está en solo lectura, ${negocio}`,
        intro:
          "Todavía puedes entrar, ver tus reportes y descargar tu información, pero no registrar ventas ni cambios hasta que reactives tu plan.",
        highlight: `<strong>Tu información está a salvo.</strong> Productos, ventas, clientes e inventario se conservan${
          params.limiteDatos ? ` hasta el ${fecha(params.limiteDatos)}` : ""
        }; al reactivar sigues justo donde lo dejaste.`,
        ctaLabel: "Reactivar mi plan",
        ctaHref: billing,
      };
      break;
    case "regreso":
      subject = `Vuelve a SYMVORA: ${oferta}`;
      contenido = {
        preheader: `Oferta de regreso válida hasta el ${fecha(params.ofertaHasta)}`,
        heading: `Te guardamos todo, ${negocio}`,
        intro:
          "Tu catálogo, tus clientes y tu historial de ventas siguen exactamente como los dejaste. Para que retomar sea más fácil, te preparamos una oferta.",
        highlight: `<strong>${oferta[0].toUpperCase()}${oferta.slice(1)}.</strong> Válido hasta el ${fecha(
          params.ofertaHasta
        )}; se aplica solo al elegir el plan mensual.`,
        ctaLabel: "Aprovechar la oferta",
        ctaHref: billing,
      };
      break;
    case "ultimo":
      subject = `Última oportunidad: tu información de SYMVORA se conserva hasta el ${fecha(params.limiteDatos)}`;
      contenido = {
        preheader: "Reactiva o descarga tu información antes de que termine el plazo",
        heading: `Quedan pocos días, ${negocio}`,
        intro: `Tu información se conserva hasta el ${fecha(
          params.limiteDatos
        )}. Después de esa fecha podríamos eliminarla, como indican nuestros Términos. Reactiva tu plan o, si ya no lo necesitas, descarga tu información antes.`,
        highlight: params.ofertaHasta
          ? `<strong>Tu oferta sigue en pie:</strong> ${oferta}, hasta el ${fecha(params.ofertaHasta)}.`
          : undefined,
        ctaLabel: "Reactivar o descargar mis datos",
        ctaHref: billing,
      };
      break;
  }

  const resend = new Resend(resendApiKey);

  try {
    await deliver(resend, {
      from: getFromAddress(),
      to: params.to,
      subject,
      html: buildNoticeHtml(contenido),
    });
    return { ok: true };
  } catch (err) {
    console.error(`[email] Falló el aviso de cobro (${params.tipo}):`, err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Notificación de seguridad al cambiar la contraseña.
 * Se envía al usuario afectado y/o al Super Admin del negocio.
 */
export async function sendPasswordChangedAlertEmail(params: {
  to: string;
  businessName: string;
  userEmail: string;
  userRole?: string;
  isSelf: boolean;
  dateStr?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resendApiKey) {
    console.warn("[email] RESEND_API_KEY no configurada; se omite el aviso de cambio de contraseña");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const { to, businessName, userEmail, userRole, isSelf } = params;
  const dateStr =
    params.dateStr ||
    new Date().toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
      dateStyle: "medium",
      timeStyle: "short",
    });

  const subject = isSelf
    ? "Seguridad: Tu contraseña de SYMVORA fue actualizada"
    : `Alerta de seguridad: Cambio de contraseña en ${businessName}`;

  const preheader = isSelf
    ? `La contraseña de tu cuenta ${userEmail} ha sido actualizada.`
    : `El usuario ${userEmail} actualizó su contraseña en ${businessName}.`;

  const heading = isSelf
    ? "Contraseña actualizada"
    : "Alerta de seguridad: Contraseña modificada";

  const intro = isSelf
    ? `Te confirmamos que la contraseña de acceso para tu cuenta <strong>${userEmail}</strong> en <strong>${businessName}</strong> fue modificada el <strong>${dateStr}</strong>.`
    : `Te informamos como Super Administrador que el usuario <strong>${userEmail}</strong>${
        userRole ? ` (${userRole})` : ""
      } actualizó su contraseña de acceso en <strong>${businessName}</strong> el <strong>${dateStr}</strong>.`;

  const highlight = isSelf
    ? "<strong>¿No fuiste tú?</strong> Si no realizaste este cambio, alguien podría tener acceso no autorizado a tu cuenta. Restablece tu contraseña de inmediato desde la pantalla de acceso o contacta a soporte."
    : "<strong>Monitoreo de seguridad:</strong> Si este cambio no fue autorizado o necesitas revisar los accesos de tu equipo, puedes gestionarlos en el panel de usuarios.";

  const ctaLabel = isSelf ? "Ir a mi cuenta" : "Gestionar usuarios";
  const ctaHref = isSelf ? `${BRAND.appUrl}/es/dashboard` : `${BRAND.appUrl}/es/users`;

  const html = buildNoticeHtml({
    preheader,
    heading,
    intro,
    highlight,
    ctaLabel,
    ctaHref,
  });

  const resend = new Resend(resendApiKey);

  try {
    await deliver(resend, {
      from: getFromAddress(),
      to,
      subject,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] Falló el aviso de cambio de contraseña:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// =============================================
// Cierre automático de caja
// ---------------------------------------------
// Notificaciones cuando el sistema cierra una caja automáticamente a las 4:30 a. m.
// =============================================

/**
 * Notifica al usuario cuya caja fue cerrada automáticamente.
 */
export async function sendAutoCloseToUserEmail(params: {
  to: string;
  userName: string;
  businessName: string;
  /** Solo con 2 o mas sucursales activas (ver `fetchSucursalParaAviso`). */
  sucursalNombre?: string | null;
  cajaId: string;
  fechaApertura: string;
  totalVentas: number;
  totalEntradas: number;
  totalSalidas: number;
  saldoEsperado: number;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resendApiKey) {
    console.warn("[email] RESEND_API_KEY no configurada; se omite aviso de cierre automático al usuario");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const formatMXN = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

  const fecha = new Date(params.fechaApertura).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const enSucursal = params.sucursalNombre ? ` en ${esc(params.sucursalNombre)}` : "";

  const html = buildNoticeHtml({
    preheader: `Tu caja fue cerrada automáticamente — ${esc(params.businessName)}`,
    heading: `Cierre automático de caja, ${esc(params.userName)}`,
    intro:
      `Tu caja${enSucursal} abierta el ${fecha} fue cerrada automáticamente por el sistema a las 4:30 a. m. (hora CDMX). A continuación el resumen del corte:`,
    highlight: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
        <tr><td style="font-size:14px;color:${BRAND.body};padding:4px 0;">Fondo inicial: <strong>${formatMXN(params.saldoEsperado - params.totalVentas - params.totalEntradas + params.totalSalidas)}</strong></td></tr>
        <tr><td style="font-size:14px;color:${BRAND.body};padding:4px 0;">Ventas: <strong style="color:#2563eb;">+${formatMXN(params.totalVentas)}</strong></td></tr>
        <tr><td style="font-size:14px;color:${BRAND.body};padding:4px 0;">Entradas: <strong style="color:#16a34a;">+${formatMXN(params.totalEntradas)}</strong></td></tr>
        <tr><td style="font-size:14px;color:${BRAND.body};padding:4px 0;">Salidas: <strong style="color:#dc2626;">-${formatMXN(params.totalSalidas)}</strong></td></tr>
        <tr><td style="font-size:14px;color:${BRAND.ink};font-weight:700;padding:8px 0 4px;border-top:1px solid ${BRAND.border};">Saldo esperado: <strong>${formatMXN(params.saldoEsperado)}</strong></td></tr>
      </table>
      <p style="font-size:13px;color:${BRAND.muted};margin:8px 0 0;">El sistema cerró la caja con saldo real = saldo esperado (diferencia $0.00). Si necesitas ajustar, contacta a tu administrador.</p>
    `,
    ctaLabel: "Ver mis cajas",
    ctaHref: `${BRAND.appUrl}/es/finances`,
    mostrarBeneficios: false,
  });

  const resend = new Resend(resendApiKey);

  try {
    await deliver(resend, {
      from: getFromAddress(),
      to: params.to,
      subject: `Tu caja fue cerrada automáticamente — ${params.businessName}`,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] Falló el aviso de cierre automático al usuario:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Notifica al SUPER_ADMIN cuando se cierra automáticamente la caja de un usuario.
 */
export async function sendAutoCloseToSuperAdminEmail(params: {
  to: string;
  businessName: string;
  /** Solo con 2 o mas sucursales activas (ver `fetchSucursalParaAviso`). */
  sucursalNombre?: string | null;
  userName: string;
  userRole: string;
  userEmail: string;
  cajaId: string;
  fechaApertura: string;
  totalVentas: number;
  totalEntradas: number;
  totalSalidas: number;
  saldoEsperado: number;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resendApiKey) {
    console.warn("[email] RESEND_API_KEY no configurada; se omite aviso de cierre automático al super admin");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const formatMXN = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

  const fecha = new Date(params.fechaApertura).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const roleLabel = params.userRole === "SUPER_ADMIN" ? "Super Administrador" : params.userRole === "ORG_ADMIN" ? "Administrador" : "Cajero";

  const enSucursalSA = params.sucursalNombre ? ` en <strong>${esc(params.sucursalNombre)}</strong>` : "";

  const html = buildNoticeHtml({
    preheader: `Caja de ${esc(params.userName)} (${roleLabel}) cerrada automáticamente — ${esc(params.businessName)}`,
    heading: `Caja cerrada automáticamente: ${esc(params.userName)}`,
    intro:
      `La caja de <strong>${esc(params.userName)}</strong> (${esc(params.userEmail)}, ${roleLabel})${enSucursalSA}, abierta el ${fecha}, fue cerrada automáticamente por el sistema a las 4:30 a. m. (hora CDMX). Resumen del corte:`,
    highlight: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
        <tr><td style="font-size:14px;color:${BRAND.body};padding:4px 0;">Fondo inicial: <strong>${formatMXN(params.saldoEsperado - params.totalVentas - params.totalEntradas + params.totalSalidas)}</strong></td></tr>
        <tr><td style="font-size:14px;color:${BRAND.body};padding:4px 0;">Ventas: <strong style="color:#2563eb;">+${formatMXN(params.totalVentas)}</strong></td></tr>
        <tr><td style="font-size:14px;color:${BRAND.body};padding:4px 0;">Entradas: <strong style="color:#16a34a;">+${formatMXN(params.totalEntradas)}</strong></td></tr>
        <tr><td style="font-size:14px;color:${BRAND.body};padding:4px 0;">Salidas: <strong style="color:#dc2626;">-${formatMXN(params.totalSalidas)}</strong></td></tr>
        <tr><td style="font-size:14px;color:${BRAND.ink};font-weight:700;padding:8px 0 4px;border-top:1px solid ${BRAND.border};">Saldo esperado: <strong>${formatMXN(params.saldoEsperado)}</strong></td></tr>
      </table>
      <p style="font-size:13px;color:${BRAND.muted};margin:8px 0 0;">El sistema cerró la caja con saldo real = saldo esperado (diferencia $0.00). Si el usuario necesita ajustar, puede hacerlo desde Finanzas.</p>
    `,
    ctaLabel: "Ver cajas del negocio",
    ctaHref: `${BRAND.appUrl}/es/finances`,
    mostrarBeneficios: false,
  });

  const resend = new Resend(resendApiKey);

  try {
    await deliver(resend, {
      from: getFromAddress(),
      to: params.to,
      subject: `Caja de ${params.userName} (${roleLabel})${params.sucursalNombre ? ` en ${params.sucursalNombre}` : ""} cerrada automáticamente — ${params.businessName}`,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] Falló el aviso de cierre automático al super admin:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}


// =============================================
// Aviso al dueño cuando alguien de su equipo cierra una caja a mano
// =============================================

const ETIQUETA_ROL: Record<string, string> = {
  SUPER_ADMIN: "Super Administrador",
  ORG_ADMIN: "Administrador",
  CAJERO: "Cajero",
};

export interface DatosCierreCaja {
  businessName: string;
  /** Solo con 2 o mas sucursales activas; si no, no se menciona. */
  sucursalNombre: string | null;
  userName: string;
  userRole: string;
  userEmail: string;
  fechaApertura: string;
  fechaCierre: string;
  fondoInicial: number;
  totalVentas: number;
  totalEntradas: number;
  totalSalidas: number;
  saldoEsperado: number;
  saldoReal: number;
  diferencia: number;
  notasCierre: string | null;
}

/**
 * Arma el correo del corte (asunto y HTML) sin enviarlo, para poder probar lo
 * que ve el dueño: con y sin sucursal, cuadre o faltante, texto escapado.
 */
export function construirCorreoCierreCaja(d: DatosCierreCaja): { subject: string; html: string } {
  const mxn = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
  const hora = (iso: string) =>
    new Date(iso).toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
      dateStyle: "medium",
      timeStyle: "short",
    });
  const rol = ETIQUETA_ROL[d.userRole] ?? "Usuario";
  const enSucursal = d.sucursalNombre ? ` en ${d.sucursalNombre}` : "";

  const cuadre =
    Math.abs(d.diferencia) < 0.005
      ? { color: "#16a34a", texto: "Cuadra" }
      : d.diferencia < 0
        ? { color: "#dc2626", texto: `Faltan ${mxn(Math.abs(d.diferencia))}` }
        : { color: "#d97706", texto: `Sobran ${mxn(d.diferencia)}` };

  const fila = (etiqueta: string, valor: string, estilo = "") =>
    `<tr><td style="font-size:14px;color:${BRAND.body};padding:4px 0;${estilo}">${etiqueta}: <strong>${valor}</strong></td></tr>`;

  const html = buildNoticeHtml({
    preheader: `${esc(d.userName)} cerró su caja${esc(enSucursal)} — ${cuadre.texto}`,
    heading: `Caja cerrada por ${esc(d.userName)}`,
    intro:
      `<strong>${esc(d.userName)}</strong> (${esc(d.userEmail)}, ${rol}) cerró su caja` +
      (d.sucursalNombre ? ` en <strong>${esc(d.sucursalNombre)}</strong>` : "") +
      ` de <strong>${esc(d.businessName)}</strong>.<br />` +
      `Abierta: ${hora(d.fechaApertura)} &middot; Cerrada: ${hora(d.fechaCierre)} (hora CDMX).`,
    highlight: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
        ${fila("Fondo inicial", mxn(d.fondoInicial))}
        ${fila("Ventas", `<span style="color:#2563eb;">+${mxn(d.totalVentas)}</span>`)}
        ${fila("Entradas", `<span style="color:#16a34a;">+${mxn(d.totalEntradas)}</span>`)}
        ${fila("Salidas", `<span style="color:#dc2626;">-${mxn(d.totalSalidas)}</span>`)}
        ${fila("Saldo esperado", mxn(d.saldoEsperado), `border-top:1px solid ${BRAND.border};padding-top:8px;`)}
        ${fila("Saldo real (contado)", mxn(d.saldoReal))}
        <tr><td style="font-size:14px;padding:8px 0 4px;color:${cuadre.color};font-weight:700;">Diferencia: ${mxn(d.diferencia)} &middot; ${cuadre.texto}</td></tr>
      </table>
      ${
        d.notasCierre
          ? `<p style="font-size:13px;color:${BRAND.body};margin:8px 0 0;"><strong>Notas:</strong> ${esc(d.notasCierre)}</p>`
          : ""
      }
    `,
    ctaLabel: "Ver finanzas",
    ctaHref: `${BRAND.appUrl}/es/finances`,
    mostrarBeneficios: false,
  });

  return {
    subject: `Corte de caja: ${d.userName} (${rol})${enSucursal} — ${cuadre.texto} — ${d.businessName}`,
    html,
  };
}

/** Envia al SUPER_ADMIN el corte que acaba de hacer alguien de su equipo. */
export async function sendCierreCajaToSuperAdminEmail(
  params: DatosCierreCaja & { to: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!resendApiKey) {
    console.warn("[email] RESEND_API_KEY no configurada; se omite aviso de cierre de caja");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const { subject, html } = construirCorreoCierreCaja(params);
  const resend = new Resend(resendApiKey);

  try {
    await deliver(resend, { from: getFromAddress(), to: params.to, subject, html });
    return { ok: true };
  } catch (err) {
    console.error("[email] Falló el aviso de cierre de caja al super admin:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface AvisoStockCorreo {
  tipo: "stock_bajo" | "stock_agotado";
  nombre: string;
  stock: number;
  minimo: number;
  unidad: string | null;
}

/**
 * Arma el correo inmediato de stock (asunto y HTML) sin enviarlo. Un solo
 * correo junta todo lo que se acabó desde el anterior (máximo uno cada 15 min
 * por negocio; ver `reclamar_avisos_stock`, migración 108). Agotados primero.
 */
export function construirCorreoAvisoStock(params: {
  businessName: string;
  avisos: AvisoStockCorreo[];
}): { subject: string; html: string } {
  const avisos = [...params.avisos].sort(
    (a, b) => Number(b.tipo === "stock_agotado") - Number(a.tipo === "stock_agotado")
  );
  const agotados = avisos.filter((a) => a.tipo === "stock_agotado").length;
  const total = avisos.length;
  const negocio = params.businessName;

  const subject =
    total === 1
      ? `${avisos[0].tipo === "stock_agotado" ? "Se agotó" : "Stock bajo"}: ${avisos[0].nombre} — ${negocio}`
      : `${total} productos se están acabando en ${negocio}`;

  const filas = avisos
    .map((a) => {
      const agotado = a.tipo === "stock_agotado";
      const color = agotado ? "#dc2626" : "#d97706";
      const etiqueta = agotado ? "Agotado" : "Stock bajo";
      const minimo = a.minimo > 0 ? formatearCantidad(a.minimo, a.unidad) : "—";
      return `<tr>
        <td style="font-size:14px;color:${BRAND.ink};padding:8px 0;border-bottom:1px solid ${BRAND.border};">${esc(a.nombre)}</td>
        <td style="font-size:14px;color:${BRAND.body};padding:8px 8px;border-bottom:1px solid ${BRAND.border};text-align:right;white-space:nowrap;">${formatearCantidad(a.stock, a.unidad)}</td>
        <td style="font-size:13px;color:${BRAND.muted};padding:8px 8px;border-bottom:1px solid ${BRAND.border};text-align:right;white-space:nowrap;">${minimo}</td>
        <td style="font-size:12px;font-weight:700;color:${color};padding:8px 0;border-bottom:1px solid ${BRAND.border};text-align:right;white-space:nowrap;">${etiqueta}</td>
      </tr>`;
    })
    .join("");

  const html = buildNoticeHtml({
    preheader:
      agotados > 0
        ? `${agotados} ${agotados === 1 ? "producto agotado" : "productos agotados"} en ${esc(negocio)}`
        : `${total} ${total === 1 ? "producto" : "productos"} con stock bajo en ${esc(negocio)}`,
    heading: total === 1 ? "Un producto se está acabando" : `${total} productos se están acabando`,
    intro:
      `En <strong>${esc(negocio)}</strong> ${total === 1 ? "este producto llegó" : "estos productos llegaron"} ` +
      `a su stock mínimo o se ${total === 1 ? "agotó" : "agotaron"}. Conviene resurtir antes de perder ventas.`,
    highlight: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:11px;color:${BRAND.muted};text-transform:uppercase;padding:0 0 4px;">Producto</td>
          <td style="font-size:11px;color:${BRAND.muted};text-transform:uppercase;padding:0 8px 4px;text-align:right;">Quedan</td>
          <td style="font-size:11px;color:${BRAND.muted};text-transform:uppercase;padding:0 8px 4px;text-align:right;">Mínimo</td>
          <td style="font-size:11px;color:${BRAND.muted};text-transform:uppercase;padding:0 0 4px;text-align:right;">Estado</td>
        </tr>
        ${filas}
      </table>`,
    ctaLabel: "Ver productos",
    ctaHref: `${BRAND.appUrl}/es/products`,
    mostrarBeneficios: false,
  });

  return { subject, html };
}

/** Envía el aviso de stock al dueño y a los administradores (en un solo correo). */
export async function sendAvisoStockEmail(params: {
  to: string[];
  businessName: string;
  avisos: AvisoStockCorreo[];
}): Promise<{ ok: boolean; error?: string }> {
  if (!resendApiKey) {
    console.warn("[email] RESEND_API_KEY no configurada; se omite aviso de stock");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  if (params.to.length === 0 || params.avisos.length === 0) {
    return { ok: false, error: "Sin destinatarios o sin avisos" };
  }

  const { subject, html } = construirCorreoAvisoStock(params);
  const resend = new Resend(resendApiKey);

  try {
    await deliver(resend, { from: getFromAddress(), to: params.to, subject, html });
    return { ok: true };
  } catch (err) {
    console.error("[email] Falló el aviso de stock:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Tarjeta de lealtad para el cliente final del negocio (migracion 115): se la
 * manda el negocio desde Clientes. El remitente es SYMVORA, pero el correo
 * habla del negocio; todo lo que escribio el negocio va escapado.
 */
export async function sendTarjetaLealtadEmail(params: {
  to: string;
  negocio: string;
  programa: string;
  premio: string;
  sellos: number;
  sellosMeta: number;
  url: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resendApiKey) {
    console.warn("[email] RESEND_API_KEY no configurada; se omite la tarjeta de lealtad");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const faltan = Math.max(0, params.sellosMeta - params.sellos);
  const progreso =
    faltan === 0
      ? `¡Ya completaste tus ${params.sellosMeta} sellos! Muéstrale tu tarjeta al cajero para canjear: <strong>${esc(params.premio)}</strong>.`
      : `Llevas <strong>${params.sellos} de ${params.sellosMeta}</strong> sellos. Al completarlos te llevas: <strong>${esc(params.premio)}</strong>.`;

  const html = buildNoticeHtml({
    preheader: `Tu tarjeta de ${esc(params.negocio)}`,
    heading: `Tu tarjeta de ${esc(params.negocio)}`,
    intro: `${esc(params.negocio)} te da la bienvenida a <strong>${esc(params.programa)}</strong>. Cada compra suma un sello: solo muestra el código de tu tarjeta al pagar.`,
    highlight: progreso,
    ctaLabel: "Ver mi tarjeta",
    ctaHref: params.url,
    mostrarBeneficios: false,
  });

  const resend = new Resend(resendApiKey);
  try {
    await deliver(resend, {
      from: getFromAddress(),
      to: params.to,
      subject: `Tu tarjeta de lealtad de ${params.negocio}`,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] Falló la tarjeta de lealtad:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
