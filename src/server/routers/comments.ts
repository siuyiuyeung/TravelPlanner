import { TRPCError } from "@trpc/server";
import { eq, and, asc } from "drizzle-orm";
import { router, protectedProcedure, z } from "../trpc";
import { tripComments, trips, groupMembers } from "../db/schema";
import { broadcastTripUpdate } from "../sse";

const ALLOWED_REACTIONS = ["👍", "🎉", "❤️", "😂", "✅"] as const;

async function assertTripMember(
  db: { query: { trips: { findFirst: (o: unknown) => Promise<{ groupId: string } | undefined> }; groupMembers: { findFirst: (o: unknown) => Promise<unknown> } } },
  tripId: string,
  userId: string
) {
  const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
  if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
  const membership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, trip.groupId), eq(groupMembers.userId, userId)),
  });
  if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
  return trip;
}

export const commentsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        tripId: z.string().uuid(),
        parentType: z.enum(["trip", "item"]).optional(),
        parentId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertTripMember(
        ctx.db as Parameters<typeof assertTripMember>[0],
        input.tripId,
        ctx.session.user.id
      );

      const conditions = [eq(tripComments.tripId, input.tripId)];
      if (input.parentType) conditions.push(eq(tripComments.parentType, input.parentType));
      if (input.parentId) conditions.push(eq(tripComments.parentId, input.parentId));

      return ctx.db.query.tripComments.findMany({
        where: and(...conditions),
        with: { user: true },
        orderBy: [asc(tripComments.createdAt)],
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        tripId: z.string().uuid(),
        parentType: z.enum(["trip", "item"]).default("trip"),
        parentId: z.string().uuid().optional(),
        body: z.string().min(1).max(2000).trim(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertTripMember(
        ctx.db as Parameters<typeof assertTripMember>[0],
        input.tripId,
        ctx.session.user.id
      );

      const [comment] = await ctx.db
        .insert(tripComments)
        .values({
          tripId: input.tripId,
          userId: ctx.session.user.id,
          parentType: input.parentType,
          parentId: input.parentId ?? null,
          body: input.body,
          reactions: {},
        })
        .returning();

      if (!comment) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      broadcastTripUpdate(input.tripId);
      return comment;
    }),

  delete: protectedProcedure
    .input(z.object({ commentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.db.query.tripComments.findFirst({
        where: eq(tripComments.id, input.commentId),
      });
      if (!comment) throw new TRPCError({ code: "NOT_FOUND" });
      if (comment.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await ctx.db.delete(tripComments).where(eq(tripComments.id, input.commentId));
      broadcastTripUpdate(comment.tripId);
      return { success: true };
    }),

  toggleReaction: protectedProcedure
    .input(
      z.object({
        commentId: z.string().uuid(),
        emoji: z.enum(ALLOWED_REACTIONS),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.db.query.tripComments.findFirst({
        where: eq(tripComments.id, input.commentId),
      });
      if (!comment) throw new TRPCError({ code: "NOT_FOUND" });

      const reactions = (comment.reactions ?? {}) as Record<string, string[]>;
      const userIds = reactions[input.emoji] ?? [];
      const userId = ctx.session.user.id;

      if (userIds.includes(userId)) {
        reactions[input.emoji] = userIds.filter((u) => u !== userId);
      } else {
        reactions[input.emoji] = [...userIds, userId];
      }

      if (reactions[input.emoji]!.length === 0) {
        delete reactions[input.emoji];
      }

      const [updated] = await ctx.db
        .update(tripComments)
        .set({ reactions })
        .where(eq(tripComments.id, input.commentId))
        .returning();

      broadcastTripUpdate(comment.tripId);
      return updated;
    }),
});
