import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { type Db } from "../index";
import { trips, groupMembers, tripEditors, tripBlocked } from "../schema";

export async function isTripBlocked(database: Db, tripId: string, userId: string): Promise<boolean> {
  const row = await database.query.tripBlocked.findFirst({
    where: and(eq(tripBlocked.tripId, tripId), eq(tripBlocked.userId, userId)),
  });
  return !!row;
}

export async function isTripEditor(database: Db, tripId: string, userId: string): Promise<boolean> {
  const row = await database.query.tripEditors.findFirst({
    where: and(eq(tripEditors.tripId, tripId), eq(tripEditors.userId, userId)),
  });
  return !!row;
}

// Throws FORBIDDEN if user cannot view (not a group member or blocked).
// Caller must already have the trip's groupId.
export async function assertTripViewer(
  database: Db,
  tripId: string,
  groupId: string,
  userId: string,
): Promise<void> {
  const membership = await database.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
  });
  if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

  const blocked = await database.query.tripBlocked.findFirst({
    where: and(eq(tripBlocked.tripId, tripId), eq(tripBlocked.userId, userId)),
  });
  if (blocked) throw new TRPCError({ code: "FORBIDDEN" });
}

// Throws FORBIDDEN if user cannot edit (not a group member, blocked, or not in tripEditors).
export async function assertTripEditor(
  database: Db,
  tripId: string,
  groupId: string,
  userId: string,
): Promise<void> {
  await assertTripViewer(database, tripId, groupId, userId);

  const editorRow = await database.query.tripEditors.findFirst({
    where: and(eq(tripEditors.tripId, tripId), eq(tripEditors.userId, userId)),
  });
  if (!editorRow) throw new TRPCError({ code: "FORBIDDEN", message: "Editor access required" });
}

// Returns all group members for a trip with their access level.
export async function getTripMemberAccess(
  database: Db,
  tripId: string,
  groupId: string,
): Promise<{ userId: string; name: string; image: string | null; isEditor: boolean; isBlocked: boolean; isCreator: boolean }[]> {
  const trip = await database.query.trips.findFirst({
    where: eq(trips.id, tripId),
  });
  if (!trip) throw new TRPCError({ code: "NOT_FOUND" });

  const members = await database.query.groupMembers.findMany({
    where: eq(groupMembers.groupId, groupId),
    with: { user: true },
  });

  const editorRows = await database.query.tripEditors.findMany({
    where: eq(tripEditors.tripId, tripId),
  });
  const blockedRows = await database.query.tripBlocked.findMany({
    where: eq(tripBlocked.tripId, tripId),
  });

  const editorSet = new Set(editorRows.map((r) => r.userId));
  const blockedSet = new Set(blockedRows.map((r) => r.userId));

  return members.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    image: m.user.image,
    isEditor: editorSet.has(m.userId),
    isBlocked: blockedSet.has(m.userId),
    isCreator: m.userId === trip.createdBy,
  }));
}

export async function grantTripEditor(database: Db, tripId: string, userId: string): Promise<void> {
  await database
    .insert(tripEditors)
    .values({ tripId, userId })
    .onConflictDoNothing();
}

export async function revokeTripEditor(database: Db, tripId: string, userId: string): Promise<void> {
  await database
    .delete(tripEditors)
    .where(and(eq(tripEditors.tripId, tripId), eq(tripEditors.userId, userId)));
}

export async function blockTripMember(database: Db, tripId: string, userId: string): Promise<void> {
  // Remove from editors first, then block
  await revokeTripEditor(database, tripId, userId);
  await database
    .insert(tripBlocked)
    .values({ tripId, userId })
    .onConflictDoNothing();
}

export async function unblockTripMember(database: Db, tripId: string, userId: string): Promise<void> {
  await database
    .delete(tripBlocked)
    .where(and(eq(tripBlocked.tripId, tripId), eq(tripBlocked.userId, userId)));
}
