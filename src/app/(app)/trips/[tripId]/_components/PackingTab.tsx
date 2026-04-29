"use client";

import { useState, useRef } from "react";
import { api } from "@/lib/trpc/client";
import { useSwipeToDelete } from "@/hooks/use-swipe-to-delete";
import { BottomSheet, BottomSheetTitle } from "@/components/ui/bottom-sheet";

type Props = {
  tripId: string;
  userId: string;
};

const CATEGORIES = [
  { value: "general",     emoji: "📦", label: "General" },
  { value: "clothing",    emoji: "👕", label: "Clothing" },
  { value: "toiletries",  emoji: "🧴", label: "Toiletries" },
  { value: "documents",   emoji: "📄", label: "Documents" },
  { value: "electronics", emoji: "🔌", label: "Electronics" },
  { value: "health",      emoji: "💊", label: "Health" },
  { value: "food",        emoji: "🍱", label: "Food" },
  { value: "other",       emoji: "🎒", label: "Other" },
] as const;

type CategoryValue = (typeof CATEGORIES)[number]["value"];

function categoryMeta(val: string) {
  return CATEGORIES.find((c) => c.value === val) ?? CATEGORIES[0]!;
}

// ─── Add Item Form ─────────────────────────────────────────────────────────────

function AddItemRow({ tripId, onAdded, onClose }: { tripId: string; onAdded: () => void; onClose?: () => void }) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [category, setCategory] = useState<CategoryValue>("general");
  const [isPersonal, setIsPersonal] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const utils = api.useUtils();
  const add = api.packing.add.useMutation({
    onSuccess: () => {
      utils.packing.listByTrip.invalidate({ tripId });
      setName("");
      setQty("1");
      setCategory("general");
      setIsPersonal(false);
      setExpanded(false);
      onAdded();
      onClose?.();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    add.mutate({
      tripId,
      name: name.trim(),
      quantity: Math.max(1, parseInt(qty) || 1),
      category,
      isPersonal,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#E5E0DA] rounded-[14px] p-4 space-y-3">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); if (!expanded && e.target.value) setExpanded(true); }}
          placeholder="Add an item…"
          className="flex-1 px-3 py-2.5 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[16px] text-[#1A1512] placeholder:text-[#A09B96] focus:outline-none focus:border-[#E8622A]"
        />
        <button
          type="submit"
          disabled={!name.trim() || add.isPending}
          className="px-4 py-2.5 bg-[#E8622A] text-white font-semibold text-[14px] rounded-[10px] disabled:opacity-40 flex-shrink-0"
        >
          Add
        </button>
      </div>

      {expanded && (
        <div className="space-y-2.5">
          {/* Category */}
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                  category === c.value
                    ? "border-[#E8622A] bg-[rgba(232,98,42,0.08)] text-[#E8622A]"
                    : "border-[#E5E0DA] bg-[#F0EDE8] text-[#6B6560]"
                }`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>

          <div className="flex gap-3 items-center">
            {/* Quantity */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#6B6560]">Qty</span>
              <div className="flex items-center border border-[#E5E0DA] rounded-[8px] overflow-hidden">
                <button type="button" onClick={() => setQty((q) => String(Math.max(1, parseInt(q) - 1)))}
                  className="w-8 h-8 flex items-center justify-center text-[#6B6560] text-lg font-bold bg-[#F0EDE8]">−</button>
                <span className="w-8 text-center text-[14px] font-semibold text-[#1A1512]">{qty}</span>
                <button type="button" onClick={() => setQty((q) => String(parseInt(q) + 1))}
                  className="w-8 h-8 flex items-center justify-center text-[#6B6560] text-lg font-bold bg-[#F0EDE8]">+</button>
              </div>
            </div>

            {/* Personal toggle */}
            <button
              type="button"
              onClick={() => setIsPersonal((p) => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                isPersonal
                  ? "border-[#A78BFA] bg-[rgba(167,139,250,0.1)] text-[#7C3AED]"
                  : "border-[#E5E0DA] bg-[#F0EDE8] text-[#6B6560]"
              }`}
            >
              {isPersonal ? "🔒 Just me" : "👥 Shared"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

// ─── Packing Item Row ──────────────────────────────────────────────────────────

type PackingItem = {
  id: string;
  name: string;
  quantity: number;
  category: string;
  isPersonal: boolean;
  checked: boolean;
  addedBy: string;
  adder: { name: string };
};

function PackingItemRow({
  item,
  tripId,
  userId,
}: {
  item: PackingItem;
  tripId: string;
  userId: string;
}) {
  const utils = api.useUtils();
  const { swiped, onTouchStart, onTouchEnd, onMouseDown, onClickCapture } = useSwipeToDelete();

  const toggle = api.packing.toggleCheck.useMutation({
    onMutate: async () => {
      await utils.packing.listByTrip.cancel({ tripId });
      const prev = utils.packing.listByTrip.getData({ tripId });
      utils.packing.listByTrip.setData({ tripId }, (old) =>
        old?.map((i) => i.id === item.id ? { ...i, checked: !i.checked } : i)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.packing.listByTrip.setData({ tripId }, ctx.prev);
    },
    onSettled: () => utils.packing.listByTrip.invalidate({ tripId }),
  });

  const del = api.packing.delete.useMutation({
    onSuccess: () => utils.packing.listByTrip.invalidate({ tripId }),
  });

  const cat = categoryMeta(item.category);
  const canDelete = item.addedBy === userId;

  return (
    <div className="relative overflow-hidden rounded-[12px]" onClickCapture={canDelete ? onClickCapture : undefined}>
      {canDelete && (
        <div className="absolute inset-y-0 right-0 w-20 bg-[#E84040] flex items-center justify-center rounded-r-[12px]">
          <button
            onClick={() => del.mutate({ itemId: item.id })}
            className="text-white text-[13px] font-semibold px-3"
          >
            Delete
          </button>
        </div>
      )}

      <div
        onTouchStart={canDelete ? onTouchStart : undefined}
        onTouchEnd={canDelete ? onTouchEnd : undefined}
        onMouseDown={canDelete ? onMouseDown : undefined}
        style={canDelete ? { transform: swiped ? "translateX(-80px)" : "translateX(0)", transition: "transform 0.2s ease" } : undefined}
        className="bg-white border border-[#E5E0DA] rounded-[12px] flex items-center gap-3 px-4 py-3 select-none"
      >
        {/* Checkbox */}
        <button
          type="button"
          onClick={() => toggle.mutate({ itemId: item.id })}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            item.checked
              ? "bg-[#3D9970] border-[#3D9970]"
              : "border-[#C8C0B8] bg-white"
          }`}
        >
          {item.checked && <span className="text-white text-[11px] font-bold">✓</span>}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-[15px] font-medium leading-snug ${item.checked ? "line-through text-[#A09B96]" : "text-[#1A1512]"}`}>
            {item.name}
            {item.quantity > 1 && (
              <span className="ml-1.5 text-[12px] font-semibold text-[#E8622A]">×{item.quantity}</span>
            )}
          </p>
          <p className="text-[11px] text-[#A09B96] mt-0.5">
            {cat.emoji} {cat.label}
            {item.isPersonal && <span className="ml-1.5">· 🔒 just you</span>}
            {!item.isPersonal && item.adder.name && (
              <span className="ml-1.5">· {item.adder.name.split(" ")[0]}</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main PackingTab ───────────────────────────────────────────────────────────

export function PackingTab({ tripId, userId }: Props) {
  const { data: items = [], isLoading } = api.packing.listByTrip.useQuery({ tripId });
  const [filter, setFilter] = useState<"all" | "shared" | "mine">("all");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = items.filter((i) => {
    if (filter === "shared") return !i.isPersonal;
    if (filter === "mine") return i.isPersonal;
    return true;
  });

  const checkedCount = filtered.filter((i) => i.checked).length;
  const totalCount = filtered.length;

  // Group by category
  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    items: filtered.filter((i) => i.category === cat.value),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {/* Progress + filter */}
      {items.length > 0 && (
        <div className="space-y-2.5">
          {/* Progress bar — only when current filter has items */}
          {totalCount > 0 && (
            <div className="bg-white border border-[#E5E0DA] rounded-[12px] px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-semibold text-[#1A1512]">
                  {checkedCount} / {totalCount} packed
                </span>
                <span className="text-[12px] text-[#A09B96]">
                  {Math.round((checkedCount / totalCount) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-[#F0EDE8] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#3D9970] rounded-full transition-all duration-300"
                  style={{ width: `${(checkedCount / totalCount) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Filter pills — always visible while any items exist */}
          <div className="flex gap-2">
            {(["all", "shared", "mine"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                  filter === f
                    ? "border-[#E8622A] bg-[rgba(232,98,42,0.08)] text-[#E8622A]"
                    : "border-[#E5E0DA] bg-white text-[#6B6560]"
                }`}
              >
                {f === "all" ? "All" : f === "shared" ? "👥 Shared" : "🔒 Mine"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 rounded-full border-2 border-[#E8622A] border-t-transparent animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center py-10 text-center">
          <span className="text-4xl mb-3">🎒</span>
          <p className="text-[15px] font-semibold text-[#1A1512]">Nothing to pack yet</p>
          <p className="text-sm text-[#6B6560] mt-1">Tap + to add your first item</p>
        </div>
      )}

      {/* Grouped items */}
      {grouped.map((group) => (
        <div key={group.value} className="space-y-2">
          <p className="text-[12px] font-semibold text-[#A09B96] uppercase tracking-wide px-1">
            {group.emoji} {group.label}
          </p>
          <div className="space-y-2">
            {group.items.map((item) => (
              <PackingItemRow key={item.id} item={item} tripId={tripId} userId={userId} />
            ))}
          </div>
        </div>
      ))}

      {/* FAB */}
      <button
        onClick={() => setAddOpen(true)}
        className="fixed bottom-24 right-5 w-10 h-10 bg-[#E8622A] rounded-full shadow-[0_4px_16px_rgba(232,98,42,0.40)] flex items-center justify-center text-white z-40"
        aria-label="Add packing item"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
        </svg>
      </button>

      {/* Add item sheet */}
      <BottomSheet open={addOpen} onOpenChange={setAddOpen}>
        <BottomSheetTitle>Add Packing Item</BottomSheetTitle>
        <div className="px-5 pb-6">
          <AddItemRow tripId={tripId} onAdded={() => {}} onClose={() => setAddOpen(false)} />
        </div>
      </BottomSheet>
    </div>
  );
}
