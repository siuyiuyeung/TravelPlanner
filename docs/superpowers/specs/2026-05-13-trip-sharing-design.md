# Trip Sharing Design

**Date:** 2026-05-13  
**Status:** Approved

---

## Context

Trips are currently only accessible to group members. There is no way to share a trip with outsiders or control which group members can edit vs. view. This feature adds two capabilities:

1. **Public link sharing** — trip owner toggles a public link; anyone with the URL can view the full trip (itinerary + map) without logging in.
2. **Per-trip member permissions** — each group member has an `editor` or `viewer` role per trip. New members default to viewer; any existing editor can promote/demote others or remove them from the trip.

---

## Data Model

### `trips` table — 2 new columns

| Column | Type | Default | Notes |
|---|---|---|---|
| `is_public` | `boolean` | `false` | Public link active |
| `share_token` | `text` (unique) | UUID generated on create | URL-safe token; stays stable across on/off toggles; regenerated only on explicit "Reset link" |

### New `trip_editors` table

| Column | Type | Notes |
|---|---|---|
| `trip_id` | `uuid` FK → `trips` (cascade delete) | |
| `user_id` | `text` FK → `users` (cascade delete) | |
| `created_at` | `timestamp` | |

- **Primary key:** `(trip_id, user_id)`
- **Semantics:** presence of a row = editor access.

### New `trip_blocked` table

| Column | Type | Notes |
|---|---|---|
| `trip_id` | `uuid` FK → `trips` (cascade delete) | |
| `user_id` | `text` FK → `users` (cascade delete) | |
| `created_at` | `timestamp` | |

- **Primary key:** `(trip_id, user_id)`
- **Semantics:** presence of a row = group member is explicitly blocked from this trip (no view, no edit). Required to support "Remove from trip" — without it, group members always retain viewer access.

### Access check order (evaluated top-to-bottom, first match wins)

1. In `trip_blocked` → ❌ no access (even if group member)
2. In `trip_editors` + group member → ✅ editor
3. Group member (no row in either table) → ✅ viewer
4. Anonymous + valid `share_token` + `is_public = true` → ✅ view-only
5. Otherwise → ❌ no access

### Access matrix

| Who | Can view | Can edit |
|---|---|---|
| Anonymous + valid `share_token` + `is_public = true` | ✅ | ❌ |
| Group member, no rows in either table | ✅ (viewer) | ❌ |
| Group member + `trip_editors` row | ✅ | ✅ |
| Group member + `trip_blocked` row | ❌ | ❌ |
| Non-member, not public | ❌ | ❌ |

### Migration for existing data

1. Add `is_public` (default `false`) and `share_token` (generated UUID) to all existing `trips` rows.
2. Create `trip_editors` table.
3. Seed `trip_editors`: for each existing trip, insert all current group members as editors (they had edit access before this feature shipped — preserve that).

---

## API / tRPC

### New procedures

```
trips.getPublic
  — publicProcedure (no auth)
  — input: { shareToken: string }
  — validates: trip exists, is_public = true; else NOT_FOUND
  — returns: same shape as trips.getById, minus budget fields
  — used by: /trips/share/[token] page

trips.updateSharing
  — tripEditorProcedure
  — input: { tripId, isPublic: boolean }
  — toggles is_public flag

trips.regenerateToken
  — tripEditorProcedure
  — input: { tripId }
  — generates new share_token (old link permanently revoked)

trips.grantEditor
  — tripEditorProcedure
  — input: { tripId, userId }
  — inserts trip_editors row (idempotent)

trips.revokeEditor
  — tripEditorProcedure
  — input: { tripId, userId }
  — deletes trip_editors row; cannot target trip creator

trips.removeFromTrip
  — tripEditorProcedure
  — input: { tripId, userId }
  — inserts trip_blocked row + deletes trip_editors row; cannot target trip creator
  — effect: member can no longer view or edit this trip (stays in group)

trips.getMemberAccess
  — protectedProcedure + group member check
  — input: { tripId }
  — returns: all group members with editor: boolean per member
```

### New middleware

**`tripEditorMiddleware`** — for all trip mutation procedures:
```ts
// Checks: user is group member AND has a trip_editors row AND not in trip_blocked
// Throws: FORBIDDEN if any check fails
```

**`tripViewerMiddleware`** — for all trip read procedures:
```ts
// Checks: user is group member AND not in trip_blocked
// Throws: FORBIDDEN if blocked or not a member
```

Existing read procedures switch from plain group-member check → `tripViewerMiddleware` to respect the blocked state.

### Modified procedures

All existing trip mutation procedures switch from group-membership check → `tripEditorProcedure`:
- `trips.update`, `trips.delete`
- `itinerary.createItem`, `itinerary.updateItem`, `itinerary.deleteItem`
- Any other mutation that currently accepts a `tripId` and writes data

---

## Routes

### `/trips/share/[token]` (new, public)

- **Auth:** none required
- **Data:** calls `trips.getPublic` server-side via RSC
- **UI:** full itinerary + map tabs, read-only
- **Banner:** amber read-only bar at top with "Sign in to edit" CTA
- **404:** if token invalid or `is_public = false`

---

## UI

### Share button entry point

Add a share icon button to the trip header (existing `TripDetailClient.tsx`). Tapping opens the Share bottom sheet.

### Share bottom sheet (Vaul)

**Static section (doesn't scroll):**
- Title: "Share trip"
- **Public link** section:
  - Toggle row: "Anyone with link can view" / "No sign-in required · Read only"
  - When ON: link input (read-only, truncated) + Copy button + Reset button
  - Reset generates a new token after confirmation

**Scrollable section:**
- Section label: "Group members"
- Creator row: avatar + name + static "Editor" badge (no `···`)
- Other member rows: avatar + name + role badge (Editor/Viewer) + `···` button

### `···` action sheet (Vaul, stacked over share sheet)

Opens when `···` tapped on a member:
- Title: member name / subtitle: "Trip access"
- **Editor** option (checkmark if current role) — "Can add, edit and delete items"
- **Viewer** option — "Can view itinerary and map only"
- Thick divider
- **Remove from trip** (red destructive) — inserts into `trip_blocked`, deletes from `trip_editors`; member stays in the group but can no longer view or edit this trip; not shown for trip creator

### Public view page `/trips/share/[token]`

- Amber banner: "👁 View only — shared trip" + "Sign in to edit" CTA (links to login with redirect back)
- Trip header (gradient, name, destination, dates)
- Itinerary tab + Map tab (same components, all interactive elements hidden/disabled)
- No add/edit/delete buttons rendered

---

## Error handling

| Scenario | Behaviour |
|---|---|
| Public link accessed with `is_public = false` | 404 page |
| Token not found | 404 page |
| Viewer tries to mutate (direct API call) | `FORBIDDEN` from `tripEditorMiddleware` |
| Editor tries to revoke/remove creator | `FORBIDDEN` — creator is always an editor and cannot be blocked |
| Editor removes themselves | Allowed (they demote to viewer); creator cannot remove themselves |

---

## Files to create / modify

### New files
- `src/server/db/queries/trip-access.ts` — query helpers: `isTripEditor`, `isTripBlocked`, `getTripMembers`, `insertTripEditor`, `deleteTripEditor`, `insertTripBlocked`, `deleteTripBlocked`
- `src/app/(app)/trips/share/[token]/page.tsx` — public view RSC
- `src/app/(app)/trips/share/[token]/_components/PublicTripView.tsx` — read-only trip UI
- `src/app/(app)/trips/[tripId]/_components/ShareSheet.tsx` — Vaul share bottom sheet
- `src/app/(app)/trips/[tripId]/_components/MemberAccessSheet.tsx` — `···` action sheet

### Modified files
- `src/server/db/schema.ts` — add `isPublic`, `shareToken` to `trips`; add `tripEditors` and `tripBlocked` tables
- `src/server/trpc.ts` — add `tripEditorMiddleware`, `tripViewerMiddleware`, `tripEditorProcedure`, `tripViewerProcedure`
- `src/server/routers/trips.ts` — add 6 new procedures; switch mutations to `tripEditorProcedure`, reads to `tripViewerProcedure`
- `src/server/routers/itinerary.ts` — switch all mutations to `tripEditorProcedure`
- `src/app/(app)/trips/[tripId]/_components/TripDetailClient.tsx` — add share button to header
- `drizzle/` — new migration (generated, not hand-edited)

---

## Verification

1. **Public link on:** visit `/trips/share/[token]` in incognito → see full itinerary + map, amber banner visible
2. **Public link off:** same URL returns 404
3. **Reset link:** old token 404s, new token works
4. **Viewer cannot edit:** API call to `itinerary.createItem` with viewer session → `FORBIDDEN`
5. **Editor promotion:** grant Alice editor → she can now add items
6. **Remove from trip:** remove Bob → `trip_blocked` row inserted → Bob's session gets `FORBIDDEN` on view and edit attempts for that trip
7. **Creator protection:** attempt to revoke creator via API → `FORBIDDEN`
8. **New member default:** join group → no `trip_editors` row → viewer on all trips
9. **Migration:** existing members retain editor access post-migration
10. Run `pnpm lint` and `pnpm typecheck` — no errors
