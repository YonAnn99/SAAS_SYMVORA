import { LegalShell } from "@/components/marketing/legal-shell";

export const metadata = {
  title: "Términos y Condiciones | SYMVORA",
  description:
    "Términos y Condiciones de uso de la Plataforma SYMVORA.",
};

export default function TerminosPage() {
  return (
    <LegalShell title="Términos y Condiciones" updatedAt="12 de agosto de 2026">
      <p>
        Estos Términos y Condiciones regulan el uso de la Plataforma SYMVORA y de los
        servicios que en ella se ofrecen. Al crear una cuenta, el usuario acepta los
        términos aquí descritos.
      </p>

      <h2>1. Aceptación de los términos</h2>
      <p>
        El uso de la Plataforma implica la aceptación plena de estos Términos y
        Condiciones. Si el usuario no está de acuerdo con ellos, deberá abstenerse de
        crear una cuenta o usar los servicios.
      </p>

      <h2>2. Registro y cuenta</h2>
      <ul>
        <li>El usuario deberá proporcionar información veraz al momento de su registro.</li>
        <li>
          La cuenta es personal e intransferible. El usuario es responsable de mantener
          la confidencialidad de sus credenciales de acceso.
        </li>
        <li>
          El usuario podrá invitar a otros miembros de su organización y asignarles
          roles conforme a sus permisos dentro de la cuenta.
        </li>
      </ul>

      <h2>3. Uso del servicio</h2>
      <p>
        La Plataforma permite administrar ventas, inventario, compras, finanzas,
        clientes, proveedores y realizar facturación electrónica (CFDI). El usuario se
        obliga a:
      </p>
      <ul>
        <li>Utilizar la Plataforma únicamente para fines legales y lícitos.</li>
        <li>
          No intentar acceder a información de terceros, vulnerar la seguridad del
          sistema o interferir con la operación de la Plataforma.
        </li>
        <li>
          No revender, sublicenciar ni explotar comercialmente la Plataforma sin
          autorización expresa.
        </li>
      </ul>

      <h2>4. Responsabilidad fiscal del usuario</h2>
      <p>
        El usuario es responsable de la veracidad de sus datos fiscales y de los datos
        de sus clientes utilizados para la emisión de comprobantes fiscales digitales
        (CFDI). La emisión, el timbrado y el contenido de los comprobantes son
        responsabilidad exclusiva del usuario, quien deberá cumplir con las obligaciones
        que establezca el SAT y demás autoridades competentes.
      </p>

      <h2>5. Suscripción y pagos</h2>
      <p>
        Los servicios se ofrecen mediante planes de suscripción. Los cobros se procesan
        a través del proveedor de pagos (Conekta). El usuario autoriza expresamente el
        cargo correspondiente. La falta de pago podrá dar lugar a la suspensión o
        cancelación del acceso a la Plataforma.
      </p>

      <h2>6. Cancelación y terminación</h2>
      <p>
        El usuario podrá cancelar su suscripción en cualquier momento conforme a las
        condiciones del plan contratado. SYMVORA podrá suspender o dar por terminada la
        cuenta ante el incumplimiento de estos Términos y Condiciones.
      </p>

      <h2>7. Propiedad intelectual</h2>
      <p>
        La Plataforma, su software, marcas, logotipos y contenidos son propiedad de
        SYMVORA o de sus licenciantes y están protegidos por la legislación aplicable en
        materia de propiedad intelectual.
      </p>

      <h2>8. Limitación de responsabilidad</h2>
      <p>
        La Plataforma se proporciona &quot;tal cual&quot; y &quot;según disponibilidad&quot;. En la medida
        máxima permitida por la ley, SYMVORA no será responsable por daños indirectos,
        incidentales o consecuentes derivados del uso o la imposibilidad de uso de la
        Plataforma, incluyendo pérdidas de datos, interrupciones del servicio o
        interacción con terceros proveedores.
      </p>

      <h2>9. Ley aplicable y jurisdicción</h2>
      <p>
        Estos Términos y Condiciones se rigen por las leyes de los Estados Unidos
        Mexicanos. Para cualquier controversia, las partes se someten a la jurisdicción
        de los tribunales competentes de [Ciudad], México.
      </p>

      <h2>10. Contacto</h2>
      <p>
        Para cualquier duda sobre estos Términos y Condiciones, contacte a
        [privacidad@symvora.com].
      </p>
    </LegalShell>
  );
}