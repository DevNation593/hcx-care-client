import type { LegalEntity } from '@/content/site';

const or = (value: string) => value.trim() || '[pendiente]';

export default function PrivacyText({ legal, brand }: { legal: LegalEntity; brand: string }) {
  return (
    <>
      <p>Esta política aplica a quienes visitan el sitio público de {brand}.</p>

      <h2>1. Responsable</h2>
      <p>
        El responsable del tratamiento es {or(legal.companyName)}, con identificación fiscal {or(legal.taxId)} y
        domicilio en {or(legal.address)}. Contacto: {or(legal.dataContactEmail)}.
      </p>

      <h2>2. Datos que recopilamos</h2>
      <ul>
        <li>
          Formulario de solicitud de demo: nombre, consultorio, correo, teléfono, tamaño del equipo, mensaje y la
          fecha en que aceptaste esta política. Al enviar el formulario, esos datos se transmiten a nuestros
          servidores y se guardan en nuestra base de datos. Avisamos de cada solicitud por correo electrónico a
          nuestro equipo, y solo el personal que administra la plataforma puede consultarlas en su panel de
          control.
        </li>
        <li>
          Si nos escribes directamente por WhatsApp o por correo, recibimos los datos que tú incluyas en ese mensaje.
        </li>
        <li>Datos de uso del sitio mediante analítica, únicamente si aceptas las cookies.</li>
      </ul>

      <h2>3. Finalidad</h2>
      <p>
        Contactarte para coordinar y realizar la demostración que solicitaste, dar seguimiento a la conversación
        comercial que derive de ella y medir cómo se usa el sitio para mejorarlo. No usamos los datos de la
        solicitud para otros fines ni los vendemos.
      </p>

      <h2>4. Base legal</h2>
      <p>
        Tu consentimiento, que otorgas al marcar la casilla de aceptación y enviar el formulario, y al aceptar las
        cookies de analítica.
      </p>

      <h2>5. Terceros</h2>
      <ul>
        <li>
          Los proveedores que alojan la plataforma y su base de datos, y el servicio de correo electrónico con el que
          avisamos al equipo de cada solicitud. Tratan los datos solo por encargo nuestro.
        </li>
        <li>WhatsApp (Meta), cuando nos escribes por ese medio.</li>
        <li>Google Analytics, solo si aceptas las cookies.</li>
        <li>Google Maps, solo si aceptas las cookies y se muestra el mapa.</li>
      </ul>

      <h2>6. Conservación</h2>
      <p>
        Conservamos tu solicitud de demo mientras la gestionamos y dure la conversación comercial que derive de
        ella. Puedes pedir que la eliminemos antes en cualquier momento (ver el punto 7). Los datos de analítica se
        conservan según la configuración de retención de Google Analytics.
      </p>

      <h2>7. Tus derechos</h2>
      <p>
        Puedes solicitar el acceso, la rectificación, la eliminación, la oposición y la portabilidad de tus datos
        escribiendo a {or(legal.dataContactEmail)}.
      </p>

      <h2>8. Cambios</h2>
      <p>Podemos actualizar esta política. Publicaremos aquí la versión vigente y su fecha de actualización.</p>
    </>
  );
}
