import { TRPCError } from "@trpc/server";
import { eq, and, ne } from "drizzle-orm";
import { router, protectedProcedure, z } from "../trpc";
import { groups, groupMembers } from "../db/schema";
import { randomBytes } from "crypto";

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

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const groupsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.query.groupMembers.findMany({
      where: eq(groupMembers.userId, ctx.session.user.id),
      with: {
        group: {
          with: {
            members: { with: { user: true } },
            trips: true,
          },
        },
      },
    });
    return memberships.map((m) => ({
      ...m.group,
      role: m.role,
      trips: m.group.trips.map((t) => ({
        ...t,
        status: computedStatus(t.startDate, t.endDate, t.status),
      })),
    }));
  }),

  getById: protectedProcedure
    .input(z.object({ groupId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const membership = await ctx.db.query.groupMembers.findFirst({
        where: and(
          eq(groupMembers.groupId, input.groupId),
          eq(groupMembers.userId, ctx.session.user.id)
        ),
      });
      if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

      const group = await ctx.db.query.groups.findFirst({
        where: eq(groups.id, input.groupId),
        with: {
          members: { with: { user: true } },
          trips: true,
        },
      });
      if (!group) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        ...group,
        role: membership.role,
        trips: group.trips.map((t) => ({
          ...t,
          status: computedStatus(t.startDate, t.endDate, t.status),
        })),
      };
    }),

  create: protectedProcedure
    .input(createGroupSchema)
    .mutation(async ({ ctx, input }) => {
      const inviteToken = randomBytes(8).toString("hex");

      const [group] = await ctx.db
        .insert(groups)
        .values({
          name: input.name,
          description: input.description,
          inviteToken,
          createdBy: ctx.session.user.id,
        })
        .returning();

      if (!group) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await ctx.db.insert(groupMembers).values({
        groupId: group.id,
        userId: ctx.session.user.id,
        role: "owner",
      });

      return group;
    }),

  join: protectedProcedure
    .input(z.object({ inviteToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.db.query.groups.findFirst({
        where: eq(groups.inviteToken, input.inviteToken),
      });
      if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite link" });

      const existing = await ctx.db.query.groupMembers.findFirst({
        where: and(
          eq(groupMembers.groupId, group.id),
          eq(groupMembers.userId, ctx.session.user.id)
        ),
      });
      if (existing) return group; // already a member, no-op

      await ctx.db.insert(groupMembers).values({
        groupId: group.id,
        userId: ctx.session.user.id,
        role: "member",
      });

      return group;
    }),

  updateMemberRole: protectedProcedure
    .input(z.object({
      groupId: z.string().uuid(),
      targetUserId: z.string(),
      role: z.enum(["admin", "member"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const myMembership = await ctx.db.query.groupMembers.findFirst({
        where: and(
          eq(groupMembers.groupId, input.groupId),
          eq(groupMembers.userId, ctx.session.user.id)
        ),
      });
      if (!myMembership || myMembership.role === "member") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      // Cannot change an owner's role
      const target = await ctx.db.query.groupMembers.findFirst({
        where: and(
          eq(groupMembers.groupId, input.groupId),
          eq(groupMembers.userId, input.targetUserId)
        ),
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      if (target.role === "owner") throw new TRPCError({ code: "FORBIDDEN" });

      const [updated] = await ctx.db
        .update(groupMembers)
        .set({ role: input.role })
        .where(and(
          eq(groupMembers.groupId, input.groupId),
          eq(groupMembers.userId, input.targetUserId)
        ))
        .returning();
      return updated;
    }),

  removeMember: protectedProcedure
    .input(z.object({
      groupId: z.string().uuid(),
      targetUserId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const myMembership = await ctx.db.query.groupMembers.findFirst({
        where: and(
          eq(groupMembers.groupId, input.groupId),
          eq(groupMembers.userId, ctx.session.user.id)
        ),
      });
      if (!myMembership || myMembership.role === "member") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const target = await ctx.db.query.groupMembers.findFirst({
        where: and(
          eq(groupMembers.groupId, input.groupId),
          eq(groupMembers.userId, input.targetUserId)
        ),
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      if (target.role === "owner") throw new TRPCError({ code: "FORBIDDEN" });

      await ctx.db
        .delete(groupMembers)
        .where(and(
          eq(groupMembers.groupId, input.groupId),
          eq(groupMembers.userId, input.targetUserId),
          ne(groupMembers.role, "owner")
        ));
      return { success: true };
    }),

  regenerateInvite: protectedProcedure
    .input(z.object({ groupId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const membership = await ctx.db.query.groupMembers.findFirst({
        where: and(
          eq(groupMembers.groupId, input.groupId),
          eq(groupMembers.userId, ctx.session.user.id)
        ),
      });
      if (!membership || membership.role === "member") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const newToken = randomBytes(8).toString("hex");
      const [updated] = await ctx.db
        .update(groups)
        .set({ inviteToken: newToken })
        .where(eq(groups.id, input.groupId))
        .returning();

      return updated;
    }),
});
