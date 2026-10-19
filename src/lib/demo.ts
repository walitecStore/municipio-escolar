import { institution } from "./institution";
export const election = {
  school: institution.name,
  year: institution.initialYear,
  students: institution.expectedStudents,
  date: "20 de noviembre de 2026",
};
export const lists = [
  {
    id: "01",
    name: "Juntos por el cambio",
    candidate: "Valeria Quispe",
    grade: "4.º de secundaria",
    color: "#147d62",
    photo: "/candidatos/valeria.jpg",
    motto: "Pequeñas acciones, grandes cambios.",
    proposals: [
      "Puntos de reciclaje en cada patio",
      "Talleres de arte y cultura",
      "Un buzón para escuchar tus ideas",
    ],
    votes: 98,
  },
  {
    id: "02",
    name: "Voces del mañana",
    candidate: "Mateo Flores",
    grade: "5.º de secundaria",
    color: "#285fc1",
    photo: "/candidatos/mateo.jpg",
    motto: "Tu voz construye nuestro futuro.",
    proposals: [
      "Campeonatos deportivos inclusivos",
      "Club de lectura entre estudiantes",
      "Campañas de convivencia escolar",
    ],
    votes: 72,
  },
  {
    id: "03",
    name: "Nueva generación",
    candidate: "Lucas Torres",
    grade: "4.º de secundaria",
    color: "#a25b22",
    photo: "/candidatos/lucas.jpg",
    motto: "Una escuela donde todos participamos.",
    proposals: [
      "Jornadas de cuidado del jardín",
      "Tutorías entre compañeros",
      "Feria de proyectos estudiantiles",
    ],
    votes: 40,
  },
];
