# Correos de SYMVORA — configuración y plantillas

SYMVORA envía correos desde **dos vías**:

| Vía | Correos | Dónde se personalizan |
|---|---|---|
| **Resend (API de la app)** | Bienvenida (y futuros correos transaccionales de la app) | `src/lib/email.ts` |
| **Supabase Auth** | Reset password, confirmación de cuenta, invitación a usuario, magic link, OTP, reautenticación | Dashboard de Supabase → **Authentication → Emails → Templates** |

> **Cloudflare no participa en el envío.** Su Email Routing (`hola@symvora.com.mx` → Hotmail) es solo de recepción.

---

## 1. Configuración SMTP de Resend (para que los correos de Supabase Auth salgan por tu dominio)

Los correos de **Supabase Auth** se envían desde el SMTP que configures. Para usar **Resend** como transportista:

### 1.1 Resend — dominio de envío
1. Crea una cuenta en [resend.com](https://resend.com) y en **Domains** agrega `symvora.com.mx`.
2. Resend te dará registros DNS. Agrégalos en **Cloudflare → DNS**:
   - **SPF** (registro TXT en `symvora.com.mx`). *Importante:* solo puede existir **un** registro SPF por dominio, y Cloudflare Email Routing ya usa `include:_spf.mx.cloudflare.net`. Combínalo en uno solo:
     ```
     v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all
     ```
   - **DKIM**: el CNAME + TXT (o el registro TXT) que indique Resend.
   - **DMARC** (recomendado):
     ```
     v=DMARC1; p=quarantine; rua=mailto:hola@symvora.com.mx; pct=100
     ```
3. Verifica el dominio en Resend (estado **Verified**).

### 1.2 Resend — credenciales SMTP
En Resend → **SMTP** obtienes:
- Host: `smtp.resend.com`
- Puerto: `587` (TLS) o `465` (SSL)
- Usuario: tu **API Key** de Resend
- Contraseña: tu **API Key** de Resend (la misma)

### 1.3 Supabase — SMTP Settings
Dashboard → **Authentication → SMTP Settings** → habilita *Enable Custom SMTP*:
- **Sender name**: `SYMVORA`
- **Sender email**: `no-reply@symvora.com.mx`
- **Host**: `smtp.resend.com`
- **Port**: `587`
- **User**: (API key de Resend)
- **Password**: (API key de Resend)

Una vez guardado, todos los correos de Auth salen por Resend con tu dominio. (Sin esto, el SMTP por defecto de Supabase solo entrega a los miembros del equipo del proyecto.)

---

## 2. Plantillas de Supabase Auth (con logo de SYMVORA)

**En todos los correos usa el logo:**
```
https://www.symvora.com.mx/symvora-logo-email.png
```
> Es un PNG optimizado (512 px, ~100 KB) creado para correo — compatible con Outlook (a diferencia de `.webp`). Está en `public/symvora-logo-email.png`.

Variables de plantilla disponibles: `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .TokenHash }}`, `{{ .SiteURL }}`, `{{ .Email }}`.

### Estructura base (mismo look en todos)

```html
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #eeeeee;border-radius:16px;overflow:hidden;">
  <div style="background:#1a1a1a;padding:24px;text-align:center;">
    <img src="https://www.symvora.com.mx/symvora-logo-email.png" alt="SYMVORA" width="140" style="display:inline-block;border:0;" />
  </div>
  <div style="padding:28px 32px;">
    <!-- CONTENIDO -->
  </div>
  <div style="padding:8px 32px 28px;">
    <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;border-top:1px solid #eeeeee;padding-top:16px;line-height:1.6;">
      ¿Necesitas ayuda? Escríbenos a <a href="mailto:contacto@symvora.com.mx" style="color:#2563eb;text-decoration:none;">contacto@symvora.com.mx</a><br />
      © 2026 SYMVORA. Todos los derechos reservados.
    </p>
  </div>
</div>
```

### 2.1 Reset Password
- **Asunto:** `Restablece tu contraseña de SYMVORA`

```html
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #eeeeee;border-radius:16px;overflow:hidden;">
  <div style="background:#1a1a1a;padding:24px;text-align:center;">
    <img src="https://www.symvora.com.mx/symvora-logo-email.png" alt="SYMVORA" width="140" style="display:inline-block;border:0;" />
  </div>
  <div style="padding:28px 32px;">
    <h1 style="font-size:22px;color:#1a1a1a;margin:0 0 12px;">Restablece tu contraseña</h1>
    <p style="font-size:15px;color:#4b5563;margin:0 0 20px;line-height:1.6;">
      Recibimos una solicitud para restablecer la contraseña de tu cuenta SYMVORA.
      Haz clic en el botón para elegir una nueva:
    </p>
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">Restablecer contraseña</a>
    <p style="font-size:12px;color:#9ca3af;margin:20px 0 0;line-height:1.6;">
      Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
      {{ .ConfirmationURL }}
    </p>
    <p style="font-size:12px;color:#9ca3af;margin:12px 0 0;line-height:1.6;">
      Si no solicitaste este cambio, ignora este correo. Tu contraseña no cambiará.
    </p>
  </div>
  <div style="padding:8px 32px 28px;">
    <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;border-top:1px solid #eeeeee;padding-top:16px;line-height:1.6;">
      ¿Necesitas ayuda? Escríbenos a <a href="mailto:contacto@symvora.com.mx" style="color:#2563eb;text-decoration:none;">contacto@symvora.com.mx</a><br />
      © 2026 SYMVORA. Todos los derechos reservados.
    </p>
  </div>
</div>
```

### 2.2 Confirm signup (confirmación de cuenta)
- **Asunto:** `Confirma tu correo en SYMVORA`
- HTML: igual al base, con contenido:
  - Título: `Confirma tu correo electrónico`
  - Texto: `Para activar tu cuenta SYMVORA, confirma tu correo electrónico con el botón de abajo.`
  - Botón: `Confirmar mi correo` → `{{ .ConfirmationURL }}`

### 2.3 Invite user (invitación del dashboard)
- **Asunto:** `Te invitaron a unirte a SYMVORA`
- HTML: igual al base, con contenido:
  - Título: `Te invitaron a SYMVORA`
  - Texto: `Te invitamos a formar parte de un negocio en SYMVORA. Crea tu cuenta con el botón de abajo.`
  - Botón: `Aceptar invitación` → `{{ .ConfirmationURL }}`

### 2.4 Magic Link
- **Asunto:** `Tu enlace de acceso a SYMVORA`
- HTML: igual al base, con contenido:
  - Título: `Acceso sin contraseña`
  - Texto: `Tu enlace de acceso a SYMVORA está listo. Toca el botón para entrar (expira pronto).`
  - Botón: `Entrar a SYMVORA` → `{{ .ConfirmationURL }}`

### 2.5 OTP / Reauthentication
- **Asunto:** `Tu código de verificación SYMVORA`
- HTML: igual al base, con contenido:
  - Título: `Código de verificación`
  - Texto: `Tu código de un solo uso es:` + `<strong style="font-size:28px;color:#1a1a1a;">{{ .Token }}</strong>` + `No lo compartas con nadie.`

---

## 3. Correo de bienvenida (app, Resend)

La plantilla de bienvenida vive en **código**: `src/lib/email.ts` (`sendWelcomeEmail`), con HTML inline y branding (header oscuro con logo, CTA de referidos, footer con contacto). Se edita con commits; Resend solo lo entrega.

- **Remitente**: env var `RESEND_FROM_EMAIL` (fallback `SYMVORA <no-reply@symvora.com.mx>`).
- **Disparo**: webhook de pago de Conekta (`src/app/api/conekta/webhook/route.ts`).
- **Logo**: `public/symvora-logo-email.png` (debe estar desplegado en `www.symvora.com.mx`).

---

## 4. Notas

- **Solo un registro SPF** por dominio: combina Cloudflare Email Routing + Resend en una sola línea TXT (sección 1.1).
- **DKIM/DMARC** aplican a `symvora.com.mx` y mejoran la entregabilidad tanto de Supabase Auth como de la app (ambos envían con ese dominio).
- Para probar los correos de Auth localmente, agrega `http://localhost:3000/es/reset-password` (y `/en/...`) en **Supabase → Authentication → URL Configuration → Redirect URLs**; en producción debe estar `https://app.symvora.com.mx/es/reset-password` y `/en/reset-password`.
