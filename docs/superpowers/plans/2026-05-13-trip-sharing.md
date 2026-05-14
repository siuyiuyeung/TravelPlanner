# Trip Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public view-only share links and per-trip member editor/viewer permissions to trips.

**Architecture:** Two sparse join tables (`trip_editors`, `trip_blocked`) sit alongside the existing `trips` table. Presence of a `trip_editors` row grants edit; `trip_blocked` overrides group membership with no-access. A `shareToken` UUID on each trip enables unauthenticated read-only views at `/trips/share/[token]`.

**Tech Stack:** Drizzle ORM (PostgreSQL), tRPC v11, Next.js 15 App Router, Vaul bottom sheets, TanStack React Query

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `src/server/db/queries/trip-access.ts` | Query helpers: editor/viewer/blocked checks, grant/revoke functions |
| `src/app/trips/share/[token]/page.tsx` | Public RSC — fetches trip via shareToken, no auth |
| `src/app/trips/share/[token]/_components/PublicTripView.tsx` | Read-only trip UI (itinerary + map tabs) |
| `src/app/(app)/trips/[tripId]/_components/ShareSheet.tsx` | Vaul bottom sheet: public link toggle + member list |
| `src/app/(app)/trips/[tripId]/_components/MemberAccessSheet.tsx` | Vaul action sheet: Editor/Viewer/Remove per member |

### Modified files
| File | What changes |
|---|---|
| `src/server/db/schema.ts` | Add `isPublic`, `shareToken` to `trips`; add `tripEditors`, `tripBlocked` tables |
| `src/server/db/relations.ts` | Add relations for `tripEditors`, `tripBlocked` |
| `src/server/trpc.ts` | Add `tripEditorMiddleware`, `tripViewerMiddleware`, export `tripEditorProcedure`, `tripViewerProcedure` |
| `src/server/routers/trips.ts` | Add 6 new procedures; update `create` to seed editor; update `getById` to check blocked + return `isEditor` |
| `src/server/routers/itinerary.ts` | Replace `assertTripMember` with `assertTripEditor`/`assertTripViewer` from trip-access.ts |
| `src/app/(app)/trips/[tripId]/_components/TripDetailClient.tsx` | Add share button to trip header; wire up ShareSheet |

---

## Task 1: Schema — add sharing columns and new tables

**Files:**
- Modify: `src/server/db/schema.ts`
- Modify: `src/server/db/relations.ts`

- [ ] **Step 1: Add `isPublic` and `shareToken` to the `trips` table**

In `src/server/db/schema.ts`, add two columns inside the `trips` pgTable definition after `createdBy`:

```ts
// add to imports at top if not already present: uuid is already imported
export const trips = pgTable("trips", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  destination: text("destination"),
  coverImage: text("cover_image"),
  status: tripStatusEnum("status").default("planning").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  metadata: jsonb("metadata").default({}),
  budgetCents: integer("budget_cents").default(0).notNull(),
  budgetCurrency: char("budget_currency", { length: 3 }).default("HKD").notNull(),
  isPublic: boolean("is_public").default(false).notNull(),
  shareToken: uuid("share_token").defaultRandom().notNull().unique(),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index("trips_group_id_idx").on(t.groupId),
  index("trips_status_idx").on(t.status),
  index("trips_start_date_idx").on(t.startDate),
]);
```

- [ ] **Step 2: Add `tripEditors` table**

Append after the `trips` table definition in `src/server/db/schema.ts`:

```ts
// ─── Trip Access ──────────────────────────────────────────────────────────────

export const tripEditors = pgTable("trip_editors", {
  tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique("trip_editors_trip_id_user_id_uniq").on(t.tripId, t.userId),
  index("trip_editors_trip_id_idx").on(t.tripId),
  index("trip_editors_user_id_idx").on(t.userId),
]);

export const tripBlocked = pgTable("trip_blocked", {
  tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique("trip_blocked_trip_id_user_id_uniq").on(t.tripId, t.userId),
  index("trip_blocked_trip_id_idx").on(t.tripId),
]);
```

- [ ] **Step 3: Add relations for `tripEditors` and `tripBlocked`**

In `src/server/db/relations.ts`, add imports and relation definitions:

```ts
// Add to imports:
import {
  // ... existing imports ...
  tripEditors,
  tripBlocked,
} from "./schema";
```

Add after `packingItemsRelations`:

```ts
export const tripEditorsRelations = relations(tripEditors, ({ one }) => ({
  trip: one(trips, { fields: [tripEditors.tripId], references: [trips.id] }),
  user: one(users, { fields: [tripEditors.userId], references: [users.id] }),
}));

export const tripBlockedRelations = relations(tripBlocked, ({ one }) => ({
  trip: one(trips, { fields: [tripBlocked.tripId], references: [trips.id] }),
  user: one(users, { fields: [tripBlocked.userId], references: [users.id] }),
}));
```

Also update `tripsRelations` to include the new tables:

```ts
export const tripsRelations = relations(trips, ({ one, many }) => ({
  group: one(groups, { fields: [trips.groupId], references: [groups.id] }),
  creator: one(users, { fields: [trips.createdBy], references: [users.id] }),
  itineraryItems: many(itineraryItems),
  comments: many(tripComments),
  attachments: many(attachments),
  presence: many(userPresence),
  expenses: many(tripExpenses),
  packingItems: many(packingItems),
  editors: many(tripEditors),
  blocked: many(tripBlocked),
}));
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: No errors related to schema changes.

---

## Task 2: Generate and apply DB migration + seed existing data

**Files:**
- Create: `drizzle/` (auto-generated migration files — never hand-edit)

- [ ] **Step 1: Generate migration**

```bash
pnpm drizzle-kit generate
```

Expected: New migration file created in `drizzle/` directory.

- [ ] **Step 2: Apply migration**

```bash
pnpm drizzle-kit migrate
```

Expected: `is_public`, `share_token` added to trips; `trip_editors` and `trip_blocked` tables created.

- [ ] **Step 3: Seed existing group members as trip editors**

This is a one-time data migration. Run this SQL against the database (replace connection details if needed — check `.env` for `DATABASE_URL`):

```sql
INSERT INTO trip_editors (trip_id, user_id, created_at)
SELECT t.id, gm.user_id, NOW()
FROM trips t
JOIN group_members gm ON gm.group_id = t.group_id
ON CONFLICT DO NOTHING;
```

Run via `psql`:
```bash
psql "$DATABASE_URL" -c "INSERT INTO trip_editors (trip_id, user_id, created_at) SELECT t.id, gm.user_id, NOW() FROM trips t JOIN group_members gm ON gm.group_id = t.group_id ON CONFLICT DO NOTHING;"
```

Expected: All existing group members now have editor access on all existing trips.

---

## Task 3: Query helpers — `trip-access.ts`

**Files:**
- Create: `src/server/db/queries/trip-access.ts`

- [ ] **Step 1: Create the helpers file**

```ts
// src/server/db/queries/trip-access.ts
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { db } from "../index";
import { trips, groupMembers, tripEditors, tripBlocked } from "../schema";

type Db = typeof db;

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
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/db/schema.ts src/server/db/relations.ts src/server/db/queries/trip-access.ts drizzle/
git commit -m "feat(sharing): add trip_editors and trip_blocked schema + query helpers"
```

---

## Task 4: New tRPC middleware

**Files:**
- Modify: `src/server/trpc.ts`

- [ ] **Step 1: Add imports**

At the top of `src/server/trpc.ts`, add to the existing import from `./db/schema`:

```ts
import { groupMembers, tripEditors, tripBlocked } from "./db/schema";
```

(Replace the existing `import { groupMembers }` line.)

- [ ] **Step 2: Add `tripViewerMiddleware` and `tripEditorMiddleware`**

Add after the existing `groupMemberProcedure` export (line 77), before `export { z }`:

```ts
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
  });
  if (!trip) throw new TRPCError({ code: "NOT_FOUND" });

  const membership = await ctx.db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, trip.groupId), eq(groupMembers.userId, ctx.session.user.id)),
  });
  if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

  const blocked = await ctx.db.query.tripBlocked.findFirst({
    where: and(eq(tripBlocked.tripId, parsed.data.tripId), eq(tripBlocked.userId, ctx.session.user.id)),
  });
  if (blocked) throw new TRPCError({ code: "FORBIDDEN" });

  return next({ ctx: { ...ctx, session: ctx.session, trip } });
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
  });
  if (!trip) throw new TRPCError({ code: "NOT_FOUND" });

  const membership = await ctx.db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, trip.groupId), eq(groupMembers.userId, ctx.session.user.id)),
  });
  if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

  const blocked = await ctx.db.query.tripBlocked.findFirst({
    where: and(eq(tripBlocked.tripId, parsed.data.tripId), eq(tripBlocked.userId, ctx.session.user.id)),
  });
  if (blocked) throw new TRPCError({ code: "FORBIDDEN" });

  const editorRow = await ctx.db.query.tripEditors.findFirst({
    where: and(eq(tripEditors.tripId, parsed.data.tripId), eq(tripEditors.userId, ctx.session.user.id)),
  });
  if (!editorRow) throw new TRPCError({ code: "FORBIDDEN", message: "Editor access required" });

  return next({ ctx: { ...ctx, session: ctx.session, trip } });
});

export const tripEditorProcedure = t.procedure.use(tripEditorMiddleware);
```

You also need to add `trips` to the import from `./db/schema`:

```ts
import { groupMembers, tripEditors, tripBlocked, trips } from "./db/schema";
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/trpc.ts
git commit -m "feat(sharing): add tripViewerProcedure and tripEditorProcedure middleware"
```

---

## Task 5: New trip sharing procedures + update `create` and `getById`

**Files:**
- Modify: `src/server/routers/trips.ts`

- [ ] **Step 1: Add imports**

At the top of `src/server/routers/trips.ts`, update imports:

```ts
import { TRPCError } from "@trpc/server";
import { eq, and, desc, lt } from "drizzle-orm";
import { router, protectedProcedure, z } from "../trpc";
import { trips, groupMembers, userPresence, tripEditors, tripBlocked } from "../db/schema";
import {
  assertTripViewer,
  assertTripEditor,
  getTripMemberAccess,
  grantTripEditor,
  revokeTripEditor,
  blockTripMember,
} from "../db/queries/trip-access";
```

- [ ] **Step 2: Update `trips.create` to seed the creator as editor**

Replace the existing `create` procedure body so it inserts the creator into `tripEditors` after creating the trip:

```ts
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
    });

    return trip;
  }),
```

- [ ] **Step 3: Update `trips.getById` to enforce blocked + return `isEditor`**

Replace the `getById` procedure:

```ts
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

    // Resolve editor status for current user
    const editorRow = await ctx.db.query.tripEditors.findFirst({
      where: and(eq(tripEditors.tripId, input.tripId), eq(tripEditors.userId, ctx.session.user.id)),
    });

    return {
      ...trip,
      status: computedStatus(trip.startDate, trip.endDate, trip.status),
      isEditor: !!editorRow,
    };
  }),
```

- [ ] **Step 4: Add 6 new sharing procedures**

Add these inside `tripsRouter` after the existing `leavePresence` procedure:

```ts
  // ── Sharing ─────────────────────────────────────────────────────────────────

  getPublic: protectedProcedure
    .input(z.object({ shareToken: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const trip = await ctx.db.query.trips.findFirst({
        where: and(eq(trips.shareToken, input.shareToken), eq(trips.isPublic, true)),
        with: {
          itineraryItems: { with: { confirmations: { with: { user: true } }, votes: true } },
          group: true,
        },
      });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        ...trip,
        status: computedStatus(trip.startDate, trip.endDate, trip.status),
        // Strip budget from public view
        budgetCents: undefined,
        budgetCurrency: undefined,
      };
    }),

  updateSharing: protectedProcedure
    .input(z.object({ tripId: z.string().uuid(), isPublic: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const trip = await ctx.db.query.trips.findFirst({ where: eq(trips.id, input.tripId) });
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
      const trip = await ctx.db.query.trips.findFirst({ where: eq(trips.id, input.tripId) });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      await assertTripEditor(ctx.db, input.tripId, trip.groupId, ctx.session.user.id);
      // Generate new UUID via DB function — insert a dummy row and use its uuid, or use crypto
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
      const trip = await ctx.db.query.trips.findFirst({ where: eq(trips.id, input.tripId) });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      await assertTripViewer(ctx.db, input.tripId, trip.groupId, ctx.session.user.id);
      return getTripMemberAccess(ctx.db, input.tripId, trip.groupId);
    }),

  grantEditor: protectedProcedure
    .input(z.object({ tripId: z.string().uuid(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const trip = await ctx.db.query.trips.findFirst({ where: eq(trips.id, input.tripId) });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      await assertTripEditor(ctx.db, input.tripId, trip.groupId, ctx.session.user.id);
      await grantTripEditor(ctx.db, input.tripId, input.userId);
      return { ok: true };
    }),

  revokeEditor: protectedProcedure
    .input(z.object({ tripId: z.string().uuid(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const trip = await ctx.db.query.trips.findFirst({ where: eq(trips.id, input.tripId) });
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
      const trip = await ctx.db.query.trips.findFirst({ where: eq(trips.id, input.tripId) });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      if (trip.createdBy === input.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot remove trip creator" });
      }
      await assertTripEditor(ctx.db, input.tripId, trip.groupId, ctx.session.user.id);
      await blockTripMember(ctx.db, input.tripId, input.userId);
      return { ok: true };
    }),
```

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/server/routers/trips.ts
git commit -m "feat(sharing): add sharing procedures and update getById/create"
```

---

## Task 6: Update itinerary router to respect trip-level permissions

**Files:**
- Modify: `src/server/routers/itinerary.ts`

The `assertTripMember` helper currently only checks group membership. Replace all calls with `assertTripEditor` (for mutations) or `assertTripViewer` (for reads) from `trip-access.ts`.

- [ ] **Step 1: Add imports**

At the top of `src/server/routers/itinerary.ts`, add:

```ts
import { assertTripEditor, assertTripViewer } from "../db/queries/trip-access";
```

- [ ] **Step 2: Remove the local `assertTripMember` helper**

Delete the `assertTripMember` function (lines 24-38) entirely. It is replaced by the imported helpers.

- [ ] **Step 3: Update `listByTrip` — viewer check**

Replace:
```ts
await assertTripMember(ctx.db as Parameters<typeof assertTripMember>[0], input.tripId, ctx.session.user.id);
```
With:
```ts
const tripRow = await ctx.db.query.trips.findFirst({ where: eq(trips.id, input.tripId) });
if (!tripRow) throw new TRPCError({ code: "NOT_FOUND" });
await assertTripViewer(ctx.db, input.tripId, tripRow.groupId, ctx.session.user.id);
```

- [ ] **Step 4: Update `create` — editor check**

Replace:
```ts
await assertTripMember(ctx.db as Parameters<typeof assertTripMember>[0], input.tripId, ctx.session.user.id);
```
With:
```ts
const tripRow = await ctx.db.query.trips.findFirst({ where: eq(trips.id, input.tripId) });
if (!tripRow) throw new TRPCError({ code: "NOT_FOUND" });
await assertTripEditor(ctx.db, input.tripId, tripRow.groupId, ctx.session.user.id);
```

- [ ] **Step 5: Update `update` — editor check**

The existing code looks up the item first to get `item.tripId`. After that lookup, replace:
```ts
await assertTripMember(ctx.db as Parameters<typeof assertTripMember>[0], item.tripId, ctx.session.user.id);
```
With:
```ts
const tripRow = await ctx.db.query.trips.findFirst({ where: eq(trips.id, item.tripId) });
if (!tripRow) throw new TRPCError({ code: "NOT_FOUND" });
await assertTripEditor(ctx.db, item.tripId, tripRow.groupId, ctx.session.user.id);
```

- [ ] **Step 6: Update `delete` — editor check**

Same pattern as `update`:
```ts
const tripRow = await ctx.db.query.trips.findFirst({ where: eq(trips.id, item.tripId) });
if (!tripRow) throw new TRPCError({ code: "NOT_FOUND" });
await assertTripEditor(ctx.db, item.tripId, tripRow.groupId, ctx.session.user.id);
```

- [ ] **Step 7: Update `castVote` — viewer check (voting is read-equivalent)**

Replace:
```ts
await assertTripMember(ctx.db as Parameters<typeof assertTripMember>[0], item.tripId, ctx.session.user.id);
```
With:
```ts
const tripRow = await ctx.db.query.trips.findFirst({ where: eq(trips.id, item.tripId) });
if (!tripRow) throw new TRPCError({ code: "NOT_FOUND" });
await assertTripViewer(ctx.db, item.tripId, tripRow.groupId, ctx.session.user.id);
```

- [ ] **Step 8: Remove unused `groupMembers` import if no longer referenced**

Check imports at the top of `itinerary.ts`. If `groupMembers` is no longer used, remove it from the import.

- [ ] **Step 9: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: No errors.

- [ ] **Step 10: Commit**

```bash
git add src/server/routers/itinerary.ts
git commit -m "feat(sharing): enforce editor/viewer checks in itinerary router"
```

---

## Task 7: Public view route — `/trips/share/[token]`

**Files:**
- Create: `src/app/trips/share/[token]/page.tsx`
- Create: `src/app/trips/share/[token]/_components/PublicTripView.tsx`

> This route lives outside the `(app)` route group — the middleware at `src/middleware.ts` only protects `(app)/*` routes, so no auth is enforced here.

- [ ] **Step 1: Create the RSC page**

```tsx
// src/app/trips/share/[token]/page.tsx
import { notFound } from "next/navigation";
import { createCaller } from "@/lib/trpc/server";
import { PublicTripView } from "./_components/PublicTripView";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function PublicTripPage({ params }: Props) {
  const { token } = await params;

  const api = await createCaller();
  let trip;
  try {
    trip = await api.trips.getPublic({ shareToken: token });
  } catch {
    notFound();
  }

  return <PublicTripView trip={trip} />;
}
```

- [ ] **Step 2: Create `PublicTripView` client component**

```tsx
// src/app/trips/share/[token]/_components/PublicTripView.tsx
"use client";

import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";

type PublicTrip = inferRouterOutputs<AppRouter>["trips"]["getPublic"];

export function PublicTripView({ trip }: { trip: PublicTrip }) {
  const [tab, setTab] = useState<"itinerary" | "map">("itinerary");

  const ITEM_ICONS: Record<string, string> = {
    flight: "✈️",
    hotel: "🏨",
    activity: "🎯",
    restaurant: "🍽️",
    transport: "🚗",
    note: "📝",
  };

  const itemsByDay = trip.itineraryItems.reduce<Record<string, typeof trip.itineraryItems>>((acc, item) => {
    const day = item.startTime
      ? new Date(item.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "Unscheduled";
    if (!acc[day]) acc[day] = [];
    acc[day]!.push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col max-w-lg mx-auto">
      {/* Read-only banner */}
      <div className="bg-[#FEF3C7] border-b border-[#FDE68A] px-4 py-2 flex items-center gap-2 text-[11px] font-semibold text-[#92400E] sticky top-0 z-10">
        <span>👁️</span>
        <span>View only — shared trip</span>
        <a
          href="/login"
          className="ml-auto px-3 py-1 bg-[#E8622A] text-white text-[11px] font-bold rounded-lg"
        >
          Sign in to edit
        </a>
      </div>

      {/* Trip header */}
      <div className="bg-gradient-to-br from-[#1a3a4a] via-[#2d6a8f] to-[#3d9970] px-5 py-6 text-white">
        <h1 className="text-[20px] font-bold">{trip.name}</h1>
        {trip.destination && (
          <p className="text-[12px] text-white/75 mt-1">📍 {trip.destination}</p>
        )}
        {trip.startDate && trip.endDate && (
          <p className="text-[12px] text-white/75 mt-0.5">
            {trip.startDate} – {trip.endDate}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-[#E5E0DA] sticky top-[37px] z-10">
        {(["itinerary", "map"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-[13px] font-semibold capitalize transition-colors ${
              tab === t
                ? "text-[#E8622A] border-b-2 border-[#E8622A]"
                : "text-[#A09B96]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {tab === "itinerary" && (
          <div className="flex flex-col gap-2">
            {Object.entries(itemsByDay).map(([day, items]) => (
              <div key={day}>
                <p className="text-[11px] font-bold text-[#E8622A] uppercase tracking-wide mb-2 mt-2">
                  {day}
                </p>
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 bg-white border border-[#E5E0DA] rounded-[14px] mb-2"
                  >
                    <span className="text-xl flex-shrink-0 mt-0.5">
                      {ITEM_ICONS[item.type] ?? "📌"}
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-[#1A1512]">{item.title}</p>
                      {item.startTime && (
                        <p className="text-[11px] text-[#A09B96] mt-0.5">
                          {new Date(item.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                      {item.description && (
                        <p className="text-[12px] text-[#6B6560] mt-1">{item.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {trip.itineraryItems.length === 0 && (
              <p className="text-[13px] text-[#A09B96] text-center py-12">No items yet.</p>
            )}
          </div>
        )}
        {tab === "map" && (
          <p className="text-[13px] text-[#A09B96] text-center py-12">
            Map view available in the app.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: No type errors. If `inferRouterOutputs` for `getPublic` has an issue with `budgetCents: undefined`, add `| undefined` to the type or cast — check actual error and fix accordingly.

- [ ] **Step 4: Manual test**

Start dev server (`pnpm dev`). In the database, set `is_public = true` for a trip, then visit `http://localhost:3000/trips/share/<shareToken>` in an incognito window. Verify:
- Amber banner visible
- Itinerary items listed
- No edit buttons anywhere

- [ ] **Step 5: Commit**

```bash
git add src/app/trips/share/
git commit -m "feat(sharing): add public view route /trips/share/[token]"
```

---

## Task 8: `MemberAccessSheet` component

**Files:**
- Create: `src/app/(app)/trips/[tripId]/_components/MemberAccessSheet.tsx`

This is the action sheet that opens when `···` is tapped on a member row inside `ShareSheet`. It lets editors change a member's role or remove them.

- [ ] **Step 1: Create the component**

```tsx
// src/app/(app)/trips/[tripId]/_components/MemberAccessSheet.tsx
"use client";

import { BottomSheet, BottomSheetTitle } from "@/components/ui/bottom-sheet";
import { api } from "@/lib/trpc/client";
import { toast } from "sonner";

type Member = {
  userId: string;
  name: string;
  isEditor: boolean;
  isCreator: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  member: Member | null;
  onSuccess: () => void;
};

export function MemberAccessSheet({ open, onOpenChange, tripId, member, onSuccess }: Props) {
  const utils = api.useUtils();

  const grantEditor = api.trips.grantEditor.useMutation({
    onSuccess: () => {
      void utils.trips.getMemberAccess.invalidate({ tripId });
      onSuccess();
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to update access"),
  });

  const revokeEditor = api.trips.revokeEditor.useMutation({
    onSuccess: () => {
      void utils.trips.getMemberAccess.invalidate({ tripId });
      onSuccess();
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to update access"),
  });

  const removeFromTrip = api.trips.removeFromTrip.useMutation({
    onSuccess: () => {
      void utils.trips.getMemberAccess.invalidate({ tripId });
      onSuccess();
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to remove member"),
  });

  if (!member) return null;

  const isPending = grantEditor.isPending || revokeEditor.isPending || removeFromTrip.isPending;

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetTitle>{member.name}</BottomSheetTitle>
      <p className="text-[12px] text-[#A09B96] px-5 pb-3">Trip access</p>

      <div className="h-px bg-[#F0EDE8] mx-5" />

      {/* Editor option */}
      <button
        disabled={isPending}
        onClick={() => {
          if (!member.isEditor) {
            grantEditor.mutate({ tripId, userId: member.userId });
          }
        }}
        className="w-full flex items-center justify-between px-5 py-4 disabled:opacity-50"
      >
        <div className="text-left">
          <p className="text-[15px] font-semibold text-[#1A1512]">Editor</p>
          <p className="text-[12px] text-[#A09B96] mt-0.5">Can add, edit and delete items</p>
        </div>
        {member.isEditor && (
          <span className="text-[16px] font-bold text-[#E8622A]">✓</span>
        )}
      </button>

      <div className="h-px bg-[#F0EDE8] mx-5" />

      {/* Viewer option */}
      <button
        disabled={isPending}
        onClick={() => {
          if (member.isEditor) {
            revokeEditor.mutate({ tripId, userId: member.userId });
          }
        }}
        className="w-full flex items-center justify-between px-5 py-4 disabled:opacity-50"
      >
        <div className="text-left">
          <p className="text-[15px] font-semibold text-[#1A1512]">Viewer</p>
          <p className="text-[12px] text-[#A09B96] mt-0.5">Can view itinerary and map only</p>
        </div>
        {!member.isEditor && (
          <span className="text-[16px] font-bold text-[#E8622A]">✓</span>
        )}
      </button>

      {/* Thick divider before destructive action */}
      <div className="h-1.5 bg-[#F0EDE8] mx-5 rounded-full my-1" />

      {/* Remove from trip */}
      <button
        disabled={isPending}
        onClick={() => {
          removeFromTrip.mutate({ tripId, userId: member.userId });
        }}
        className="w-full flex items-center px-5 py-4 disabled:opacity-50"
      >
        <p className="text-[15px] font-semibold text-[#E84040]">Remove from trip</p>
      </button>

      <div className="h-px bg-[#F0EDE8] mx-5" />
    </BottomSheet>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: No errors.

---

## Task 9: `ShareSheet` component

**Files:**
- Create: `src/app/(app)/trips/[tripId]/_components/ShareSheet.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/app/(app)/trips/[tripId]/_components/ShareSheet.tsx
"use client";

import { useState, useCallback } from "react";
import { BottomSheet, BottomSheetTitle } from "@/components/ui/bottom-sheet";
import { api } from "@/lib/trpc/client";
import { toast } from "sonner";
import { MemberAccessSheet } from "./MemberAccessSheet";

type Member = {
  userId: string;
  name: string;
  image: string | null;
  isEditor: boolean;
  isBlocked: boolean;
  isCreator: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  isPublic: boolean;
  shareToken: string;
  currentUserId: string;
};

const AVATAR_COLORS = [
  "bg-[#E8622A]",
  "bg-[#2D6A8F]",
  "bg-[#3D9970]",
  "bg-[#A78BFA]",
  "bg-[#F2A93B]",
];

export function ShareSheet({ open, onOpenChange, tripId, isPublic, shareToken, currentUserId }: Props) {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberSheetOpen, setMemberSheetOpen] = useState(false);

  const utils = api.useUtils();

  const { data: members, refetch: refetchMembers } = api.trips.getMemberAccess.useQuery(
    { tripId },
    { enabled: open },
  );

  const updateSharing = api.trips.updateSharing.useMutation({
    onSuccess: () => void utils.trips.getById.invalidate({ tripId }),
    onError: () => toast.error("Failed to update sharing"),
  });

  const regenerateToken = api.trips.regenerateToken.useMutation({
    onSuccess: () => {
      void utils.trips.getById.invalidate({ tripId });
      toast.success("Share link reset");
    },
    onError: () => toast.error("Failed to reset link"),
  });

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/trips/share/${shareToken}`
    : `/trips/share/${shareToken}`;

  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied");
  }, [shareUrl]);

  const handleResetLink = () => {
    if (confirm("Reset the share link? The old link will stop working.")) {
      regenerateToken.mutate({ tripId });
    }
  };

  const visibleMembers = (members ?? []).filter((m) => !m.isBlocked);

  return (
    <>
      <BottomSheet open={open} onOpenChange={onOpenChange}>
        <BottomSheetTitle>Share trip</BottomSheetTitle>

        {/* Public link section */}
        <div className="px-5">
          <p className="text-[11px] font-semibold text-[#A09B96] uppercase tracking-wide mb-2 mt-1">
            Public link
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-between px-3.5 py-3 bg-[#FAF8F5] border border-[#E5E0DA] rounded-[14px]">
            <div>
              <p className="text-[14px] font-semibold text-[#1A1512]">Anyone with link can view</p>
              <p className="text-[11px] text-[#A09B96] mt-0.5">No sign-in required · Read only</p>
            </div>
            <button
              onClick={() => updateSharing.mutate({ tripId, isPublic: !isPublic })}
              disabled={updateSharing.isPending}
              className={`w-11 h-[26px] rounded-full relative transition-colors flex-shrink-0 disabled:opacity-50 ${
                isPublic ? "bg-[#E8622A]" : "bg-[#E5E0DA]"
              }`}
            >
              <span
                className={`absolute top-[3px] w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  isPublic ? "translate-x-[22px]" : "translate-x-[3px]"
                }`}
              />
            </button>
          </div>

          {/* Link row — show only when public */}
          {isPublic && (
            <div className="flex gap-2 mt-2 items-center">
              <div className="flex-1 px-3 py-2.5 bg-[#F0EDE8] rounded-[10px] text-[11px] text-[#6B6560] overflow-hidden text-ellipsis whitespace-nowrap">
                {shareUrl}
              </div>
              <button
                onClick={copyLink}
                className="px-3.5 py-2.5 bg-[#E8622A] text-white text-[12px] font-bold rounded-[12px] shadow-[0_2px_8px_rgba(232,98,42,0.30)] whitespace-nowrap"
              >
                Copy
              </button>
              <button
                onClick={handleResetLink}
                disabled={regenerateToken.isPending}
                className="px-3 py-2.5 border border-[#E5E0DA] text-[#6B6560] text-[12px] font-semibold rounded-[12px] whitespace-nowrap disabled:opacity-50"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Members section label */}
        <div className="px-5 mt-4">
          <p className="text-[11px] font-semibold text-[#A09B96] uppercase tracking-wide mb-2">
            Group members
          </p>
        </div>

        {/* Scrollable members list */}
        <div className="overflow-y-auto px-5 pb-8" style={{ maxHeight: "40vh" }}>
          {visibleMembers.map((member, idx) => {
            const isCurrentUser = member.userId === currentUserId;
            const isCreator = member.isCreator;
            const colorClass = AVATAR_COLORS[idx % AVATAR_COLORS.length]!;

            return (
              <div
                key={member.userId}
                className="flex items-center py-2.5 border-b border-[#F0EDE8] last:border-b-0"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0 ${colorClass}`}
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div className="ml-2.5 flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#1A1512]">
                    {member.name}
                    {isCurrentUser && (
                      <span className="text-[#A09B96] font-normal ml-1">(you)</span>
                    )}
                  </p>
                  {isCreator && (
                    <p className="text-[11px] text-[#A09B96]">Trip creator</p>
                  )}
                </div>
                <span
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-md flex-shrink-0 ${
                    member.isEditor
                      ? "bg-[rgba(232,98,42,0.10)] text-[#E8622A]"
                      : "bg-[#F0EDE8] text-[#6B6560]"
                  }`}
                >
                  {member.isEditor ? "Editor" : "Viewer"}
                </span>
                {/* Show ··· only for non-creator other members */}
                {!isCreator && !isCurrentUser && (
                  <button
                    onClick={() => {
                      setSelectedMember(member);
                      setMemberSheetOpen(true);
                    }}
                    className="ml-1 w-7 h-7 flex items-center justify-center rounded-full text-[#A09B96] hover:bg-[#F0EDE8] transition-colors flex-shrink-0 text-[16px] tracking-tighter"
                  >
                    ···
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </BottomSheet>

      {/* Stacked member action sheet */}
      <MemberAccessSheet
        open={memberSheetOpen}
        onOpenChange={setMemberSheetOpen}
        tripId={tripId}
        member={selectedMember}
        onSuccess={() => void refetchMembers()}
      />
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: No errors.

---

## Task 10: Wire up share button in `TripDetailClient`

**Files:**
- Modify: `src/app/(app)/trips/[tripId]/_components/TripDetailClient.tsx`

- [ ] **Step 1: Add import for `ShareSheet`**

At the top of `TripDetailClient.tsx`, add:

```ts
import { ShareSheet } from "./ShareSheet";
```

- [ ] **Step 2: Add share sheet state**

Inside the `TripDetailClient` function body, after the existing `useState` declarations:

```ts
const [shareOpen, setShareOpen] = useState(false);
```

- [ ] **Step 3: Add share button to the trip header**

Find the section in `TripDetailClient` that renders the trip header (look for `AvatarStack` and the gradient header div). Add a share button alongside the existing header controls.

Look for where the back button or header action buttons are rendered (likely a `flex items-center justify-between` row at the top of the gradient header). Add next to existing buttons:

```tsx
{trip.isEditor && (
  <button
    onClick={() => setShareOpen(true)}
    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white"
    aria-label="Share trip"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  </button>
)}
```

- [ ] **Step 4: Render `ShareSheet` at the bottom of the component return**

Before the closing `</div>` of the component's root element, add:

```tsx
{trip.isEditor && (
  <ShareSheet
    open={shareOpen}
    onOpenChange={setShareOpen}
    tripId={tripId}
    isPublic={trip.isPublic}
    shareToken={trip.shareToken}
    currentUserId={userId}
  />
)}
```

- [ ] **Step 5: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: No errors. If TypeScript complains that `trip.isEditor`, `trip.isPublic`, or `trip.shareToken` don't exist on the type, ensure the `getById` router change from Task 5 is complete and the type is inferred correctly via `inferRouterOutputs`.

- [ ] **Step 6: Manual end-to-end test**

With `pnpm dev` running:

1. **Share button visible for editors:** Open a trip as the creator → share icon visible in header
2. **Share button hidden for viewers:** Manually remove your editor row from `trip_editors` and reload → no share button
3. **Toggle public link:** Tap share → toggle ON → copy link → paste in incognito → see public view
4. **Toggle OFF:** Toggle back OFF → incognito URL returns 404
5. **Reset link:** Toggle ON → Reset → confirm → old URL 404s, new URL works
6. **Change member role:** Tap `···` on a member → change Editor ↔ Viewer → re-open sheet → confirm badge changed
7. **Remove from trip:** Tap `···` → Remove from trip → member disappears from list

- [ ] **Step 7: Commit**

```bash
git add src/app/(app)/trips/[tripId]/_components/TripDetailClient.tsx src/app/(app)/trips/[tripId]/_components/ShareSheet.tsx src/app/(app)/trips/[tripId]/_components/MemberAccessSheet.tsx src/app/trips/share/
git commit -m "feat(sharing): wire up share button, ShareSheet, and MemberAccessSheet"
```

---

## Task 11: Final lint + typecheck pass

- [ ] **Step 1: Run full checks**

```bash
pnpm lint && pnpm typecheck
```

Expected: Zero errors, zero warnings.

- [ ] **Step 2: Commit if any lint fixes were made**

```bash
git add -A
git commit -m "chore: fix lint warnings from trip sharing feature"
```

---

## Verification Checklist

| # | Test | Expected |
|---|---|---|
| 1 | Visit `/trips/share/<token>` in incognito with `is_public=true` | Full itinerary + map tabs, amber banner |
| 2 | Same URL with `is_public=false` | 404 page |
| 3 | Reset link → visit old URL | 404 |
| 4 | Viewer session calls `itinerary.create` via tRPC | `FORBIDDEN` |
| 5 | Grant editor → member can add items | Success |
| 6 | Remove from trip → member call to `trips.getById` | `FORBIDDEN` |
| 7 | Try to remove creator via API | `FORBIDDEN` |
| 8 | New member joins group → no `trip_editors` row | Member shows as Viewer in ShareSheet |
| 9 | Existing trips after seed migration | All members show as Editor |
| 10 | `pnpm lint && pnpm typecheck` | Zero errors |
