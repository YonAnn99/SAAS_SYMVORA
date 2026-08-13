import { LegalShell } from "@/components/marketing/legal-shell";

export const metadata = {
  title: "Aviso de Privacidad | SYMVORA",
  description:
    "Aviso de Privacidad Integral de SYMVORA conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.",
};

export default function AvisoPrivacidadPage() {
  return (
    <LegalShell title="Aviso de Privacidad Integral" updatedAt="12 de agosto de 2026">
      <p>
        SYMVORA (&quot;la Plataforma&quot;, &quot;nosotros&quot;), con domicilio en [Domicilio del responsable],
        pone a disposición de sus usuarios el presente Aviso de Privacidad Integral, en
        cumplimiento de la Ley Federal de Protección de Datos Personales en Posesión de
        los Particulares, su Reglamento y demás normatividad aplicable en México.
      </p>

      <h2>1. Responsable de los datos</h2>
      <p>
        El responsable del tratamiento de sus datos personales es SYMVORA, con domicilio
        en [Domicilio del responsable] y correo de contacto [privacidad@symvora.com].
      </p>

      <h2>2. Datos personales que recabamos</h2>
      <p>De los titulares (usuarios de la Plataforma) recabamos los siguientes datos:</p>
      <ul>
        <li>Identificación: nombre(s) y apellidos, correo electrónico, teléfono.</li>
        <li>
          Datos de su negocio: nombre comercial, giro comercial, logotipo, datos
          fiscales (RFC, razón social, régimen fiscal, código postal) necesarios para la
          emisión y cancelación de CFDI.
        </li>
        <li>
          Datos financieros para procesar sus pagos (por ejemplo, a través de nuestro
          proveedor de cobros Conekta). No almacenamos números de tarjeta de crédito o
          débito; su manejo se realiza directamente por el proveedor de pagos.
        </li>
        <li>Datos de acceso: credenciales de usuario e información de inicio de sesión.</li>
        <li>
          Datos técnicos y de navegación: dirección IP, tipo y versión de navegador,
          sistema operativo, información del dispositivo, identificadores de sesión y
          cookies estrictamente necesarias. Estos datos se utilizan para fines de
          seguridad, prevención de fraude y mejora del servicio.
        </li>
        <li>
          Datos de uso: interacciones con la Plataforma, bitácora de actividad (con
          sello de tiempo) y métricas de uso agregadas.
        </li>
      </ul>

      <h2>3. Finalidades del tratamiento</h2>
      <p>
        Sus datos personales serán utilizados para las siguientes finalidades primarias:
      </p>
      <ul>
        <li>Proveer, operar, administrar y dar mantenimiento a la Plataforma.</li>
        <li>
          Permitir la facturación electrónica (CFDI), su timbrado y cancelación de
          conformidad con las disposiciones del SAT.
        </li>
        <li>Gestionar la relación comercial: registro, facturación de servicios, cobros y soporte.</li>
        <li>Verificar su identidad y proteger la seguridad de su cuenta.</li>
        <li>Dar cumplimiento a obligaciones legales y fiscales.</li>
      </ul>
      <p>
        De manera adicional, podremos usar sus datos para finalidades secundarias como
        el envío de comunicaciones sobre la Plataforma y encuestas de satisfacción.
        En todo caso, usted puede oponerse al uso de sus datos con fines secundarios o
        revocar su consentimiento enviando una solicitud a [privacidad@symvora.com].
      </p>

      <h2>4. Datos de los clientes finales del usuario</h2>
      <p>
        La Plataforma permite a los usuarios registrar y procesar datos personales de sus
        propios clientes (por ejemplo, RFC y razón social para la emisión de facturas),
        así como datos de sus operaciones. En estos casos, SYMVORA actúa como encargado
        del tratamiento y el usuario actúa como responsable, por lo que el usuario es
        quien debe acreditar, ante sus clientes, la información relativa al tratamiento
        de dichos datos y contar con sus avisos de privacidad.
      </p>

      <h2>5. Transferencias de datos</h2>
      <p>
        Sus datos personales pueden ser transferidos a los siguientes encargados, todos
        con las medidas de seguridad necesarias:
      </p>
      <ul>
        <li>Proveedor de infraestructura en la nube y base de datos (Supabase).</li>
        <li>Proveedor de alojamiento de la Plataforma (Vercel).</li>
        <li>Proveedor de cobros en línea (Conekta) para el procesamiento de pagos.</li>
        <li>
          Proveedor de protección contra bots (Cloudflare Turnstile) cuando esté
          habilitado, para validar que los registros e inicios de sesión no sean
          automatizados.
        </li>
        <li>
          Proveedor de monitoreo de errores y observabilidad (Sentry) cuando esté
          habilitado, para identificar y resolver problemas técnicos que afecten la
          operación de la Plataforma.
        </li>
        <li>
          Autoridades competentes, cuando sea requerido por ley, mandamiento judicial o
          resolución de autoridad.
        </li>
      </ul>
      <p>
        Las transferencias a proveedores de tecnología se realizan únicamente con la
        finalidad de prestar el servicio contratado. No vendemos ni rentamos sus datos
        personales.
      </p>

      <h2>6. Mecanismos de seguridad</h2>
      <p>
        Adoptamos medidas administrativas, técnicas y físicas razonables para proteger
        sus datos personales contra daño, pérdida, alteración, destrucción o uso,
        acceso o tratamiento no autorizado. El acceso a su información está limitado con
        permisos según el rol del usuario dentro de su organización, y las operaciones
        se registran en bitácoras de actividad.
      </p>

      <h2>7. Conservación de los datos</h2>
      <p>
        Conservaremos sus datos personales únicamente durante el tiempo necesario para
        cumplir las finalidades descritas, incluyendo el plazo que exija la
        normatividad fiscal aplicable a la emisión y conservación de comprobantes
        fiscales (CFDI). Al término del plazo, los datos serán suprimidos, salvo que
        exista una obligación legal que exija su conservación.
      </p>

      <h2>8. Derechos ARCO</h2>
      <p>
        Usted o su representante legal podrán ejercer los derechos de Acceso,
        Rectificación, Cancelación y Oposición (derechos ARCO), así como revocar el
        consentimiento otorgado, enviando una solicitud al correo [privacidad@symvora.com],
        con: (i) su nombre y correo registrado; (ii) una descripción clara y precisa de
        los datos respecto de los cuales busca ejercer alguno de los derechos; y (iii)
        cualquier otro documento que facilite su localización. Le daremos respuesta en
        los plazos previstos por la legislación aplicable.
      </p>

      <h2>9. Cambios al Aviso de Privacidad</h2>
      <p>
        Nos reservamos el derecho de efectuar modificaciones al presente Aviso de
        Privacidad. Cualquier cambio sustancial será notificado con al menos quince
        (15) días naturales de anticipación a su entrada en vigor, mediante:
      </p>
      <ul>
        <li>Correo electrónico enviado a la dirección registrada por el usuario.</li>
        <li>
          Aviso prominente al iniciar sesión en la Plataforma, requiriendo la
          aceptación de la nueva versión para continuar utilizando el servicio.
        </li>
        <li>Publicación de la versión actualizada en esta misma página.</li>
      </ul>
      <p>
        Se consideran cambios sustanciales, entre otros: las finalidades del
        tratamiento, los terceros a los que se transfieren datos, los medios para
        ejercer derechos ARCO, o cualquier modificación que afecte la forma en que
        SYMVORA utiliza los datos personales del titular.
      </p>
    </LegalShell>
  );
}