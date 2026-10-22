/** Loopback-only HTTP fixture for the real Supabase SDK. Never a production service. */
import http from "node:http";
import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
  createHash,
} from "node:crypto";
const secret = randomBytes(32);
const port = 54329;
const electionId = "10000000-0000-4000-8000-000000000001";
const studentId = "30000000-0000-4000-8000-000000000001";
const electorId = "40000000-0000-4000-8000-000000000001";
const listId = "20000000-0000-4000-8000-000000000001";
const factorId = "50000000-0000-4000-8000-000000000001";
type Claims = {
  sub: string;
  role: string;
  aal: string;
  email: string;
  exp: number;
  amr?: { method: string; timestamp: number }[];
};
const inviteTokens = new Map<string, Claims>();
const invitedStaff = new Map<
  string,
  {
    institution: string;
    name: string;
    email: string;
    role: string;
    active: boolean;
    accepted: boolean;
  }
>();
let generatedInvites = 0;
let phase = "draft",
  purpose = "test",
  approved = false,
  userReads = 0;
let calls: Record<string, number> = {};
let credential: { hash: string; version: string; delivered: boolean } | null =
  null;
let supervisedDni = false;
let station: {
  id: string;
  hash: string;
  label: string;
  active: boolean;
} | null = null;
let turn: { id: string; state: string } | null = null;
let participation = false;
let ballots: (string | null)[] = [];
let media = new Map<string, Buffer>();
let mediaAuthorization = new Set<string>();
let rejectUsers = false;
const factors = new Map<string, string>();
const passwordHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const passwords = new Map<string, string>();
let passwordUpdates = 0;
let recoverRequests = 0;
let recoveryProvider = "none";
let institutionalFunctionMissing = false;
let recoveryRedirectValid = false;
let challenge = "";
const recoveryTokens = new Map<string, Claims>();
function recoveryClaims(email = "admin@example.test", age = 0): Claims {
  return {
    sub: profiles[email].id,
    email,
    role: "authenticated",
    aal: "aal1",
    exp: Math.floor(Date.now() / 1000) + 3600,
    amr: [{ method: "otp", timestamp: Math.floor(Date.now() / 1000) - age }],
  };
}
const profiles: Record<string, { id: string; role: string }> = {
  "school@example.test": {
    id: "70000000-0000-4000-8000-000000000001",
    role: "administrator",
  },
  "admin@example.test": {
    id: "00000000-0000-4000-8000-000000000001",
    role: "administrator",
  },
  "committee@example.test": {
    id: "00000000-0000-4000-8000-000000000002",
    role: "committee",
  },
  "student@example.test": { id: studentId, role: "elector" },
  "outsider@example.test": {
    id: "00000000-0000-4000-8000-000000000003",
    role: "unassigned",
  },
};
function jwt(claims: Claims) {
  const head = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({
      ...claims,
      aud: "authenticated",
      iss: `http://127.0.0.1:${port}/auth/v1`,
      iat: Math.floor(Date.now() / 1000),
    }),
  ).toString("base64url");
  const unsigned = `${head}.${body}`;
  return `${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`;
}
function claimsFrom(token: string): Claims | null {
  try {
    const [h, b, s] = token.split(".");
    const expected = createHmac("sha256", secret).update(`${h}.${b}`).digest();
    const supplied = Buffer.from(s, "base64url");
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(expected, supplied)
    )
      return null;
    const claims = JSON.parse(Buffer.from(b, "base64url").toString());
    return claims.exp > Date.now() / 1000 ? claims : null;
  } catch {
    return null;
  }
}
function user(c: Claims) {
  return {
    id: c.sub,
    email: c.email,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
    factors: factors.has(c.email)
      ? [
          {
            id: factorId,
            factor_type: "totp",
            status: factors.get(c.email),
            friendly_name: "Fixture",
          },
        ]
      : [],
  };
}
function authTokens(c: Claims) {
  return {
    access_token: jwt(c),
    refresh_token: randomUUID(),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: c.exp,
    user: user(c),
  };
}
const baseInstitution = "60000000-0000-4000-8000-000000000001";
let institutionProfiles = [
  {
    id: baseInstitution,
    name: "Institución ficticia de integración",
    expected_students: 230,
    owner: "",
  },
];
let electionInstitution = baseInstitution;
let expectedStudents = 230;
function role(c: Claims) {
  const member = invitedStaff.get(c.sub);
  if (member) return member.active ? member.role : "unassigned";
  return profiles[c.email]?.role ?? "unassigned";
}
function staff(c: Claims) {
  return ["administrator", "committee"].includes(role(c)) && c.aal === "aal2";
}
function election() {
  return {
    id: electionId,
    school: "Institución ficticia de integración",
    year: 2026,
    state: phase,
    purpose,
    security_approved: approved,
    expected_students: expectedStudents,
    institution_id: electionInstitution,
    supervised_dni: supervisedDni,
  };
}
const initialStudents = Array.from({ length: 230 }, (_, i) => ({
  id:
    i === 0
      ? electorId
      : `40000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  code: `DEMO-${String(i + 1).padStart(3, "0")}`,
  full_name: `Estudiante ficticio ${String(i + 1).padStart(3, "0")}`,
  grade: 1 + (i % 5),
  section: ["A", "B", "C"][i % 3],
  auth_user_id: i === 0 ? studentId : null,
}));
const initialLists: import("../../src/lib/connected/data").ConnectedList[] = [
  {
    id: listId,
    name: "Lista ficticia conectada",
    number: 1,
    proposals: ["Propuesta ficticia"],
    symbol_path: null,
    candidates: [
      {
        id: "60000000-0000-4000-8000-000000000001",
        name: "Candidato ficticio",
        role: "alcalde",
        position: 0,
        title: "Alcaldía",
        grade: 4,
        section: "A",
        photo_path: null,
      },
    ],
  },
];
const students = structuredClone(initialStudents);
let lists = structuredClone(initialLists);
async function body(req: http.IncomingMessage) {
  let size = 0;
  const parts: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 9 * 1024 * 1024) throw new Error("Too large");
    parts.push(Buffer.from(chunk));
  }
  return Buffer.concat(parts);
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
  const send = (data: unknown, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  try {
    if (url.pathname === "/health") return send({ ready: true });
    if (url.pathname === "/__test/reset") {
      for (const email of Object.keys(profiles))
        if (email.endsWith("@invite.example.test")) delete profiles[email];
      inviteTokens.clear();
      invitedStaff.clear();
      generatedInvites = 0;
      supervisedDni = false;
      station = null;
      turn = null;
      institutionProfiles = [
        {
          id: baseInstitution,
          name: "Institución ficticia de integración",
          expected_students: 230,
          owner: "",
        },
      ];
      electionInstitution = baseInstitution;
      expectedStudents = 230;
      phase = "draft";
      purpose = "test";
      approved = false;
      userReads = 0;
      calls = {};
      credential = null;
      participation = false;
      ballots = [];
      media = new Map();
      mediaAuthorization = new Set();
      rejectUsers = false;
      factors.clear();
      passwords.clear();
      passwordUpdates = 0;
      recoverRequests = 0;
      recoveryProvider = "none";
      institutionalFunctionMissing = false;
      recoveryRedirectValid = false;
      challenge = "";
      recoveryTokens.clear();
      students.splice(0, students.length, ...structuredClone(initialStudents));
      lists = structuredClone(initialLists);
      return send({ ok: true });
    }
    if (url.pathname === "/__test/scenario") {
      const data = JSON.parse((await body(req)).toString());
      if (typeof data.recoveryProvider === "string")
        recoveryProvider = data.recoveryProvider;
      if (typeof data.institutionalFunctionMissing === "boolean")
        institutionalFunctionMissing = data.institutionalFunctionMissing;
      if (data.clearRoll === true) students.splice(0);
      if (typeof data.supervisedDni === "boolean")
        supervisedDni = data.supervisedDni;
      if (data.state) phase = data.state;
      if (data.purpose) purpose = data.purpose;
      if (typeof data.approved === "boolean") approved = data.approved;
      if (typeof data.rejectUsers === "boolean") rejectUsers = data.rejectUsers;
      return send({ ok: true });
    }
    if (url.pathname === "/__test/state")
      return send({
        calls,
        passwordUpdates,
        generatedInvites,
        recoverRequests,
        recoveryRedirectValid,
        userReads,
        participation,
        ballots: ballots.length,
        media: media.size,
      });
    if (url.pathname === "/__test/recovery") {
      const data = JSON.parse((await body(req)).toString() || "{}");
      const c = recoveryClaims(data.email, data.age ?? 0);
      if (data.mfa) factors.set(c.email, "verified");
      const hash = randomBytes(32).toString("hex");
      recoveryTokens.set(hash, c);
      if (data.mode === "implicit") return send(authTokens(c));
      if (data.mode === "ordinary")
        return send(
          authTokens({
            ...c,
            amr: [
              { method: "password", timestamp: Math.floor(Date.now() / 1000) },
            ],
          }),
        );
      return send({ hash });
    }
    if (url.pathname === "/auth/v1/recover") {
      const data = JSON.parse((await body(req)).toString());
      recoverRequests++;
      recoveryRedirectValid =
        url.searchParams.get("redirect_to") ===
        "http://127.0.0.1:3102/sistema/restablecer";
      if (recoveryProvider === "smtp")
        return send(
          {
            message: "internal-smtp-sensitive-details",
            error_code: "unexpected_failure",
          },
          500,
        );
      if (recoveryProvider === "rate")
        return send(
          { message: "Too many", error_code: "over_email_send_rate_limit" },
          429,
        );
      if (recoveryProvider === "configuration")
        return send(
          {
            message: "private-provider-detail",
            error_code: "email_address_not_authorized",
          },
          403,
        );
      if (recoveryProvider === "account")
        return send(
          { message: "Private account info", error_code: "user_not_found" },
          400,
        );
      challenge = data.code_challenge ?? "";
      return send({});
    }
    if (url.pathname === "/auth/v1/admin/generate_link") {
      if (req.headers.apikey !== "sb_secret_local_invitation_fixture")
        return send({ message: "Denied" }, 403);
      const data = JSON.parse((await body(req)).toString());
      if (
        data.type !== "invite" ||
        (profiles[data.email] &&
          ![...invitedStaff.values()].some(
            (m) => m.email === data.email && !m.accepted && m.active,
          ))
      )
        return send({ message: "Already registered" }, 400);
      const uid = profiles[data.email]?.id ?? randomUUID();
      for (const [proof, claim] of inviteTokens)
        if (claim.sub === uid) inviteTokens.delete(proof);
      profiles[data.email] = { id: uid, role: "unassigned" };
      const proof = randomBytes(32).toString("hex");
      const claims: Claims = {
        sub: uid,
        email: data.email,
        role: "authenticated",
        aal: "aal1",
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      inviteTokens.set(proof, claims);
      invitedStaff.set(uid, {
        institution: "",
        name: data.data?.full_name ?? "Personal ficticio",
        email: data.email,
        role: "committee",
        active: false,
        accepted: false,
      });
      generatedInvites++;
      return send({
        ...user(claims),
        action_link: "http://127.0.0.1/unused",
        hashed_token: proof,
        verification_type: "invite",
        email_otp: "123456",
        redirect_to: "http://127.0.0.1",
      });
    }
    if (url.pathname === "/auth/v1/verify") {
      const data = JSON.parse((await body(req)).toString());
      if (data.type === "invite") {
        const invitation = inviteTokens.get(data.token_hash);
        if (!invitation)
          return send({ message: "Expired", error_code: "otp_expired" }, 403);
        inviteTokens.delete(data.token_hash);
        const member = invitedStaff.get(invitation.sub);
        if (member) member.accepted = true;
        return send(authTokens(invitation));
      }
      const recovery = recoveryTokens.get(data.token_hash);
      if (!recovery || data.type !== "recovery")
        return send({ message: "Expired", error_code: "otp_expired" }, 403);
      recoveryTokens.delete(data.token_hash);
      return send(authTokens(recovery));
    }
    const c = claimsFrom(
      (req.headers.authorization ?? "").replace(/^Bearer /, ""),
    );
    if (url.pathname === "/auth/v1/token") {
      const data = JSON.parse((await body(req)).toString());
      if (url.searchParams.get("grant_type") === "pkce") {
        if (
          data.auth_code !== "local-pkce-code" ||
          !challenge ||
          createHash("sha256")
            .update(data.code_verifier ?? "")
            .digest("base64url") !== challenge
        )
          return send({ message: "Invalid code" }, 400);
        challenge = "";
        const recovery = recoveryClaims();
        recovery.amr![0].method = "recovery";
        return send(authTokens(recovery));
      }
      const profile = profiles[String(data.email)];
      if (
        !profile ||
        passwordHash(data.password ?? "") !==
          (passwords.get(data.email) ?? passwordHash("solo-prueba-local"))
      )
        return send({ message: "Invalid credentials" }, 400);
      return send(
        authTokens({
          sub: profile.id,
          email: data.email,
          role: "authenticated",
          aal: profile.role === "elector" ? "aal1" : "aal1",
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      );
    }
    if (url.pathname === "/auth/v1/user") {
      userReads++;
      if (!c || rejectUsers) return send({ message: "Session invalid" }, 401);
      if (req.method === "PUT") {
        const data = JSON.parse((await body(req)).toString());
        if (factors.get(c.email) === "verified" && c.aal !== "aal2")
          return send({ message: "AAL2 required" }, 403);
        if (passwordHash(data.password ?? "") === passwords.get(c.email))
          return send({ message: "Same password" }, 400);
        passwords.set(c.email, passwordHash(data.password));
        passwordUpdates++;
      }
      return send(user(c));
    }
    if (url.pathname === "/auth/v1/logout") {
      res.writeHead(204);
      return res.end();
    }
    if (url.pathname === "/rest/v1/rpc/station_electoral_operation") {
      calls.station_electoral_operation =
        (calls.station_electoral_operation ?? 0) + 1;
      const a = JSON.parse((await body(req)).toString());
      if (
        !station?.active ||
        station.hash !==
          createHash("sha256").update(String(a.p_token)).digest("hex") ||
        phase !== "open"
      )
        return send({ message: "Denied" }, 403);
      if (a.p_operation === "request") {
        if (a.p_dni !== "00000001" || participation)
          return send({ purpose, state: "unavailable" });
        turn = { id: randomUUID(), state: "pending" };
      }
      if (a.p_operation === "cast") {
        if (turn?.state !== "authorized" || participation)
          return send({ message: "Denied" }, 403);
        participation = true;
        ballots.push(a.p_choice);
        turn.state = "consumed";
      }
      if (a.p_operation === "finish" && turn?.state === "consumed") turn = null;
      return send({
        purpose,
        state: turn?.state ?? "ready",
        ...(turn?.state === "authorized"
          ? {
              name: "Estudiante ficticio 001",
              lists: [
                {
                  id: listId,
                  number: 1,
                  name: lists[0].name,
                  mayor: "Candidato ficticio",
                },
              ],
            }
          : {}),
      });
    }
    if (!c) return send({ message: "Unauthorized" }, 401);
    if (url.pathname.endsWith("/challenge"))
      return send({
        id: factorId,
        type: "totp",
        expires_at: Math.floor(Date.now() / 1000) + 300,
      });
    if (url.pathname.endsWith("/verify")) {
      const data = JSON.parse((await body(req)).toString());
      if (data.code !== "123456") return send({ message: "Invalid code" }, 400);
      factors.set(c.email, "verified");
      return send(authTokens({ ...c, aal: "aal2" }));
    }
    if (url.pathname === "/auth/v1/factors") {
      factors.set(c.email, "unverified");
      return send({
        id: factorId,
        type: "totp",
        totp: {
          qr_code:
            '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#000"/></svg>',
        },
      });
    }
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const name = url.pathname.split("/").at(-1)!;
      calls[name] = (calls[name] ?? 0) + 1;
      const args = JSON.parse((await body(req)).toString() || "{}");
      if (name === "get_electoral_session")
        return send({
          role: role(c),
          aal: c.aal,
          platform_operator:
            c.email === "admin@example.test" && c.aal === "aal2",
        });
      if (name === "list_accessible_elections")
        return send(
          (staff(c) || role(c) === "elector") &&
            (c.email !== "school@example.test" ||
              institutionProfiles.some(
                (i) => i.id === electionInstitution && i.owner === c.sub,
              ))
            ? [election()]
            : [],
        );
      if (name === "electoral_vote_status")
        return send(c.sub === studentId && participation);
      if (name === "get_electoral_lists")
        return staff(c) || (role(c) === "elector" && phase !== "draft")
          ? send(lists)
          : send({ message: "Denied" }, 403);
      if (name === "cast_electoral_vote") {
        if (
          c.sub !== studentId ||
          phase !== "open" ||
          participation ||
          !credential?.delivered ||
          credential.hash !==
            createHash("sha256").update(String(args.p_token)).digest("hex")
        )
          return send({ code: "P0001", message: "Rejected" }, 400);
        participation = true;
        ballots.push(args.p_choice);
        return send(null);
      }
      if (!staff(c)) return send({ code: "P0001", message: "Denied" }, 403);
      if (name === "list_my_institutions")
        return send({
          platform_operator: c.email === "admin@example.test",
          institutions: institutionProfiles.filter(
            (i) => c.email === "admin@example.test" || i.owner === c.sub,
          ),
        });
      if (
        [
          "get_institution_team",
          "authorize_staff_invitation",
          "assign_institution_staff",
          "assign_existing_institution_staff",
        ].includes(name)
      ) {
        const institution = institutionProfiles.find(
          (i) =>
            i.id === args.p_institution &&
            (c.email === "admin@example.test" || i.owner === c.sub),
        );
        if (!institution || role(c) !== "administrator")
          return send({ message: "Denied" }, 403);
        if (name === "get_institution_team")
          return send(
            [...invitedStaff.entries()]
              .filter(([, v]) => v.institution === institution.id)
              .map(([id, v]) => ({ id, ...v })),
          );
        if (name === "authorize_staff_invitation")
          return profiles[args.p_email] && !args.p_existing
            ? send({ message: "Existing" }, 400)
            : send(null);
        const target =
          name === "assign_institution_staff"
            ? args.p_user
            : profiles[args.p_email]?.id;
        const member = invitedStaff.get(target);
        if (
          !member ||
          (member.institution && member.institution !== institution.id)
        )
          return send({ message: "Denied" }, 403);
        member.institution = institution.id;
        member.role = args.p_role;
        member.active = args.p_active;
        profiles[member.email].role = member.active
          ? member.role
          : "unassigned";
        return send(null);
      }
      if (name === "provision_institution") {
        if (c.email !== "admin@example.test")
          return send({ message: "Denied" }, 403);
        const i = {
          id: randomUUID(),
          name: args.p_name,
          expected_students: args.p_expected,
          owner: args.p_admin,
        };
        institutionProfiles.push(i);
        return send(i.id);
      }
      if (name === "update_my_institution") {
        const i = institutionProfiles.find(
          (i) =>
            i.id === args.p_institution &&
            (i.owner === c.sub || c.email === "admin@example.test"),
        );
        if (!i) return send({ message: "Denied" }, 403);
        i.name = args.p_name;
        i.expected_students = args.p_expected;
        return send(null);
      }
      if (name === "create_institution_election") {
        const i = institutionProfiles.find(
          (i) =>
            i.id === args.p_institution &&
            (i.owner === c.sub || c.email === "admin@example.test"),
        );
        if (!i) return send({ message: "Denied" }, 403);
        electionInstitution = i.id;
        phase = "draft";
        purpose = "official";
        approved = false;
        supervisedDni = true;
        expectedStudents = args.p_expected;
        students.splice(0);
        return send(electionId);
      }
      if (name === "configure_institutional_election") {
        if (args.p_expected < students.length)
          return send({ message: "Rejected" }, 400);
        expectedStudents = args.p_expected;
        return send(null);
      }
      if (name === "append_electoral_dni_roll") {
        if (
          phase !== "draft" ||
          students.length + args.p_rows.length > 230 ||
          args.p_rows.some((r: { codigo: string }) =>
            students.some((s) => s.code === r.codigo),
          )
        )
          return send({ message: "Rejected" }, 400);
        for (const r of args.p_rows)
          students.push({
            id: randomUUID(),
            code: r.codigo,
            full_name: r.nombre,
            grade: r.grado,
            section: r.seccion,
            auth_user_id: null,
          });
        return send(args.p_rows.length);
      }
      if (name === "configure_supervised_dni") {
        supervisedDni = true;
        return send(null);
      }
      if (name === "create_voting_station") {
        station = {
          id: randomUUID(),
          hash: args.p_hash,
          label: args.p_label,
          active: true,
        };
        return send(station.id);
      }
      if (name === "get_supervised_control")
        return send({
          stations: station
            ? [
                {
                  id: station.id,
                  label: station.label,
                  active: station.active,
                  expires_at: new Date(Date.now() + 3600000).toISOString(),
                },
              ]
            : [],
          turns:
            turn && station && ["pending", "authorized"].includes(turn.state)
              ? [
                  {
                    id: turn.id,
                    station_id: station.id,
                    name: "Estudiante ficticio 001",
                    dni: "00000001",
                    grade: 1,
                    section: "A",
                    state: turn.state,
                  },
                ]
              : [],
        });
      if (name === "manage_supervised_turn") {
        if (args.p_revoke && station) {
          station.active = false;
          turn = null;
        } else if (turn)
          turn.state = args.p_approve ? "authorized" : "cancelled";
        return send(null);
      }
      if (name === "manage_electoral_list") {
        if (phase !== "draft") return send({ message: "Draft only" }, 400);
        const list = args.p_id ? lists.find((l) => l.id === args.p_id) : null;
        if (args.p_delete) {
          lists = lists.filter((l) => l.id !== args.p_id);
          return send(args.p_id);
        }
        const saved = {
          id: list?.id ?? randomUUID(),
          name: args.p_name,
          number: args.p_number,
          proposals: args.p_proposals,
          symbol_path: args.p_symbol,
          candidates: list?.candidates ?? [],
        };
        lists = lists.filter((l) => l.id !== saved.id);
        lists.push(saved);
        return send(saved.id);
      }
      if (name === "manage_electoral_candidate") {
        const list = lists.find((l) => l.id === args.p_list);
        if (!list || phase !== "draft")
          return send({ message: "Invalid list" }, 400);
        if (args.p_delete) {
          list.candidates = list.candidates.filter((c) => c.id !== args.p_id);
          return send(args.p_id);
        }
        const candidate = {
          id: args.p_id ?? randomUUID(),
          name: args.p_name,
          role: args.p_role,
          position: args.p_position,
          title: args.p_title,
          grade: args.p_grade,
          section: args.p_section,
          photo_path: args.p_photo,
        };
        list.candidates = list.candidates.filter((c) => c.id !== candidate.id);
        list.candidates.push(candidate);
        return send(candidate.id);
      }
      if (name === "replace_electoral_roll") {
        if (phase !== "draft") return send({ message: "Draft only" }, 400);
        students.splice(
          0,
          students.length,
          ...args.p_rows.map((row: Record<string, unknown>, i: number) => ({
            id: i === 0 ? electorId : randomUUID(),
            code: String(row.codigo),
            full_name: String(row.nombre),
            grade: Number(row.grado),
            section: String(row.seccion),
            auth_user_id: null,
          })),
        );
        return send(students.length);
      }
      if (name === "correct_electoral_student") {
        const row = students.find((s) => s.id === args.p_id);
        if (!row || phase !== "draft")
          return send({ message: "Invalid row" }, 400);
        Object.assign(row, {
          code: args.p_code,
          full_name: args.p_name,
          grade: args.p_grade,
          section: args.p_section,
          auth_user_id: args.p_auth_user,
        });
        return send(null);
      }
      if (name === "get_electoral_roll") return send(students);
      if (name === "electoral_roll_summary")
        return send(
          Array.from({ length: 15 }, (_, i) => ({
            grade: 1 + Math.floor(i / 3),
            section: ["A", "B", "C"][i % 3],
            electors: i < 5 ? 16 : 15,
            voters: i === 0 && participation ? 1 : 0,
            pending: (i < 5 ? 16 : 15) - (i === 0 && participation ? 1 : 0),
          })),
        );
      if (name === "register_electoral_credential") {
        if (participation)
          return send({ code: "P0001", message: "Already voted" }, 400);
        credential = {
          hash: args.p_token_hash,
          version: randomUUID(),
          delivered: false,
        };
        return send(credential.version);
      }
      if (name === "confirm_electoral_delivery") {
        if (!credential || credential.version !== args.p_version)
          return send({ code: "P0001", message: "Old delivery" }, 400);
        credential.delivered = true;
        return send(null);
      }
      if (name === "register_electoral_media") {
        mediaAuthorization.add(args.p_path);
        return send(null);
      }
      if (name === "get_electoral_results") {
        if (phase !== "closed")
          return send({ code: "P0001", message: "Not closed" }, 403);
        const count = ballots.filter((v) => v === listId).length;
        const blank = ballots.filter((v) => v === null).length;
        return send({
          election_id: electionId,
          state: "closed",
          electors: 230,
          voters: ballots.length,
          pending: 230 - ballots.length,
          blank,
          blank_percentage: ballots.length ? (blank / ballots.length) * 100 : 0,
          participation: (ballots.length / 230) * 100,
          lists: [
            {
              id: listId,
              number: 1,
              name: lists[0].name,
              votes: count,
              percentage: ballots.length ? (count / ballots.length) * 100 : 0,
              winner: count > 0,
            },
          ],
        });
      }
      if (name === "create_institutional_election") {
        if (institutionalFunctionMissing)
          return send({ code: "PGRST202", message: "Missing" }, 404);
        if (!staff(c)) return send({ message: "Denied" }, 403);
        phase = "draft";
        purpose = "official";
        approved = false;
        return send(electionId);
      }
      if (name === "manage_electoral_election") {
        phase = args.p_state;
        return send(electionId);
      }
      return send(null);
    }
    if (url.pathname.startsWith("/storage/v1/object/")) {
      const path = url.pathname.replace(
        /^\/storage\/v1\/object\/(authenticated\/)?electoral-media\//,
        "",
      );
      if (req.method === "POST") {
        if (!staff(c) || phase !== "draft" || !mediaAuthorization.has(path))
          return send({ message: "Denied" }, 403);
        media.set(path, await body(req));
        return send({ Key: `electoral-media/${path}` });
      }
      if (
        !media.has(path) ||
        (!staff(c) && !(role(c) === "elector" && phase !== "draft"))
      )
        return send({ message: "Not found" }, 404);
      res.writeHead(200, { "Content-Type": "image/webp" });
      return res.end(media.get(path));
    }
    return send({ message: "Not found" }, 404);
  } catch {
    if (!res.headersSent) send({ message: "Fixture request failed" }, 500);
    else res.end();
  }
});
server.listen(port, "127.0.0.1");
