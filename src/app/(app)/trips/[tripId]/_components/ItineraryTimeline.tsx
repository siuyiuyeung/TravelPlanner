"use client";

import { useState, useRef, useCallback } from "react";
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

type Props = {
  items: ItineraryItem[];
  tripId: string;
  userId: string;
  legMap?: Map<string, number> | undefined;
};

const ITEM_EMOJI: Record<string, string> = {
  flight: "✈️",
  hotel: "🏨",
  restaurant: "🍜",
  activity: "🎭",
  transport: "🚌",
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
  return new Date(startTime).toISOString().slice(0, 10);
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

function formatCost(cents: number) {
  return (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 });
}

// ── Drag-to-reorder hook ──────────────────────────────────────────────────────

function useDragReorder(
  initialOrder: string[],
  onCommit: (orderedIds: string[]) => void
) {
  const [order, setOrder] = useState<string[]>(initialOrder);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragging = useRef(false);

  // Reset order when initialOrder changes (e.g. after server refetch)
  const latestInitial = useRef(initialOrder);
  if (JSON.stringify(latestInitial.current) !== JSON.stringify(initialOrder) && !isDragging.current) {
    latestInitial.current = initialOrder;
    setOrder(initialOrder);
  }

  function handleHandlePointerDown(id: string, e: React.PointerEvent) {
    e.stopPropagation();
    longPressTimer.current = setTimeout(() => {
      isDragging.current = true;
      setDraggingId(id);
      if (navigator.vibrate) navigator.vibrate(10);
    }, 350);
  }

  function handleHandlePointerUp() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || !draggingId) return;
    e.preventDefault();

    for (const [id, ref] of Object.entries(itemRefs.current)) {
      if (!ref || id === draggingId) continue;
      const rect = ref.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (Math.abs(e.clientY - midY) < rect.height / 2) {
        setOrder((prev) => {
          const next = [...prev];
          const fromIdx = next.indexOf(draggingId);
          const toIdx = next.indexOf(id);
          if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
          next.splice(fromIdx, 1);
          next.splice(toIdx, 0, draggingId);
          return next;
        });
        break;
      }
    }
  }, [draggingId]);

  function handlePointerUp() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (isDragging.current) {
      isDragging.current = false;
      setDraggingId(null);
      onCommit(order);
    }
  }

  return {
    order,
    draggingId,
    itemRefs,
    handleHandlePointerDown,
    handleHandlePointerUp,
    handlePointerMove,
    handlePointerUp,
  };
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

// ── Day section with drag ─────────────────────────────────────────────────────

function DaySection({
  dateStr,
  dayIndex,
  items,
  userId,
  tripId,
  legMap,
  onEdit,
  onToggleConfirm,
  onCastVote,
}: {
  dateStr: string;
  dayIndex: number;
  items: ItineraryItem[];
  userId: string;
  tripId: string;
  legMap?: Map<string, number> | undefined;
  onEdit: (item: ItineraryItem) => void;
  onToggleConfirm: (itemId: string) => void;
  onCastVote: (itemId: string, vote: VoteType) => void;
}) {
  const utils = api.useUtils();
  const reorder = api.itinerary.reorder.useMutation({
    onSuccess: () => utils.trips.getById.invalidate({ tripId }),
  });

  const initialOrder = items.map((i) => i.id);
  const { order, draggingId, itemRefs, handleHandlePointerDown, handleHandlePointerUp, handlePointerMove, handlePointerUp } =
    useDragReorder(initialOrder, (orderedIds) => {
      reorder.mutate({
        tripId,
        items: orderedIds.map((id, index) => ({ id, sortOrder: index })),
      });
    });

  const { mono, readable } = formatDayHeader(dateStr, dayIndex);
  const orderedItems = order.map((id) => items.find((i) => i.id === id)).filter(Boolean) as ItineraryItem[];

  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Day header */}
      <div className="flex items-baseline gap-2 mb-3 sticky top-0 bg-[#FAF8F5] py-1 z-10">
        <span className="font-mono text-[13px] font-bold text-[#F2A93B] tracking-wider">{mono}</span>
        <span className="text-xs text-[#A09B96]">{readable}</span>
      </div>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-[#E5E0DA]" />

        <div className="space-y-3">
          {orderedItems.map((item) => {
            const nodeColor = NODE_COLORS[item.type] ?? "bg-[#A09B96]";
            const isDragged = draggingId === item.id;
            const legKm = legMap?.get(item.id);

            return (
              <div key={item.id}>
              <div
                ref={(el) => { itemRefs.current[item.id] = el; }}
                className={`flex gap-4 transition-opacity duration-150 ${isDragged ? "opacity-40" : "opacity-100"}`}
              >
                {/* Drag handle */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${nodeColor} z-10 mt-3`}
                  >
                    <span>{ITEM_EMOJI[item.type] ?? "📌"}</span>
                  </div>
                  <div
                    className="text-[#C8C0B8] text-[10px] leading-none cursor-grab select-none touch-none"
                    onPointerDown={(e) => handleHandlePointerDown(item.id, e)}
                    onPointerUp={handleHandlePointerUp}
                  >
                    ⠿
                  </div>
                </div>

                {/* Card */}
                <div
                  className={`flex-1 bg-white border rounded-[12px] p-3 shadow-[0_1px_3px_rgba(26,21,18,0.04)] active:scale-[0.99] transition-all cursor-pointer ${
                    isDragged ? "border-[#E8622A] shadow-[0_4px_12px_rgba(232,98,42,0.20)] scale-[1.01]" : "border-[#E5E0DA]"
                  }`}
                  onClick={() => onEdit(item)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[14px] font-semibold text-[#1A1512]">{item.title}</p>
                    <span className="text-[11px] text-[#A09B96] flex-shrink-0">Edit ›</span>
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
                    {item.costCents != null && item.costCents > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 bg-[rgba(242,169,59,0.15)] rounded-full text-[10px] text-[#B8860B]">
                        ${formatCost(item.costCents)}
                      </span>
                    )}
                  </div>

                  {item.description && (
                    <p className="text-xs text-[#A09B96] mt-1.5 line-clamp-2">{item.description}</p>
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
              {legKm !== undefined && (
                <div className="flex items-center gap-2 pl-10 py-1">
                  <div className="flex-1 border-t border-dashed border-[#E5E0DA]" />
                  <span className="text-[11px] font-semibold text-[#A09B96] font-mono flex-shrink-0">
                    🚗 {legKm < 1 ? `${Math.round(legKm * 1000)} m` : `${legKm.toFixed(1)} km`}
                  </span>
                  <div className="flex-1 border-t border-dashed border-[#E5E0DA]" />
                </div>
              )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ItineraryTimeline({ items, tripId, userId, legMap }: Props) {
  const utils = api.useUtils();
  const [editItem, setEditItem] = useState<ItineraryItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null); // null = All

  const toggleConfirmation = api.itinerary.toggleConfirmation.useMutation({
    onSuccess: () => utils.trips.getById.invalidate({ tripId }),
  });
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

  // Day filter chips data
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
              activeDay === null
                ? "bg-[#E8622A] text-white"
                : "bg-[#F0EDE8] text-[#6B6560]"
            }`}
          >
            All
          </button>
          {dayChips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setActiveDay(activeDay === chip.key ? null : chip.key)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                activeDay === chip.key
                  ? "bg-[#E8622A] text-white"
                  : "bg-[#F0EDE8] text-[#6B6560]"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-6">
        {filteredGroups.map(([dateStr, dayItems], index) => {
          // Use original index from groups for day numbering when filtered
          const originalIndex = groups.findIndex(([k]) => k === dateStr);
          return (
            <DaySection
              key={dateStr || "no-date"}
              dateStr={dateStr}
              dayIndex={originalIndex + 1}
              items={dayItems}
              userId={userId}
              tripId={tripId}
              legMap={legMap}
              onEdit={setEditItem}
              onToggleConfirm={(itemId) => toggleConfirmation.mutate({ itemId })}
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
            onSuccess={() => {
              setEditItem(null);
              utils.trips.getById.invalidate({ tripId });
            }}
            onDelete={() => setDeleteConfirmId(editItem.id)}
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
