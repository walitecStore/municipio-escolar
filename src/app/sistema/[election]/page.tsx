import Image from "next/image";
import { VoterWelcome } from "@/components/connected/voter-experience";
import { CalendarDays, Users, Layers3, ShieldCheck } from "lucide-react";
import { protectedElection } from "@/lib/connected/session";
import { integrationConfig } from "@/lib/connected/env";
import { openingAllowed, isStaff } from "@/lib/connected/policy";
import { summarySchema, listsSchema } from "@/lib/connected/data";
import { electionModules } from "@/lib/election-navigation";
import { ModuleCard } from "@/components/module-card";
import { ConnectedElectionState } from "@/components/connected/forms";
export default async function Page({
  params,
}: {
  params: Promise<{ election: string }>;
}) {
  const { election, session, client } = await protectedElection(
    (await params).election,
  );
  const config = integrationConfig();
  const staff = isStaff(session);
  let total: number | null = null,
    listCount: number | null = null;
  if (staff) {
    const [roll, lists] = await Promise.all([
      client.rpc("electoral_roll_summary", { p_election: election.id }),
      client.rpc("get_electoral_lists", { p_election: election.id }),
    ]);
    if (!roll.error)
      total = summarySchema
        .parse(roll.data)
        .reduce((n, c) => n + c.electors, 0);
    if (!lists.error) listCount = listsSchema.parse(lists.data).length;
  }
  return (
    <VoterWelcome enabled={!staff}>
      <div className="page-heading">
        <div className="eyebrow">MI COMUNIDAD EDUCATIVA</div>
        <h1>{election.school}</h1>
        <p>Organiza cada etapa de tu elección en un solo lugar.</p>
      </div>
      <section className="welcome-hero">
        <div className="welcome-copy">
          <span className="hero-kicker">
            <ShieldCheck size={15} aria-hidden="true" />
            PARTICIPACIÓN CON CONFIANZA
          </span>
          <h2>{staff ? "¡Hola, comité electoral!" : "¡Tu voz cuenta!"}</h2>
          <p>
            {staff
              ? "Acompaña a tus estudiantes y construyan juntos una mejor escuela."
              : "Conoce las propuestas y participa en la elección de tu municipio escolar."}
          </p>
        </div>
        <Image
          className="welcome-illustration"
          src="/illustrations/school-election.svg"
          alt="Estudiantes ilustrados participando en una elección escolar"
          width={700}
          height={450}
          priority
        />
      </section>
      <section
        className="election-facts"
        aria-label="Información de la elección"
      >
        <article>
          <span className="fact-icon blue">
            <CalendarDays aria-hidden="true" />
          </span>
          <div>
            <span>Año electoral</span>
            <strong>{election.year}</strong>
          </div>
        </article>
        {staff && (
          <>
            <article>
              <span className="fact-icon green">
                <Users aria-hidden="true" />
              </span>
              <div>
                <span>Electores registrados</span>
                <strong>
                  {total === null
                    ? "No disponible"
                    : `${total} de ${election.expected_students}`}
                </strong>
              </div>
            </article>
            <article>
              <span className="fact-icon purple">
                <Layers3 aria-hidden="true" />
              </span>
              <div>
                <span>Listas inscritas</span>
                <strong>
                  {listCount === null ? "No disponible" : listCount}
                </strong>
              </div>
            </article>
          </>
        )}
      </section>
      <section className="section">
        <div className="section-header">
          <div>
            <h2>Tu elección, paso a paso</h2>
            <p>Selecciona la tarea que deseas realizar.</p>
          </div>
        </div>
        <div className="module-grid">
          {electionModules(election, staff).map((module) => (
            <ModuleCard module={module} key={module.key} />
          ))}
        </div>
      </section>
      {staff && (
        <section className="panel section lifecycle-panel">
          <h2>Control de la elección</h2>
          <p>
            Preparar el padrón y las candidaturas no abre la votación. La
            apertura requiere completar la revisión y las autorizaciones.
          </p>
          <ConnectedElectionState
            election={election}
            canOpen={!!config && openingAllowed(config, election)}
          />
        </section>
      )}
    </VoterWelcome>
  );
}
