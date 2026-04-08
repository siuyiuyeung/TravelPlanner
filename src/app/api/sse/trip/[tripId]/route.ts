import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { eq, and } from "drizzle-orm";
import { trips, groupMembers } from "@/server/db/schema";
import { registerTripController, unregisterTripController } from "@/server/sse";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
  if (!trip) return new Response("Not found", { status: 404 });

  const membership = await db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.groupId, trip.groupId),
      eq(groupMembers.userId, session.user.id)
    ),
  });
  if (!membership) return new Response("Forbidden", { status: 403 });

  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      registerTripController(tripId, controller);
      // initial keepalive comment
      c.enqueue(new TextEncoder().encode(": connected\n\n"));
    },
    cancel() {
      unregisterTripController(tripId, controller);
    },
  });

  request.signal.addEventListener("abort", () => {
    try { unregisterTripController(tripId, controller); } catch { /* ignore */ }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
