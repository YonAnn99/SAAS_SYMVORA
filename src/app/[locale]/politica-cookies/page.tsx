import { LegalShell } from "@/components/marketing/legal-shell";
import { PRIVACY_EMAIL } from "@/lib/contact";
import { BotonConfigurarCookies } from "@/components/compliance/boton-configurar-cookies";

export const metadata = {
  title: "Política de Cookies | SYMVORA",
  description:
    "Política de Cookies de la Plataforma SYMVORA: qué cookies utilizamos y cómo administrarlas.",
  alternates: {
    canonical: "/es/politica-cookies",
  },
};

export default function PoliticaCookiesPage() {
  return (
    <LegalShell title="Política de Cookies" updatedAt="12 de noviembre de 2026">
      <p>
        Esta Política explica qué son las cookies, qué cookies y tecnologías similares
        utiliza la Plataforma SYMVORA, para qué se emplean y cómo puede administrar su uso.
      </p>

      <h2>1. ¿Qué son las cookies?</h2>
      <p>
        Las cookies son pequeños archivos que se almacenan en su dispositivo (navegador)
        cuando visita un sitio. Permiten que la Plataforma recuerde información sobre su
        visita para proporcionarle una mejor experiencia.
      </p>

      <h2>2. Cookies y tecnologías que utilizamos</h2>
      <p>
        SYMVORA no utiliza cookies de publicidad ni de seguimiento de terceros. Lo que
        usamos se divide en dos categorías:
      </p>
      <h3>Esenciales (siempre activas)</h3>
      <ul>
        <li>
          <strong>Cookies de sesión (autenticación):</strong> necesarias para mantenerle
          identificado mientras utiliza la Plataforma. Sin ellas, no podría iniciar
          sesión ni acceder a los módulos de su negocio.
        </li>
        <li>
          <strong>Cookie de idioma:</strong> recuerda su preferencia de idioma
          (NEXT_LOCALE) para mostrar la Plataforma en el idioma seleccionado.
        </li>
        <li>
          <strong>Cookie de consentimiento:</strong> registra su elección sobre la medición
          anónima, aceptarla o rechazarla (symvora_consent). Dura 180 días.
        </li>
        <li>
          <strong>Seguridad:</strong> la verificación de Cloudflare Turnstile en el inicio de
          sesión y el registro, para distinguir personas de programas automatizados.
        </li>
      </ul>
      <h3>Medición anónima (opcional, sin cookies)</h3>
      <p>
        Usamos Vercel Web Analytics y Vercel Speed Insights para contar visitas y páginas
        vistas y medir la velocidad del sitio. No guardan cookies en su navegador ni usan
        identificadores personales: los datos son agregados y sirven solo para mejorar la
        Plataforma. Se activan salvo que usted los rechace en el aviso de cookies.
      </p>
      <p>
        Además, algunas preferencias (como el tema claro u oscuro) se guardan en el
        almacenamiento local del navegador y no constituyen cookies.
      </p>

      <h2>3. ¿Para qué se usan?</h2>
      <ul>
        <li>Mantener su sesión iniciada de forma segura.</li>
        <li>Recordar su idioma preferido.</li>
        <li>Garantizar la seguridad y el correcto funcionamiento de la Plataforma.</li>
        <li>Si usted lo permite, entender de forma anónima cómo se usa el sitio y qué tan rápido carga.</li>
      </ul>

      <h2>4. ¿Cómo administrar o eliminar las cookies?</h2>
      <p>
        Puede aceptar o rechazar la medición anónima en el aviso de cookies y cambiar su
        elección en cualquier momento desde «Configurar cookies», en el pie de página o aquí
        mismo:{" "}
        <BotonConfigurarCookies className="font-medium underline underline-offset-2">
          Configurar cookies
        </BotonConfigurarCookies>
        .
      </p>
      <p>
        También puede configurar su navegador para bloquear o eliminar cookies desde su menú
        de preferencias. Tenga en cuenta que, si deshabilita las cookies de sesión, algunas
        funcionalidades de la Plataforma podrían dejar de funcionar correctamente, como
        el inicio de sesión.
      </p>

      <h2>5. Cambios a esta Política</h2>
      <p>
        Podremos actualizar esta Política de Cookies cuando sea necesario; se publicará
        aquí la fecha de la última actualización.
      </p>

      <h2>6. Contacto</h2>
      <p>
        Para cualquier duda sobre esta Política, contacte a <a href={`mailto:${PRIVACY_EMAIL}`} className="underline">{PRIVACY_EMAIL}</a>.
      </p>
    </LegalShell>
  );
}