# Map Long-Press Drop Pin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to long-press the map to drop a pin at any coordinate, then add it to the plan or open in Google Maps — matching the existing search result / POI popup pattern.

**Architecture:** All changes confined to `MapViewInner.tsx`. Touch events on the outer wrapper div detect long-press; a `reverseGeocode` helper fetches a place name from Mapbox Search Box v1; the dropped pin renders a `<Marker>` + `<Popup>` identical in structure to the existing search result popup.

**Tech Stack:** react-map-gl/mapbox, Mapbox Search Box v1 REST API, React useState/useRef/useCallback/useEffect

---

## File Map

| File | Change |
|---|---|
| `src/app/(app)/trips/[tripId]/_components/MapViewInner.tsx` | All changes — type, state, refs, helpers, touch handlers, JSX |

---

### Task 1: Add `DroppedPin` type, state, refs, and helper functions

**Files:**
- Modify: `src/app/(app)/trips/[tripId]/_components/MapViewInner.tsx`

- [ ] **Step 1: Add `DroppedPin` type after the existing `LocateStatus` type (line 165)**

Open `MapViewInner.tsx`. After:
```ts
type LocateStatus = "idle" | "loading" | "error";
```
Add:
```ts
type DroppedPin = {
  lng: number;
  lat: number;
  name: string | null; // null = reverse geocode in flight
};
```

- [ ] **Step 2: Add `reverseGeocode` module-level function after the `fmtDur` function (around line 116)**

After the closing brace of `fmtDur`, add:
```ts
async function reverseGeocode(lng: number, lat: number): Promise<string> {
  try {
    const url = new URL("https://api.mapbox.com/search/searchbox/v1/reverse");
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("access_token", MAPBOX_TOKEN);
    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      features: { properties: { full_address?: string; name?: string } }[];
    };
    const props = data.features?.[0]?.properties;
    return props?.full_address ?? props?.name ?? "Dropped Pin";
  } catch {
    return "Dropped Pin";
  }
}
```

- [ ] **Step 3: Add state and refs in the `MapViewInner` component body, after the `searchResult` / `selectedSearchPin` state declarations (around line 394)**

After:
```ts
const [selectedSearchPin, setSelectedSearchPin] = useState(false);
```
Add:
```ts
const [droppedPin, setDroppedPin] = useState<DroppedPin | null>(null);
const [droppedPinOpen, setDroppedPinOpen] = useState(false);
const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const touchStartPos = useRef<{ x: number; y: number } | null>(null);
```

- [ ] **Step 4: Add `openDroppedPin` and `handleLongPress` callbacks after the `fetchPoi` / `handlePoiCategorySelect` callbacks (around line 486)**

After the closing of `handlePoiCategorySelect`, add:
```ts
const openDroppedPin = useCallback((lng: number, lat: number) => {
  setSelectedItemId(null);
  setSelectedPoi(null);
  setSelectedSearchPin(false);
  setDroppedPin({ lng, lat, name: null });
  setDroppedPinOpen(true);
  void reverseGeocode(lng, lat).then((name) =>
    setDroppedPin((prev) => (prev ? { ...prev, name } : prev))
  );
}, []);

const handleLongPress = useCallback((clientX: number, clientY: number) => {
  const map = mapRef.current?.getMap();
  if (!map) return;
  const rect = map.getContainer().getBoundingClientRect();
  const { lng, lat } = map.unproject([clientX - rect.left, clientY - rect.top]);
  navigator.vibrate?.(50);
  openDroppedPin(lng, lat);
}, [openDroppedPin]);
```

- [ ] **Step 5: Run typecheck to confirm no errors so far**

```bash
cd C:\Users\IGS\VsCodeProjects\travel-planner && pnpm typecheck
```
Expected: no errors (functions are defined but not yet called — TypeScript will not flag unused locals in this config).

---

### Task 2: Wire touch handlers on wrapper div + `onContextMenu` on `<Map>` + cleanup effect

**Files:**
- Modify: `src/app/(app)/trips/[tripId]/_components/MapViewInner.tsx`

- [ ] **Step 1: Add timer cleanup `useEffect` after `handleLongPress` (still in component body)**

```ts
useEffect(() => {
  return () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };
}, []);
```

- [ ] **Step 2: Add touch event handlers to the outermost wrapper `<div>` (line 504)**

The outermost wrapper currently is:
```tsx
<div style={{ position: "relative", width: "100%", height: "100%" }}>
```
Replace it with:
```tsx
<div
  style={{ position: "relative", width: "100%", height: "100%" }}
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
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    }
  }}
  onTouchEnd={() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }}
>
```

- [ ] **Step 3: Add `onContextMenu` prop to the `<Map>` component (around line 681)**

The `<Map>` opening tag currently ends with `onMoveEnd={...}`. Add after `onMoveEnd`:
```tsx
onContextMenu={(e) => {
  e.originalEvent.preventDefault();
  navigator.vibrate?.(50);
  openDroppedPin(e.lngLat.lng, e.lngLat.lat);
}}
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

---

### Task 3: Add dropped pin `<Marker>` and `<Popup>` inside `<Map>`

**Files:**
- Modify: `src/app/(app)/trips/[tripId]/_components/MapViewInner.tsx`

- [ ] **Step 1: Add the dropped pin `<Marker>` and `<Popup>` JSX inside `<Map>`, immediately before `<LocateControl />` (around line 1000)**

Find the line:
```tsx
        <LocateControl onLocate={(lng, lat) => setUserPos({ lng, lat })} />
```
Insert before it:
```tsx
        {/* Dropped pin marker */}
        {droppedPin && (
          <Marker
            longitude={droppedPin.lng}
            latitude={droppedPin.lat}
            anchor="bottom"
            onClick={(e) => { e.originalEvent.stopPropagation(); setDroppedPinOpen(true); }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "#DB4437", border: "2.5px solid white",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, boxShadow: "0 2px 8px rgba(219,68,55,0.45)", cursor: "pointer",
            }}>📍</div>
          </Marker>
        )}

        {/* Dropped pin popup */}
        {droppedPin && droppedPinOpen && (
          <Popup
            longitude={droppedPin.lng}
            latitude={droppedPin.lat}
            anchor="bottom"
            offset={20}
            onClose={() => { setDroppedPin(null); setDroppedPinOpen(false); }}
            closeButton={false}
            closeOnClick={false}
            maxWidth="220px"
          >
            <div style={{ minWidth: 190, padding: "12px 14px 12px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                {droppedPin.name === null ? (
                  <div style={{ width: 18, height: 18, border: "2.5px solid #2D6A8F", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "2px 0" }} />
                ) : (
                  <p style={{ fontWeight: 700, fontSize: 14, margin: 0, flex: 1 }}>{droppedPin.name}</p>
                )}
                <button
                  onClick={() => { setDroppedPin(null); setDroppedPinOpen(false); }}
                  style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: "#F0EDE8", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#6B6560", lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
              <p style={{ fontSize: 12, color: "#A09B96", margin: "0 0 10px" }}>
                {droppedPin.lat.toFixed(5)}, {droppedPin.lng.toFixed(5)}
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  disabled={droppedPin.name === null}
                  onClick={() => {
                    if (!droppedPin.name) return;
                    const { name, lat, lng } = droppedPin;
                    setDroppedPin(null);
                    setDroppedPinOpen(false);
                    onAddToPlan({
                      title: name,
                      locationName: name,
                      locationLat: String(lat),
                      locationLng: String(lng),
                    });
                  }}
                  style={{
                    flex: 1, padding: "6px 0", background: "#E8622A", color: "white",
                    borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none",
                    cursor: droppedPin.name === null ? "default" : "pointer",
                    opacity: droppedPin.name === null ? 0.5 : 1,
                    pointerEvents: droppedPin.name === null ? "none" : "auto",
                  } as React.CSSProperties}
                >
                  + Add to Plan
                </button>
                <a
                  href={`https://maps.google.com?q=${droppedPin.lat},${droppedPin.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, padding: "6px 0", borderRadius: 8, background: "#F0EDE8", color: "#2D6A8F", fontSize: 12, fontWeight: 600, textAlign: "center", textDecoration: "none", display: "block" }}
                >
                  Maps ↗
                </a>
              </div>
            </div>
          </Popup>
        )}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

---

### Task 4: Extend existing marker `onClick` handlers to clear dropped pin (cross-popup dismissal)

**Files:**
- Modify: `src/app/(app)/trips/[tripId]/_components/MapViewInner.tsx`

- [ ] **Step 1: Extend item marker `onClick` to clear dropped pin (around line 775)**

Find:
```tsx
onClick={() => { setSelectedPoi(null); setSelectedSearchPin(false); setSelectedItemId(item.id); }}
```
Replace with:
```tsx
onClick={() => { setSelectedPoi(null); setSelectedSearchPin(false); setDroppedPin(null); setDroppedPinOpen(false); setSelectedItemId(item.id); }}
```

- [ ] **Step 2: Extend POI marker `onClick` to clear dropped pin (around line 843)**

Find:
```tsx
onClick={(e) => {
  e.originalEvent.stopPropagation();
  setSelectedItemId(null);
  setSelectedSearchPin(false);
  setSelectedPoi(poi);
}}
```
Replace with:
```tsx
onClick={(e) => {
  e.originalEvent.stopPropagation();
  setSelectedItemId(null);
  setSelectedSearchPin(false);
  setDroppedPin(null);
  setDroppedPinOpen(false);
  setSelectedPoi(poi);
}}
```

- [ ] **Step 3: Extend search result marker `onClick` to clear dropped pin (around line 925)**

Find:
```tsx
onClick={(e) => {
  e.originalEvent.stopPropagation();
  setSelectedItemId(null);
  setSelectedPoi(null);
  setSelectedSearchPin(true);
}}
```
Replace with:
```tsx
onClick={(e) => {
  e.originalEvent.stopPropagation();
  setSelectedItemId(null);
  setSelectedPoi(null);
  setDroppedPin(null);
  setDroppedPinOpen(false);
  setSelectedSearchPin(true);
}}
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

---

### Task 5: Lint, typecheck, manual test, commit

**Files:**
- No new changes — verification only

- [ ] **Step 1: Run lint and typecheck**

```bash
pnpm lint && pnpm typecheck
```
Expected: no errors, no warnings.

- [ ] **Step 2: Start dev server and open the Map tab on a trip**

```bash
pnpm dev
```
Navigate to any trip → Map tab.

- [ ] **Step 3: Manual test — mobile long-press (or touch simulation in DevTools)**

In Chrome DevTools, enable device toolbar (mobile emulation). Hold a finger on any empty map area for 500ms without moving.

Expected:
- Red `📍` circle marker appears at that spot
- Popup opens immediately with a spinner in the title area and coordinates in subtitle
- After ~1s, spinner replaced by reverse-geocoded place name
- "Maps ↗" opens Google Maps at those coordinates in a new tab
- "+ Add to Plan" is disabled (dim) while spinner shows, then enabled once name loads
- Clicking "+ Add to Plan" opens the existing AddItem bottom sheet with location pre-filled

- [ ] **Step 4: Manual test — existing popup dismissal**

With a dropped pin popup open, click an existing plan item marker.
Expected: dropped pin marker + popup disappear; item popup opens.

With an item popup open, long-press elsewhere.
Expected: item popup disappears; new dropped pin popup opens.

- [ ] **Step 5: Manual test — panning does not trigger drop**

Touch and drag (pan the map). No pin should appear.
Expected: no pin dropped when finger moved >8px.

- [ ] **Step 6: Manual test — desktop right-click**

Right-click on empty map area.
Expected: browser context menu suppressed; dropped pin popup appears at that location.

- [ ] **Step 7: Commit**

```bash
git add src/app/(app)/trips/[tripId]/_components/MapViewInner.tsx
git commit -m "feat(map): long-press to drop pin with reverse geocode and add-to-plan"
```
