import { LegalShell } from "@/components/marketing/legal-shell";
import { PRIVACY_EMAIL } from "@/lib/contact";

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
    <LegalShell title="Política de Cookies" updatedAt="12 de agosto de 2026">
      <p>
        Esta Política explica qué son las cookies, qué cookies utiliza la Plataforma
        SYMVORA, para qué se emplean y cómo puede administrar su uso.
      </p>

      <h2>1. ¿Qué son las cookies?</h2>
      <p>
        Las cookies son pequeños archivos que se almacenan en su dispositivo (navegador)
        cuando visita un sitio. Permiten que la Plataforma recuerde información sobre su
        visita para proporcionarle una mejor experiencia.
      </p>

      <h2>2. Cookies que utilizamos</h2>
      <p>
        SYMVORA utiliza únicamente cookies estrictamente necesarias y funcionales para el
        funcionamiento correcto de la Plataforma. No utilizamos cookies de publicidad ni
        de seguimiento de terceros.
      </p>
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
          <strong>Cookie de consentimiento:</strong> registra que usted aceptó esta
          Política de Cookies (symvora_consent).
        </li>
      </ul>
      <p>
        Además, algunas preferencias (como el tema claro u oscuro) se guardan en el
        almacenamiento local del navegador y no constituyen cookies.
      </p>

      <h2>3. ¿Para qué se usan?</h2>
      <ul>
        <li>Mantener su sesión iniciada de forma segura.</li>
        <li>Recordar su idioma preferido.</li>
        <li>Garantizar la seguridad y el correcto funcionamiento de la Plataforma.</li>
      </ul>

      <h2>4. ¿Cómo administrar o eliminar las cookies?</h2>
      <p>
        Puede configurar su navegador para bloquear o eliminar cookies desde su menú de
        preferencias. Tenga en cuenta que, si deshabilita las cookies de sesión, algunas
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