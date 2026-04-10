import { TRPCError } from "@trpc/server";
import { eq, and, asc } from "drizzle-orm";
import { router, protectedProcedure, z } from "../trpc";
import { trips, groupMembers, packingItems } from "../db/schema";
import { broadcastTripUpdate } from "../sse";

async function assertTripMember(
  db: { query: { trips: { findFirst: (o: unknown) => Promise<unknown> }; groupMembers: { findFirst: (o: unknown) => Promise<unknown> } } },
  tripId: string,
  userId: string
) {
  const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) }) as { groupId: string } | undefined;
  if (!trip) throw new TRPCError({ code: "NOT_FOUND", message: "Trip not found" });
  const membership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, trip.groupId), eq(groupMembers.userId, userId)),
  });
  if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
  return { trip, membership };
}

export const packingRouter = router({
  listByTrip: protectedProcedure
    .input(z.object({ tripId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertTripMember(ctx.db as Parameters<typeof assertTripMember>[0], input.tripId, ctx.session.user.id);
      const items = await ctx.db.query.packingItems.findMany({
        where: eq(packingItems.tripId, input.tripId),
        with: { adder: true },
        orderBy: [asc(packingItems.sortOrder), asc(packingItems.createdAt)],
      });
      // Filter out other users' personal items
      return items.filter((i) => !i.isPersonal || i.addedBy === ctx.session.user.id);
    }),

  add: protectedProcedure
    .input(z.object({
      tripId: z.string().uuid(),
      name: z.string().min(1).max(200),
      quantity: z.number().int().min(1).default(1),
      category: z.string().max(50).default("general"),
      isPersonal: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertTripMember(ctx.db as Parameters<typeof assertTripMember>[0], input.tripId, ctx.session.user.id);
      const [item] = await ctx.db.insert(packingItems).values({
        tripId: input.tripId,
        addedBy: ctx.session.user.id,
        name: input.name,
        quantity: input.quantity,
        category: input.category,
        isPersonal: input.isPersonal,
      }).returning();
      if (!item) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (!input.isPersonal) broadcastTripUpdate(input.tripId);
      return item;
    }),

  toggleCheck: protectedProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.query.packingItems.findFirst({
        where: eq(packingItems.id, input.itemId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      await assertTripMember(ctx.db as Parameters<typeof assertTripMember>[0], item.tripId, ctx.session.user.id);
      const [updated] = await ctx.db
        .update(packingItems)
        .set({ checked: !item.checked })
        .where(eq(packingItems.id, input.itemId))
        .returning();
      if (!item.isPersonal) broadcastTripUpdate(item.tripId);
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.query.packingItems.findFirst({
        where: eq(packingItems.id, input.itemId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      if (item.addedBy !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await ctx.db.delete(packingItems).where(eq(packingItems.id, input.itemId));
      if (!item.isPersonal) broadcastTripUpdate(item.tripId);
      return { success: true };
    }),
});
