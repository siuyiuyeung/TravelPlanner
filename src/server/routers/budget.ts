import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import { router, protectedProcedure, z } from "../trpc";
import { trips, groupMembers, tripExpenses, itineraryItems } from "../db/schema";
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

const CATEGORIES = ["food", "transport", "accommodation", "activity", "other"] as const;

export const budgetRouter = router({
  listByTrip: protectedProcedure
    .input(z.object({ tripId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertTripMember(ctx.db as Parameters<typeof assertTripMember>[0], input.tripId, ctx.session.user.id);
      return ctx.db.query.tripExpenses.findMany({
        where: eq(tripExpenses.tripId, input.tripId),
        with: { payer: true, itineraryItem: { columns: { id: true, title: true } } },
        orderBy: [desc(tripExpenses.paidAt)],
      });
    }),

  listByItem: protectedProcedure
    .input(z.object({ itineraryItemId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.db.query.itineraryItems.findFirst({
        where: eq(itineraryItems.id, input.itineraryItemId),
      }) as { tripId: string } | undefined;
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      await assertTripMember(ctx.db as Parameters<typeof assertTripMember>[0], item.tripId, ctx.session.user.id);
      return ctx.db.query.tripExpenses.findMany({
        where: eq(tripExpenses.itineraryItemId, input.itineraryItemId),
        with: { payer: true },
        orderBy: [desc(tripExpenses.paidAt)],
      });
    }),

  add: protectedProcedure
    .input(z.object({
      tripId: z.string().uuid(),
      itineraryItemId: z.string().uuid().optional(),
      title: z.string().min(1).max(200),
      amountCents: z.number().int().min(1),
      currency: z.string().length(3).default("HKD"),
      category: z.enum(CATEGORIES).default("other"),
      paidAt: z.string().datetime().optional(),
      paidByUserId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { trip } = await assertTripMember(ctx.db as Parameters<typeof assertTripMember>[0], input.tripId, ctx.session.user.id);

      const effectivePaidBy = input.paidByUserId ?? ctx.session.user.id;
      if (input.paidByUserId && input.paidByUserId !== ctx.session.user.id) {
        const targetMembership = await ctx.db.query.groupMembers.findFirst({
          where: and(eq(groupMembers.groupId, trip.groupId), eq(groupMembers.userId, input.paidByUserId)),
        });
        if (!targetMembership) throw new TRPCError({ code: "BAD_REQUEST", message: "Specified payer is not a group member" });
      }

      const [expense] = await ctx.db.insert(tripExpenses).values({
        tripId: input.tripId,
        itineraryItemId: input.itineraryItemId,
        paidBy: effectivePaidBy,
        title: input.title,
        amountCents: input.amountCents,
        currency: input.currency,
        category: input.category,
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
      }).returning();
      if (!expense) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      broadcastTripUpdate(input.tripId);
      return expense;
    }),

  update: protectedProcedure
    .input(z.object({
      expenseId: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      amountCents: z.number().int().min(1).optional(),
      currency: z.string().length(3).optional(),
      category: z.enum(CATEGORIES).optional(),
      paidByUserId: z.string().optional(),
      itineraryItemId: z.string().uuid().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const expense = await ctx.db.query.tripExpenses.findFirst({
        where: eq(tripExpenses.id, input.expenseId),
      });
      if (!expense) throw new TRPCError({ code: "NOT_FOUND" });
      if (expense.paidBy !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const { expenseId, paidByUserId, ...rest } = input;

      let newPaidBy: string | undefined;
      if (paidByUserId) {
        const trip = await ctx.db.query.trips.findFirst({ where: eq(trips.id, expense.tripId) }) as { groupId: string } | undefined;
        if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
        const targetMembership = await ctx.db.query.groupMembers.findFirst({
          where: and(eq(groupMembers.groupId, trip.groupId), eq(groupMembers.userId, paidByUserId)),
        });
        if (!targetMembership) throw new TRPCError({ code: "BAD_REQUEST", message: "Specified payer is not a group member" });
        newPaidBy = paidByUserId;
      }

      const [updated] = await ctx.db
        .update(tripExpenses)
        .set({ ...rest, ...(newPaidBy ? { paidBy: newPaidBy } : {}) })
        .where(eq(tripExpenses.id, expenseId))
        .returning();
      broadcastTripUpdate(expense.tripId);
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ expenseId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const expense = await ctx.db.query.tripExpenses.findFirst({
        where: eq(tripExpenses.id, input.expenseId),
      });
      if (!expense) throw new TRPCError({ code: "NOT_FOUND" });
      if (expense.paidBy !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await ctx.db.delete(tripExpenses).where(eq(tripExpenses.id, input.expenseId));
      broadcastTripUpdate(expense.tripId);
      return { success: true };
    }),
});
