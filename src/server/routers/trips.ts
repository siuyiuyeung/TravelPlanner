import { TRPCError } from "@trpc/server";
import { eq, and, desc, lt } from "drizzle-orm";
import { router, protectedProcedure, publicProcedure, z } from "../trpc";
import { trips, groupMembers, userPresence, tripEditors, tripBlocked } from "../db/schema";
import {
  assertTripViewer,
  assertTripEditor,
  getTripMemberAccess,
  grantTripEditor,
  revokeTripEditor,
  blockTripMember,
} from "../db/queries/trip-access";

const createTripSchema = z.object({
  groupId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  destination: z.string().max(200).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const updateTripSchema = z.object({
  tripId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  destination: z.string().max(200).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(["planning", "active", "completed"]).optional(),
  coverImage: z.string().optional(),
  budgetCents: z.number().int().min(0).optional(),
  budgetCurrency: z.string().length(3).optional(),
});

function computedStatus(
  startDate: string | null,
  endDate: string | null,
  storedStatus: "planning" | "active" | "completed"
): "planning" | "active" | "completed" {
  const today = new Date().toISOString().slice(0, 10);
  if (endDate && today > endDate) return "completed";
  if (startDate && today >= startDate) return "active";
  return storedStatus === "completed" ? "completed" : "planning";
}

async function assertGroupMember(ctx: { db: { query: { groupMembers: { findFirst: (opts: unknown) => Promise<unknown> } } }; session: { user: { id: string } } }, groupId: string) {
  const membership = await ctx.db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, ctx.session.user.id)),
  });
  if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
  return membership;
}

export const tripsRouter = router({
  listByGroup: protectedProcedure
    .input(z.object({ groupId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertGroupMember(ctx as Parameters<typeof assertGroupMember>[0], input.groupId);
      const rows = await ctx.db.query.trips.findMany({
        where: eq(trips.groupId, input.groupId),
        with: { itineraryItems: true },
        orderBy: [desc(trips.createdAt)],
      });
      return rows.map((t) => ({ ...t, status: computedStatus(t.startDate, t.endDate, t.status) }));
    }),

  getById: protectedProcedure
    .input(z.object({ tripId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const trip = await ctx.db.query.trips.findFirst({
        where: eq(trips.id, input.tripId),
        with: {
          group: { with: { members: { with: { user: true } } } },
          itineraryItems: { with: { confirmations: { with: { user: true } }, votes: true } },
          comments: { with: { user: true } },
          attachments: true,
          presence: { with: { user: true } },
        },
      });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });

      const isMember = trip.group.members.some((m) => m.userId === ctx.session.user.id);
      if (!isMember) throw new TRPCError({ code: "FORBIDDEN" });

      // Check blocked
      const blockedRow = await ctx.db.query.tripBlocked.findFirst({
        where: and(eq(tripBlocked.tripId, input.tripId), eq(tripBlocked.userId, ctx.session.user.id)),
      });
      if (blockedRow) throw new TRPCError({ code: "FORBIDDEN" });

      // Resolve editor status for current user (creator is always editor)
      const isCreator = trip.createdBy === ctx.session.user.id;
      const editorRow = isCreator ? true : await ctx.db.query.tripEditors.findFirst({
        where: and(eq(tripEditors.tripId, input.tripId), eq(tripEditors.userId, ctx.session.user.id)),
      });

      return {
        ...trip,
        status: computedStatus(trip.startDate, trip.endDate, trip.status),
        isEditor: !!editorRow,
      };
    }),

  create: protectedProcedure
    .input(createTripSchema)
    .mutation(async ({ ctx, input }) => {
      await assertGroupMember(ctx as Parameters<typeof assertGroupMember>[0], input.groupId);

      const [trip] = await ctx.db
        .insert(trips)
        .values({
          groupId: input.groupId,
          name: input.name,
          description: input.description,
          destination: input.destination,
          startDate: input.startDate,
          endDate: input.endDate,
          createdBy: ctx.session.user.id,
        })
        .returning();

      if (!trip) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Seed creator as editor
      await ctx.db.insert(tripEditors).values({
        tripId: trip.id,
        userId: ctx.session.user.id,
      }).onConflictDoNothing();

      return trip;
    }),

  update: protectedProcedure
    .input(updateTripSchema)
    .mutation(async ({ ctx, input }) => {
      const trip = await ctx.db.query.trips.findFirst({
        where: eq(trips.id, input.tripId),
      });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });

      await assertGroupMember(ctx as Parameters<typeof assertGroupMember>[0], trip.groupId);

      const { tripId, ...rest } = input;
      const [updated] = await ctx.db
        .update(trips)
        .set(rest)
        .where(eq(trips.id, tripId))
        .returning();

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ tripId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const trip = await ctx.db.query.trips.findFirst({
        where: eq(trips.id, input.tripId),
      });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });

      const membership = await ctx.db.query.groupMembers.findFirst({
        where: and(
          eq(groupMembers.groupId, trip.groupId),
          eq(groupMembers.userId, ctx.session.user.id)
        ),
      });
      if (!membership || membership.role === "member") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.db.delete(trips).where(eq(trips.id, input.tripId));
      return { success: true };
    }),

  // ── Presence ────────────────────────────────────────────────────────────────

  pingPresence: protectedProcedure
    .input(z.object({ tripId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(userPresence)
        .values({
          userId: ctx.session.user.id,
          tripId: input.tripId,
          lastSeenAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [userPresence.userId, userPresence.tripId],
          set: { lastSeenAt: new Date() },
        });
      return { ok: true };
    }),

  leavePresence: protectedProcedure
    .input(z.object({ tripId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(userPresence)
        .where(
          and(
            eq(userPresence.userId, ctx.session.user.id),
            eq(userPresence.tripId, input.tripId)
          )
        );
      // Also clean up stale presence records (> 2 minutes old)
      const staleThreshold = new Date(Date.now() - 2 * 60 * 1000);
      await ctx.db
        .delete(userPresence)
        .where(
          and(
            eq(userPresence.tripId, input.tripId),
            lt(userPresence.lastSeenAt, staleThreshold)
          )
        );
      return { ok: true };
    }),

  // ── Sharing ─────────────────────────────────────────────────────────────────

  getPublic: publicProcedure
    .input(z.object({ shareToken: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const trip = await ctx.db.query.trips.findFirst({
        where: and(eq(trips.shareToken, input.shareToken), eq(trips.isPublic, true)),
        columns: {
          id: true,
          groupId: true,
          name: true,
          description: true,
          destination: true,
          coverImage: true,
          status: true,
          startDate: true,
          endDate: true,
          metadata: true,
          isPublic: true,
          shareToken: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
        },
        with: {
          itineraryItems: { with: { confirmations: { with: { user: true } }, votes: true } },
          group: { columns: { id: true, name: true } },
        },
      });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        ...trip,
        status: computedStatus(trip.startDate, trip.endDate, trip.status),
      };
    }),

  updateSharing: protectedProcedure
    .input(z.object({ tripId: z.string().uuid(), isPublic: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const trip = await ctx.db.query.trips.findFirst({
        where: eq(trips.id, input.tripId),
        columns: { id: true, groupId: true, createdBy: true },
      });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      await assertTripEditor(ctx.db, input.tripId, trip.groupId, ctx.session.user.id);
      const [updated] = await ctx.db
        .update(trips)
        .set({ isPublic: input.isPublic })
        .where(eq(trips.id, input.tripId))
        .returning();
      return updated;
    }),

  regenerateToken: protectedProcedure
    .input(z.object({ tripId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const trip = await ctx.db.query.trips.findFirst({
        where: eq(trips.id, input.tripId),
        columns: { id: true, groupId: true, createdBy: true },
      });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      await assertTripEditor(ctx.db, input.tripId, trip.groupId, ctx.session.user.id);
      const newToken = crypto.randomUUID();
      const [updated] = await ctx.db
        .update(trips)
        .set({ shareToken: newToken })
        .where(eq(trips.id, input.tripId))
        .returning();
      return updated;
    }),

  getMemberAccess: protectedProcedure
    .input(z.object({ tripId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const trip = await ctx.db.query.trips.findFirst({
        where: eq(trips.id, input.tripId),
        columns: { id: true, groupId: true },
      });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      await assertTripViewer(ctx.db, input.tripId, trip.groupId, ctx.session.user.id);
      return getTripMemberAccess(ctx.db, input.tripId, trip.groupId);
    }),

  grantEditor: protectedProcedure
    .input(z.object({ tripId: z.string().uuid(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const trip = await ctx.db.query.trips.findFirst({
        where: eq(trips.id, input.tripId),
        columns: { id: true, groupId: true, createdBy: true },
      });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      await assertTripEditor(ctx.db, input.tripId, trip.groupId, ctx.session.user.id);
      await grantTripEditor(ctx.db, input.tripId, input.userId);
      return { ok: true };
    }),

  revokeEditor: protectedProcedure
    .input(z.object({ tripId: z.string().uuid(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const trip = await ctx.db.query.trips.findFirst({
        where: eq(trips.id, input.tripId),
        columns: { id: true, groupId: true, createdBy: true },
      });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      if (trip.createdBy === input.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot revoke trip creator" });
      }
      await assertTripEditor(ctx.db, input.tripId, trip.groupId, ctx.session.user.id);
      await revokeTripEditor(ctx.db, input.tripId, input.userId);
      return { ok: true };
    }),

  removeFromTrip: protectedProcedure
    .input(z.object({ tripId: z.string().uuid(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const trip = await ctx.db.query.trips.findFirst({
        where: eq(trips.id, input.tripId),
        columns: { id: true, groupId: true, createdBy: true },
      });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      if (trip.createdBy === input.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot remove trip creator" });
      }
      await assertTripEditor(ctx.db, input.tripId, trip.groupId, ctx.session.user.id);
      await blockTripMember(ctx.db, input.tripId, input.userId);
      return { ok: true };
    }),
});
