import { Resend } from "resend";
import { getReferralSignupUrl } from "@/lib/referrals";
import { CONTACT_EMAIL, HELLO_EMAIL, NO_REPLY_EMAIL, SUPPORT_EMAIL } from "@/lib/contact";
import { TIMEOUTS, withTimeout } from "@/lib/http/timeout";
import { DIAS_PRUEBA } from "@/lib/trial";

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
}): string {
  const { preheader, heading, intro, highlight, ctaLabel, ctaHref } = params;

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
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 4px;">
                    <tr><td style="padding:6px 0;font-size:14px;color:${BRAND.body};line-height:1.6;">&#10003;&nbsp; Tus datos y tu catálogo siguen intactos</td></tr>
                    <tr><td style="padding:6px 0;font-size:14px;color:${BRAND.body};line-height:1.6;">&#10003;&nbsp; Sin comisiones por venta</td></tr>
                    <tr><td style="padding:6px 0;font-size:14px;color:${BRAND.body};line-height:1.6;">&#10003;&nbsp; Cancela cuando quieras</td></tr>
                  </table>
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
      `Los ${DIAS_PRUEBA} días de prueba llegaron a su fin, así que por ahora el acceso al sistema está en pausa. Activar tu suscripción lo restablece al instante.`,
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

