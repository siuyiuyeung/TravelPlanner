# Design: Edit Plan Item from Map Page

**Date:** 2026-05-08  
**Status:** Approved

## Context

The Map page shows itinerary item markers as pins. Tapping a pin opens a popup with the item name and a "View details" button. There is no way to edit an item directly from the map — users must switch to the Plan tab, find the item, and tap the `···` button there. This design adds the same `···` button to the map item popup so users can edit without leaving the map.

## Goal

Add a `···` button to item marker popups in `MapViewInner.tsx` that opens `EditItemForm` in a `BottomSheet` — identical behavior to the Plan tab.

## Architecture

**3 file changes:** `TripDetailClient.tsx`, `MapView.tsx`, `MapViewInner.tsx`

`MapViewInner` currently has no `tripId` or `userId` props — both are required by `EditItemForm`. Also `MapItem` is missing `endTime` and `description` fields that `EditItemForm` needs. These thread through the existing prop chain.

### MapItem type extension (`MapViewInner.tsx`)

Add two missing fields so the type satisfies `EditItemForm`'s `ItineraryItem`:

```ts
type MapItem = {
  id: string;
  title: string;
  type: string;
  locationName: string | null;
  locationLat: string | null;
  locationLng: string | null;
  startTime: Date | string | null;
  endTime: Date | string | null;      // add
  description: string | null;         // add
};
```

Runtime data from `trips.getById` already includes these fields — no backend change needed.

### Props additions

**`MapViewInner.tsx` Props:**
```ts
type Props = {
  // existing...
  tripId: string;   // add
  userId: string;   // add
};
```

**`MapView.tsx` Props:** same two fields added and passed through to `MapViewInner`.

**`TripDetailClient.tsx`:** Pass `tripId={tripId}` and `userId={userId}` to `<MapView>`.

### State additions (`MapViewInner.tsx`)

```ts
const [editItem, setEditItem] = useState<MapItem | null>(null);
const utils = api.useUtils();   // for cache invalidation on save
```

### UI changes

In the item marker popup (existing Leaflet popup per marker):
- Add `···` button alongside existing "View details" button
- `onClick`: `e.stopPropagation(); setEditItem(item)`
- Button style: matches Plan tab (`w-7 h-7`, rounded, `text-[#A09B96]`, hover state)

### BottomSheet + EditItemForm

Add at bottom of `MapViewInner` return (alongside existing geocode picker BottomSheet):

```tsx
<BottomSheet open={editItem !== null} onOpenChange={(open) => { if (!open) setEditItem(null); }}>
  <BottomSheetTitle>Edit Item</BottomSheetTitle>
  {editItem && (
    <EditItemForm
      item={editItem}
      tripId={tripId}
      userId={userId}
      onSuccess={() => {
        setEditItem(null);
        utils.trips.getById.invalidate({ tripId });
      }}
      onDelete={() => setEditItem(null)}
    />
  )}
</BottomSheet>
```

## Files Changed

| File | Change |
|------|--------|
| `src/app/(app)/trips/[tripId]/_components/MapViewInner.tsx` | Extend `MapItem` type; add `tripId`/`userId` props; `editItem` state; `···` button in popup; BottomSheet + EditItemForm |
| `src/app/(app)/trips/[tripId]/_components/MapView.tsx` | Add `tripId`/`userId` to props and pass through |
| `src/app/(app)/trips/[tripId]/_components/TripDetailClient.tsx` | Pass `tripId` and `userId` to `<MapView>` |

## Imports to Add (`MapViewInner.tsx`)

```ts
import { EditItemForm } from "./EditItemForm";
import { api } from "@/lib/trpc/client";
// BottomSheet already imported for geocode picker
```

## Verification

1. Tap item marker on map → popup opens
2. Tap `···` button → EditItemForm BottomSheet opens with correct item pre-filled
3. Edit a field → save → map refreshes with updated data
4. Delete via EditItemForm → sheet closes, marker removed from map
5. `pnpm lint && pnpm typecheck` pass
