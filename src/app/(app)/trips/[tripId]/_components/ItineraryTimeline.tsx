"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { api } from "@/lib/trpc/client";
import { BottomSheet, BottomSheetTitle } from "@/components/ui/bottom-sheet";
import { EditItemForm } from "./EditItemForm";

type VoteType = "yes" | "maybe" | "no";

type ItineraryItem = {
  id: string;
  title: string;
  type: string;
  startTime: Date | string | null;
  endTime: Date | string | null;
  locationName: string | null;
  locationLat: string | null;
  locationLng: string | null;
  costCents: number | null;
  currency: string | null;
  description: string | null;
  sortOrder: number;
  confirmations: { userId: string }[];
  votes: { userId: string; vote: VoteType }[];
};

type RouteMode = "driving" | "walking" | "cycling" | "transit";

const ROUTE_MODE_ICON: Record<RouteMode, string> = {
  driving: "🚗",
  walking: "🚶",
  cycling: "🚴",
  transit: "🚌",
};

const MODES: { value: RouteMode; icon: string }[] = [
  { value: "driving", icon: "🚗" },
  { value: "walking", icon: "🚶" },
  { value: "cycling", icon: "🚴" },
  { value: "transit", icon: "🚌" },
];

type Props = {
  items: ItineraryItem[];
  tripId: string;
  userId: string;
  legDistances?: Record<string, number> | undefined;
  legModes?: Record<string, RouteMode> | undefined;
  onLegModeChange?: ((itemId: string, mode: RouteMode) => void) | undefined;
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

function toDateKey(startTime: Date | string | null): string {
  if (!startTime) return "";
  const d = new Date(startTime);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  const mono = `DAY ${String(dayIndex).padStart(2, "0")}`;
  const readable = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  return { mono, readable };
}

function formatLegDist(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

// ── Vote tally bar ────────────────────────────────────────────────────────────

function VoteTallyBar({ votes }: { votes: { vote: VoteType }[] }) {
  const yes = votes.filter((v) => v.vote === "yes").length;
  const maybe = votes.filter((v) => v.vote === "maybe").length;
  const no = votes.filter((v) => v.vote === "no").length;
  const total = votes.length;
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 flex rounded-full overflow-hidden h-1.5 bg-[#F0EDE8]">
        {yes > 0 && (
          <div className="bg-[#3D9970] h-full transition-all" style={{ width: `${(yes / total) * 100}%` }} />
        )}
        {maybe > 0 && (
          <div className="bg-[#F2A93B] h-full transition-all" style={{ width: `${(maybe / total) * 100}%` }} />
        )}
        {no > 0 && (
          <div className="bg-[#A09B96] h-full transition-all" style={{ width: `${(no / total) * 100}%` }} />
        )}
      </div>
      <span className="text-[10px] text-[#A09B96] flex-shrink-0">
        {yes}✓ {maybe}~ {no}✗
      </span>
    </div>
  );
}

// ── Swipe-to-reorder hook ────────────────────────────────────────────────────
// Attaches touch events to a handle element only (the ⠿ icon).
// dragDy is applied to the card visually; the handle is the sole trigger.

function useSwipeReorder({
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const handleRef = useRef<HTMLSpanElement>(null);
  const [dragDy, setDragDy] = useState(0);
  const internal = useRef({ startY: 0, active: false, currentDy: 0 });
  const cbs = useRef({ onMoveUp, onMoveDown, canMoveUp, canMoveDown });
  useLayoutEffect(() => {
    cbs.current = { onMoveUp, onMoveDown, canMoveUp, canMoveDown };
  });

  useEffect(() => {
    const el = handleRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      internal.current.startY = e.touches[0]!.clientY;
      internal.current.active = true;
      internal.current.currentDy = 0;
    }

    function onTouchMove(e: TouchEvent) {
      if (!internal.current.active) return;
      e.preventDefault();
      const dy = e.touches[0]!.clientY - internal.current.startY;
      const abs = Math.abs(dy);
      const clamped = abs <= 60 ? dy : Math.sign(dy) * (60 + (abs - 60) * 0.25);
      internal.current.currentDy = dy;
      setDragDy(clamped);
    }

    function onTouchEnd() {
      if (!internal.current.active) return;
      const dy = internal.current.currentDy;
      const { onMoveUp, onMoveDown, canMoveUp, canMoveDown } = cbs.current;
      if (dy < -40 && canMoveUp) onMoveUp();
      else if (dy > 40 && canMoveDown) onMoveDown();
      internal.current.active = false;
      internal.current.currentDy = 0;
      setDragDy(0);
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return { handleRef, dragDy };
}

// ── Item card ─────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  idx,
  total,
  userId,
  legDistances,
  legModes,
  onLegModeChange,
  onEdit,
  onCastVote,
  onMove,
}: {
  item: ItineraryItem;
  idx: number;
  total: number;
  userId: string;
  legDistances?: Record<string, number> | undefined;
  legModes?: Record<string, RouteMode> | undefined;
  onLegModeChange?: ((itemId: string, mode: RouteMode) => void) | undefined;
  onEdit: (item: ItineraryItem) => void;
  onCastVote: (itemId: string, vote: VoteType) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  const canMoveUp = idx > 0;
  const canMoveDown = idx < total - 1;

  const { handleRef, dragDy } = useSwipeReorder({
    onMoveUp: () => onMove(item.id, -1),
    onMoveDown: () => onMove(item.id, 1),
    canMoveUp,
    canMoveDown,
  });

  const nodeColor = NODE_COLORS[item.type] ?? "bg-[#A09B96]";
  const legKm = legDistances?.[item.id];
  const legMode = legModes?.[item.id] ?? "driving";
  const isDragging = dragDy !== 0;

  return (
    <div>
      {/* Row: node + card */}
      <div className="flex gap-3 group">
        {/* Left column: node dot + hover reorder buttons (desktop fallback) */}
        <div className="flex flex-col items-center flex-shrink-0 w-6 gap-0.5">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${nodeColor} z-10 mt-3`}
          >
            <span>{ITEM_EMOJI[item.type] ?? "📌"}</span>
          </div>
          <button
            type="button"
            onClick={() => onMove(item.id, -1)}
            disabled={!canMoveUp}
            className="w-5 h-5 flex items-center justify-center rounded text-[#C8C0B8] hover:text-[#6B6560] hover:bg-[#F0EDE8] disabled:opacity-0 transition-all text-[10px] opacity-0 group-hover:opacity-100"
            aria-label="Move up"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => onMove(item.id, 1)}
            disabled={!canMoveDown}
            className="w-5 h-5 flex items-center justify-center rounded text-[#C8C0B8] hover:text-[#6B6560] hover:bg-[#F0EDE8] disabled:opacity-0 transition-all text-[10px] opacity-0 group-hover:opacity-100"
            aria-label="Move down"
          >
            ▼
          </button>
        </div>

        {/* Card — swipe up/down to reorder */}
        <div
          style={{
            transform: `translateY(${dragDy}px)`,
            transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.15s",
            boxShadow: isDragging
              ? "0 10px 28px rgba(26,21,18,0.18)"
              : "0 1px 3px rgba(26,21,18,0.04)",
            zIndex: isDragging ? 20 : undefined,
          }}
          className={`flex-1 min-w-0 bg-white border rounded-[12px] p-3 cursor-pointer relative select-none ${
            isDragging
              ? "border-[#E8622A] scale-[1.025]"
              : "border-[#E5E0DA] active:scale-[0.99]"
          }`}
          onClick={() => onEdit(item)}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[14px] font-semibold text-[#1A1512] break-words min-w-0">{item.title}</p>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Drag handle — touch here to reorder */}
              <span
                ref={handleRef}
                style={{ touchAction: "none" }}
                className="text-[#C8C0B8] text-[18px] leading-none select-none cursor-grab active:cursor-grabbing px-1 -mr-1"
                onClick={(e) => e.stopPropagation()}
                aria-label="Drag to reorder"
              >
                ⠿
              </span>
              <span className="text-[11px] text-[#A09B96]">Edit ›</span>
            </div>
          </div>

          {item.startTime && (
            <p className="text-xs text-[#6B6560] mt-0.5">
              {new Date(item.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              {item.endTime ? ` – ${new Date(item.endTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5 mt-2">
            {item.locationName && (
              <span className="inline-flex items-center px-2 py-0.5 bg-[#F0EDE8] rounded-full text-[10px] text-[#6B6560]">
                📍 {item.locationName}
              </span>
            )}
          </div>

          {item.description && (
            <p className="text-xs text-[#A09B96] mt-1.5 line-clamp-2 break-words">{item.description}</p>
          )}

          <div
            className="flex flex-col gap-2 mt-2.5 pt-2.5 border-t border-[#F0EDE8]"
            onClick={(e) => e.stopPropagation()}
          >
            <VoteTallyBar votes={item.votes} />
            <div className="flex items-center gap-1.5">
              {(["yes", "maybe", "no"] as VoteType[]).map((v) => {
                const myVote = item.votes.find((vote) => vote.userId === userId)?.vote;
                const isActive = myVote === v;
                const count = item.votes.filter((vote) => vote.vote === v).length;
                const label = v === "yes" ? "👍" : v === "maybe" ? "🤔" : "👎";
                const activeStyle =
                  v === "yes"
                    ? "bg-[rgba(61,153,112,0.15)] text-[#3D9970] border-[rgba(61,153,112,0.3)]"
                    : v === "maybe"
                    ? "bg-[rgba(242,169,59,0.15)] text-[#B8860B] border-[rgba(242,169,59,0.3)]"
                    : "bg-[rgba(160,155,150,0.15)] text-[#6B6560] border-[rgba(160,155,150,0.3)]";
                return (
                  <button
                    key={v}
                    onClick={() => onCastVote(item.id, v)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                      isActive ? activeStyle : "bg-[#F0EDE8] text-[#6B6560] border-transparent"
                    }`}
                  >
                    {label}
                    {count > 0 && <span className="font-mono">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Per-leg distance connector */}
      {legKm !== undefined && (
        <div className="flex items-center gap-2 pl-9 py-1.5">
          <div className="flex-1 border-t border-dashed border-[#E5E0DA]" />
          {/* Mode picker */}
          <div className="flex items-center gap-0.5 bg-[#F0EDE8] rounded-full px-1.5 py-0.5">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => onLegModeChange?.(item.id, m.value)}
                className={`w-6 h-6 flex items-center justify-center rounded-full text-[12px] transition-colors ${
                  legMode === m.value
                    ? "bg-[#E8622A] shadow-sm"
                    : "hover:bg-[#E5E0DA]"
                }`}
                aria-label={m.value}
              >
                {m.icon}
              </button>
            ))}
          </div>
          <span className="text-[11px] font-semibold text-[#A09B96] font-mono flex-shrink-0">
            {ROUTE_MODE_ICON[legMode]} {formatLegDist(legKm)}
          </span>
          <div className="flex-1 border-t border-dashed border-[#E5E0DA]" />
        </div>
      )}
    </div>
  );
}

// ── Day section ───────────────────────────────────────────────────────────────

function DaySection({
  dateStr,
  dayIndex,
  items,
  userId,
  tripId,
  legDistances,
  legModes,
  onLegModeChange,
  onEdit,
  onCastVote,
}: {
  dateStr: string;
  dayIndex: number;
  items: ItineraryItem[];
  userId: string;
  tripId: string;
  legDistances?: Record<string, number> | undefined;
  legModes?: Record<string, RouteMode> | undefined;
  onLegModeChange?: ((itemId: string, mode: RouteMode) => void) | undefined;
  onEdit: (item: ItineraryItem) => void;
  onCastVote: (itemId: string, vote: VoteType) => void;
}) {
  const utils = api.useUtils();
  const reorder = api.itinerary.reorder.useMutation({
    onSuccess: () => utils.trips.getById.invalidate({ tripId }),
  });

  const [order, setOrder] = useState<string[]>(items.map((i) => i.id));

  // Sync with server data when items change externally (derived-state pattern)
  const [prevItemKey, setPrevItemKey] = useState(() => items.map((i) => i.id).join(","));
  const newItemKey = items.map((i) => i.id).join(",");
  if (prevItemKey !== newItemKey) {
    setPrevItemKey(newItemKey);
    setOrder(items.map((i) => i.id));
  }

  function move(id: string, dir: -1 | 1) {
    const next = [...order];
    const idx = next.indexOf(id);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= next.length) return;
    [next[idx], next[targetIdx]] = [next[targetIdx]!, next[idx]!];
    setOrder(next);
    reorder.mutate({
      tripId,
      items: next.map((itemId, i) => ({ id: itemId, sortOrder: i })),
    });
  }

  const { mono, readable } = formatDayHeader(dateStr, dayIndex);
  const orderedItems = order.map((id) => items.find((i) => i.id === id)).filter(Boolean) as ItineraryItem[];

  return (
    <div>
      {/* Day header */}
      <div className="flex items-baseline gap-2 mb-3 sticky top-0 bg-[#FAF8F5] py-1 z-10">
        <span className="font-mono text-[13px] font-bold text-[#F2A93B] tracking-wider">{mono}</span>
        <span className="text-xs text-[#A09B96]">{readable}</span>
      </div>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-[#E5E0DA]" />

        <div className="space-y-3">
          {orderedItems.map((item, idx) => (
            <ItemCard
              key={item.id}
              item={item}
              idx={idx}
              total={orderedItems.length}
              userId={userId}
              legDistances={legDistances}
              legModes={legModes}
              onLegModeChange={onLegModeChange}
              onEdit={onEdit}
              onCastVote={onCastVote}
              onMove={move}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ItineraryTimeline({ items, tripId, userId, legDistances, legModes, onLegModeChange }: Props) {
  const utils = api.useUtils();
  const [editItem, setEditItem] = useState<ItineraryItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);

  const castVote = api.itinerary.castVote.useMutation({
    onSuccess: () => utils.trips.getById.invalidate({ tripId }),
  });
  const deleteItem = api.itinerary.delete.useMutation({
    onSuccess: () => {
      setDeleteConfirmId(null);
      setEditItem(null);
      utils.trips.getById.invalidate({ tripId });
    },
  });

  const sorted = [...items].sort((a, b) => {
    const aTime = a.startTime ? new Date(a.startTime).getTime() : null;
    const bTime = b.startTime ? new Date(b.startTime).getTime() : null;
    if (aTime && bTime) return aTime - bTime || a.sortOrder - b.sortOrder;
    if (aTime) return -1;
    if (bTime) return 1;
    return a.sortOrder - b.sortOrder;
  });

  const groups = groupByDate(sorted);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <span className="text-4xl mb-3">🗺️</span>
        <p className="text-[15px] font-semibold text-[#1A1512]">Nothing planned yet</p>
        <p className="text-sm text-[#6B6560] mt-1">Tap + to add the first stop</p>
      </div>
    );
  }

  const dayChips = groups.map(([dateStr], i) => ({
    key: dateStr || "__none__",
    label: dateStr ? `Day ${i + 1}` : "Unscheduled",
  }));

  const filteredGroups = activeDay === null
    ? groups
    : groups.filter(([dateStr]) => (dateStr || "__none__") === activeDay);

  return (
    <>
      {/* Day filter chips */}
      {dayChips.length > 1 && (
        <div
          className="flex gap-2 overflow-x-auto pb-3 mb-4"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
        >
          <button
            onClick={() => setActiveDay(null)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
              activeDay === null ? "bg-[#E8622A] text-white" : "bg-[#F0EDE8] text-[#6B6560]"
            }`}
          >
            All
          </button>
          {dayChips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setActiveDay(activeDay === chip.key ? null : chip.key)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                activeDay === chip.key ? "bg-[#E8622A] text-white" : "bg-[#F0EDE8] text-[#6B6560]"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-6">
        {filteredGroups.map(([dateStr, dayItems]) => {
          const originalIndex = groups.findIndex(([k]) => k === dateStr);
          return (
            <DaySection
              key={dateStr || "no-date"}
              dateStr={dateStr}
              dayIndex={originalIndex + 1}
              items={dayItems}
              userId={userId}
              tripId={tripId}
              legDistances={legDistances}
              legModes={legModes}
              onLegModeChange={onLegModeChange}
              onEdit={setEditItem}
              onCastVote={(itemId, vote) => castVote.mutate({ itemId, vote })}
            />
          );
        })}
      </div>

      {/* Edit sheet */}
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
            onDelete={() => { setEditItem(null); setDeleteConfirmId(editItem.id); }}
          />
        )}
      </BottomSheet>

      {/* Delete confirm sheet */}
      <BottomSheet open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <BottomSheetTitle>Delete item?</BottomSheetTitle>
        <div className="px-5 pb-8 space-y-3">
          <p className="text-sm text-[#6B6560]">This cannot be undone.</p>
          <button
            onClick={() => deleteItem.mutate({ itemId: deleteConfirmId! })}
            disabled={deleteItem.isPending}
            className="w-full py-4 bg-[#E84040] text-white font-bold text-[15px] rounded-[12px] disabled:opacity-50"
          >
            {deleteItem.isPending ? "Deleting…" : "Delete"}
          </button>
          <button
            onClick={() => setDeleteConfirmId(null)}
            className="w-full py-4 border border-[#E5E0DA] text-[#6B6560] font-semibold text-[15px] rounded-[12px]"
          >
            Cancel
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
