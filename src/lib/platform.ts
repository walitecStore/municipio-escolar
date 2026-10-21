/** Public branding only. Never pass credentials or Auth configuration to clients. */
export function publicInstitution(
  env: Record<string, string | undefined> = process.env,
) {
  const name = (
    env.ELECTORAL_INSTITUTION_NAME ?? "Plataforma de Municipios Escolares"
  ).trim();
  const expected = Number(env.ELECTORAL_EXPECTED_STUDENTS ?? 230);
  const year = Number(env.ELECTORAL_INITIAL_YEAR ?? 2026);
  if (
    !name ||
    name.length > 160 ||
    !Number.isInteger(expected) ||
    expected < 1 ||
    expected > 10000 ||
    !Number.isInteger(year) ||
    year < 2026 ||
    year > 2100
  )
    throw new Error("Configuración institucional inválida.");
  return {
    name,
    level: "Educación Secundaria",
    expectedStudents: expected,
    initialYear: year,
  };
}
export type PublicInstitution = ReturnType<typeof publicInstitution>;
/** Legacy demonstrations are accessible only in an explicitly isolated loopback environment. */
export function demonstrationsEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  if (
    env.ELECTORAL_DEMO_ENABLED !== "true" ||
    env.ELECTORAL_DEPLOYMENT_STAGE !== "local-test"
  )
    return false;
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(env.APP_ORIGIN ?? "").hostname,
    );
  } catch {
    return false;
  }
}
export const legacyDemoPaths = [
  "/demostracion",
  "/administracion",
  "/estudiantes",
  "/padron",
  "/candidatos",
  "/votacion",
  "/resultados",
];
