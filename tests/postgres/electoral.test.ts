import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
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
before(async () => {
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
  for (const name of [
    "202610190001_electoral_security.sql",
    "202610190002_complete_electoral_system.sql",
    "202610190003_private_electoral_media.sql",
    "202610190004_secure_application_sessions.sql",
    "202610210005_institutional_drafts.sql",
  ])
    await pool.query(await readFile(`supabase/migrations/${name}`, "utf8"));
  await pool.query("insert into auth.users values($1)", [admin]);
  await pool.query("insert into electoral_private.administrators values($1)", [
    admin,
  ]);
});
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
    /Se requieren 230 electores/,
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
