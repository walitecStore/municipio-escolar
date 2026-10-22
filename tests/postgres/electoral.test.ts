import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { prepareElectoralCredential } from "../../src/lib/security/credentials";
import {
  issueCredential,
  confirmCredentialDelivery,
  submitVote,
  type AuthorizedRpc,
} from "../../src/lib/electoral/backend";

const address = new URL(process.env.ELECTORAL_TEST_DATABASE_URL ?? "");
if (
  !["127.0.0.1", "localhost", "[::1]"].includes(address.hostname) ||
  address.pathname !== "/municipio_electoral_test"
)
  throw new Error(
    "Solo se admite la base local exclusiva municipio_electoral_test.",
  );
const pool = new Pool({ connectionString: address.toString(), max: 12 });
const admin = randomUUID();
let year = 2026;
async function session<T>(
  user: string | null,
  fn: (client: PoolClient) => Promise<T>,
  role = "authenticated",
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      "set local statement_timeout='10000ms';set local lock_timeout='5000ms'",
    );
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user ?? "",
    ]);
    await client.query(
      `set local role ${role === "anon" ? "anon" : role === "service_role" ? "service_role" : "authenticated"}`,
    );
    const value = await fn(client);
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
const rpc = (c: PoolClient): AuthorizedRpc => ({
  async call<T>(name: string, parameters: Record<string, unknown>) {
    const calls: Record<string, string> = {
      register_electoral_credential:
        "select public.register_electoral_credential($1,$2,$3,$4) as value",
      confirm_electoral_delivery:
        "select public.confirm_electoral_delivery($1,$2,$3)",
      cast_electoral_vote: "select public.cast_electoral_vote($1,$2,$3)",
      electoral_vote_status: "select public.electoral_vote_status($1) as value",
    };
    if (!calls[name]) throw new Error("RPC no permitida en la prueba");
    const values = Object.values(parameters);
    const result = await c.query(calls[name], values);
    return result.rows[0]?.value as T;
  },
});
async function initializeDatabase(migrationNames: string[]) {
  // Dedicated disposable database only. No real Supabase URLs or accounts.
  await pool.query(
    "drop schema if exists electoral_private,ballot_box,storage,auth,public cascade;create schema public;",
  );
  await pool.query(`do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls;end if;end $$;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{"aal":"aal2"}'::jsonb) $$;
 grant execute on function auth.jwt() to authenticated;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
 alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;
 grant select,insert,update,delete on storage.objects to anon,authenticated;
 create policy intentionally_broad_existing_policy on storage.objects for all to anon,authenticated using(true) with check(true);
 -- Emulate automatic ENABLE RLS for newly created tables before migration execution.
 create function public.test_auto_rls() returns event_trigger language plpgsql as $$ declare cmd record;begin for cmd in select * from pg_event_trigger_ddl_commands() where command_tag='CREATE TABLE' and object_type='table' loop execute format('alter table %s enable row level security',cmd.objid::regclass);end loop;end $$;
 create event trigger test_auto_rls on ddl_command_end when tag in ('CREATE TABLE') execute function public.test_auto_rls();`);
  for (const name of migrationNames)
    await pool.query(await readFile(`supabase/migrations/${name}`, "utf8"));
  await pool.query("insert into auth.users values($1)", [admin]);
  await pool.query("insert into electoral_private.administrators values($1)", [
    admin,
  ]);
}
before(() =>
  initializeDatabase([
    "202610190001_electoral_security.sql",
    "202610190002_complete_electoral_system.sql",
    "202610190003_private_electoral_media.sql",
    "202610190004_secure_application_sessions.sql",
    "202610210005_institutional_drafts.sql",
    "202610210006_supervised_dni.sql",
    "202610210007_institutional_configuration.sql",
    "202610210008_institution_isolation.sql",
  ]),
);

after(async () => {
  await pool.end();
});
async function fixture(open = true) {
  const users = Array.from({ length: 230 }, () => randomUUID());
  await pool.query("insert into auth.users select unnest($1::uuid[])", [users]);
  const election = await session(
    admin,
    async (c) =>
      (
        await c.query("select public.manage_electoral_election(null,$1) id", [
          year++,
        ])
      ).rows[0].id as string,
  );
  const rows = users.map((u, i) => ({
    codigo: `DEMO-${String(i + 1).padStart(3, "0")}`,
    nombre: `Estudiante ficticio ${i + 1}`,
    grado: 1 + (i % 5),
    seccion: ["A", "B", "C"][i % 3],
    auth_user_id: u,
  }));
  let electors: { id: string; auth_user_id: string }[] = [];
  const lists: string[] = [];
  const credentials = users.map(() => prepareElectoralCredential());
  await session(admin, async (c) => {
    await c.query("select public.replace_electoral_roll($1,$2::jsonb)", [
      election,
      JSON.stringify(rows),
    ]);
    electors = (
      await c.query("select * from public.get_electoral_roll($1)", [election])
    ).rows;
    for (let i = 0; i < 3; i++) {
      const id = (
        await c.query(
          "select public.manage_electoral_list($1,null,$2,$3::smallint,$4::text[]) id",
          [election, `Lista ficticia ${i + 1}`, i + 1, ["Propuesta ficticia"]],
        )
      ).rows[0].id;
      lists.push(id);
      await c.query(
        "select public.manage_electoral_candidate($1,null,$2,'Candidato ficticio','alcalde',0::smallint,'Alcaldía',1::smallint,'A')",
        [election, id],
      );
      await c.query(
        "select public.manage_electoral_candidate($1,null,$2,'Regidor ficticio','regidor',1::smallint,'Regiduría de cultura',2::smallint,'B')",
        [election, id],
      );
    }
    for (let i = 0; i < 230; i++) {
      const version = (
        await c.query(
          "select public.register_electoral_credential($1,$2,$3,$4) version",
          [
            election,
            electors[i].id,
            credentials[i].tokenHash,
            credentials[i].expiresAt,
          ],
        )
      ).rows[0].version;
      await c.query("select public.confirm_electoral_delivery($1,$2,$3)", [
        election,
        electors[i].id,
        version,
      ]);
    }
    if (open)
      await c.query("select public.manage_electoral_election($1,2026,'open')", [
        election,
      ]);
  });
  return {
    election,
    users: electors.map((e) => e.auth_user_id),
    electors,
    lists,
    credentials,
  };
}
const vote = (
  f: Awaited<ReturnType<typeof fixture>>,
  i = 0,
  choice: string | null = f.lists[0],
) =>
  session(f.users[i], (c) =>
    c.query("select public.cast_electoral_vote($1,$2,$3)", [
      f.election,
      f.credentials[i].token,
      choice,
    ]),
  );
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
async function waitBlocked(pid: number) {
  for (let i = 0; i < 100; i++) {
    const r = await pool.query(
      "select cardinality(pg_blocking_pids($1))>0 blocked",
      [pid],
    );
    if (r.rows[0].blocked) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("No se observó el bloqueo esperado.");
}

test("roles, RLS automática y acceso privado: padrón, auditoría, tokens y resultados", async () => {
  const f = await fixture(false);
  for (const role of ["anon", "authenticated", "service_role"]) {
    await assert.rejects(
      session(
        null,
        (c) => c.query("select * from electoral_private.electors"),
        role,
      ),
      /permission denied/,
    );
    await assert.rejects(
      session(null, (c) => c.query("select * from ballot_box.ballots"), role),
      /permission denied/,
    );
  }
  await assert.rejects(
    session(f.users[0], (c) =>
      c.query("select * from public.get_electoral_roll($1)", [f.election]),
    ),
    /Acceso denegado/,
  );
  await assert.rejects(
    session(f.users[0], (c) =>
      c.query("select public.get_electoral_results($1)", [f.election]),
    ),
    /Acceso denegado/,
  );
  await assert.rejects(
    session(admin, (c) =>
      c.query("select public.get_electoral_results($1)", [f.election]),
    ),
    /solo después/,
  );
  const funcs = await pool.query(
    "select p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prosecdef and n.nspname in ('public','electoral_private')",
  );
  assert.ok(
    funcs.rows.every((r) => r.proconfig.includes("search_path=pg_catalog")),
  );
  const rls = await pool.query(
    "select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('electoral_private','ballot_box') and c.relkind='r'",
  );
  assert.ok(rls.rows.every((r) => r.relrowsecurity));
  const before = (
    await pool.query(
      "select count(*) n from electoral_private.admin_audit where election_id=$1",
      [f.election],
    )
  ).rows[0].n;
  await session(admin, (c) =>
    c.query("select public.manage_electoral_election($1,2026,'open')", [
      f.election,
    ]),
  );
  await assert.rejects(
    session(admin, (c) =>
      c.query("select public.get_electoral_results($1)", [f.election]),
    ),
    /solo después/,
  );
  assert.ok(Number(before) > 0);
});

test("230 estudiantes; doble envío simultáneo en conexiones PostgreSQL independientes", async () => {
  const f = await fixture();
  const pids: number[] = [];
  const attempts = await Promise.allSettled(
    [0, 1].map(() =>
      session(f.users[0], async (c) => {
        pids.push((await c.query("select pg_backend_pid() pid")).rows[0].pid);
        await c.query("select public.cast_electoral_vote($1,$2,$3)", [
          f.election,
          f.credentials[0].token,
          f.lists[0],
        ]);
      }),
    ),
  );
  assert.equal(new Set(pids).size, 2);
  assert.equal(attempts.filter((a) => a.status === "fulfilled").length, 1);
  assert.equal(
    (
      await pool.query(
        "select count(*) n from ballot_box.ballots where election_id=$1",
        [f.election],
      )
    ).rows[0].n,
    "1",
  );
  await assert.rejects(vote(f), /Credencial|Participación/);
  await assert.rejects(
    session(admin, (c) =>
      c.query("select public.register_electoral_credential($1,$2,$3,$4)", [
        f.election,
        f.electors[0].id,
        prepareElectoralCredential().tokenHash,
        new Date(Date.now() + 3600000),
      ]),
    ),
    /ya participó/,
  );
  const res = await session(admin, (c) =>
    c.query("select * from public.electoral_roll_summary($1)", [f.election]),
  );
  assert.equal(
    res.rows.reduce((n, r) => n + Number(r.pending), 0),
    229,
  );
});

test("recuperación supervisada invalida token anterior y compite de forma segura con voto", async () => {
  const f = await fixture();
  const oldVersion = (
    await pool.query(
      "select version from electoral_private.credentials where elector_id=$1",
      [f.electors[1].id],
    )
  ).rows[0].version;
  const newCredential = await session(admin, (c) =>
    issueCredential(rpc(c), f.election, f.electors[1].id),
  );
  await assert.rejects(vote(f, 1), /Credencial/);
  await assert.rejects(
    session(admin, (c) =>
      c.query("select public.confirm_electoral_delivery($1,$2,$3)", [
        f.election,
        f.electors[1].id,
        oldVersion,
      ]),
    ),
    /obsoleta/,
  );
  await assert.rejects(
    session(f.users[1], (c) =>
      c.query("select public.cast_electoral_vote($1,$2,null)", [
        f.election,
        newCredential.token,
      ]),
    ),
    /Credencial/,
  );
  await session(admin, (c) =>
    confirmCredentialDelivery(
      rpc(c),
      f.election,
      f.electors[1].id,
      newCredential.version,
    ),
  );
  await session(f.users[1], (c) =>
    c.query("select public.cast_electoral_vote($1,$2,null)", [
      f.election,
      newCredential.token,
    ]),
  );
  const recovery = prepareElectoralCredential();
  const started = deferred(),
    release = deferred(),
    pidReady = deferred();
  let pid = 0;
  const recovering = session(admin, async (c) => {
    const receipt = (
      await c.query(
        "select public.register_electoral_credential($1,$2,$3,$4) version",
        [f.election, f.electors[2].id, recovery.tokenHash, recovery.expiresAt],
      )
    ).rows[0].version;
    await c.query("select public.confirm_electoral_delivery($1,$2,$3)", [
      f.election,
      f.electors[2].id,
      receipt,
    ]);
    started.resolve();
    await release.promise;
  });
  await started.promise;
  const voting = session(f.users[2], async (c) => {
    pid = (await c.query("select pg_backend_pid() pid")).rows[0].pid;
    pidReady.resolve();
    return c.query("select public.cast_electoral_vote($1,$2,$3)", [
      f.election,
      f.credentials[2].token,
      f.lists[0],
    ]);
  });
  const observed = voting.then(
    () => null,
    (e) => e,
  );
  await pidReady.promise;
  await waitBlocked(pid);
  release.resolve();
  await recovering;
  assert.match((await observed).message, /Credencial/);
  await session(f.users[2], (c) =>
    c.query("select public.cast_electoral_vote($1,$2,$3)", [
      f.election,
      recovery.token,
      f.lists[1],
    ]),
  );
});

test("cierre espera votos en curso; resultados, blancos y empate se calculan solo después", async () => {
  const f = await fixture();
  await vote(f, 1, f.lists[1]);
  await vote(f, 2, null);
  const before = (
    await pool.query(
      "select count(*) n from electoral_private.admin_audit where election_id=$1",
      [f.election],
    )
  ).rows[0].n;
  const started = deferred(),
    release = deferred(),
    pidReady = deferred();
  let pid = 0;
  const voting = session(f.users[0], async (c) => {
    await c.query("select public.cast_electoral_vote($1,$2,$3)", [
      f.election,
      f.credentials[0].token,
      f.lists[0],
    ]);
    started.resolve();
    await release.promise;
  });
  await started.promise;
  const closing = session(admin, async (c) => {
    pid = (await c.query("select pg_backend_pid() pid")).rows[0].pid;
    pidReady.resolve();
    await c.query("select public.manage_electoral_election($1,2026,'closed')", [
      f.election,
    ]);
  });
  await pidReady.promise;
  await waitBlocked(pid);
  release.resolve();
  await voting;
  await closing;
  const result = (
    await session(admin, (c) =>
      c.query("select public.get_electoral_results($1) value", [f.election]),
    )
  ).rows[0].value;
  assert.equal(result.electors, 230);
  assert.equal(result.voters, 3);
  assert.equal(result.blank, 1);
  assert.equal(result.pending, 227);
  assert.equal(
    result.lists.filter((l: { winner: boolean }) => l.winner).length,
    2,
  );
  assert.equal(result.lists[0].percentage, 33.33);
  assert.equal(result.blank_percentage, 33.33);
  await assert.rejects(vote(f, 3), /no abierta/);
  const audits = (
    await pool.query(
      "select * from electoral_private.admin_audit where election_id=$1",
      [f.election],
    )
  ).rows;
  assert.equal(
    audits.length,
    Number(before) + 1,
    "solo cierre administrativo, ningún evento de voto",
  );
  assert.ok(
    audits.every((a) => !JSON.stringify(a).includes(f.credentials[0].token)),
  );
  await assert.rejects(
    session(f.users[0], (c) =>
      c.query("select public.get_electoral_results($1)", [f.election]),
    ),
    /Acceso denegado/,
  );
});

test("un cierre ya adquirido impide un voto concurrente pendiente", async () => {
  const f = await fixture();
  const started = deferred(),
    release = deferred(),
    pidReady = deferred();
  let pid = 0;
  const closing = session(admin, async (c) => {
    await c.query("select public.manage_electoral_election($1,2026,'closed')", [
      f.election,
    ]);
    started.resolve();
    await release.promise;
  });
  await started.promise;
  const voting = session(f.users[0], async (c) => {
    pid = (await c.query("select pg_backend_pid() pid")).rows[0].pid;
    pidReady.resolve();
    return c.query("select public.cast_electoral_vote($1,$2,$3)", [
      f.election,
      f.credentials[0].token,
      f.lists[0],
    ]);
  });
  const observed = voting.then(
    () => null,
    (e) => e,
  );
  await pidReady.promise;
  await waitBlocked(pid);
  release.resolve();
  await closing;
  assert.match((await observed).message, /no abierta/);
});

test("fallo de papeleta revierte participación; respuesta perdida se resuelve sin segundo voto", async () => {
  const f = await fixture();
  await pool.query(
    `create function ballot_box.test_fail() returns trigger language plpgsql as $$ begin raise exception 'Fallo ficticio';end $$;create trigger test_fail before insert on ballot_box.ballots for each row execute function ballot_box.test_fail();`,
  );
  await assert.rejects(vote(f), /Fallo ficticio/);
  assert.equal(
    (
      await pool.query(
        "select * from electoral_private.participations where election_id=$1",
        [f.election],
      )
    ).rows.length,
    0,
  );
  await pool.query(
    "drop trigger test_fail on ballot_box.ballots;drop function ballot_box.test_fail()",
  );
  const transport: AuthorizedRpc = {
    call: <T>(name: string, params: Record<string, unknown>) =>
      session(f.users[0], (c) => rpc(c).call<T>(name, params)),
  };
  const lostResponse: AuthorizedRpc = {
    async call<T>(name: string, params: Record<string, unknown>) {
      const value = await transport.call<T>(name, params);
      if (name === "cast_electoral_vote")
        throw new Error("Respuesta perdida ficticia");
      return value;
    },
  };
  assert.equal(
    await submitVote(
      lostResponse,
      f.election,
      f.credentials[0].token,
      f.lists[0],
    ),
    "registered",
  );
  assert.equal(
    (
      await pool.query(
        "select count(*) n from ballot_box.ballots where election_id=$1",
        [f.election],
      )
    ).rows[0].n,
    "1",
  );
});

test("gestión restringida, candidatos completos, corrección y fotografías privadas", async () => {
  const f = await fixture(false);
  const path = `${f.election}/foto.jpg`;
  await assert.rejects(
    session(f.users[0], (c) =>
      c.query(
        "select public.manage_electoral_list($1,null,'Intrusa',9::smallint,array['X'])",
        [f.election],
      ),
    ),
    /Acceso denegado/,
  );
  await session(admin, (c) =>
    c.query("select public.register_electoral_media($1,$2,false)", [
      f.election,
      path,
    ]),
  );
  await assert.rejects(
    session(admin, (c) =>
      c.query("select public.manage_electoral_election($1,2026,'open')", [
        f.election,
      ]),
    ),
    /Medios sin/,
  );
  await session(admin, (c) =>
    c.query("select public.register_electoral_media($1,$2,true)", [
      f.election,
      path,
    ]),
  );
  await session(admin, (c) =>
    c.query(
      "insert into storage.objects(bucket_id,name) values('electoral-media',$1)",
      [path],
    ),
  );
  await assert.rejects(
    session(f.users[0], (c) =>
      c.query(
        "insert into storage.objects(bucket_id,name) values('electoral-media',$1)",
        [path],
      ),
    ),
    /row-level security/,
  );
  assert.equal(
    (
      await session(
        null,
        (c) =>
          c.query(
            "select * from storage.objects where bucket_id='electoral-media'",
          ),
        "anon",
      )
    ).rows.length,
    0,
    "política restrictiva prevalece sobre política amplia existente",
  );
  await session(admin, (c) =>
    c.query("select public.manage_electoral_election($1,2026,'open')", [
      f.election,
    ]),
  );
  assert.equal(
    (
      await session(f.users[0], (c) =>
        c.query(
          "select * from storage.objects where bucket_id='electoral-media'",
        ),
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await session(admin, (c) =>
        c.query(
          "delete from storage.objects where bucket_id='electoral-media'",
        ),
      )
    ).rowCount,
    0,
  );
  assert.equal(
    (
      await pool.query(
        "select * from storage.objects where bucket_id='electoral-media'",
      )
    ).rows.length,
    1,
  );
  await assert.rejects(
    session(admin, (c) =>
      c.query(
        "select public.correct_electoral_student($1,$2,'DEMO-001','Estudiante ficticio',1::smallint,'A',$3)",
        [f.election, f.electors[0].id, f.users[0]],
      ),
    ),
    /no admite/,
  );
});

test("230 votos ficticios por conexiones independientes: recuento completo, blancos y participación", async () => {
  const f = await fixture();
  const choices = Array.from({ length: 230 }, (_, i) =>
    i % 4 === 0 ? null : f.lists[i % 3],
  );
  await Promise.all(choices.map((choice, i) => vote(f, i, choice)));
  await session(admin, (c) =>
    c.query("select public.manage_electoral_election($1,2026,'closed')", [
      f.election,
    ]),
  );
  const result = (
    await session(admin, (c) =>
      c.query("select public.get_electoral_results($1) value", [f.election]),
    )
  ).rows[0].value;
  assert.equal(result.voters, 230);
  assert.equal(result.pending, 0);
  assert.equal(result.participation, 100);
  assert.equal(result.blank, 58);
  assert.equal(
    result.lists.reduce((n: number, r: { votes: number }) => n + r.votes, 0) +
      result.blank,
    230,
  );
  for (const row of result.lists)
    assert.equal(row.votes, choices.filter((c) => c === row.id).length);
});

test("recuento sin votos o solo blancos no inventa ganador ni divide entre cero", async () => {
  for (const blankOnly of [false, true]) {
    const f = await fixture();
    if (blankOnly) await vote(f, 0, null);
    await session(admin, (c) =>
      c.query("select public.manage_electoral_election($1,2026,'closed')", [
        f.election,
      ]),
    );
    const result = (
      await session(admin, (c) =>
        c.query("select public.get_electoral_results($1) value", [f.election]),
      )
    ).rows[0].value;
    assert.equal(result.voters, blankOnly ? 1 : 0);
    assert.equal(result.blank_percentage, blankOnly ? 100 : 0);
    assert.ok(
      result.lists.every(
        (r: { winner: boolean; percentage: number }) =>
          !r.winner && r.percentage === 0,
      ),
    );
  }
});

test("sesión y comité requieren AAL2; elección oficial sin aprobación permanece bloqueada", async () => {
  const f = await fixture(false);
  await session(admin, async (c) => {
    await c.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ aal: "aal1" }),
    ]);
    const context = (
      await c.query("select public.get_electoral_session() value")
    ).rows[0].value;
    assert.equal(context.role, "administrator");
    assert.equal(context.aal, "aal1");
    await assert.rejects(
      c.query("select * from public.get_electoral_roll($1)", [f.election]),
      /Acceso denegado/,
    );
  });
  await pool.query(
    "update electoral_private.administrators set role='committee' where user_id=$1",
    [admin],
  );
  const context = (
    await session(admin, (c) =>
      c.query("select public.get_electoral_session() value"),
    )
  ).rows[0].value;
  assert.equal(context.role, "committee");
  assert.equal(context.aal, "aal2");
  const accessible = (
    await session(f.users[0], (c) =>
      c.query("select public.list_accessible_elections() value"),
    )
  ).rows[0].value;
  assert.equal(accessible.length, 1);
  assert.equal(accessible[0].id, f.election);
  await pool.query(
    "update electoral_private.elections set purpose='official' where id=$1",
    [f.election],
  );
  await assert.rejects(
    session(admin, (c) =>
      c.query("select public.manage_electoral_election($1,2026,'open')", [
        f.election,
      ]),
    ),
    /sin aprobación/,
  );
  await assert.rejects(
    session(admin, (c) =>
      c.query(
        "update electoral_private.elections set security_approved=true where id=$1",
        [f.election],
      ),
    ),
    /permission denied/,
  );
  await pool.query(
    "update electoral_private.administrators set role='administrator' where user_id=$1",
    [admin],
  );
});

test("borrador institucional: convive con prueba del mismo año, exige AAL2 y no aprueba ni abre votos", async () => {
  const f = await fixture(false);
  const testRow = (
    await pool.query(
      "select year,school from electoral_private.elections where id=$1",
      [f.election],
    )
  ).rows[0];
  for (const role of ["anon", "service_role"])
    await assert.rejects(
      session(
        null,
        (c) =>
          c.query("select public.create_institutional_election($1)", [
            testRow.year,
          ]),
        role,
      ),
      /permission denied/,
    );
  await assert.rejects(
    session(f.users[0], (c) =>
      c.query("select public.create_institutional_election($1)", [
        testRow.year,
      ]),
    ),
    /Acceso denegado/,
  );
  await assert.rejects(
    session(admin, async (c) => {
      await c.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ aal: "aal1" }),
      ]);
      return c.query("select public.create_institutional_election($1)", [
        testRow.year,
      ]);
    }),
    /Acceso denegado/,
  );
  const id = (
    await session(admin, (c) =>
      c.query("select public.create_institutional_election($1) id", [
        testRow.year,
      ]),
    )
  ).rows[0].id;
  const row = (
    await pool.query("select * from electoral_private.elections where id=$1", [
      id,
    ])
  ).rows[0];
  assert.equal(row.state, "draft");
  assert.equal(row.purpose, "official");
  assert.equal(row.security_approved, false);
  assert.equal(row.school, "I.E. ESTEBAN PAVLETICH TRUJILLO");
  assert.equal(row.expected_students, 230);
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from electoral_private.elections where year=$1 and school=$2",
        [testRow.year, testRow.school],
      )
    ).rows[0].n,
    2,
  );
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from electoral_private.electors where election_id=$1",
        [f.election],
      )
    ).rows[0].n,
    230,
  );
  assert.equal(
    (
      await pool.query(
        "select action,actor_id from electoral_private.admin_audit where election_id=$1 and action='institutional_draft_created'",
        [id],
      )
    ).rows[0].action,
    "institutional_draft_created",
  );
  await assert.rejects(
    session(admin, (c) =>
      c.query("select public.create_institutional_election($1)", [
        testRow.year,
      ]),
    ),
    /duplicate key/,
  );
  await assert.rejects(
    session(admin, (c) =>
      c.query("select public.create_institutional_election(2025)"),
    ),
    /Año inválido/,
  );
  await assert.rejects(
    session(admin, (c) =>
      c.query("select public.manage_electoral_election($1,$2,'open')", [
        id,
        testRow.year,
      ]),
    ),
    /El padrón debe coincidir con el total configurado/,
  );
  await assert.rejects(
    session(admin, (c) =>
      c.query("select public.get_electoral_results($1)", [id]),
    ),
    /solo después/,
  );
  await assert.rejects(
    session(admin, (c) =>
      c.query(
        "update electoral_private.elections set security_approved=true where id=$1",
        [id],
      ),
    ),
    /permission denied/,
  );
});

async function presencialFixture() {
  const f = await fixture(false);
  // Invented identifiers only, reserved for disposable local tests; never import live.
  await pool.query(
    "update electoral_private.electors set code=lpad(row_number::text,8,'0'),auth_user_id=null from (select id,row_number() over(order by id) from electoral_private.electors where election_id=$1) x where electors.id=x.id",
    [f.election],
  );
  await session(admin, (c) =>
    c.query("select public.configure_supervised_dni($1)", [f.election]),
  );
  await pool.query(
    "delete from electoral_private.credentials where election_id=$1",
    [f.election],
  );
  await session(admin, (c) =>
    c.query("select public.manage_electoral_election($1,2026,'open')", [
      f.election,
    ]),
  );
  const tokens = [
    randomBytes(48).toString("base64url"),
    randomBytes(48).toString("base64url"),
  ];
  const stations = [];
  for (const token of tokens)
    stations.push(
      (
        await session(admin, (c) =>
          c.query(
            "select public.create_voting_station($1,'Equipo ficticio',$2) id",
            [f.election, createHash("sha256").update(token).digest("hex")],
          ),
        )
      ).rows[0].id,
    );
  return { ...f, tokens, stations };
}
const stationOp = (
  token: string,
  op: string,
  dni: string | null = null,
  choice: string | null = null,
) =>
  session(
    null,
    (c) =>
      c.query("select public.station_electoral_operation($1,$2,$3,$4) value", [
        token,
        op,
        dni,
        choice,
      ]),
    "anon",
  ).then((r) => r.rows[0].value);
async function authorizeStation(
  f: Awaited<ReturnType<typeof presencialFixture>>,
  station = 0,
  dni = "00000001",
) {
  await stationOp(f.tokens[station], "request", dni);
  const t = (
    await pool.query(
      "select id from electoral_private.supervised_turns where station_id=$1 and state='pending'",
      [f.stations[station]],
    )
  ).rows[0].id;
  await session(admin, (c) =>
    c.query("select public.manage_supervised_turn($1,$2,$3,true)", [
      f.election,
      f.stations[station],
      t,
    ]),
  );
  return t;
}
test("DNI presencial: sin cuentas de alumnos; nombre solo tras verificar, voto atómico y resultados cerrados", async () => {
  const f = await presencialFixture();
  await assert.rejects(
    stationOp(randomBytes(48).toString("base64url"), "status"),
  );
  await assert.rejects(stationOp(f.tokens[0], "cast", null, f.lists[0]));
  assert.equal(
    (await stationOp(f.tokens[0], "request", "00000001")).state,
    "pending",
  );
  assert.equal((await stationOp(f.tokens[0], "status")).name, undefined);
  const t = (
    await pool.query(
      "select id from electoral_private.supervised_turns where station_id=$1",
      [f.stations[0]],
    )
  ).rows[0].id;
  await assert.rejects(
    session(null, (c) =>
      c.query("select public.manage_supervised_turn($1,$2,$3,true)", [
        f.election,
        f.stations[0],
        t,
      ]),
    ),
  );
  await assert.rejects(
    session(admin, async (c) => {
      await c.query(
        `select set_config('request.jwt.claims','{"aal":"aal1"}',true)`,
      );
      await c.query("select public.manage_supervised_turn($1,$2,$3,true)", [
        f.election,
        f.stations[0],
        t,
      ]);
    }),
  );
  await session(admin, (c) =>
    c.query("select public.manage_supervised_turn($1,$2,$3,true)", [
      f.election,
      f.stations[0],
      t,
    ]),
  );
  const state = await stationOp(f.tokens[0], "status");
  assert.equal(state.state, "authorized");
  assert.match(state.name, /Estudiante ficticio/);
  assert.equal(state.lists.length, 3);
  const attempts = await Promise.allSettled([
    stationOp(f.tokens[0], "cast", null, f.lists[0]),
    stationOp(f.tokens[0], "cast", null, f.lists[1]),
  ]);
  assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await stationOp(f.tokens[0], "status")).state, "consumed");
  assert.equal(
    (
      await pool.query(
        "select count(*) n from ballot_box.ballots where election_id=$1",
        [f.election],
      )
    ).rows[0].n,
    "1",
  );
  await assert.rejects(
    session(admin, (c) =>
      c.query("select public.get_electoral_results($1)", [f.election]),
    ),
  );
  await assert.rejects(
    session(
      null,
      (c) => c.query("select * from electoral_private.supervised_turns"),
      "anon",
    ),
  );
  await stationOp(f.tokens[0], "finish");
  assert.equal(
    (await stationOp(f.tokens[1], "request", "00000001")).state,
    "unavailable",
  );
});
test("DNI presencial: autorizaciones simultáneas del mismo elector en dos equipos, caducidad y revocación", async () => {
  const f = await presencialFixture();
  await Promise.all(f.tokens.map((t) => stationOp(t, "request", "00000001")));
  const turns = (
    await pool.query(
      "select id,station_id from electoral_private.supervised_turns where election_id=$1",
      [f.election],
    )
  ).rows;
  const approvals = await Promise.allSettled(
    turns.map((t) =>
      session(admin, (c) =>
        c.query("select public.manage_supervised_turn($1,$2,$3,true)", [
          f.election,
          t.station_id,
          t.id,
        ]),
      ),
    ),
  );
  assert.equal(approvals.filter((r) => r.status === "fulfilled").length, 1);
  await pool.query(
    "update electoral_private.supervised_turns set expires_at=clock_timestamp()-interval '1 second' where election_id=$1",
    [f.election],
  );
  for (const token of f.tokens)
    await assert.rejects(stationOp(token, "cast", null, f.lists[0]));
  await session(admin, (c) =>
    c.query("select public.manage_supervised_turn($1,$2,null,false,true)", [
      f.election,
      f.stations[0],
    ]),
  );
  await assert.rejects(stationOp(f.tokens[0], "status"));
});
test("DNI presencial: 230 alumnos ficticios en dos equipos, blancos y conteo centralizado", async () => {
  const f = await presencialFixture();
  for (let i = 1; i <= 230; i++) {
    const n = i % 2;
    const dni = String(i).padStart(8, "0");
    // Advance only the per-station rate window in the isolated database (no sleeps).
    await pool.query(
      "update electoral_private.voting_stations set window_start=clock_timestamp()-interval '2 minutes' where election_id=$1",
      [f.election],
    );
    await authorizeStation(f, n, dni);
    await stationOp(
      f.tokens[n],
      "cast",
      null,
      i % 10 === 0 ? null : f.lists[0],
    );
    await stationOp(f.tokens[n], "finish");
  }
  await session(admin, (c) =>
    c.query("select public.manage_electoral_election($1,2026,'closed')", [
      f.election,
    ]),
  );
  const r = (
    await session(admin, (c) =>
      c.query("select public.get_electoral_results($1) r", [f.election]),
    )
  ).rows[0].r;
  assert.equal(r.voters, 230);
  assert.equal(r.blank, 23);
  assert.equal(
    r.lists.find((l: { id: string }) => l.id === f.lists[0]).votes,
    207,
  );
  await assert.rejects(stationOp(f.tokens[0], "request", "00000001"));
});
test("DNI presencial: cierre espera voto en curso por conexiones independientes; elección cerrada no recibe votos", async () => {
  const f = await presencialFixture();
  await authorizeStation(f);
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("set local role anon");
    await c.query(
      "select public.station_electoral_operation($1,'cast',null,$2)",
      [f.tokens[0], f.lists[0]],
    );
    const close = session(admin, (c) =>
      c.query("select public.manage_electoral_election($1,2026,'closed')", [
        f.election,
      ]),
    );
    await c.query("commit");
    await close;
    await assert.rejects(stationOp(f.tokens[1], "cast", null, f.lists[0]));
    assert.equal(
      (
        await pool.query(
          "select count(*) n from ballot_box.ballots where election_id=$1",
          [f.election],
        )
      ).rows[0].n,
      "1",
    );
  } finally {
    await c.query("rollback");
    c.release();
  }
});

test("DNI presencial: fallo de papeleta revierte todo; canal individual, tokens caducados y abuso quedan bloqueados", async () => {
  const f = await presencialFixture();
  await authorizeStation(f);
  await assert.rejects(vote(f));
  await pool.query(
    `create function ballot_box.fail_supervised_test() returns trigger language plpgsql as $$ begin raise exception 'Fallo ficticio';end $$;create trigger fail_supervised_test before insert on ballot_box.ballots for each row execute function ballot_box.fail_supervised_test()`,
  );
  try {
    await assert.rejects(stationOp(f.tokens[0], "cast", null, f.lists[0]));
    assert.equal((await stationOp(f.tokens[0], "status")).state, "authorized");
    assert.equal(
      (
        await pool.query(
          "select count(*) n from electoral_private.participations where election_id=$1",
          [f.election],
        )
      ).rows[0].n,
      "0",
    );
  } finally {
    await pool.query(
      "drop trigger fail_supervised_test on ballot_box.ballots;drop function ballot_box.fail_supervised_test()",
    );
  }
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await stationOp(f.tokens[1], "request", "99999999")).state,
      "unavailable",
    );
  assert.equal(
    (await stationOp(f.tokens[1], "request", "99999999")).state,
    "limited",
  );
  await pool.query(
    "update electoral_private.voting_stations set expires_at=clock_timestamp()-interval '1 second' where id=$1",
    [f.stations[1]],
  );
  await assert.rejects(stationOp(f.tokens[1], "status"));
  // Independent devices may cast DIFFERENT students concurrently; same central count.
  await pool.query(
    "update electoral_private.voting_stations set expires_at=clock_timestamp()+interval '1 hour',window_start=clock_timestamp()-interval '2 minutes' where id=$1",
    [f.stations[1]],
  );
  await authorizeStation(f, 1, "00000002");
  const casts = await Promise.allSettled(
    f.tokens.map((token) => stationOp(token, "cast", null, f.lists[0])),
  );
  assert.equal(casts.filter((r) => r.status === "fulfilled").length, 2);
  assert.equal(
    (
      await pool.query(
        "select count(*) n from ballot_box.ballots where election_id=$1",
        [f.election],
      )
    ).rows[0].n,
    "2",
  );
  const columns = (
    await pool.query(
      "select column_name from information_schema.columns where table_schema='ballot_box' and table_name='ballots'",
    )
  ).rows.map((r) => r.column_name);
  assert.deepEqual(columns.sort(), ["choice_id", "election_id", "id"]);
  const events = (
    await pool.query(
      "select action from electoral_private.admin_audit where election_id=$1",
      [f.election],
    )
  ).rows.map((r) => r.action);
  assert.ok(events.includes("identity_checked"));
  assert.ok(!events.some((a) => /vote|choice_selected/i.test(a)));
});

test("padrón DNI por grado: agrega lotes sin borrar anteriores, duplicados y carreras revierten lote completo", async () => {
  const id = (
    await session(admin, (c) =>
      c.query("select public.manage_electoral_election(null,$1) id", [year++]),
    )
  ).rows[0].id;
  const row = (code: string, grade: number) => ({
    codigo: code,
    nombre: "Estudiante ficticio",
    grado: grade,
    seccion: "A",
  });
  const add = (rows: ReturnType<typeof row>[]) =>
    session(admin, (c) =>
      c.query("select public.append_electoral_dni_roll($1,$2::jsonb)", [
        id,
        JSON.stringify(rows),
      ]),
    );
  await add([row("00000001", 1)]);
  await add([row("00000002", 2)]);
  await assert.rejects(add([row("00000003", 3), row("00000001", 1)]));
  assert.equal(
    (
      await pool.query(
        "select count(*) n from electoral_private.electors where election_id=$1",
        [id],
      )
    ).rows[0].n,
    "2",
  );
  const simultaneous = await Promise.allSettled([
    add([row("00000003", 3)]),
    add([row("00000003", 3)]),
  ]);
  assert.equal(simultaneous.filter((r) => r.status === "fulfilled").length, 1);
  await assert.rejects(add([row("00000004", 6)]));
  await assert.rejects(
    session(null, (c) =>
      c.query("select public.append_electoral_dni_roll($1,$2::jsonb)", [
        id,
        JSON.stringify([row("00000004", 4)]),
      ]),
    ),
  );
  assert.equal(
    (
      await pool.query(
        "select count(*) n from electoral_private.electors where election_id=$1",
        [id],
      )
    ).rows[0].n,
    "3",
  );
});

test("configuración institucional: mantiene registros existentes, capacidad variable y MFA", async () => {
  const f = await fixture(false);
  await session(admin, (c) =>
    c.query("select public.configure_institutional_election($1,$2,$3)", [
      f.election,
      "Colegio ficticio",
      230,
    ]),
  ).then(
    () => assert.fail("Una elección de ensayo no se convierte a institucional"),
    () => {},
  );
  const id = (
    await session(admin, (c) =>
      c.query("select public.create_configured_election($1,$2,$3) id", [
        "Institución ficticia configurable",
        2098,
        2,
      ]),
    )
  ).rows[0].id;
  const metadata = (
    await pool.query(
      "select state,security_approved,supervised_dni,expected_students from electoral_private.elections where id=$1",
      [id],
    )
  ).rows[0];
  assert.equal(metadata.state, "draft");
  assert.equal(metadata.security_approved, false);
  assert.equal(metadata.supervised_dni, true);
  assert.equal(metadata.expected_students, 2);
  const row = (n: number) => ({
    codigo: String(n).padStart(8, "0"),
    nombre: `Estudiante ficticio ${n}`,
    grado: 1,
    seccion: "A",
  });
  await session(admin, (c) =>
    c.query("select public.append_electoral_dni_roll($1,$2::jsonb)", [
      id,
      JSON.stringify([row(1), row(2)]),
    ]),
  );
  await assert.rejects(
    session(admin, (c) =>
      c.query("select public.append_electoral_dni_roll($1,$2::jsonb)", [
        id,
        JSON.stringify([row(3)]),
      ]),
    ),
  );
  await assert.rejects(
    session(admin, (c) =>
      c.query("select public.configure_institutional_election($1,$2,1)", [
        id,
        "Institución ficticia configurable",
      ]),
    ),
  );
  await session(admin, (c) =>
    c.query("select public.configure_institutional_election($1,$2,3)", [
      id,
      "Institución ficticia configurable",
    ]),
  );
  await session(admin, (c) =>
    c.query("select public.append_electoral_dni_roll($1,$2::jsonb)", [
      id,
      JSON.stringify([row(3)]),
    ]),
  );
  assert.equal(
    (
      await pool.query(
        "select count(*) n from electoral_private.electors where election_id=$1",
        [id],
      )
    ).rows[0].n,
    "3",
  );
  await assert.rejects(
    session(null, (c) =>
      c.query("select public.create_configured_election($1,2099,2)", [
        "Sin permiso",
      ]),
    ),
  );
  await assert.rejects(
    session(admin, async (c) => {
      await c.query(
        `select set_config('request.jwt.claims','{"aal":"aal1"}',true)`,
      );
      await c.query("select public.configure_institutional_election($1,$2,3)", [
        id,
        "Sin MFA",
      ]);
    }),
  );
  // Existing institutional data is preserved when the new migration is loaded.
  assert.equal(
    (
      await pool.query(
        "select count(*) n from electoral_private.electors where election_id=$1",
        [f.election],
      )
    ).rows[0].n,
    "230",
  );
});

async function schoolFixture() {
  const users = [randomUUID(), randomUUID(), randomUUID()];
  await pool.query("insert into auth.users select unnest($1::uuid[])", [users]);
  const institutions = [];
  const elections = [];
  for (let n = 0; n < 2; n++) {
    const iid = (
      await session(admin, (c) =>
        c.query("select public.provision_institution($1,$2,2) id", [
          `Institución ficticia ${n}`,
          users[n],
        ]),
      )
    ).rows[0].id;
    institutions.push(iid);
    const eid = (
      await session(users[n], (c) =>
        c.query("select public.create_institution_election($1,2026,2) id", [
          iid,
        ]),
      )
    ).rows[0].id;
    elections.push(eid);
  }
  return { users, institutions, elections };
}
test("instituciones: encargados no acceden a otros padrones, listas, mesas, auditorías o permisos", async () => {
  const f = await schoolFixture();
  const list = (
    await session(f.users[0], (c) =>
      c.query("select public.list_accessible_elections() value"),
    )
  ).rows[0].value;
  assert.deepEqual(
    list.map((e: { id: string }) => e.id),
    [f.elections[0]],
  );
  const context = (
    await session(f.users[0], (c) =>
      c.query("select public.get_electoral_session() value"),
    )
  ).rows[0].value;
  assert.equal(context.role, "administrator");
  assert.equal(context.platform_operator, false);
  const mine = (
    await session(f.users[0], (c) =>
      c.query("select public.list_my_institutions() value"),
    )
  ).rows[0].value;
  assert.deepEqual(
    mine.institutions.map((i: { id: string }) => i.id),
    [f.institutions[0]],
  );
  for (const query of [
    "select * from public.get_electoral_roll($1)",
    "select public.get_electoral_lists($1)",
    "select public.get_supervised_control($1)",
    "select public.get_electoral_results($1)",
    "select public.get_electoral_audit($1)",
    "select public.electoral_roll_summary($1)",
  ])
    await assert.rejects(
      session(f.users[0], (c) => c.query(query, [f.elections[1]])),
    );
  await assert.rejects(
    session(f.users[0], (c) =>
      c.query("select public.configure_institutional_election($1,$2,2)", [
        f.elections[1],
        "Intrusión",
      ]),
    ),
  );
  await assert.rejects(
    session(f.users[0], (c) =>
      c.query("select public.create_institution_election($1,2027,2)", [
        f.institutions[1],
      ]),
    ),
  );
  await assert.rejects(
    session(f.users[0], (c) =>
      c.query("select public.manage_electoral_election(null,2099)"),
    ),
  );
  await assert.rejects(
    session(f.users[0], (c) =>
      c.query("select public.create_configured_election($1,2099,2)", [
        "Atajo legado",
      ]),
    ),
  );
  await assert.rejects(
    session(f.users[0], (c) =>
      c.query("select public.provision_institution($1,$2,2)", [
        "No permitido",
        f.users[2],
      ]),
    ),
  );
  await assert.rejects(
    session(f.users[0], (c) =>
      c.query("select public.assign_institution_staff($1,$2,$3,true)", [
        f.institutions[1],
        f.users[2],
        "administrator",
      ]),
    ),
  );
  await assert.rejects(
    session(f.users[0], async (c) => {
      await c.query(
        `select set_config('request.jwt.claims','{"aal":"aal1"}',true)`,
      );
      await c.query("select public.list_my_institutions()");
    }),
  );
  await assert.rejects(
    pool.query(
      "update electoral_private.elections set institution_id=$2 where id=$1",
      [f.elections[0], f.institutions[1]],
    ),
  );
  await session(f.users[0], (c) =>
    c.query("select public.assign_institution_staff($1,$2,$3,true)", [
      f.institutions[0],
      f.users[2],
      "committee",
    ]),
  );
  await assert.rejects(
    session(f.users[2], (c) =>
      c.query("select public.update_my_institution($1,$2,2)", [
        f.institutions[0],
        "Cambio no permitido",
      ]),
    ),
  );
  await session(f.users[0], (c) =>
    c.query("select public.assign_institution_staff($1,$2,$3,false)", [
      f.institutions[0],
      f.users[2],
      "committee",
    ]),
  );
  assert.equal(
    (
      await session(f.users[2], (c) =>
        c.query("select public.get_electoral_session() value"),
      )
    ).rows[0].value.role,
    "unassigned",
  );
});
test("instituciones: fotografías privadas, mismo DNI en dos colegios y recuentos separados de capacidad variable", async () => {
  const f = await schoolFixture();
  const lists: string[] = [];
  const tokens: string[] = [];
  const stations: string[] = [];
  for (let n = 0; n < 2; n++) {
    const eid = f.elections[n];
    const path = `${eid}/foto-ficticia.webp`;
    await session(f.users[n], (c) =>
      c.query("select public.replace_electoral_roll($1,$2::jsonb)", [
        eid,
        JSON.stringify(
          [1, 2].map((i) => ({
            codigo: String(i).padStart(8, "0"),
            nombre: `Estudiante ficticio ${i}`,
            grado: 1,
            seccion: "A",
          })),
        ),
      ]),
    );
    await pool.query(
      "insert into electoral_private.media_assets values($1,$2,true)",
      [eid, path],
    );
    await pool.query(
      "insert into storage.objects(bucket_id,name) values('electoral-media',$1)",
      [path],
    );
    await session(f.users[n], async (c) => {
      const l = (
        await c.query(
          "select public.manage_electoral_list($1,null,'Lista ficticia',1::smallint,array['Propuesta']) id",
          [eid],
        )
      ).rows[0].id;
      lists.push(l);
      await c.query(
        "select public.manage_electoral_candidate($1,null,$2,'Candidato ficticio','alcalde',0::smallint,'Alcaldía',1::smallint,'A')",
        [eid, l],
      );
      await c.query(
        "select public.manage_electoral_candidate($1,null,$2,'Regidor ficticio','regidor',1::smallint,'Cultura',1::smallint,'A')",
        [eid, l],
      );
    });
    const visible = (
      await session(f.users[1 - n], (c) =>
        c.query(
          "select count(*) n from storage.objects where bucket_id='electoral-media' and name=$1",
          [path],
        ),
      )
    ).rows[0].n;
    assert.equal(visible, "0");
    await pool.query(
      "update electoral_private.elections set security_approved=true where id=$1",
      [eid],
    );
    await session(f.users[n], (c) =>
      c.query("select public.manage_electoral_election($1,2026,'open')", [eid]),
    );
    const token = randomBytes(48).toString("base64url");
    tokens.push(token);
    stations.push(
      (
        await session(f.users[n], (c) =>
          c.query(
            "select public.create_voting_station($1,'Equipo ficticio',$2) id",
            [eid, createHash("sha256").update(token).digest("hex")],
          ),
        )
      ).rows[0].id,
    );
    await stationOp(token, "request", "00000001");
    const turn = (
      await pool.query(
        "select id from electoral_private.supervised_turns where station_id=$1 and state='pending'",
        [stations[n]],
      )
    ).rows[0].id;
    await session(f.users[n], (c) =>
      c.query("select public.manage_supervised_turn($1,$2,$3,true)", [
        eid,
        stations[n],
        turn,
      ]),
    );
  }
  await assert.rejects(stationOp(tokens[0], "cast", null, lists[1]));
  await Promise.all(
    tokens.map((t, n) => stationOp(t, "cast", null, n === 0 ? lists[0] : null)),
  );
  for (let n = 0; n < 2; n++) {
    await session(f.users[n], (c) =>
      c.query("select public.manage_electoral_election($1,2026,'closed')", [
        f.elections[n],
      ]),
    );
    const r = (
      await session(f.users[n], (c) =>
        c.query("select public.get_electoral_results($1) value", [
          f.elections[n],
        ]),
      )
    ).rows[0].value;
    assert.equal(r.electors, 2);
    assert.equal(r.voters, 1);
    assert.equal(r.blank, n);
    await assert.rejects(
      session(f.users[1 - n], (c) =>
        c.query("select public.get_electoral_results($1)", [f.elections[n]]),
      ),
    );
  }
});

test("actualización 006 → 007 → 008 conserva los 15 electores, sus identificadores y la elección cerrada a votos", async () => {
  await initializeDatabase([
    "202610190001_electoral_security.sql",
    "202610190002_complete_electoral_system.sql",
    "202610190003_private_electoral_media.sql",
    "202610190004_secure_application_sessions.sql",
    "202610210005_institutional_drafts.sql",
    "202610210006_supervised_dni.sql",
  ]);
  const id = (
    await session(admin, (c) =>
      c.query("select public.create_institutional_election(2026) id"),
    )
  ).rows[0].id;
  await session(admin, (c) =>
    c.query("select public.replace_electoral_roll($1,$2::jsonb)", [
      id,
      JSON.stringify(
        Array.from({ length: 15 }, (_, i) => ({
          codigo: String(i + 1).padStart(8, "0"),
          nombre: `Estudiante ficticio ${i + 1}`,
          grado: 1,
          seccion: "A",
        })),
      ),
    ]),
  );
  await session(admin, (c) =>
    c.query("select public.configure_supervised_dni($1)", [id]),
  );
  const beforeRows = (
    await pool.query(
      "select * from electoral_private.electors where election_id=$1 order by code",
      [id],
    )
  ).rows;
  for (const name of [
    "202610210007_institutional_configuration.sql",
    "202610210008_institution_isolation.sql",
  ])
    await pool.query(await readFile(`supabase/migrations/${name}`, "utf8"));
  const afterRows = (
    await pool.query(
      "select * from electoral_private.electors where election_id=$1 order by code",
      [id],
    )
  ).rows;
  assert.deepEqual(afterRows, beforeRows);
  const election = (
    await pool.query(
      "select state,security_approved,expected_students,institution_id from electoral_private.elections where id=$1",
      [id],
    )
  ).rows[0];
  assert.equal(election.state, "draft");
  assert.equal(election.security_approved, false);
  assert.equal(election.expected_students, 230);
  assert.ok(election.institution_id);
  const accessible = (
    await session(admin, (c) =>
      c.query("select public.list_accessible_elections() value"),
    )
  ).rows[0].value;
  assert.equal(accessible[0].id, id);
  assert.equal(
    (
      await session(admin, (c) =>
        c.query("select * from public.get_electoral_roll($1)", [id]),
      )
    ).rowCount,
    15,
  );
});

test("equipo: invitaciones privadas, MFA, aislamiento, asignación por correo y límites compartidos", async () => {
  const f = await schoolFixture();
  await pool.query(
    await readFile(
      "supabase/migrations/202610220009_staff_invitations.sql",
      "utf8",
    ),
  );
  await pool.query(
    "alter table auth.users add column email text,add column raw_user_meta_data jsonb default '{}'::jsonb,add column email_confirmed_at timestamptz",
  );
  await pool.query(
    "update auth.users set email=$2,raw_user_meta_data=$3 where id=$1",
    [f.users[2], "comite@example.test", { full_name: "Comité ficticio" }],
  );
  const authorize = (c: PoolClient, iid = f.institutions[0]) =>
    c.query(
      "select public.authorize_staff_invitation($1,'nuevo@example.test')",
      [iid],
    );
  await session(f.users[0], (c) => authorize(c));
  await assert.rejects(session(f.users[1], (c) => authorize(c)));
  await assert.rejects(
    session(f.users[0], async (c) => {
      await c.query(
        `select set_config('request.jwt.claims','{"aal":"aal1"}',true)`,
      );
      await authorize(c);
    }),
  );
  await assert.rejects(session(f.users[0], (c) => authorize(c), "anon"));
  await assert.rejects(
    session(f.users[0], (c) => authorize(c), "service_role"),
  );
  await session(f.users[0], (c) =>
    c.query(
      "select public.assign_existing_institution_staff($1,'COMITE@example.test','committee',true)",
      [f.institutions[0]],
    ),
  );
  const team = (
    await session(f.users[0], (c) =>
      c.query("select public.get_institution_team($1) value", [
        f.institutions[0],
      ]),
    )
  ).rows[0].value;
  assert.ok(
    team.some(
      (m: { email: string; name: string }) =>
        m.email === "comite@example.test" && m.name === "Comité ficticio",
    ),
  );
  await assert.rejects(session(f.users[2], (c) => authorize(c)));
  await assert.rejects(
    session(f.users[2], (c) =>
      c.query("select public.get_institution_team($1)", [f.institutions[0]]),
    ),
  );
  await assert.rejects(
    session(f.users[1], (c) =>
      c.query("select public.get_institution_team($1)", [f.institutions[0]]),
    ),
  );
  await assert.rejects(
    session(f.users[1], (c) =>
      c.query(
        "select public.assign_existing_institution_staff($1,'comite@example.test','committee',true)",
        [f.institutions[1]],
      ),
    ),
  );
  await assert.rejects(
    session(f.users[0], (c) =>
      c.query(
        "select public.authorize_staff_invitation($1,'comite@example.test')",
        [f.institutions[0]],
      ),
    ),
  );
  await pool.query(
    "insert into electoral_private.institution_audit(institution_id,actor_id,action) select $1,$2,'staff.invitation_requested' from generate_series(1,18)",
    [f.institutions[0], f.users[0]],
  );
  const attempts = await Promise.allSettled([
    session(f.users[0], (c) => authorize(c)),
    session(f.users[0], (c) => authorize(c)),
  ]);
  assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
  await session(f.users[0], (c) =>
    c.query(
      "select public.assign_existing_institution_staff($1,'comite@example.test','committee',false)",
      [f.institutions[0]],
    ),
  );
  assert.equal(
    (
      await session(f.users[2], (c) =>
        c.query("select public.get_electoral_session() value"),
      )
    ).rows[0].value.role,
    "unassigned",
  );
  assert.equal(
    (
      await pool.query(
        "select state,security_approved from electoral_private.elections where id=$1",
        [f.elections[0]],
      )
    ).rows[0].state,
    "draft",
  );
});

test("registro guiado: transacción completa, numeración automática, rollback y solicitudes simultáneas sin duplicados", async () => {
  await pool.query(
    await readFile(
      "supabase/migrations/202610220010_guided_slate_registration.sql",
      "utf8",
    ),
  );
  const f = await schoolFixture();
  const eid = f.elections[0];
  const mayor = {
    name: "Alcalde ficticio guiado",
    grade: 4,
    section: "B",
    photo: null,
  };
  const regidors = [
    {
      name: "Regidor ficticio uno",
      title: "Educación",
      grade: 3,
      section: "A",
    },
    { name: "Regidor ficticio dos", title: "Deporte", grade: 2, section: "B" },
  ];
  const register = (
    c: PoolClient,
    request = randomUUID(),
    party = "Partido ficticio guiado",
    rows = regidors,
  ) =>
    c.query(
      "select public.register_electoral_slate($1,$2,$3,$4,null,$5,$6) value",
      [
        eid,
        request,
        party,
        ["Propuesta ficticia"],
        JSON.stringify(mayor),
        JSON.stringify(rows),
      ],
    );
  const request = randomUUID();
  const receipt = (await session(f.users[0], (c) => register(c, request)))
    .rows[0].value;
  assert.equal(receipt.number, 1);
  const candidates = (
    await pool.query(
      "select role,position from electoral_private.candidates where election_id=$1 and list_id=$2 order by position",
      [eid, receipt.id],
    )
  ).rows;
  assert.deepEqual(candidates, [
    { role: "alcalde", position: 0 },
    { role: "regidor", position: 1 },
    { role: "regidor", position: 2 },
  ]);
  assert.deepEqual(
    (await session(f.users[0], (c) => register(c, request))).rows[0].value,
    receipt,
  );
  await assert.rejects(
    session(f.users[0], (c) =>
      register(c, randomUUID(), "Partido inválido", [
        { ...regidors[0], grade: 9 },
      ]),
    ),
  );
  assert.equal(
    (
      await pool.query(
        "select count(*) n from electoral_private.choices where election_id=$1",
        [eid],
      )
    ).rows[0].n,
    "1",
  );
  assert.equal(
    (
      await pool.query(
        "select count(*) n from electoral_private.slate_registration_receipts where election_id=$1",
        [eid],
      )
    ).rows[0].n,
    "1",
  );
  const parallel = await Promise.all([
    session(f.users[0], (c) => register(c, randomUUID(), "Partido paralelo A")),
    session(f.users[0], (c) => register(c, randomUUID(), "Partido paralelo B")),
  ]);
  assert.deepEqual(parallel.map((r) => r.rows[0].value.number).sort(), [2, 3]);
  const same = randomUUID();
  const repeated = await Promise.all([
    session(f.users[0], (c) => register(c, same)),
    session(f.users[0], (c) => register(c, same)),
  ]);
  assert.equal(repeated[0].rows[0].value.id, repeated[1].rows[0].value.id);
  assert.equal(
    (
      await pool.query(
        "select count(*) n from electoral_private.choices where election_id=$1",
        [eid],
      )
    ).rows[0].n,
    "4",
  );
  for (const dbRole of ["anon", "service_role"])
    await assert.rejects(session(f.users[0], (c) => register(c), dbRole));
  await assert.rejects(session(f.users[1], (c) => register(c)));
  await assert.rejects(
    session(f.users[0], async (c) => {
      await c.query(
        `select set_config('request.jwt.claims','{"aal":"aal1"}',true)`,
      );
      await register(c);
    }),
  );
  await assert.rejects(
    session(f.users[0], (c) =>
      c.query("select * from electoral_private.slate_registration_receipts"),
    ),
  );
  await assert.rejects(
    session(admin, (c) =>
      c.query("select public.get_slate_registration_receipt($1,$2)", [
        eid,
        request,
      ]),
    ),
  );
  const other = (
    await session(f.users[1], (c) =>
      c.query(
        "select public.register_electoral_slate($1,$2,$3,$4,null,$5,$6) value",
        [
          f.elections[1],
          randomUUID(),
          "Otro colegio",
          ["Propuesta ficticia"],
          JSON.stringify(mayor),
          JSON.stringify(regidors),
        ],
      ),
    )
  ).rows[0].value;
  assert.equal(other.number, 1);
  await session(f.users[0], (c) =>
    c.query(
      "select public.manage_electoral_list($1,$2,'',1::smallint,'{}'::text[],null,true)",
      [eid, receipt.id],
    ),
  );
  const deleted = (await session(f.users[0], (c) => register(c, request)))
    .rows[0].value;
  assert.equal(deleted.deleted, true);
  assert.equal(
    (
      await pool.query(
        "select count(*) n from electoral_private.choices where election_id=$1",
        [eid],
      )
    ).rows[0].n,
    "3",
  );
  const state = (
    await pool.query(
      "select state,security_approved from electoral_private.elections where id=$1",
      [eid],
    )
  ).rows[0];
  assert.equal(state.state, "draft");
  assert.equal(state.security_approved, false);
});
