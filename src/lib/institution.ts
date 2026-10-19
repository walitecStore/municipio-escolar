export const institution = {
  name: "I.E. ESTEBAN PAVLETICH TRUJILLO",
  level: "Educación Secundaria",
  expectedStudents: 230,
  initialYear: 2026,
} as const;
export const grades = [1, 2, 3, 4, 5] as const;
export const sections = ["A", "B", "C"] as const;
export const classrooms = grades.flatMap((grade) =>
  sections.map((section) => ({
    grade,
    section,
    label: `${grade}.º ${section}`,
  })),
);
