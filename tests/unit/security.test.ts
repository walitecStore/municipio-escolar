import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

// Isolated local PostgreSQL-compatible engine. No service or personal data.
test("migración: RLS, edición en borrador, credenciales, atomicidad y voto único", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 insert into auth.users values('00000000-0000-0000-0000-000000000001');`);
    await db.exec(
      await readFile(
        "supabase/migrations/202610190001_electoral_security.sql",
        "utf8",
      ),
    );
    const admin = "00000000-0000-0000-0000-000000000001";
    const election = "10000000-0000-0000-0000-000000000001";
    const choice = "20000000-0000-0000-0000-000000000001";
    await db.query("insert into electoral_private.administrators values($1)", [
      admin,
    ]);
    await db.query("insert into electoral_private.elections(id) values($1)", [
      election,
    ]);
    await db.exec(`set role anon`);
    await assert.rejects(
      db.query("select * from electoral_private.electors"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.electoral_roll_summary($1)", [election]),
      /permission denied/,
    );
    await db.exec("reset role");
    // A non-admin cannot read a roll or modify it, even with the authenticated role.
    const student = "00000000-0000-0000-0000-000000000002";
    await db.query("insert into auth.users values($1)", [student]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      student,
    ]);
    await db.exec("set role authenticated");
    assert.equal(
      (await db.query("select * from electoral_private.electors")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("insert into electoral_private.elections(year) values(2027)"),
      /row-level security/,
    );
    await assert.rejects(
      db.query("select * from electoral_private.credentials"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from ballot_box.ballots"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.electoral_roll_summary($1)", [election]),
      /Acceso denegado/,
    );
    await assert.rejects(
      db.query(
        "select public.register_electoral_credential($1,$2,$3,now()+interval '1 hour')",
        [election, student, "a".repeat(64)],
      ),
      /Acceso denegado/,
    );
    await db.exec("reset role");
    // Synthetic identities only. No Excel or real student file is ever stored.
    await db.exec(`insert into auth.users select ('30000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,230)i;
 insert into electoral_private.electors(election_id,code,full_name,grade,section,auth_user_id)
 select '${election}', 'DEMO-'||lpad(i::text,3,'0'), 'Estudiante ficticio '||i, 1+(i-1)%5, (array['A','B','C'])[1+(i-1)%3],('30000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,230)i;
 insert into electoral_private.choices(election_id,id,name) values('${election}','${choice}','Lista ficticia');`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      admin,
    ]);
    await db.exec("set role authenticated");
    await assert.rejects(
      db.query(
        "update electoral_private.elections set state='open' where id=$1",
        [election],
      ),
      /credenciales/,
    );
    await assert.rejects(
      db.query("select public.replace_electoral_roll($1,$2::jsonb)", [
        election,
        JSON.stringify([
          {
            codigo: "DEMO-001",
            nombre: "Estudiante ficticio 001",
            grado: 6,
            seccion: "D",
          },
        ]),
      ]),
      /foreign key/,
    );
    assert.equal(
      (await db.query("select * from electoral_private.electors")).rows.length,
      230,
      "una importación inválida no elimina el padrón anterior",
    );
    const first = (
      await db.query<{ id: string }>(
        "select id from electoral_private.electors where code='DEMO-001'",
      )
    ).rows[0].id;
    await db.query(
      "update electoral_private.electors set section='B' where id=$1",
      [first],
    );
    await assert.rejects(
      db.query(
        "update electoral_private.electors set section='D' where id=$1",
        [first],
      ),
      /foreign key/,
    );
    await assert.rejects(
      db.query(
        "update electoral_private.electors set code='DEMO-002' where id=$1",
        [first],
      ),
      /unique constraint/,
    );
    await assert.rejects(
      db.query(
        "select public.register_electoral_credential($1,$2,$3,now()-interval '1 hour')",
        [election, first, "a".repeat(64)],
      ),
      /Caducidad/,
    );
    await db.exec("reset role");
    // Generate only in-memory tokens. Never print their values.
    const token = "A".repeat(43);
    const hash = createHash("sha256").update(token).digest("hex");
    await db.query(
      "insert into electoral_private.credentials(election_id,elector_id,token_hash,expires_at) select election_id,id,encode(sha256(convert_to(code,'UTF8')),'hex'),now()+interval '1 hour' from electoral_private.electors",
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      admin,
    ]);
    await db.exec("set role authenticated");
    await db.query(
      "select public.register_electoral_credential($1,$2,$3,now()+interval '1 hour')",
      [election, first, hash],
    );
    await db.query(
      "update electoral_private.electors set section='A' where id=$1",
      [first],
    );
    await db.exec("reset role");
    assert.equal(
      (
        await db.query(
          "select * from electoral_private.credentials where elector_id=$1",
          [first],
        )
      ).rows.length,
      0,
      "corregir revoca credenciales",
    );
    await db.exec("set role authenticated");
    await db.query(
      "select public.register_electoral_credential($1,$2,$3,now()+interval '1 hour')",
      [election, first, hash],
    );
    await db.query(
      "update electoral_private.elections set state='open' where id=$1",
      [election],
    );
    await assert.rejects(
      db.query(
        "update electoral_private.electors set section='B' where id=$1",
        [first],
      ),
      /no admite correcciones/,
    );
    await assert.rejects(
      db.query(
        "update electoral_private.elections set state='draft' where id=$1",
        [election],
      ),
      /Transición/,
    );
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      "30000000-0000-0000-0000-000000000001",
    ]);
    await db.query(
      "update electoral_private.credentials set expires_at=now()-interval '1 hour' where elector_id=$1",
      [first],
    );
    await db.exec("set role authenticated");
    await assert.rejects(
      db.query("select public.cast_electoral_vote($1,$2,$3)", [
        election,
        token,
        choice,
      ]),
      /Credencial/,
    );
    await db.exec("reset role");
    await db.query(
      "update electoral_private.credentials set expires_at=now()+interval '1 hour' where elector_id=$1",
      [first],
    );
    await db.exec("set role authenticated");
    await assert.rejects(
      db.query("select public.cast_electoral_vote($1,$2,$3)", [
        election,
        "B".repeat(43),
        choice,
      ]),
      /Credencial/,
    );
    await assert.rejects(
      db.query("select public.cast_electoral_vote($1,$2,$3)", [
        election,
        token,
        "20000000-0000-0000-0000-000000000099",
      ]),
      /Candidatura/,
    );
    await db.exec("reset role");
    // Force a ballot write failure: participation must roll back as well.
    await db.exec(`create function ballot_box.fail_test() returns trigger language plpgsql as $$ begin raise exception 'Forced ballot failure'; end $$;
 create trigger fail_test before insert on ballot_box.ballots for each row execute function ballot_box.fail_test();`);
    await db.exec("set role authenticated");
    await assert.rejects(
      db.query("select public.cast_electoral_vote($1,$2,$3)", [
        election,
        token,
        choice,
      ]),
      /Forced ballot failure/,
    );
    await db.exec("reset role");
    assert.equal(
      (await db.query("select * from electoral_private.participations")).rows
        .length,
      0,
    );
    assert.equal(
      (
        await db.query<{ consumed: boolean }>(
          "select consumed from electoral_private.credentials where elector_id=$1",
          [first],
        )
      ).rows[0].consumed,
      false,
    );
    await db.exec("drop trigger fail_test on ballot_box.ballots");
    await db.exec("set role authenticated");
    const attempts = await Promise.allSettled([
      db.query("select public.cast_electoral_vote($1,$2,$3)", [
        election,
        token,
        choice,
      ]),
      db.query("select public.cast_electoral_vote($1,$2,$3)", [
        election,
        token,
        choice,
      ]),
    ]);
    assert.equal(attempts.filter((a) => a.status === "fulfilled").length, 1);
    assert.equal(attempts.filter((a) => a.status === "rejected").length, 1);
    await db.exec("reset role");
    assert.equal(
      (await db.query("select * from ballot_box.ballots")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from electoral_private.participations")).rows
        .length,
      1,
    );
    const columns = (
      await db.query<{ column_name: string }>(
        "select column_name from information_schema.columns where table_schema='ballot_box' and table_name='ballots'",
      )
    ).rows.map((c) => c.column_name);
    assert.deepEqual(columns, ["id", "election_id", "choice_id"]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      admin,
    ]);
    await db.exec("set role authenticated");
    const counts = await db.query<{
      electors: number;
      voters: number;
      pending: number;
    }>("select * from public.electoral_roll_summary($1)", [election]);
    assert.equal(counts.rows.length, 15);
    assert.equal(
      counts.rows.reduce((n, r) => n + Number(r.electors), 0),
      230,
    );
    assert.equal(
      counts.rows.reduce((n, r) => n + Number(r.voters), 0),
      1,
    );
    assert.equal(
      counts.rows.reduce((n, r) => n + Number(r.pending), 0),
      229,
    );
    await db.query(
      "update electoral_private.elections set state='closed' where id=$1",
      [election],
    );
    await assert.rejects(
      db.query("select public.cast_electoral_vote($1,$2,$3)", [
        election,
        token,
        choice,
      ]),
      /no abierta/,
    );
  } finally {
    await db.close();
  }
});
