import type { ConnectedElection } from "./connected/policy";
export type ModuleIcon =
  | "users"
  | "roll"
  | "vote"
  | "chart"
  | "document"
  | "settings"
  | "image"
  | "key"
  | "school"
  | "shield"
  | "help"
  | "plus";
export type ModuleTone =
  "blue" | "green" | "amber" | "purple" | "rose" | "teal";
export type ElectionModule = {
  key: string;
  title: string;
  description: string;
  href: string;
  icon: ModuleIcon;
  tone: ModuleTone;
  locked?: boolean;
};
export function electionModules(
  election: ConnectedElection,
  staff: boolean,
): ElectionModule[] {
  const base = `/sistema/${election.id}`;
  if (!staff)
    return [
      {
        key: "listas",
        title: "Mostrar candidatos",
        description: "Conoce las candidaturas y sus propuestas.",
        href: `${base}/candidatos`,
        icon: "users",
        tone: "blue",
      },
      {
        key: "votar",
        title: "Votar",
        description: "Revisa tu elección y confirma tu participación.",
        href: election.supervised_dni ? "/sistema/mesa" : `${base}/votar`,
        icon: "vote",
        tone: "green",
      },
    ];
  return [
    {
      key: "padron",
      title: "Padrón electoral",
      description: "Importa y revisa a tus estudiantes por grado y sección.",
      href: `${base}/padron`,
      icon: "roll",
      tone: "teal",
    },
    {
      key: "listas",
      title: "Registrar candidato y plana de regiduría",
      description:
        "Inscribe al alcalde, su partido y sus regidores paso a paso.",
      href: `${base}/listas`,
      icon: "users",
      tone: "blue",
    },
    {
      key: "candidatos",
      title: "Mostrar candidatos",
      description:
        "Consulta fotos, símbolos y equipos de los partidos inscritos.",
      href: `${base}/candidatos`,
      icon: "users",
      tone: "purple",
    },
    {
      key: "presencial",
      title: "Mesas · DNI",
      description: election.supervised_dni
        ? "Habilita computadoras y verifica los turnos."
        : "Prepara la modalidad presencial y sus computadoras.",
      href: `${base}/presencial`,
      icon: "vote",
      tone: "green",
    },
    ...(!election.supervised_dni
      ? [
          {
            key: "credenciales",
            title: "Credenciales",
            description: "Prepara y entrega el acceso individual.",
            href: `${base}/credenciales`,
            icon: "key" as const,
            tone: "green" as const,
          },
        ]
      : []),
    {
      key: "resultados",
      title: "Resultados",
      description: "Consulta el recuento después del cierre.",
      href: `${base}/resultados`,
      icon: "chart",
      tone: "amber",
      locked: election.state !== "closed",
    },
    {
      key: "actas",
      title: "Actas y documentos",
      description: "Genera el acta PDF y exporta el recuento Excel.",
      href: `${base}/actas`,
      icon: "document",
      tone: "purple",
      locked: election.state !== "closed",
    },
    {
      key: "media",
      title: "Fotografías y símbolos",
      description: "Guarda y reutiliza fotos y símbolos de esta elección.",
      href: `${base}/media`,
      icon: "image",
      tone: "rose",
    },
    {
      key: "configuracion",
      title: "Configuración",
      description: "Revisa el nombre del colegio y el total de electores.",
      href: `${base}/configuracion`,
      icon: "settings",
      tone: "teal",
    },
  ];
}
