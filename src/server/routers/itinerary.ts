import { TRPCError } from "@trpc/server";
import { eq, and, asc } from "drizzle-orm";
import { router, protectedProcedure, z } from "../trpc";
import { itineraryItems, itemConfirmations, itemVotes, trips, groupMembers } from "../db/schema";
import { broadcastTripUpdate } from "../sse";

const createItemSchema = z.object({
  tripId: z.string().uuid(),
  type: z.enum(["flight", "hotel", "activity", "restaurant", "transport", "note"]),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  locationName: z.string().max(300).optional(),
  locationLat: z.string().max(30).optional(),
  locationLng: z.string().max(30).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  costCents: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  url: z.string().url().optional(),
  sortOrder: z.number().int().default(0),
  routeMode: z.enum(["driving", "walking", "cycling", "transit", "none"]).optional(),
});

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

export const itineraryRouter = router({
  listByTrip: protectedProcedure
    .input(z.object({ tripId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertTripMember(ctx.db as Parameters<typeof assertTripMember>[0], input.tripId, ctx.session.user.id);
      return ctx.db.query.itineraryItems.findMany({
        where: eq(itineraryItems.tripId, input.tripId),
        with: { confirmations: { with: { user: true } }, votes: true },
        orderBy: [asc(itineraryItems.sortOrder), asc(itineraryItems.startTime)],
      });
    }),

  create: protectedProcedure
    .input(createItemSchema)
    .mutation(async ({ ctx, input }) => {
      await assertTripMember(ctx.db as Parameters<typeof assertTripMember>[0], input.tripId, ctx.session.user.id);
      const { startTime, endTime, ...rest } = input;
      const [item] = await ctx.db
        .insert(itineraryItems)
        .values({
          ...rest,
          startTime: startTime ? new Date(startTime) : null,
          endTime: endTime ? new Date(endTime) : null,
          createdBy: ctx.session.user.id,
        })
        .returning();
      if (!item) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      broadcastTripUpdate(input.tripId);
      return item;
    }),

  update: protectedProcedure
    .input(createItemSchema.partial().extend({ itemId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.query.itineraryItems.findFirst({
        where: eq(itineraryItems.id, input.itemId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      await assertTripMember(ctx.db as Parameters<typeof assertTripMember>[0], item.tripId, ctx.session.user.id);

      const { itemId, startTime, endTime, ...rest } = input;
      const [updated] = await ctx.db
        .update(itineraryItems)
        .set({
          ...rest,
          ...(startTime !== undefined && { startTime: startTime ? new Date(startTime) : null }),
          ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
        })
        .where(eq(itineraryItems.id, itemId))
        .returning();
      broadcastTripUpdate(item.tripId);
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.query.itineraryItems.findFirst({
        where: eq(itineraryItems.id, input.itemId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      await assertTripMember(ctx.db as Parameters<typeof assertTripMember>[0], item.tripId, ctx.session.user.id);
      await ctx.db.delete(itineraryItems).where(eq(itineraryItems.id, input.itemId));
      broadcastTripUpdate(item.tripId);
      return { success: true };
    }),

  toggleConfirmation: protectedProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.itemConfirmations.findFirst({
        where: and(
          eq(itemConfirmations.itemId, input.itemId),
          eq(itemConfirmations.userId, ctx.session.user.id)
        ),
      });

      if (existing) {
        await ctx.db.delete(itemConfirmations).where(eq(itemConfirmations.id, existing.id));
        return { confirmed: false };
      }

      await ctx.db.insert(itemConfirmations).values({
        itemId: input.itemId,
        userId: ctx.session.user.id,
      });
      return { confirmed: true };
    }),

  castVote: protectedProcedure
    .input(z.object({
      itemId: z.string().uuid(),
      vote: z.enum(["yes", "maybe", "no"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.query.itineraryItems.findFirst({
        where: eq(itineraryItems.id, input.itemId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      await assertTripMember(ctx.db as Parameters<typeof assertTripMember>[0], item.tripId, ctx.session.user.id);

      const existing = await ctx.db.query.itemVotes.findFirst({
        where: and(
          eq(itemVotes.itemId, input.itemId),
          eq(itemVotes.userId, ctx.session.user.id),
        ),
      });

      if (existing?.vote === input.vote) {
        await ctx.db.delete(itemVotes).where(eq(itemVotes.id, existing.id));
        broadcastTripUpdate(item.tripId);
        return { vote: null };
      }

      if (existing) {
        await ctx.db.update(itemVotes).set({ vote: input.vote }).where(eq(itemVotes.id, existing.id));
      } else {
        await ctx.db.insert(itemVotes).values({
          itemId: input.itemId,
          userId: ctx.session.user.id,
          vote: input.vote,
        });
      }

      broadcastTripUpdate(item.tripId);
      return { vote: input.vote };
    }),

  reorder: protectedProcedure
    .input(z.object({
      tripId: z.string().uuid(),
      items: z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int() })),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertTripMember(ctx.db as Parameters<typeof assertTripMember>[0], input.tripId, ctx.session.user.id);
      await Promise.all(
        input.items.map(({ id, sortOrder }) =>
          ctx.db.update(itineraryItems).set({ sortOrder }).where(eq(itineraryItems.id, id))
        )
      );
      return { success: true };
    }),
});
