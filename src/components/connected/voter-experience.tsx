"use client";
import Image from "next/image";
import { useState, type ReactNode } from "react";
import { ArrowRight, HeartHandshake, Sparkles, ShieldCheck } from "lucide-react";
export function VoterWelcome({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const [entered, setEntered] = useState(false);
  if (!enabled || entered) return children;
  return <section className="voter-greeting" aria-labelledby="voter-welcome-title">
    <div className="voter-mascot"><Image src="/illustrations/student-welcome.webp" alt="Joven ilustrado en 3D con terno azul dando la bienvenida" width={640} height={960} priority /></div>
    <div className="voter-greeting-copy"><span className="voter-kicker"><Sparkles size={19} />TU VOZ CONSTRUYE TU ESCUELA</span><h1 id="voter-welcome-title">¡Bienvenido a tus elecciones escolares!</h1><p>Hoy tienes la oportunidad de elegir y hacer la diferencia. Conoce las propuestas y participa con confianza.</p><span className="voter-promise"><ShieldCheck size={21} />Tu voto es personal y secreto.</span><button className="button primary voter-enter" onClick={() => setEntered(true)}>Entrar a mis elecciones<ArrowRight size={22} /></button></div>
  </section>;
}
export function VoterThanks() {
  return <section className="voter-greeting voter-thanks" aria-labelledby="voter-thanks-title"><div className="voter-mascot"><Image src="/illustrations/student-welcome.webp" alt="Joven ilustrado en 3D con terno agradeciendo tu participación" width={640} height={960} /></div><div className="voter-greeting-copy"><span className="voter-kicker"><HeartHandshake size={22} />¡TU PARTICIPACIÓN IMPORTA!</span><h2 id="voter-thanks-title">¡Gracias por tu voto!</h2><p>Tu voz cuenta. Hoy ayudaste a construir una mejor escuela para todos.</p><p className="voter-promise"><ShieldCheck size={22} />Participación registrada. Tu elección permanece en secreto.</p></div></section>;
}
