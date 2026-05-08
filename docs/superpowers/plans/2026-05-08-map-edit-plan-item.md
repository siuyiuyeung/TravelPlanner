# Map Edit Plan Item Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `···` button to item marker popups on the Map page that opens `EditItemForm` in a BottomSheet — identical to the Plan tab behavior.

**Architecture:** Thread `tripId` and `userId` props through `MapView` → `MapViewInner`. Extend `MapItem` type with `endTime` and `description`. Add `editItem` state and BottomSheet + `EditItemForm` inside `MapViewInner`.

**Tech Stack:** Next.js 15, TypeScript, tRPC v11, react-map-gl/mapbox, shadcn/ui BottomSheet

---

## File Map

| File | Change |
|------|--------|
| `src/app/(app)/trips/[tripId]/_components/MapView.tsx` | Extend `MapItem` type; add `tripId`/`userId` props; pass through to `MapViewInner` |
| `src/app/(app)/trips/[tripId]/_components/MapViewInner.tsx` | Extend `MapItem` type; add `tripId`/`userId` props; import `api` + `EditItemForm`; add `editItem` state; add `···` button in popup; add BottomSheet + EditItemForm |
| `src/app/(app)/trips/[tripId]/_components/TripDetailClient.tsx` | Pass `tripId` and `userId` to `<MapView>` |

---

### Task 1: Update MapView.tsx — extend type + add props

**Files:**
- Modify: `src/app/(app)/trips/[tripId]/_components/MapView.tsx`

- [ ] **Step 1: Read the file**

Read `src/app/(app)/trips/[tripId]/_components/MapView.tsx` to confirm current state before editing.

- [ ] **Step 2: Replace `MapItem` type and `Props` type, update component signature and JSX**

Replace the entire file content with:

```tsx
"use client";

import dynamic from "next/dynamic";

type MapItem = {
  id: string;
  title: string;
  type: string;
  locationName: string | null;
  locationLat: string | null;
  locationLng: string | null;
  startTime: Date | string | null;
  endTime: Date | string | null;
  description: string | null;
};

type AddToPlanPayload = {
  title: string;
  locationName: string;
  locationLat: string;
  locationLng: string;
};

type Props = {
  tripId: string;
  userId: string;
  items: MapItem[];
  onSelectItem: (id: string) => void;
  routeSegments: { coords: [number, number][]; dayIndex: number }[];
  totalKm?: number | undefined;
  legDistances?: Record<string, number> | undefined;
  legDurations?: Record<string, number> | undefined;
  onAddToPlan: (payload: AddToPlanPayload) => void;
};

const MapViewInner = dynamic(
  () => import("./MapViewInner").then((m) => m.MapViewInner),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F0EDE8",
        }}
      >
        <div className="w-8 h-8 rounded-full border-2 border-[#E8622A] border-t-transparent animate-spin" />
      </div>
    ),
  }
);

export function MapView({ tripId, userId, items, onSelectItem, routeSegments, totalKm, legDistances, legDurations, onAddToPlan }: Props) {
  return (
    // flex-1 grows to fill the tab content area; position:relative + absolute child gives Leaflet real px dimensions
    <div style={{ flex: 1, position: "relative", minHeight: 0, zIndex: 0 }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <MapViewInner tripId={tripId} userId={userId} items={items} onSelectItem={onSelectItem} routeSegments={routeSegments} totalKm={totalKm} legDistances={legDistances} legDurations={legDurations} onAddToPlan={onAddToPlan} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck passes so far**

```bash
pnpm typecheck
```

Expected: errors about `MapViewInner` missing `tripId`/`userId` props (expected — fixed in Task 2) and `TripDetailClient` not passing them (fixed in Task 3). No other new errors.

---

### Task 2: Update MapViewInner.tsx — extend type, add props, add edit flow

**Files:**
- Modify: `src/app/(app)/trips/[tripId]/_components/MapViewInner.tsx`

- [ ] **Step 1: Extend `MapItem` type**

In `MapViewInner.tsx`, find the `MapItem` type (lines 30–38):

```ts
type MapItem = {
  id: string;
  title: string;
  type: string;
  locationName: string | null;
  locationLat: string | null;
  locationLng: string | null;
  startTime: Date | string | null;
};
```

Replace with:

```ts
type MapItem = {
  id: string;
  title: string;
  type: string;
  locationName: string | null;
  locationLat: string | null;
  locationLng: string | null;
  startTime: Date | string | null;
  endTime: Date | string | null;
  description: string | null;
};
```

- [ ] **Step 2: Add `tripId` and `userId` to `Props`**

Find the `Props` type (lines 47–55):

```ts
type Props = {
  items: MapItem[];
  onSelectItem: (id: string) => void;
  routeSegments: { coords: [number, number][]; dayIndex: number }[];
  totalKm?: number | undefined;
  legDistances?: Record<string, number> | undefined;
  legDurations?: Record<string, number> | undefined;
  onAddToPlan: (payload: AddToPlanPayload) => void;
};
```

Replace with:

```ts
type Props = {
  tripId: string;
  userId: string;
  items: MapItem[];
  onSelectItem: (id: string) => void;
  routeSegments: { coords: [number, number][]; dayIndex: number }[];
  totalKm?: number | undefined;
  legDistances?: Record<string, number> | undefined;
  legDurations?: Record<string, number> | undefined;
  onAddToPlan: (payload: AddToPlanPayload) => void;
};
```

- [ ] **Step 3: Add imports for `api` and `EditItemForm`**

Near the top of the file, after the existing imports, add:

```ts
import { api } from "@/lib/trpc/client";
import { EditItemForm } from "./EditItemForm";
```

- [ ] **Step 4: Update `MapViewInner` function signature**

Find the function declaration (around line 413):

```ts
export function MapViewInner({ items, onSelectItem, routeSegments, totalKm, legDistances, legDurations, onAddToPlan }: Props) {
```

Replace with:

```ts
export function MapViewInner({ tripId, userId, items, onSelectItem, routeSegments, totalKm, legDistances, legDurations, onAddToPlan }: Props) {
```

- [ ] **Step 5: Add `editItem` state and `utils` inside `MapViewInner`**

Inside `MapViewInner`, after the existing `useState` declarations (around line 418), add:

```ts
const [editItem, setEditItem] = useState<MapItem | null>(null);
const utils = api.useUtils();
```

- [ ] **Step 6: Add `···` button to item popup**

Find the popup button row (around lines 925–940):

```tsx
<div style={{ display: "flex", gap: 8, marginTop: 8 }}>
  <button
    onClick={() => { setSelectedItemId(null); setTimeout(() => onSelectItem(selectedItem.id), 50); }}
    style={{ flex: 1, padding: "6px 0", borderRadius: 8, background: "#E8622A", color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}
  >
    View details
  </button>
  <a
    href={`https://maps.google.com?q=${selectedItem.locationLat},${selectedItem.locationLng}`}
    target="_blank"
    rel="noopener noreferrer"
    style={{ flex: 1, padding: "6px 0", borderRadius: 8, background: "#F0EDE8", color: "#2D6A8F", fontSize: 12, fontWeight: 600, textAlign: "center", textDecoration: "none", display: "block" }}
  >
    Maps ↗
  </a>
</div>
```

Replace with:

```tsx
<div style={{ display: "flex", gap: 8, marginTop: 8 }}>
  <button
    onClick={() => { setSelectedItemId(null); setTimeout(() => onSelectItem(selectedItem.id), 50); }}
    style={{ flex: 1, padding: "6px 0", borderRadius: 8, background: "#E8622A", color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}
  >
    View details
  </button>
  <a
    href={`https://maps.google.com?q=${selectedItem.locationLat},${selectedItem.locationLng}`}
    target="_blank"
    rel="noopener noreferrer"
    style={{ flex: 1, padding: "6px 0", borderRadius: 8, background: "#F0EDE8", color: "#2D6A8F", fontSize: 12, fontWeight: 600, textAlign: "center", textDecoration: "none", display: "block" }}
  >
    Maps ↗
  </a>
  <button
    onClick={() => { setSelectedItemId(null); setEditItem(selectedItem); }}
    style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: "#F0EDE8", color: "#6B6560", fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
    aria-label="Edit item"
  >
    ···
  </button>
</div>
```

- [ ] **Step 7: Add BottomSheet + EditItemForm**

Find the geocode picker BottomSheet (starts around line 1195 — search for `<BottomSheet open={geocodePickerOpen}`). Add the edit BottomSheet **after** the closing `</BottomSheet>` of the geocode picker:

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

- [ ] **Step 8: Run lint and typecheck**

```bash
pnpm lint && pnpm typecheck
```

Expected: errors only about `TripDetailClient` not yet passing `tripId`/`userId` to `<MapView>`. No other errors.

---

### Task 3: Update TripDetailClient.tsx — pass new props to MapView

**Files:**
- Modify: `src/app/(app)/trips/[tripId]/_components/TripDetailClient.tsx`

- [ ] **Step 1: Read the MapView usage**

In `TripDetailClient.tsx`, find the `<MapView>` JSX (around line 667):

```tsx
<MapView
  items={mapFilteredPinnedItems}
  onSelectItem={(id) => setMapSelectedId(id)}
  routeSegments={routeSegments}
  totalKm={totalKm || routeData?.totalKm}
  legDistances={legDistances}
  legDurations={legDurations}
  onAddToPlan={handleAddToPlan}
/>
```

- [ ] **Step 2: Add `tripId` and `userId` props**

Replace with:

```tsx
<MapView
  tripId={tripId}
  userId={userId}
  items={mapFilteredPinnedItems}
  onSelectItem={(id) => setMapSelectedId(id)}
  routeSegments={routeSegments}
  totalKm={totalKm || routeData?.totalKm}
  legDistances={legDistances}
  legDurations={legDurations}
  onAddToPlan={handleAddToPlan}
/>
```

Note: `tripId` and `userId` are already in scope — `TripDetailClient` receives them as props (`type Props = { tripId: string; userId: string }`).

- [ ] **Step 3: Run lint and typecheck — expect clean**

```bash
pnpm lint && pnpm typecheck
```

Expected: no errors.

---

### Task 4: Manual verification

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Open a trip with pinned items on the Map tab**

Navigate to a trip that has itinerary items with coordinates.

- [ ] **Step 3: Tap an item marker**

Popup opens showing: emoji + title, location name, time, "View details" / "Maps ↗" / `···` buttons.

- [ ] **Step 4: Tap `···`**

`EditItemForm` BottomSheet opens with the item's current data pre-filled (title, type, date/time, location, notes).

- [ ] **Step 5: Edit a field and save**

Change the title. Tap Save. Sheet closes. The map marker reflects the updated title on the next render (tRPC cache invalidated).

- [ ] **Step 6: Test delete flow**

Open edit sheet for an item. Tap Delete. Sheet closes. Marker disappears from map.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/trips/\[tripId\]/_components/MapView.tsx \
         src/app/\(app\)/trips/\[tripId\]/_components/MapViewInner.tsx \
         src/app/\(app\)/trips/\[tripId\]/_components/TripDetailClient.tsx
git commit -m "feat(map): add ··· edit button to item marker popup"
```
