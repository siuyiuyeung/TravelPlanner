"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { createServerCaller } from "@/lib/trpc/server";
import { PublicMapView } from "./PublicMapView";

type PublicTrip = Awaited<ReturnType<Awaited<ReturnType<typeof createServerCaller>>["trips"]["getPublic"]>>;
type ItineraryItem = PublicTrip["itineraryItems"][number];
type RouteMode = "driving" | "walking" | "cycling" | "transit" | "none";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const MAPBOX_PROFILE: Record<Exclude<RouteMode, "none">, string> = {
  driving: "driving",
  walking: "walking",
  cycling: "cycling",
  transit: "driving-traffic",
};

const ITEM_EMOJI: Record<string, string> = {
  flight: "✈️",
  hotel: "🏨",
  restaurant: "🍜",
  activity: "🎡",
  transport: "🚗",
  note: "📝",
};

const NODE_COLORS: Record<string, string> = {
  flight: "bg-[#2D6A8F]",
  hotel: "bg-[#A78BFA]",
  restaurant: "bg-[#E8622A]",
  activity: "bg-[#3D9970]",
  transport: "bg-[#F2A93B]",
  note: "bg-[#A09B96]",
};

const ROUTE_MODE_ICON: Record<RouteMode, string> = {
  driving: "🚗",
  walking: "🚶",
  cycling: "🚴",
  transit: "🚌",
  none: "✕",
};

function toDateKey(startTime: Date | string | null): string {
  if (!startTime) return "";
  const d = new Date(startTime);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function groupByDate(items: ItineraryItem[]) {
  const groups: Record<string, ItineraryItem[]> = {};
  const noDate: ItineraryItem[] = [];
  for (const item of items) {
    const key = toDateKey(item.startTime);
    if (key) {
      if (!groups[key]) groups[key] = [];
      groups[key]!.push(item);
    } else {
      noDate.push(item);
    }
  }
  const sorted = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  if (noDate.length > 0) sorted.push(["", noDate]);
  return sorted;
}

function formatDayHeader(dateStr: string, dayIndex: number) {
  if (!dateStr) return { mono: "UNSCHEDULED", readable: "No date set" };
  const d = new Date(dateStr + "T00:00:00");
  return {
    mono: `DAY ${String(dayIndex).padStart(2, "0")}`,
    readable: d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
  };
}

function formatLegDist(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function formatLegDuration(secs: number): string {
  const mins = Math.round(secs / 60);
  if (mins < 1) return "<1 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function ReadOnlyItemCard({
  item,
  seqNum,
  legKm,
  legDuration,
  legMode,
}: {
  item: ItineraryItem;
  seqNum: number;
  legKm: number | undefined;
  legDuration: number | undefined;
  legMode: RouteMode | undefined;
}) {
  const nodeColor = NODE_COLORS[item.type] ?? "bg-[#A09B96]";

  return (
    <div>
      {item.startTime && (
        <div className="pl-9 mb-1">
          <span className="text-[11px] font-mono font-semibold text-[#E8622A]">
            {new Date(item.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            {item.endTime
              ? ` – ${new Date(item.endTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
              : ""}
          </span>
        </div>
      )}

      <div className="flex gap-3">
        {/* Left column: node dot */}
        <div className="flex flex-col items-center flex-shrink-0 w-6">
          <div className="relative mt-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${nodeColor} z-10`}>
              <span>{ITEM_EMOJI[item.type] ?? "📌"}</span>
            </div>
            <div className="absolute -top-1.5 -right-1.5 w-[14px] h-[14px] rounded-full bg-[#1A1512] text-white text-[8px] font-bold font-mono flex items-center justify-center border border-[#FAF8F5] leading-none">
              {seqNum}
            </div>
          </div>
        </div>

        {/* Card */}
        <div
          className="flex-1 min-w-0 bg-white border border-[#E5E0DA] rounded-[12px] p-3"
          style={{ boxShadow: "0 1px 3px rgba(26,21,18,0.04)" }}
        >
          <p className="text-[14px] font-semibold text-[#1A1512] break-words">{item.title}</p>

          {item.locationName && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="inline-flex items-center px-2 py-0.5 bg-[#F0EDE8] rounded-full text-[10px] text-[#6B6560]">
                📍 {item.locationName}
              </span>
            </div>
          )}

          {item.description && (
            <p className="text-xs text-[#A09B96] mt-1.5 line-clamp-2 break-words">{item.description}</p>
          )}
        </div>
      </div>

      {/* Leg connector */}
      {legKm !== undefined && legMode !== undefined && (
        <div className="flex items-center gap-2 pl-9 py-1.5">
          <div className="flex-1 border-t border-dashed border-[#E5E0DA]" />
          <div className="flex items-center gap-0.5 bg-[#F0EDE8] rounded-full px-1.5 py-0.5">
            <span className="w-6 h-6 flex items-center justify-center rounded-full text-[12px] bg-[#E8622A] shadow-sm">
              {ROUTE_MODE_ICON[legMode]}
            </span>
          </div>
          {legMode !== "none" && (
            <span className="text-[11px] font-semibold text-[#A09B96] font-mono flex-shrink-0">
              {formatLegDist(legKm)}
              {legDuration !== undefined && legDuration > 0 ? ` · ${formatLegDuration(legDuration)}` : ""}
            </span>
          )}
          <div className="flex-1 border-t border-dashed border-[#E5E0DA]" />
        </div>
      )}
    </div>
  );
}

function DaySection({
  dateStr,
  dayIndex,
  seqOffset,
  items,
  legDistances,
  legDurations,
  legModes,
}: {
  dateStr: string;
  dayIndex: number;
  seqOffset: number;
  items: ItineraryItem[];
  legDistances: Record<string, number>;
  legDurations: Record<string, number>;
  legModes: Record<string, RouteMode>;
}) {
  const { mono, readable } = formatDayHeader(dateStr, dayIndex);

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3 sticky top-0 bg-[#FAF8F5] py-1 z-10">
        <span className="font-mono text-[13px] font-bold text-[#F2A93B] tracking-wider">{mono}</span>
        <span className="text-xs text-[#A09B96]">{readable}</span>
      </div>

      <div className="relative">
        <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-[#E5E0DA]" />
        <div className="space-y-3">
          {items.map((item, idx) => (
            <ReadOnlyItemCard
              key={item.id}
              item={item}
              seqNum={seqOffset + idx + 1}
              legKm={legDistances[item.id]}
              legDuration={legDurations[item.id]}
              legMode={legModes[item.id]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PublicTripView({ trip }: { trip: PublicTrip }) {
  const [tab, setTab] = useState<"itinerary" | "map">("itinerary");
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [scrollDay, setScrollDay] = useState<string | null>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const chipsRowRef = useRef<HTMLDivElement>(null);
  const [legModes, setLegModes] = useState<Record<string, RouteMode>>({});
  const [legDistances, setLegDistances] = useState<Record<string, number>>({});
  const [legDurations, setLegDurations] = useState<Record<string, number>>({});
  const [legCoords, setLegCoords] = useState<Record<string, [number, number][]>>({});

  const sorted = [...trip.itineraryItems].sort((a, b) => {
    const aTime = a.startTime ? new Date(a.startTime).getTime() : null;
    const bTime = b.startTime ? new Date(b.startTime).getTime() : null;
    if (aTime && bTime) return aTime - bTime || a.sortOrder - b.sortOrder;
    if (aTime) return -1;
    if (bTime) return 1;
    return a.sortOrder - b.sortOrder;
  });

  // Only items with lat/lng participate in routing
  const pinnedItems = sorted.filter(
    (i) => i.startTime !== null && i.locationLat !== null && i.locationLng !== null,
  );

  useEffect(() => {
    if (pinnedItems.length < 2 || !MAPBOX_TOKEN) {
      setLegDistances({});
      setLegDurations({});
      setLegModes({});
      setLegCoords({});
      return;
    }
    const legs = pinnedItems.slice(0, -1);
    void Promise.all(
      legs.map(async (item, i) => {
        const to = pinnedItems[i + 1]!;
        const isDayBoundary = toDateKey(item.startTime) !== toDateKey(to.startTime);
        const defaultMode: RouteMode = isDayBoundary ? "none" : "driving";
        const itemMode = (item.routeMode ?? defaultMode) as RouteMode;
        if (itemMode === "none") {
          return { id: item.id, mode: itemMode, distance: 0, duration: 0, coords: [] as [number, number][] };
        }
        const coordStr = `${item.locationLng},${item.locationLat};${to.locationLng},${to.locationLat}`;
        const profile = MAPBOX_PROFILE[itemMode];
        const r = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordStr}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`,
        );
        const data = (await r.json()) as { routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] };
        const route = data.routes?.[0];
        return {
          id: item.id, mode: itemMode,
          distance: route?.distance ?? 0, duration: route?.duration ?? 0,
          coords: (route?.geometry.coordinates ?? []).map(([lng, lat]) => [lat, lng] as [number, number]),
        };
      }),
    ).then((results) => {
      const distances: Record<string, number> = {};
      const durations: Record<string, number> = {};
      const modes: Record<string, RouteMode> = {};
      const coords: Record<string, [number, number][]> = {};
      results.forEach((r) => {
        distances[r.id] = r.distance / 1000;
        durations[r.id] = r.duration;
        modes[r.id] = r.mode;
        coords[r.id] = r.coords;
      });
      setLegDistances(distances);
      setLegDurations(durations);
      setLegModes(modes);
      setLegCoords(coords);
    }).catch(() => {
      setLegDistances({});
      setLegDurations({});
      setLegModes({});
      setLegCoords({});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedItems.map((i) => `${i.id}:${i.routeMode}`).join("|")]);

  const groups = groupByDate(sorted);

  const routeSegments = useMemo(() => {
    if (pinnedItems.length < 2) return [];
    const dayKeys = [...new Set(
      pinnedItems.map((i) => toDateKey(i.startTime)).filter((k): k is string => k !== ""),
    )].sort();
    const result: { coords: [number, number][]; dayIndex: number }[] = [];
    for (let i = 0; i < pinnedItems.length - 1; i++) {
      const item = pinnedItems[i]!;
      const next = pinnedItems[i + 1]!;
      const itemDay = toDateKey(item.startTime);
      const nextDay = toDateKey(next.startTime);
      if (!itemDay || itemDay !== nextDay) continue;
      const coords = legCoords[item.id] ?? [];
      if (coords.length < 2) continue;
      result.push({ coords: [...coords], dayIndex: dayKeys.indexOf(itemDay) });
    }
    return result;
  }, [pinnedItems, legCoords]);

  const totalKm = useMemo(
    () => Object.values(legDistances).reduce((s, v) => s + v, 0),
    [legDistances],
  );

  useEffect(() => {
    if (activeDay !== null) return;
    let rafId: number;
    function update() {
      const threshold = chipsRowRef.current?.getBoundingClientRect().bottom ?? 0;
      let current: string | null = null;
      let currentTop = -Infinity;
      sectionRefs.current.forEach((el, key) => {
        const top = el.getBoundingClientRect().top;
        if (top <= threshold && top > currentTop) {
          currentTop = top;
          current = key;
        }
      });
      setScrollDay(current);
    }
    function onScroll() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [activeDay, groups]);

  useEffect(() => {
    const key = activeDay ?? scrollDay;
    if (!key) return;
    chipRefs.current.get(key)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [scrollDay, activeDay]);

  const dayChips = groups.map(([dateStr], i) => ({
    key: dateStr || "__none__",
    label: dateStr ? `Day ${i + 1}` : "Unscheduled",
  }));

  const filteredGroups =
    activeDay === null ? groups : groups.filter(([dateStr]) => (dateStr || "__none__") === activeDay);

  const groupSeqOffsets = new Map<string, number>();
  let cumSeq = 0;
  for (const [dateStr, dayItems] of groups) {
    groupSeqOffsets.set(dateStr || "__none__", cumSeq);
    cumSeq += dayItems.length;
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col max-w-lg mx-auto">
      {/* Read-only banner */}
      <div className="bg-[#FEF3C7] border-b border-[#FDE68A] px-4 py-2 flex items-center gap-2 text-[11px] font-semibold text-[#92400E] sticky top-0 z-20">
        <span>👁️</span>
        <span>View only — shared trip</span>
        <a href="/login" className="ml-auto px-3 py-1 bg-[#E8622A] text-white text-[11px] font-bold rounded-lg">
          Sign in to edit
        </a>
      </div>

      {/* Trip header */}
      <div className="bg-gradient-to-br from-[#1a3a4a] via-[#2d6a8f] to-[#3d9970] px-5 py-6 text-white">
        <h1 className="text-[20px] font-bold">{trip.name}</h1>
        {trip.destination && <p className="text-[12px] text-white/75 mt-1">📍 {trip.destination}</p>}
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
              tab === t ? "text-[#E8622A] border-b-2 border-[#E8622A]" : "text-[#A09B96]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={`flex-1 ${tab === "map" ? "flex flex-col overflow-hidden" : "px-5 pt-4 pb-8"}`}>
        {tab === "itinerary" && (
          <>
            {/* Day filter chips */}
            {dayChips.length > 1 && (
              <div
                ref={chipsRowRef}
                className="sticky z-20 -mx-5 px-5 bg-gradient-to-b from-[#FAF8F5] to-transparent pt-2 pb-5 mb-0 flex gap-2 overflow-x-auto"
                style={{ top: "calc(37px + 41px)", scrollbarWidth: "none" } as React.CSSProperties}
              >
                <button
                  ref={(el) => { if (el) chipRefs.current.set("__all__", el); }}
                  onClick={() => { setActiveDay(null); setScrollDay(null); }}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                    activeDay === null && scrollDay === null ? "bg-[#E8622A] text-white" : "bg-[#F0EDE8] text-[#6B6560]"
                  }`}
                >
                  All
                </button>
                {dayChips.map((chip) => (
                  <button
                    key={chip.key}
                    ref={(el) => { if (el) chipRefs.current.set(chip.key, el); }}
                    onClick={() => setActiveDay(activeDay === chip.key ? null : chip.key)}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                      activeDay === chip.key || (activeDay === null && scrollDay === chip.key)
                        ? "bg-[#E8622A] text-white"
                        : "bg-[#F0EDE8] text-[#6B6560]"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}

            {trip.itineraryItems.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <span className="text-4xl mb-3">🗺️</span>
                <p className="text-[15px] font-semibold text-[#1A1512]">Nothing planned yet</p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredGroups.map(([dateStr, dayItems]) => {
                  const originalIndex = groups.findIndex(([k]) => k === dateStr);
                  const key = dateStr || "__none__";
                  return (
                    <div
                      key={dateStr || "no-date"}
                      ref={(el) => {
                        if (el) sectionRefs.current.set(key, el);
                        else sectionRefs.current.delete(key);
                      }}
                    >
                      <DaySection
                        dateStr={dateStr}
                        dayIndex={originalIndex + 1}
                        seqOffset={groupSeqOffsets.get(key) ?? 0}
                        items={dayItems}
                        legDistances={legDistances}
                        legDurations={legDurations}
                        legModes={legModes}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        {tab === "map" && (
          <PublicMapView
            items={sorted}
            routeSegments={routeSegments}
            totalKm={totalKm > 0 ? totalKm : undefined}
            legDistances={legDistances}
            legDurations={legDurations}
          />
        )}
      </div>
    </div>
  );
}
