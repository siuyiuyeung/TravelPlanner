import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { router, protectedProcedure, z } from "../trpc";
import { attachments, trips, groupMembers, itineraryItems } from "../db/schema";

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
}

export const attachmentsRouter = router({
  listByTrip: protectedProcedure
    .input(z.object({ tripId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertTripMember(
        ctx.db as Parameters<typeof assertTripMember>[0],
        input.tripId,
        ctx.session.user.id
      );
      return ctx.db.query.attachments.findMany({
        where: eq(attachments.tripId, input.tripId),
        with: { uploader: true },
        orderBy: (a, { desc }) => [desc(a.createdAt)],
      });
    }),

  listByItem: protectedProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.db.query.itineraryItems.findFirst({
        where: eq(itineraryItems.id, input.itemId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      await assertTripMember(
        ctx.db as Parameters<typeof assertTripMember>[0],
        item.tripId,
        ctx.session.user.id
      );
      return ctx.db.query.attachments.findMany({
        where: and(
          eq(attachments.tripId, item.tripId),
          eq(attachments.itineraryItemId, input.itemId)
        ),
        with: { uploader: true },
        orderBy: (a, { desc }) => [desc(a.createdAt)],
      });
    }),
});
