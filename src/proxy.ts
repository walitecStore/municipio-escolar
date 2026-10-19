import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { parseIntegrationConfig } from "./lib/connected/policy";
export async function proxy(request: NextRequest) {
  const config = parseIntegrationConfig(process.env);
  let response = NextResponse.next({ request });
  if (config) {
    const client = createServerClient(config.url, config.key, {
      cookieOptions: {
        httpOnly: true,
        secure: config.origin.startsWith("https:"),
        sameSite: "lax",
        path: "/",
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          for (const { name, value } of items) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of items)
            response.cookies.set(name, value, options);
        },
      },
    });
    try {
      await client.auth.getUser();
    } catch {
      /* Fail closed again in every protected action/page. */
    }
  }
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Content-Security-Policy",
    "frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'",
  );
  return response;
}
export const config = { matcher: ["/sistema/:path*"] };
