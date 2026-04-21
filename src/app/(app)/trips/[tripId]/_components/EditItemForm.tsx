"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";
import { parseCents, formatCurrency } from "@/lib/utils";
import { LocationAutocomplete } from "./LocationAutocomplete";
import {
  CATEGORY_META,
  CATEGORIES,
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
  type Category,
  DEFAULT_CURRENCY,
} from "@/lib/budget-categories";

type ItineraryItem = {
  id: string;
  title: string;
  type: string;
  startTime: Date | string | null;
  endTime: Date | string | null;
  locationName: string | null;
  locationLat: string | null;
  locationLng: string | null;
  description: string | null;
};

type Props = {
  item: ItineraryItem;
  tripId: string;
  userId: string;
  onSuccess: () => void;
  onDelete: () => void;
};

const ITEM_TYPES = [
  { value: "flight", emoji: "✈️", label: "Flight" },
  { value: "hotel", emoji: "🏨", label: "Hotel" },
  { value: "restaurant", emoji: "🍜", label: "Food" },
  { value: "activity", emoji: "🎡", label: "Activity" },
  { value: "transport", emoji: "🚗", label: "Transport" },
  { value: "note", emoji: "📝", label: "Note" },
] as const;

type ItemType = (typeof ITEM_TYPES)[number]["value"];

function toDateInput(dt: Date | string | null): string {
  if (!dt) return "";
  const d = new Date(dt);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toTimeInput(dt: Date | string | null): string {
  if (!dt) return "";
  const d = new Date(dt);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function EditItemForm({ item, tripId, userId, onSuccess, onDelete }: Props) {
  const [type, setType] = useState<ItemType>((item.type as ItemType) ?? "activity");
  const [title, setTitle] = useState(item.title);
  const [date, setDate] = useState(toDateInput(item.startTime));
  const [time, setTime] = useState(toTimeInput(item.startTime));
  const [location, setLocation] = useState(item.locationName ?? "");
  const [locationLat, setLocationLat] = useState<string | undefined>(item.locationLat ?? undefined);
  const [locationLng, setLocationLng] = useState<string | undefined>(item.locationLng ?? undefined);
  const [description, setDescription] = useState(item.description ?? "");
  const [error, setError] = useState("");

  // Linked costs state
  const [addingCost, setAddingCost] = useState(false);
  const [costTitle, setCostTitle] = useState("");
  const [costAmount, setCostAmount] = useState("");
  const [costCurrency, setCostCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [costCategory, setCostCategory] = useState<Category>("other");
  const [costError, setCostError] = useState("");

  const utils = api.useUtils();

  const updateItem = api.itinerary.update.useMutation({
    onSuccess,
    onError: (err) => setError(err.message),
  });

  const { data: linkedExpenses = [] } = api.budget.listByItem.useQuery(
    { itineraryItemId: item.id },
    { enabled: !!item.id }
  );

  const addExpense = api.budget.add.useMutation({
    onSuccess: () => {
      utils.budget.listByItem.invalidate({ itineraryItemId: item.id });
      utils.budget.listByTrip.invalidate({ tripId });
      setAddingCost(false);
      setCostTitle("");
      setCostAmount("");
      setCostCategory("other");
      setCostError("");
    },
    onError: (err) => setCostError(err.message),
  });

  const deleteExpense = api.budget.delete.useMutation({
    onSuccess: () => {
      utils.budget.listByItem.invalidate({ itineraryItemId: item.id });
      utils.budget.listByTrip.invalidate({ tripId });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Title is required"); return; }

    let startTime: string | undefined;
    if (date) {
      startTime = time
        ? new Date(`${date}T${time}:00`).toISOString()
        : new Date(`${date}T00:00:00`).toISOString();
    }

    updateItem.mutate({
      itemId: item.id,
      type,
      title: title.trim(),
      startTime,
      locationName: location.trim() || undefined,
      locationLat,
      locationLng,
      description: description.trim() || undefined,
    });
  }

  function handleAddCost() {
    const cents = parseCents(costAmount);
    if (!costTitle.trim() || isNaN(cents) || cents <= 0) {
      setCostError("Enter a description and valid amount");
      return;
    }
    setCostError("");
    addExpense.mutate({
      tripId,
      itineraryItemId: item.id,
      title: costTitle.trim(),
      amountCents: cents,
      currency: costCurrency,
      category: costCategory,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto px-5 pb-8">
      {/* Type picker */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {ITEM_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={`flex flex-col items-center gap-1 py-2.5 rounded-[10px] border text-[11px] font-semibold transition-colors ${
              type === t.value
                ? "border-[#E8622A] bg-[rgba(232,98,42,0.08)] text-[#E8622A]"
                : "border-[#E5E0DA] bg-[#F0EDE8] text-[#6B6560]"
            }`}
          >
            <span className="text-xl">{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-[#6B6560] mb-1">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[16px] text-[#1A1512] focus:outline-none focus:border-[#E8622A]"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-[#6B6560] mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-3 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[16px] text-[#1A1512] focus:outline-none focus:border-[#E8622A]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#6B6560] mb-1">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-3 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[16px] text-[#1A1512] focus:outline-none focus:border-[#E8622A]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#6B6560] mb-1">Location</label>
          <LocationAutocomplete
            value={location}
            onChange={(val, lat, lng) => {
              setLocation(val);
              setLocationLat(lat);
              setLocationLng(lng);
            }}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#6B6560] mb-1">Notes</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[16px] text-[#1A1512] focus:outline-none focus:border-[#E8622A] resize-none"
          />
        </div>
      </div>

      {/* Linked costs section */}
      <div className="mt-4 pt-4 border-t border-[#F0EDE8]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-[#6B6560]">Linked costs</p>
          {!addingCost && (
            <button
              type="button"
              onClick={() => setAddingCost(true)}
              className="text-[11px] font-semibold text-[#E8622A]"
            >
              + Add cost
            </button>
          )}
        </div>

        {linkedExpenses.length === 0 && !addingCost && (
          <p className="text-[12px] text-[#A09B96]">No costs linked</p>
        )}

        {linkedExpenses.map((e) => {
          const meta = CATEGORY_META[e.category as Category] ?? CATEGORY_META.other;
          const isOwn = e.paidBy === userId;
          return (
            <div key={e.id} className="flex items-center gap-2 py-2 border-b border-[#F0EDE8] last:border-0">
              <span className="text-base flex-shrink-0">{meta.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-[#1A1512] truncate">{e.title}</p>
                <p className="text-[11px] text-[#A09B96]">{e.payer.name}</p>
              </div>
              <span className="text-[12px] font-semibold text-[#1A1512] flex-shrink-0">
                {formatCurrency(e.amountCents, e.currency)}
              </span>
              {isOwn && (
                <button
                  type="button"
                  onClick={() => deleteExpense.mutate({ expenseId: e.id })}
                  disabled={deleteExpense.isPending}
                  className="text-[#E84040] text-[14px] ml-1 flex-shrink-0 disabled:opacity-50"
                >
                  🗑
                </button>
              )}
            </div>
          );
        })}

        {addingCost && (
          <div className="mt-2 p-3 bg-[#F0EDE8] rounded-[10px] space-y-2">
            <input
              type="text"
              value={costTitle}
              onChange={(e) => setCostTitle(e.target.value)}
              placeholder="e.g. Hotel booking"
              className="w-full px-3 py-2 bg-white rounded-[8px] text-[14px] text-[#1A1512] placeholder:text-[#A09B96] outline-none border border-[#E5E0DA]"
            />
            <div className="flex gap-2">
              <select
                value={costCurrency}
                onChange={(e) => setCostCurrency(e.target.value as CurrencyCode)}
                className="px-2.5 py-2 bg-white rounded-[8px] text-[13px] text-[#1A1512] outline-none flex-shrink-0 border border-[#E5E0DA]"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code}</option>
                ))}
              </select>
              <input
                type="number"
                inputMode="decimal"
                value={costAmount}
                onChange={(e) => setCostAmount(e.target.value)}
                placeholder="0.00"
                min="0.01"
                step="0.01"
                className="flex-1 px-3 py-2 bg-white rounded-[8px] text-[14px] text-[#1A1512] placeholder:text-[#A09B96] outline-none border border-[#E5E0DA]"
              />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {CATEGORIES.map((c) => {
                const meta = CATEGORY_META[c];
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCostCategory(c)}
                    className={`flex flex-col items-center gap-0.5 py-2 rounded-[8px] text-[10px] font-semibold border transition-colors ${
                      costCategory === c
                        ? "border-[#E8622A] bg-[rgba(232,98,42,0.08)] text-[#E8622A]"
                        : "border-[#E5E0DA] bg-white text-[#6B6560]"
                    }`}
                  >
                    <span className="text-sm">{meta.emoji}</span>
                    {meta.label}
                  </button>
                );
              })}
            </div>
            {costError && <p className="text-[11px] text-[#E84040]">{costError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddCost}
                disabled={addExpense.isPending}
                className="flex-1 py-2 bg-[#E8622A] text-white text-[13px] font-semibold rounded-[8px] disabled:opacity-50"
              >
                {addExpense.isPending ? "Adding…" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingCost(false);
                  setCostTitle("");
                  setCostAmount("");
                  setCostCategory("other");
                  setCostError("");
                }}
                className="flex-1 py-2 border border-[#E5E0DA] text-[#6B6560] text-[13px] font-semibold rounded-[8px]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-[#E84040] mt-2">{error}</p>}

      <button
        type="submit"
        disabled={updateItem.isPending}
        className="w-full mt-5 py-4 bg-[#E8622A] text-white font-bold text-[15px] rounded-[12px] shadow-[0_2px_8px_rgba(232,98,42,0.30)] disabled:opacity-50"
      >
        {updateItem.isPending ? "Saving…" : "Save Changes"}
      </button>

      <button
        type="button"
        onClick={onDelete}
        className="w-full mt-3 py-4 border border-[#E84040] text-[#E84040] font-semibold text-[15px] rounded-[12px]"
      >
        Delete item
      </button>
    </form>
  );
}
