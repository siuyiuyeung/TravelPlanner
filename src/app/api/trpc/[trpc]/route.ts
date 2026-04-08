import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/trpc";

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
  : [];
const isDev = process.env.NODE_ENV === "development";

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};
  // In dev with no ALLOWED_ORIGINS set, allow all origins
  if (isDev && allowedOrigins.length === 0) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    };
  }
  if (allowedOrigins.length === 0) return {};
  const allowed = allowedOrigins.some((o) => origin === o || origin.endsWith(o));
  if (!allowed) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

async function handler(req: Request) {
  const origin = req.headers.get("origin");
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
    ...(process.env.NODE_ENV === "development" && {
      onError: ({ path, error }: { path: string | undefined; error: Error }) => {
        console.error(`tRPC error on ${path}:`, error);
      },
    }),
  });

  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(origin)).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, headers });
}

export { handler as GET, handler as POST };
