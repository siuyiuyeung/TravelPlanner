# Map Long-Press Drop Pin — Design Spec

**Date:** 2026-05-07  
**Status:** Approved  
**Scope:** `MapViewInner.tsx` only

---

## Overview

Allow users to long-press anywhere on the Map tab to drop a pin at that coordinate. The pin shows a popup with a reverse-geocoded place name and two action buttons — identical in structure to the existing search result and POI popups.

---

## Trigger

| Platform | Gesture |
|---|---|
| Mobile (iOS/Android) | 500ms touch hold without panning (>8px movement cancels) |
| Desktop | Right-click (`contextmenu` event) |

Haptic feedback: `navigator.vibrate?.(50)` fires on long-press detection (mobile only, no-op on unsupported).

---

## State

```ts
type DroppedPin = {
  lng: number;
  lat: number;
  name: string | null; // null = reverse geocode in flight
};

const [droppedPin, setDroppedPin] = useState<DroppedPin | null>(null);
const [droppedPinOpen, setDroppedPinOpen] = useState(false);
```

Two refs track long-press on the wrapper div:

```ts
const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const touchStartPos = useRef<{ x: number; y: number } | null>(null);
```

---

## Touch Detection

Handlers added to the outermost wrapper `<div>` in `MapViewInner`:

```ts
onTouchStart={(e) => {
  const t = e.touches[0]!;
  touchStartPos.current = { x: t.clientX, y: t.clientY };
  longPressTimer.current = setTimeout(() => handleLongPress(t.clientX, t.clientY), 500);
}}
onTouchMove={(e) => {
  const t = e.touches[0]!;
  const dx = t.clientX - (touchStartPos.current?.x ?? t.clientX);
  const dy = t.clientY - (touchStartPos.current?.y ?? t.clientY);
  if (Math.hypot(dx, dy) > 8) {
    clearTimeout(longPressTimer.current!);
    longPressTimer.current = null;
  }
}}
onTouchEnd={() => {
  clearTimeout(longPressTimer.current!);
  longPressTimer.current = null;
}}
```

Desktop: `onContextMenu` prop on `<Map>` component — receives `MapMouseEvent` with `e.lngLat` directly, bypasses unproject step.

---

## Coordinate Conversion (Mobile)

```ts
function handleLongPress(clientX: number, clientY: number) {
  const map = mapRef.current?.getMap();
  if (!map) return;
  const rect = map.getContainer().getBoundingClientRect();
  const { lng, lat } = map.unproject([clientX - rect.left, clientY - rect.top]);
  navigator.vibrate?.(50);
  // close existing popups
  setSelectedItemId(null);
  setSelectedPoi(null);
  setSelectedSearchPin(false);
  // place pin
  setDroppedPin({ lng, lat, name: null });
  setDroppedPinOpen(true);
  // fetch name async
  void reverseGeocode(lng, lat).then((name) =>
    setDroppedPin((prev) => prev ? { ...prev, name } : prev)
  );
}
```

---

## Reverse Geocoding

Endpoint: Mapbox Search Box v1 reverse (consistent with existing POI/search usage).

```
GET https://api.mapbox.com/search/searchbox/v1/reverse
  ?longitude={lng}&latitude={lat}&access_token={MAPBOX_TOKEN}
```

Name resolution priority:
1. `features[0]?.properties.full_address`
2. `features[0]?.properties.name`
3. `"Dropped Pin"` (fallback on error or empty response)

---

## Marker

Red circle pin — visually distinct from existing markers:

| Marker type | Color | Shape |
|---|---|---|
| Plan item | `#E8622A` orange | Diamond teardrop |
| POI | `#F59E0B` amber | Circle |
| Search result | `#6366F1` indigo | Circle |
| **Dropped pin** | **`#DB4437` red** | **Circle** |

```tsx
<Marker longitude={droppedPin.lng} latitude={droppedPin.lat} anchor="bottom"
  onClick={(e) => { e.originalEvent.stopPropagation(); setDroppedPinOpen(true); }}>
  <div style={{
    width: 32, height: 32, borderRadius: "50%",
    background: "#DB4437", border: "2.5px solid white",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 15, boxShadow: "0 2px 8px rgba(219,68,55,0.45)", cursor: "pointer",
  }}>📍</div>
</Marker>
```

---

## Popup

Identical structure to search result popup (`minWidth: 190, padding: "12px 14px"`):

- **Title**: `droppedPin.name` when loaded; inline spinner (18px border-spin) while `null`
- **Subtitle**: `${lat.toFixed(5)}, ${lng.toFixed(5)}` — always visible
- **Close (×)**: sets `droppedPin = null` and `droppedPinOpen = false` — marker disappears
- **Button row**:
  - `+ Add to Plan` (orange `#E8622A`) → calls `onAddToPlan({ title: name ?? "Dropped Pin", locationName: name ?? "Dropped Pin", locationLat: String(lat), locationLng: String(lng) })` → existing day-picker bottom sheet
  - `Maps ↗` (sand `#F0EDE8`, blue text) → `https://maps.google.com?q=${lat},${lng}` (target `_blank`)

Add to Plan is disabled (opacity 0.5, pointer-events none) while name is still loading, to avoid submitting a nameless item.

---

## Interactions with Existing Popups

Opening the dropped pin popup closes: selected item popup, POI popup, search result popup (and vice versa — existing popup handlers already call `setSelectedPoi(null)` etc., extend them to also call `setDroppedPin(null)`).

---

## Files Changed

- `src/app/(app)/trips/[tripId]/_components/MapViewInner.tsx` — all changes contained here

No new files. No schema changes. No tRPC changes.
