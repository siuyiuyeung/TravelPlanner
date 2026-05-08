# Unschedule Plan Item Design

**Date:** 2026-05-08  
**Scope:** `EditItemForm` — allow clearing date/time to unschedule a plan item

---

## Problem

Clearing the date input in `EditItemForm` leaves `date = ""`, but `handleSubmit` only builds `startTime` when `date` is truthy. The server skips the update when `startTime` is `undefined`. Result: clearing the date field and saving does not actually unschedule the item.

Additionally, `z.string().datetime().optional()` in the `update` schema cannot accept `null`, so there is no way to signal "clear this field" from the client.

---

## Solution

Two-part fix: a schema change on the server, and a UI + submit-logic change on the client.

### Server (`src/server/routers/itinerary.ts`)

Change the `update` input to override `startTime` and `endTime` from `.optional()` to `.nullish()`:

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

The existing server logic already handles `null` correctly:
```ts
...(startTime !== undefined && { startTime: startTime ? new Date(startTime) : null })
```

- `startTime: null` → spreads `{ startTime: null }` → clears the column  
- `startTime: undefined` → skipped (no change)  
- `startTime: "ISO string"` → sets the date

No other server changes required.

### Client (`src/app/(app)/trips/[tripId]/_components/EditItemForm.tsx`)

**UI change:** Replace the current separate `Date` / `Time` labels with a single row header that shows "Date & Time" on the left and an "Unschedule" text button on the right. The button is only rendered when `date` is non-empty.

```
[ Date & Time          Unschedule × ]
[ date input ] [ time input          ]
```

Clicking "Unschedule" sets both `date` and `time` state to `""`.

**Submit logic change:** Always send `startTime` — never omit it from the mutation payload. Build it as:

```ts
const startTime = date
  ? (time
      ? new Date(`${date}T${time}:00`).toISOString()
      : new Date(`${date}T00:00:00`).toISOString())
  : null;  // null = explicitly unschedule
```

Pass `startTime` (ISO string or `null`) directly to `updateItem.mutate`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/server/routers/itinerary.ts` | Extend `update` input — `startTime`/`endTime` accept `null` via `.nullish()` |
| `src/app/(app)/trips/[tripId]/_components/EditItemForm.tsx` | Add "Unschedule" button; fix `handleSubmit` to send `null` when date is empty |

---

## Edge Cases

- **Time without date:** Not possible — "Unschedule" clears both. The date input itself is still independently editable, but submitting with `date = ""` always sends `null` regardless of time value.
- **Item never had a date:** Sending `startTime: null` on save is idempotent (sets null → was already null).
- **`endTime`:** The form doesn't expose an end-time field yet, so no UI change needed. The schema fix covers it for future use.
