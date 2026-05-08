# Unschedule Plan Item Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to clear the date/time on a plan item in `EditItemForm`, saving it as unscheduled (null `startTime` in the database).

**Architecture:** Two-file change. Server: extend the `update` tRPC input schema so `startTime`/`endTime` accept `null` (`.nullish()`) in addition to ISO strings. Client: add an "Unschedule" button that clears both date and time state, and fix `handleSubmit` to always send `startTime` (null when date is empty, ISO string when set).

**Tech Stack:** Next.js 15, TypeScript, tRPC v11, Zod, Drizzle ORM

---

## File Map

| File | Change |
|------|--------|
| `src/server/routers/itinerary.ts` | Extend `update` input — override `startTime`/`endTime` to `.nullish()` |
| `src/app/(app)/trips/[tripId]/_components/EditItemForm.tsx` | Add "Unschedule" button; fix `handleSubmit` to send `null` when date is empty |

---

### Task 1: Extend `update` schema to accept null startTime/endTime

**Files:**
- Modify: `src/server/routers/itinerary.ts:72`

- [ ] **Step 1: Read the file**

Read `src/server/routers/itinerary.ts` to confirm current state before editing.

- [ ] **Step 2: Replace the update procedure's `.input(...)` call**

Find this block (lines ~71–72):

```ts
  update: protectedProcedure
    .input(createItemSchema.partial().extend({ itemId: z.string().uuid() }))
```

Replace with:

```ts
  update: protectedProcedure
    .input(
      createItemSchema.partial().extend({
        itemId: z.string().uuid(),
        startTime: z.string().datetime().nullish(),
        endTime: z.string().datetime().nullish(),
      })
    )
```

No changes to the mutation body — the existing logic already handles `null` correctly:
```ts
...(startTime !== undefined && { startTime: startTime ? new Date(startTime) : null })
```
When `startTime` is `null`: spreads `{ startTime: null }` → clears the DB column.

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/itinerary.ts
git commit -m "feat(itinerary): allow null startTime/endTime in update schema"
```

---

### Task 2: Add "Unschedule" button and fix handleSubmit

**Files:**
- Modify: `src/app/(app)/trips/[tripId]/_components/EditItemForm.tsx`

- [ ] **Step 1: Read the file**

Read `src/app/(app)/trips/[tripId]/_components/EditItemForm.tsx` to confirm current state before editing.

- [ ] **Step 2: Replace the date/time grid section**

Find this block (lines ~186–205):

```tsx
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-[#6B6560] mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-3 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[16px] text-[#1A1512] focus:outline-none focus:border-[#E8622A]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#6B6560] mb-1">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-3 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[16px] text-[#1A1512] focus:outline-none focus:border-[#E8622A]"
            />
          </div>
        </div>
```

Replace with:

```tsx
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-[#6B6560]">Date & Time</label>
            {date && (
              <button
                type="button"
                onClick={() => { setDate(""); setTime(""); }}
                className="text-[11px] font-semibold text-[#A09B96]"
              >
                Unschedule ×
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-3 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[16px] text-[#1A1512] focus:outline-none focus:border-[#E8622A]"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-3 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[16px] text-[#1A1512] focus:outline-none focus:border-[#E8622A]"
            />
          </div>
        </div>
```

- [ ] **Step 3: Replace handleSubmit's startTime logic**

Find this block inside `handleSubmit` (lines ~118–134):

```ts
    let startTime: string | undefined;
    if (date) {
      startTime = time
        ? new Date(`${date}T${time}:00`).toISOString()
        : new Date(`${date}T00:00:00`).toISOString();
    }

    updateItem.mutate({
      itemId: item.id,
      type,
      title: title.trim(),
      startTime,
      locationName: location.trim() || undefined,
      locationLat,
      locationLng,
      description: description.trim() || undefined,
    });
```

Replace with:

```ts
    const startTime = date
      ? (time
          ? new Date(`${date}T${time}:00`).toISOString()
          : new Date(`${date}T00:00:00`).toISOString())
      : null;

    updateItem.mutate({
      itemId: item.id,
      type,
      title: title.trim(),
      startTime,
      locationName: location.trim() || undefined,
      locationLat,
      locationLng,
      description: description.trim() || undefined,
    });
```

- [ ] **Step 4: Run typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: no errors or lint warnings.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/trips/[tripId]/_components/EditItemForm.tsx
git commit -m "feat(itinerary): add unschedule button to edit item form"
```
