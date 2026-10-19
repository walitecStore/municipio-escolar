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
};
let phase = "draft",
  purpose = "test",
  approved = false,
  userReads = 0;
let calls: Record<string, number> = {};
let credential: { hash: string; version: string; delivered: boolean } | null =
  null;
let participation = false;
let ballots: (string | null)[] = [];
let media = new Map<string, Buffer>();
let mediaAuthorization = new Set<string>();
let rejectUsers = false;
const factors = new Map<string, string>();
const profiles: Record<string, { id: string; role: string }> = {
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
function role(c: Claims) {
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
      students.splice(0, students.length, ...structuredClone(initialStudents));
      lists = structuredClone(initialLists);
      return send({ ok: true });
    }
    if (url.pathname === "/__test/scenario") {
      const data = JSON.parse((await body(req)).toString());
      if (data.state) phase = data.state;
      if (data.purpose) purpose = data.purpose;
      if (typeof data.approved === "boolean") approved = data.approved;
      if (typeof data.rejectUsers === "boolean") rejectUsers = data.rejectUsers;
      return send({ ok: true });
    }
    if (url.pathname === "/__test/state")
      return send({
        calls,
        userReads,
        participation,
        ballots: ballots.length,
        media: media.size,
      });
    const c = claimsFrom(
      (req.headers.authorization ?? "").replace(/^Bearer /, ""),
    );
    if (url.pathname === "/auth/v1/token") {
      const data = JSON.parse((await body(req)).toString());
      const profile = profiles[String(data.email)];
      if (!profile) return send({ message: "Invalid credentials" }, 400);
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
      return send(user(c));
    }
    if (url.pathname === "/auth/v1/logout") {
      res.writeHead(204);
      return res.end();
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
      if (!/^\d{6}$/.test(data.code))
        return send({ message: "Invalid code" }, 400);
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
        return send({ role: role(c), aal: c.aal });
      if (name === "list_accessible_elections")
        return send(staff(c) || role(c) === "elector" ? [election()] : []);
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
