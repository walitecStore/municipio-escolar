/** Anonymous HTTP checks only: no login, student data, voting, uploads or SQL. */
import { parseIntegrationConfig } from "../src/lib/connected/policy";
const config = parseIntegrationConfig(process.env);
if (
  !config ||
  !config.url.startsWith("https:") ||
  !config.origin.startsWith("https:")
) {
  console.error(
    "Configura las variables de servidor válidas en un entorno seguro; se exige HTTPS.",
  );
  process.exit(1);
}
if (config.voting || config.official) {
  console.error(
    "Esta comprobación exige ambos interruptores de votación en false.",
  );
  process.exit(1);
}
const id = "10000000-0000-4000-8000-000000000001";
let failures = 0;
async function check(name: string, action: () => Promise<boolean>) {
  try {
    if (!(await action())) throw new Error("Unexpected response");
    console.log(`PASS ${name}`);
  } catch {
    failures++;
    // Never print response bodies, request headers, cookies or provider errors.
    console.error(`FAIL ${name}: respuesta inesperada o conexión bloqueada`);
  }
}
const request = (url: string, init: RequestInit = {}) =>
  fetch(url, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
await check("formulario de acceso habilitado y sin caché pública", async () => {
  const response = await request(`${config.origin}/sistema/login`);
  return (
    response.status === 200 &&
    (response.headers.get("cache-control") ?? "").includes("no-store") &&
    (await response.text()).includes("Correo de la cuenta autorizada")
  );
});
await check("panel anónimo redirige al login", async () => {
  const response = await request(`${config.origin}/sistema`);
  return (
    [303, 307, 308].includes(response.status) &&
    new URL(response.headers.get("location") ?? "", config.origin).pathname ===
      "/sistema/login"
  );
});
await check("fotografía anónima no se entrega", async () => {
  const response = await request(
    `${config.origin}/sistema/${id}/media/archivo?path=${id}/prueba.webp`,
  );
  return (
    response.status === 404 &&
    (response.headers.get("cache-control") ?? "").includes("no-store")
  );
});
for (const rpc of ["get_electoral_roll", "get_electoral_results"]) {
  await check(`RPC ${rpc} rechaza rol anónimo`, async () => {
    const response = await request(`${config.url}/rest/v1/rpc/${rpc}`, {
      method: "POST",
      headers: { apikey: config.key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_election: id }),
    });
    return [401, 403].includes(response.status);
  });
}
console.log(
  "Alcance: solo barreras anónimas. No certifica MFA, RLS con sesión, un archivo existente ni el estado oficial remoto.",
);
process.exitCode = failures ? 1 : 0;
