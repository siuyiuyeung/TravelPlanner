"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/trpc/client";
import type { AppRouter } from "@/server/routers/_app";
import type { inferRouterOutputs } from "@trpc/server";
import { BottomSheet, BottomSheetTitle } from "@/components/ui/bottom-sheet";
import { timeAgo } from "@/lib/utils";
import { AddItemForm } from "./AddItemForm";
import { ItineraryTimeline } from "./ItineraryTimeline";
import { CommentThread } from "./CommentThread";
import { AttachmentGallery } from "./AttachmentGallery";
import { AttachmentUpload } from "./AttachmentUpload";
import { BudgetTab } from "./BudgetTab";
import { MapView } from "./MapView";
import { PackingTab } from "./PackingTab";

type RouterOutput = inferRouterOutputs<AppRouter>;
type Trip = RouterOutput["trips"]["getById"];
type PresenceUser = Trip["presence"][number];

type Props = {
  tripId: string;
  userId: string;
};

const HERO_GRADIENTS = [
  "from-[#1a1a3e] via-[#2d2060] to-[#6b2080]",
  "from-[#1a3a4a] via-[#2d6a8f] to-[#3d9970]",
  "from-[#2c1654] via-[#4a1060] to-[#c0392b]",
  "from-[#0d1b2a] via-[#1b4b72] to-[#2d6a8f]",
];

function getGradient(id: string) {
  const idx = id.charCodeAt(0) % HERO_GRADIENTS.length;
  return HERO_GRADIENTS[idx];
}

type Member = Trip["group"]["members"][number];

function AvatarStack({ members }: { members: Member[] }) {
  const shown = members.slice(0, 4);
  const extra = members.length - shown.length;
  const colors = ["bg-[#E8622A]", "bg-[#2D6A8F]", "bg-[#3D9970]", "bg-[#A78BFA]", "bg-[#F2A93B]"];
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center">
        {shown.map((m, i) => (
          <div
            key={m.userId}
            className={`w-8 h-8 rounded-full border-2 border-white/30 flex items-center justify-center text-[11px] font-bold text-white ${colors[i % colors.length]} ${i > 0 ? "-ml-2" : ""}`}
          >
            {m.user.name.charAt(0).toUpperCase()}
          </div>
        ))}
        {extra > 0 && (
          <div className="-ml-2 w-8 h-8 rounded-full border-2 border-white/30 bg-white/20 flex items-center justify-center text-[10px] font-bold text-white">
            +{extra}
          </div>
        )}
      </div>
      <span className="text-white/70 text-xs">{members.length} member{members.length !== 1 ? "s" : ""}</span>
    </div>
  );
}

// Shows who else is viewing the trip right now (excludes self)
function PresenceRow({ presence, userId }: { presence: PresenceUser[]; userId: string }) {
  const others = presence.filter((p) => p.userId !== userId);
  if (others.length === 0) return null;
  const colors = ["bg-[#E8622A]", "bg-[#2D6A8F]", "bg-[#3D9970]", "bg-[#A78BFA]", "bg-[#F2A93B]"];
  return (
    <div className="flex items-center gap-2 mt-3">
      <span className="w-2 h-2 rounded-full bg-[#3D9970] animate-pulse flex-shrink-0" />
      <div className="flex items-center gap-1">
        {others.slice(0, 3).map((p, i) => (
          <div
            key={p.userId}
            title={p.user.name}
            className={`w-6 h-6 rounded-full border-2 border-white/30 flex items-center justify-center text-[9px] font-bold text-white ${colors[i % colors.length]}`}
          >
            {p.user.name.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
      <span className="text-white/60 text-xs">
        {others.length === 1
          ? `${others[0]!.user.name.split(" ")[0]} is here`
          : `${others.length} others here`}
      </span>
    </div>
  );
}

// Pull-to-refresh hook
function usePullToRefresh(onRefresh: () => Promise<void>) {
  const startY = useRef(0);
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY === 0) startY.current = e.touches[0]!.clientY;
    }
    async function onTouchEnd(e: TouchEvent) {
      const dy = e.changedTouches[0]!.clientY - startY.current;
      if (dy > 70 && window.scrollY === 0) {
        setPulling(false);
        setRefreshing(true);
        await onRefresh();
        setRefreshing(false);
      } else {
        setPulling(false);
      }
    }
    function onTouchMove(e: TouchEvent) {
      const dy = e.touches[0]!.clientY - startY.current;
      if (dy > 10 && window.scrollY === 0) setPulling(true);
    }
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [onRefresh]);

  return { pulling, refreshing };
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

type RouteMode = "driving" | "walking" | "cycling" | "transit" | "none";

const MAPBOX_PROFILE: Record<Exclude<RouteMode, "none">, string> = {
  driving: "driving",
  walking: "walking",
  cycling: "cycling",
  transit: "driving", // Mapbox free tier has no transit profile; driving is the closest proxy
};

type RouteData = {
  coords: [number, number][];
  totalKm: number;
};

export function TripDetailClient({ tripId, userId }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "itinerary" | "map" | "budget" | "pack" | "chat">("overview");
  const [showMapOverlay, setShowMapOverlay] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [mapSelectedId, setMapSelectedId] = useState<string | null>(null);
  const [mapDay, setMapDay] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [legModes, setLegModes] = useState<Record<string, RouteMode>>({});
  const [legDistances, setLegDistances] = useState<Record<string, number>>({});
  const [legDurations, setLegDurations] = useState<Record<string, number>>({});
  const [legCoords, setLegCoords] = useState<Record<string, [number, number][]>>({});
  const utils = api.useUtils();

  const switchTab = useCallback((id: typeof tab) => {
    setTab(id);
    if (id === 'map') {
      setTimeout(() => setShowMapOverlay(true), 300);
    } else {
      setShowMapOverlay(false);
      document.getElementById('main-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const { data: trip, isLoading } = api.trips.getById.useQuery({ tripId });
  const { data: tripAttachments = [] } = api.attachments.listByTrip.useQuery({ tripId });

  const pingPresence = api.trips.pingPresence.useMutation();
  const leavePresence = api.trips.leavePresence.useMutation();
  const updateItem = api.itinerary.update.useMutation();

  // Ping presence on mount, every 30s, and clean up on unmount
  useEffect(() => {
    pingPresence.mutate({ tripId });
    const interval = setInterval(() => pingPresence.mutate({ tripId }), 30_000);
    return () => {
      clearInterval(interval);
      leavePresence.mutate({ tripId });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  // SSE — invalidate trip query + show toast for collaborator changes
  const prevItemCountRef = useRef<number | null>(null);
  useEffect(() => {
    const es = new EventSource(`/api/sse/trip/${tripId}`);
    es.onmessage = () => {
      utils.trips.getById.invalidate({ tripId }).then(() => {
        const current = utils.trips.getById.getData({ tripId });
        const prevCount = prevItemCountRef.current;
        const newCount = current?.itineraryItems.length ?? null;
        if (prevCount !== null && newCount !== null && newCount !== prevCount) {
          if (newCount > prevCount) {
            toast("✈️ Itinerary updated", { description: "A new item was added" });
          }
        }
        if (newCount !== null) prevItemCountRef.current = newCount;
      });
    };
    return () => es.close();
  }, [tripId, utils]);

  function toDateKey(t: Date | string | null): string | null {
    if (!t) return null;
    const d = new Date(t);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // All items with coordinates, sorted (markers — includes unscheduled)
  const allPinnedItems = [...(trip?.itineraryItems ?? [])]
    .sort((a, b) => {
      const aTime = a.startTime ? new Date(a.startTime).getTime() : null;
      const bTime = b.startTime ? new Date(b.startTime).getTime() : null;
      if (aTime && bTime) return aTime - bTime || a.sortOrder - b.sortOrder;
      if (aTime) return -1;
      if (bTime) return 1;
      return a.sortOrder - b.sortOrder;
    })
    .filter((i) => i.locationLat !== null && i.locationLng !== null);

  // Day numbering consistent with Plan tab (derived from ALL items, not just pinned)
  const allDates = [...new Set(
    (trip?.itineraryItems ?? [])
      .filter(i => i.startTime !== null)
      .map(i => toDateKey(i.startTime))
      .filter((d): d is string => d !== null)
  )].sort();
  const dayIndexMap = new Map(allDates.map((d, i) => [d, i + 1]));

  const pinnedDates = [...new Set(
    allPinnedItems
      .filter(i => i.startTime !== null)
      .map(i => toDateKey(i.startTime))
      .filter((d): d is string => d !== null)
  )].sort();
  const hasUnscheduledPinned = allPinnedItems.some(i => i.startTime === null);
  const showMapFilter = pinnedDates.length + (hasUnscheduledPinned ? 1 : 0) > 1;
  const mapChips: { key: string | null; label: string }[] = [
    { key: null, label: "All" },
    ...pinnedDates.map(d => ({ key: d, label: `Day ${dayIndexMap.get(d) ?? "?"}` })),
    ...(hasUnscheduledPinned ? [{ key: "__none__", label: "Unscheduled" }] : []),
  ];

  // Filtered items for map markers
  const mapFilteredPinnedItems =
    mapDay === null ? allPinnedItems :
    mapDay === "__none__" ? allPinnedItems.filter(i => i.startTime === null) :
    allPinnedItems.filter(i => toDateKey(i.startTime) === mapDay);

  // Only scheduled items participate in route computation
  const scheduledPinnedItems = mapFilteredPinnedItems.filter(i => i.startTime !== null);

  const posKey = scheduledPinnedItems.map((i) => `${i.locationLat},${i.locationLng}`).join("|");

  useEffect(() => {
    if (scheduledPinnedItems.length < 2) {
      setRouteData(null);
      setLegDistances({});
      setLegDurations({});
      setLegModes({});
      setLegCoords({});
      return;
    }
    const legs = scheduledPinnedItems.slice(0, -1);
    Promise.all(
      legs.map(async (item, i) => {
        const to = scheduledPinnedItems[i + 1]!;
        const isDayBoundary = toDateKey(item.startTime) !== toDateKey(to.startTime);
        const defaultMode: RouteMode = isDayBoundary ? "none" : "driving";
        const itemMode = (item.routeMode ?? defaultMode) as RouteMode;
        if (itemMode === "none") {
          return { id: item.id, mode: itemMode, distance: 0, duration: 0, coords: [] as [number, number][] };
        }
        const coordStr = `${item.locationLng},${item.locationLat};${to.locationLng},${to.locationLat}`;
        const profile = MAPBOX_PROFILE[itemMode];
        const r = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordStr}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
        );
        const data = (await r.json()) as { routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] };
        const route = data.routes?.[0];
        return { id: item.id, mode: itemMode, distance: route?.distance ?? 0, duration: route?.duration ?? 0, coords: route?.geometry.coordinates ?? [] as [number, number][] };
      })
    ).then((results) => {
      const distances: Record<string, number> = {};
      const durations: Record<string, number> = {};
      const modes: Record<string, RouteMode> = {};
      const coords: Record<string, [number, number][]> = {};
      results.forEach((r) => {
        distances[r.id] = r.distance / 1000;
        durations[r.id] = r.duration;
        modes[r.id] = r.mode;
        coords[r.id] = r.coords.map(([lng, lat]) => [lat, lng] as [number, number]);
      });
      setLegDistances(distances);
      setLegDurations(durations);
      setLegModes(modes);
      setLegCoords(coords);
      setRouteData({
        coords: results.flatMap((r) => r.coords.map(([lng, lat]) => [lat, lng] as [number, number])),
        totalKm: results.reduce((s, r) => s + r.distance / 1000, 0),
      });
    }).catch(() => {
      setRouteData(null);
      setLegDistances({});
      setLegDurations({});
      setLegModes({});
      setLegCoords({});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posKey]);

  const handleLegModeChange = useCallback(async (itemId: string, mode: RouteMode) => {
    setLegModes((prev) => ({ ...prev, [itemId]: mode }));
    updateItem.mutate({ itemId, tripId, routeMode: mode });
    const idx = scheduledPinnedItems.findIndex((i) => i.id === itemId);
    if (idx === -1 || idx >= scheduledPinnedItems.length - 1) return;
    if (mode === "none") {
      setLegDistances((prev) => ({ ...prev, [itemId]: 0 }));
      setLegDurations((prev) => ({ ...prev, [itemId]: 0 }));
      setLegCoords((prev) => ({ ...prev, [itemId]: [] }));
      return;
    }
    const from = scheduledPinnedItems[idx]!;
    const to = scheduledPinnedItems[idx + 1]!;
    const coordStr = `${from.locationLng},${from.locationLat};${to.locationLng},${to.locationLat}`;
    const profile = MAPBOX_PROFILE[mode];
    try {
      const r = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordStr}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
      );
      const data = (await r.json()) as { routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] };
      const route = data.routes?.[0];
      if (route) {
        setLegDistances((prev) => ({ ...prev, [itemId]: route.distance / 1000 }));
        setLegDurations((prev) => ({ ...prev, [itemId]: route.duration }));
        setLegCoords((prev) => ({
          ...prev,
          [itemId]: route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
        }));
      }
    } catch {
      // keep existing values on error
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduledPinnedItems]);

  // Split per-leg geometries into discrete polyline segments (gaps at "none" legs)
  const routeSegments = useMemo(() => {
    if (scheduledPinnedItems.length < 2) return [];
    const legs = scheduledPinnedItems.slice(0, -1);
    const segments: [number, number][][] = [];
    let current: [number, number][] = [];
    for (const item of legs) {
      const coords = legCoords[item.id] ?? [];
      if (coords.length === 0) {
        if (current.length > 0) { segments.push(current); current = []; }
      } else {
        current = [...current, ...coords];
      }
    }
    if (current.length > 0) segments.push(current);
    return segments;
  }, [scheduledPinnedItems, legCoords]);

  const totalKm = useMemo(
    () => Object.values(legDistances).reduce((s, v) => s + v, 0),
    [legDistances]
  );

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    await utils.trips.getById.invalidate({ tripId });
    await utils.attachments.listByTrip.invalidate({ tripId });
  }, [tripId, utils]);

  const { pulling, refreshing } = usePullToRefresh(handleRefresh);

  function onItemAdded() {
    setAddItemOpen(false);
  }

  if (isLoading || !trip) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FAF8F5]">
        <div className="w-8 h-8 rounded-full border-2 border-[#E8622A] border-t-transparent animate-spin" />
      </div>
    );
  }

  const gradient = getGradient(trip.id);

  const totalDistKm = Object.values(legDistances).reduce((s, km) => s + km, 0);
  const distStat =
    totalDistKm === 0
      ? "—"
      : totalDistKm < 1
      ? `${Math.round(totalDistKm * 1000)} m`
      : `${totalDistKm.toFixed(1)} km`;

  const now = new Date();
  const nextItem = trip.itineraryItems
    .filter((i) => i.startTime != null)
    .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime())
    .find((i) => new Date(i.startTime!) >= now);

  const ITEM_EMOJI: Record<string, string> = {
    flight: "✈️", hotel: "🏨", restaurant: "🍜", activity: "🎡", transport: "🚗", note: "📝",
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF8F5]">
      {/* Pull-to-refresh indicator */}
      {(pulling || refreshing) && (
        <div className="fixed top-0 inset-x-0 z-50 flex justify-center pt-2 pointer-events-none">
          <div className={`w-8 h-8 rounded-full border-2 border-[#E8622A] border-t-transparent ${refreshing ? "animate-spin" : "opacity-50"}`} />
        </div>
      )}

      {/* Hero — collapses on Map tab */}
      <div className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${tab === 'map' ? 'max-h-0' : 'max-h-[400px]'}`}>
        <div className={`relative bg-gradient-to-br ${gradient} px-5 pb-5`} style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
          <button
            onClick={() => router.back()}
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
            className="absolute left-5 w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white"
          >
            ←
          </button>

          <div className="mt-8">
            <p className="text-white/60 text-xs font-medium mb-1">{trip.group.name}</p>
            <h1 className="text-[28px] font-bold text-white leading-tight">{trip.name}</h1>
            {(trip.startDate || trip.destination) && (
              <p className="text-white/70 text-sm mt-1">
                {trip.destination ? `📍 ${trip.destination}` : ""}
                {trip.startDate ? `${trip.destination ? " · " : ""}${trip.startDate}${trip.endDate ? ` – ${trip.endDate}` : ""}` : ""}
              </p>
            )}
            <div className="mt-4">
              <AvatarStack members={trip.group.members} />
            </div>
            <PresenceRow presence={trip.presence} userId={userId} />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-[#E5E0DA] flex sticky top-0 z-20">
        {(
          [
            { id: "overview", label: "Home" },
            { id: "itinerary", label: "Plan" },
            { id: "map", label: "Map" },
            { id: "budget", label: "Budget" },
            { id: "pack", label: "Pack" },
            { id: "chat", label: "Chat" },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => switchTab(id)}
            className={`flex-1 py-3 text-[11px] font-semibold transition-colors ${
              tab === id
                ? "text-[#E8622A] border-b-2 border-[#E8622A]"
                : "text-[#A09B96]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={tab === "map" ? { flex: 1, position: "relative", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" } : undefined} className={tab === "map" ? "" : tab === "chat" ? "flex-1 flex flex-col overflow-hidden pb-0" : "flex-1 px-5 py-5 pb-28"}>
        {tab === "overview" && (
          <div className="space-y-4">
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: "📍", label: "Places", value: trip.itineraryItems.filter(i => i.locationName).length },
                { icon: "📋", label: "Items", value: trip.itineraryItems.length },
                { icon: "👥", label: "Members", value: trip.group.members.length },
              ].map(({ icon, label, value }) => (
                <div key={label} className="bg-white border border-[#E5E0DA] rounded-[12px] p-3 text-center">
                  <p className="text-xl">{icon}</p>
                  <p className="text-[18px] font-bold text-[#1A1512] mt-1">{value}</p>
                  <p className="text-[11px] text-[#A09B96]">{label}</p>
                </div>
              ))}
            </div>

            {/* Distance stat */}
            <div className="bg-white border border-[#E5E0DA] rounded-[12px] p-3 text-center">
              <p className="text-xl">📏</p>
              <p className="text-[15px] font-bold text-[#1A1512] mt-1 truncate">{distStat}</p>
              <p className="text-[11px] text-[#A09B96]">Distance</p>
            </div>

            {/* Next up */}
            {nextItem && (
              <div className="bg-white border-l-4 border-[#E8622A] border-t border-r border-b border-[#E5E0DA] rounded-[12px] p-4">
                <p className="text-[11px] font-semibold text-[#E8622A] uppercase tracking-wide mb-1">Next up</p>
                <p className="text-[15px] font-semibold text-[#1A1512]">
                  {ITEM_EMOJI[nextItem.type] ?? "📌"} {nextItem.title}
                </p>
                {nextItem.startTime && (
                  <p className="text-xs text-[#6B6560] mt-0.5">
                    {new Date(nextItem.startTime).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    {nextItem.locationName ? ` · ${nextItem.locationName}` : ""}
                  </p>
                )}
              </div>
            )}

            {trip.itineraryItems.length === 0 && (
              <div className="flex flex-col items-center py-10 text-center">
                <span className="text-4xl mb-3">🗺️</span>
                <p className="text-[15px] font-semibold text-[#1A1512]">Nothing planned yet</p>
                <p className="text-sm text-[#6B6560] mt-1">Tap + to add the first stop</p>
              </div>
            )}

            {/* Recent activity */}
            {(() => {
              type ActivityEntry = { time: Date; emoji: string; text: string };
              const activities: ActivityEntry[] = [];

              for (const item of trip.itineraryItems) {
                activities.push({
                  time: new Date(item.createdAt),
                  emoji: ITEM_EMOJI[item.type] ?? "📌",
                  text: `Added "${item.title}"`,
                });
              }
              for (const c of trip.comments) {
                activities.push({
                  time: new Date(c.createdAt),
                  emoji: "💬",
                  text: `${c.user.name.split(" ")[0]}: ${c.body.length > 50 ? c.body.slice(0, 50) + "…" : c.body}`,
                });
              }

              activities.sort((a, b) => b.time.getTime() - a.time.getTime());
              const recent = activities.slice(0, 5);
              if (recent.length === 0) return null;

              return (
                <div className="bg-white border border-[#E5E0DA] rounded-[16px] p-4">
                  <p className="text-[14px] font-semibold text-[#1A1512] mb-3">Recent Activity</p>
                  <div className="space-y-2.5">
                    {recent.map((a, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="text-base flex-shrink-0 mt-0.5">{a.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-[#1A1512] truncate">{a.text}</p>
                        </div>
                        <span className="text-[11px] text-[#A09B96] flex-shrink-0 mt-0.5">{timeAgo(a.time)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Files */}
            <div className="bg-white border border-[#E5E0DA] rounded-[16px] p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[14px] font-semibold text-[#1A1512]">
                  Files {tripAttachments.length > 0 && <span className="text-[#A09B96] font-normal">· {tripAttachments.length}</span>}
                </p>
                <AttachmentUpload
                  tripId={trip.id}
                  onUploaded={() => utils.attachments.listByTrip.invalidate({ tripId })}
                />
              </div>
              {tripAttachments.length > 0 ? (
                <AttachmentGallery
                  attachments={tripAttachments}
                  currentUserId={userId}
                  uploaderIds={Object.fromEntries(tripAttachments.map((a) => [a.id, a.uploadedBy]))}
                  onDelete={async (id) => {
                    await fetch(`/api/upload/${id}`, { method: "DELETE" });
                    utils.attachments.listByTrip.invalidate({ tripId });
                  }}
                />
              ) : (
                <p className="text-sm text-[#A09B96]">No files yet — tap Add file to attach a photo or PDF.</p>
              )}
            </div>
          </div>
        )}

        {tab === "itinerary" && (
          <ItineraryTimeline
            items={trip.itineraryItems}
            tripId={trip.id}
            userId={userId}
            legDistances={legDistances}
            legDurations={legDurations}
            legModes={legModes}
            onLegModeChange={handleLegModeChange}
          />
        )}

        {/* map rendered in fixed overlay outside content div */}

        {tab === "budget" && (
          <BudgetTab
            tripId={trip.id}
            userId={userId}
            members={trip.group.members}
            itineraryItems={trip.itineraryItems}
            budgetCents={trip.budgetCents}
            budgetCurrency={trip.budgetCurrency}
          />
        )}

        {tab === "pack" && (
          <PackingTab tripId={trip.id} userId={userId} />
        )}

        {tab === "chat" && (
          <CommentThread tripId={trip.id} userId={userId} />
        )}
      </div>

      {/* Map fixed overlay — rendered after 300ms hero collapse, z-10 sits below sticky tab bar (z-20) and bottom nav (z-50) */}
      {showMapOverlay && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 10, display: "flex", flexDirection: "column" }}>
            <MapView
              items={mapFilteredPinnedItems}
              onSelectItem={(id) => setMapSelectedId(id)}
              routeSegments={routeSegments}
              totalKm={totalKm || routeData?.totalKm}
              legDistances={legDistances}
              legDurations={legDurations}
            />
            {showMapFilter && (
              <div
                style={{ position: "absolute", top: 'calc(var(--tab-bar-height) + 8px)', left: 0, right: 0, zIndex: 10, pointerEvents: "none" } as React.CSSProperties}
                className="flex gap-2 px-4 overflow-x-auto"
              >
                {mapChips.map(chip => (
                  <button
                    key={chip.key ?? "all"}
                    onClick={() => setMapDay(mapDay === chip.key ? null : chip.key)}
                    style={{ pointerEvents: "auto" }}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors shadow-sm ${
                      mapDay === chip.key
                        ? "bg-[#E8622A] text-white"
                        : "bg-white/90 text-[#6B6560]"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <BottomSheet
            open={mapSelectedId !== null}
            onOpenChange={(open) => { if (!open) setMapSelectedId(null); }}
          >
            {(() => {
              const item = trip.itineraryItems.find((i) => i.id === mapSelectedId);
              if (!item) return null;
              const emoji = ITEM_EMOJI[item.type] ?? "📌";
              return (
                <div className="px-5 pb-8 space-y-3">
                  <BottomSheetTitle>{emoji} {item.title}</BottomSheetTitle>
                  {item.locationName && (
                    <p className="text-sm text-[#6B6560]">📍 {item.locationName}</p>
                  )}
                  {item.startTime && (
                    <p className="text-sm text-[#6B6560]">
                      🕐{" "}
                      {new Date(item.startTime).toLocaleString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                  {item.description && (
                    <p className="text-sm text-[#1A1512]">{item.description}</p>
                  )}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-[#E8622A] font-medium underline truncate"
                    >
                      {item.url}
                    </a>
                  )}
                </div>
              );
            })()}
          </BottomSheet>
        </>
      )}

      {/* FAB — only on Plan tab */}
      {tab === "itinerary" && (
        <button
          onClick={() => setAddItemOpen(true)}
          className="fixed bottom-24 right-5 w-10 h-10 bg-[#E8622A] rounded-full shadow-[0_4px_16px_rgba(232,98,42,0.40)] flex items-center justify-center text-white z-40"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {/* Add item sheet */}
      <BottomSheet open={addItemOpen} onOpenChange={setAddItemOpen}>
        <BottomSheetTitle>Add to Itinerary</BottomSheetTitle>
        <AddItemForm tripId={trip.id} onSuccess={onItemAdded} />
      </BottomSheet>
    </div>
  );
}
