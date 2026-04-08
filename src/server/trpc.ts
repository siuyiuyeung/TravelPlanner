import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "./auth";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { groupMembers } from "./db/schema";
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

export { z };
