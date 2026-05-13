import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "./auth";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { groupMembers, tripEditors, tripBlocked, trips } from "./db/schema";
import type { Session } from "./auth";
import { z } from "zod/v4";

// ─── Context ──────────────────────────────────────────────────────────────────

export type Context = {
  db: typeof db;
  session: Session | null;
};

export const createTRPCContext = cache(async (): Promise<Context> => {
  const session = await auth.api.getSession({ headers: await headers() });
  return { db, session };
});

// ─── tRPC init ────────────────────────────────────────────────────────────────

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

// ─── Procedures ───────────────────────────────────────────────────────────────

export const publicProcedure = t.procedure;

const authMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { ...ctx, session: ctx.session },
  });
});

export const protectedProcedure = t.procedure.use(authMiddleware);

// Middleware that verifies caller is a member of the given groupId
const groupMemberMiddleware = t.middleware(async ({ ctx, next, getRawInput }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const raw = await getRawInput();
  const parsed = z.object({ groupId: z.string() }).safeParse(raw);
  if (!parsed.success) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "groupId required" });
  }

  const membership = await ctx.db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.groupId, parsed.data.groupId),
      eq(groupMembers.userId, ctx.session.user.id)
    ),
  });

  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a group member" });
  }

  return next({
    ctx: { ...ctx, session: ctx.session, membership },
  });
});

export const groupMemberProcedure = t.procedure.use(groupMemberMiddleware);

// Middleware that verifies caller can view a specific trip (group member, not blocked).
// Requires `tripId` in input. Looks up the trip's groupId internally.
const tripViewerMiddleware = t.middleware(async ({ ctx, next, getRawInput }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const raw = await getRawInput();
  const parsed = z.object({ tripId: z.string() }).safeParse(raw);
  if (!parsed.success) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "tripId required" });
  }

  const trip = await ctx.db.query.trips.findFirst({
    where: eq(trips.id, parsed.data.tripId),
    columns: { id: true, groupId: true },
  });
  if (!trip) throw new TRPCError({ code: "NOT_FOUND" });

  const [membership, blocked] = await Promise.all([
    ctx.db.query.groupMembers.findFirst({
      where: and(eq(groupMembers.groupId, trip.groupId), eq(groupMembers.userId, ctx.session.user.id)),
    }),
    ctx.db.query.tripBlocked.findFirst({
      where: and(eq(tripBlocked.tripId, parsed.data.tripId), eq(tripBlocked.userId, ctx.session.user.id)),
    }),
  ]);
  if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
  if (blocked) throw new TRPCError({ code: "FORBIDDEN" });

  return next({ ctx: { ...ctx, session: ctx.session } });
});

export const tripViewerProcedure = t.procedure.use(tripViewerMiddleware);

// Middleware that verifies caller has editor access to a specific trip.
const tripEditorMiddleware = t.middleware(async ({ ctx, next, getRawInput }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const raw = await getRawInput();
  const parsed = z.object({ tripId: z.string() }).safeParse(raw);
  if (!parsed.success) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "tripId required" });
  }

  const trip = await ctx.db.query.trips.findFirst({
    where: eq(trips.id, parsed.data.tripId),
    columns: { id: true, groupId: true, createdBy: true },
  });
  if (!trip) throw new TRPCError({ code: "NOT_FOUND" });

  const [membership, blocked] = await Promise.all([
    ctx.db.query.groupMembers.findFirst({
      where: and(eq(groupMembers.groupId, trip.groupId), eq(groupMembers.userId, ctx.session.user.id)),
    }),
    ctx.db.query.tripBlocked.findFirst({
      where: and(eq(tripBlocked.tripId, parsed.data.tripId), eq(tripBlocked.userId, ctx.session.user.id)),
    }),
  ]);
  if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
  if (blocked) throw new TRPCError({ code: "FORBIDDEN" });

  // Creator is always an editor
  if (trip.createdBy !== ctx.session.user.id) {
    const editorRow = await ctx.db.query.tripEditors.findFirst({
      where: and(eq(tripEditors.tripId, parsed.data.tripId), eq(tripEditors.userId, ctx.session.user.id)),
    });
    if (!editorRow) throw new TRPCError({ code: "FORBIDDEN", message: "Editor access required" });
  }

  return next({ ctx: { ...ctx, session: ctx.session } });
});

export const tripEditorProcedure = t.procedure.use(tripEditorMiddleware);

export { z };
