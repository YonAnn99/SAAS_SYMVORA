import Link from "next/link";
import { LegalShell } from "@/components/marketing/legal-shell";
import { PRIVACY_EMAIL } from "@/lib/contact";
import { DIAS_PLAZO_BAJA } from "@/features/cuenta/baja";

/**
 * Pagina publica para pedir la eliminacion de la cuenta. Google Play la exige
 * (se pega su URL en la ficha de la app, «Eliminacion de datos») aunque la app
 * ya tenga el boton en Mi perfil. Migracion 128.
 */
export const metadata = {
  title: "Eliminar tu cuenta | SYMVORA",
  description:
    "Cómo pedir la eliminación de tu cuenta de SYMVORA y de tus datos, qué se borra, qué se conserva y en cuánto tiempo.",
  alternates: {
    canonical: "/es/eliminar-cuenta",
  },
};

export default function EliminarCuentaPage() {
  return (
    <LegalShell title="Eliminar tu cuenta de SYMVORA" updatedAt="31 de octubre de 2026">
      <p>
        Puedes pedir que eliminemos tu cuenta de SYMVORA en cualquier momento, desde la
        app de Android, desde el navegador o por correo.
      </p>

      <h2>Desde la app o el navegador</h2>
      <ol>
        <li>Inicia sesión en SYMVORA (app.symvora.com.mx o la app de Android).</li>
        <li>Abre «Mi perfil»: en la computadora está al pie del menú lateral; en el celular, dentro del botón «+» del menú de abajo.</li>
        <li>En «Mi cuenta», al final, pulsa «Eliminar mi cuenta» y confirma escribiendo ELIMINAR.</li>
      </ol>

      <h2>Por correo</h2>
      <p>
        Si ya no puedes entrar, escribe a <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> desde
        el correo con el que te registraste, con el asunto «Eliminar mi cuenta» y el nombre de tu negocio.
      </p>

      <h2>Qué pasa después</h2>
      <ul>
        <li>
          Tu acceso queda bloqueado desde ese momento y tienes {DIAS_PLAZO_BAJA} días para
          arrepentirte: si entras y cancelas la solicitud, todo sigue como estaba.
        </li>
        <li>
          Si eres el dueño del negocio, tu suscripción se cancela ese mismo día y, al
          terminar el plazo, se borra el negocio completo: productos, inventario, ventas,
          clientes, fotos y las cuentas de tu equipo. Durante el plazo puedes descargar tu
          información.
        </li>
        <li>
          Si eres colaborador, sales del negocio y tu cuenta se elimina. Las ventas que
          registraste pertenecen al negocio y se quedan, sin tus datos.
        </li>
      </ul>

      <h2>Qué conservamos</h2>
      <ul>
        <li>
          Tu nombre y tu número de celular, para enviarte comunicaciones comerciales,
          como lo indica el Aviso de Privacidad. Puedes oponerte al pedir la eliminación
          (hay una casilla para eso) o en cualquier momento escribiendo a{" "}
          <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
        </li>
        <li>
          El registro de los pagos de tu suscripción, durante el plazo que exige la
          normatividad fiscal.
        </li>
      </ul>
      <p>
        Consulta el <Link href="/es/aviso-privacidad">Aviso de Privacidad</Link> para conocer el
        resto de tus derechos.
      </p>
    </LegalShell>
  );
}
