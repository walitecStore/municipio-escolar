import { protectedElection } from "@/lib/connected/session";
import {
  CalendarDays,
  ShieldCheck,
  LockKeyhole,
  CheckCircle2,
} from "lucide-react";
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ election: string }>;
}) {
  const id = (await params).election;
  const { election } = await protectedElection(id);
  const state =
    election.state === "draft"
      ? "Borrador"
      : election.state === "open"
        ? "Abierta"
        : "Cerrada";
  return (
    <>
      <div className="election-context">
        <span className={`state-pill state-${election.state}`}>
          {election.state === "closed" ? (
            <CheckCircle2 size={15} />
          ) : election.state === "open" ? (
            <ShieldCheck size={15} />
          ) : (
            <LockKeyhole size={15} />
          )}
          Estado: {state}
        </span>
        <span>
          <CalendarDays size={16} aria-hidden="true" />
          {election.year}
        </span>
        {election.purpose === "test" ? (
          <span>PRUEBAS · Solo datos ficticios</span>
        ) : (
          <span>Elección institucional</span>
        )}
        {election.purpose === "official" && !election.security_approved && (
          <span className="approval-pending">
            Aprobación de seguridad pendiente
          </span>
        )}
      </div>
      {children}
    </>
  );
}
