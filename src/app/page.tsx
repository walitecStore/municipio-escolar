import Link from "next/link";
import Image from "next/image";
import { ShieldCheck, Vote } from "lucide-react";
export default function Home() {
  return <section className="entry-welcome">
    <div className="entry-character"><Image src="/illustrations/student-welcome.webp" alt="Joven con terno dando la bienvenida a las elecciones escolares" width={640} height={960} priority /></div>
    <div className="entry-copy"><span>ELECCIONES DEL MUNICIPIO ESCOLAR</span><h1>¡Bienvenido a tus elecciones escolares!</h1><p>Tu escuela, tu voz y tu participación. Elige cómo deseas ingresar.</p><div className="entry-choices"><Link href="/sistema" className="entry-choice"><ShieldCheck size={32} /><strong>Ingresar si eres organizador</strong><small>Organiza la elección de tu institución</small></Link><Link href="/sistema/mesa" className="entry-choice voter"><Vote size={32} /><strong>Ingresar si eres votante</strong><small>Elige a tus representantes escolares</small></Link></div></div>
  </section>;
}
