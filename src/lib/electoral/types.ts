export type Candidate = {
  id: string;
  name: string;
  role: "alcalde" | "regidor";
  position: number;
  title: string;
  grade: number;
  section: string;
  photo: string;
};
export type Slate = {
  id: string;
  number: number;
  name: string;
  symbol: "Árbol" | "Libro" | "Sol";
  proposals: string[];
  candidates: Candidate[];
  color: string;
  motto: string;
};
export type ElectionState = "draft" | "open" | "closed";
export type ResultRow = {
  id: string;
  number: number;
  name: string;
  votes: number;
  percentage: number;
  winner: boolean;
};
export type ElectoralResults = {
  election_id: string;
  state: "closed";
  electors: number;
  voters: number;
  pending: number;
  blank: number;
  blank_percentage: number;
  participation: number;
  lists: ResultRow[];
};
export function validateSlate(slate: Slate): string[] {
  const errors: string[] = [];
  if (!slate.name.trim() || slate.name.length > 120)
    errors.push("Nombre de lista obligatorio (hasta 120 caracteres).");
  if (!Number.isInteger(slate.number) || slate.number < 1 || slate.number > 99)
    errors.push("Número de lista entre 1 y 99.");
  if (
    !slate.proposals.length ||
    slate.proposals.length > 20 ||
    slate.proposals.some((p) => !p.trim() || p.length > 500)
  )
    errors.push("Entre 1 y 20 propuestas de hasta 500 caracteres.");
  if (slate.candidates.filter((c) => c.role === "alcalde").length !== 1)
    errors.push("Se requiere exactamente un candidato a alcalde.");
  if (!slate.candidates.some((c) => c.role === "regidor"))
    errors.push("Se requiere al menos un regidor.");
  if (
    new Set(slate.candidates.map((c) => c.position)).size !==
    slate.candidates.length
  )
    errors.push("Los puestos de candidatura no pueden repetirse.");
  for (const c of slate.candidates) {
    if (
      !c.name.trim() ||
      c.name.length > 120 ||
      !c.title.trim() ||
      c.title.length > 100 ||
      !Number.isInteger(c.grade) ||
      c.grade < 1 ||
      c.grade > 5 ||
      !["A", "B", "C"].includes(c.section) ||
      (c.role === "alcalde"
        ? c.position !== 0
        : !Number.isInteger(c.position) || c.position < 1 || c.position > 20)
    )
      errors.push(
        "Revisa nombre, cargo, posición, grado y sección de cada candidatura.",
      );
    if (
      ![
        "/candidatos/valeria.jpg",
        "/candidatos/mateo.jpg",
        "/candidatos/lucas.jpg",
      ].includes(c.photo)
    )
      errors.push(
        "La demostración solo admite las fotografías referenciales incluidas.",
      );
  }
  return errors;
}
