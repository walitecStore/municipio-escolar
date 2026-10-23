import { InstallApp } from "@/components/install-app";
import {
  CircleHelp,
  ClipboardCheck,
  Vote,
  FileText,
  ShieldCheck,
} from "lucide-react";
const topics = [
  {
    icon: ClipboardCheck,
    title: "1. Prepara tu elección",
    text: "Desde el panel electoral, selecciona una elección o prepara una nueva. Configura el colegio y el total definitivo de electores antes de abrirla.",
  },
  {
    icon: ClipboardCheck,
    title: "2. Revisa el padrón",
    text: "Importa un Excel con dni, nombre, grado y seccion. El DNI debe ser texto de ocho dígitos. Para cargar por salón, selecciona agregar sin borrar los registros anteriores.",
  },
  {
    icon: Vote,
    title: "3. Organiza las mesas",
    text: "En modalidad DNI, el comité habilita cada computadora y comprueba presencialmente la identidad del estudiante. La sesión administrativa se mantiene en un equipo separado.",
  },
  {
    icon: FileText,
    title: "4. Consulta resultados y genera el acta",
    text: "Los resultados y las actas están protegidos hasta cerrar la elección. Después podrás descargar el PDF con la insignia y los espacios de firma, o exportar el recuento Excel.",
  },
  {
    icon: ShieldCheck,
    title: "5. Cuida tu acceso",
    text: "Tu cuenta y el autenticador son personales. Cambia tu contraseña desde Perfil y seguridad. Si pierdes conexión después de confirmar un voto, consulta el estado antes de volver a intentarlo.",
  },
];
export default function Help() {
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">ESTAMOS PARA ORIENTARTE</div>
        <h1>Ayuda para tu proceso electoral</h1>
        <p>Una guía sencilla para acompañarte en cada etapa.</p>
      </div>
      <section className="panel help-intro">
        <CircleHelp size={35} aria-hidden="true" />
        <div>
          <h2>¿Por dónde empezar?</h2>
          <p>
            El panel te muestra las elecciones disponibles para tu cuenta.
            Dentro de cada elección encontrarás sus tareas ordenadas por
            tarjetas.
          </p>
        </div>
      </section>
      <div className="help-grid section">
        {topics.map((t) => (
          <article className="panel" key={t.title}>
            <t.icon size={27} aria-hidden="true" />
            <h2>{t.title}</h2>
            <p>{t.text}</p>
          </article>
        ))}
      </div>
      <section className="notice">
        Si necesitas recuperar acceso o corregir permisos, contacta al encargado
        institucional o al operador de la plataforma. No compartas contraseñas,
        códigos MFA ni habilitaciones de mesa.
      </section>
      <section className="panel section"><h2>Instalar en tu dispositivo</h2><InstallApp /></section>
    </>
  );
}
