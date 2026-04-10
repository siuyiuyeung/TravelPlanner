"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";

type Props = {
  tripId: string;
  onSuccess: () => void;
};

const ITEM_TYPES = [
  { value: "flight", emoji: "✈️", label: "Flight" },
  { value: "hotel", emoji: "🏨", label: "Hotel" },
  { value: "restaurant", emoji: "🍜", label: "Food" },
  { value: "activity", emoji: "🎭", label: "Activity" },
  { value: "transport", emoji: "🚌", label: "Transport" },
  { value: "note", emoji: "📝", label: "Note" },
] as const;

type ItemType = (typeof ITEM_TYPES)[number]["value"];

export function AddItemForm({ tripId, onSuccess }: Props) {
  const [type, setType] = useState<ItemType>("activity");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [locationLat, setLocationLat] = useState<string | undefined>();
  const [locationLng, setLocationLng] = useState<string | undefined>();
  const [cost, setCost] = useState("");
  const [currency, setCurrency] = useState("HKD");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  async function geocode(query: string) {
    if (!query.trim()) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json() as { lat: string; lon: string }[];
      if (data[0]) {
        setLocationLat(data[0].lat);
        setLocationLng(data[0].lon);
      }
    } catch {
      // ignore geocoding errors — location name still saved
    }
  }

  const utils = api.useUtils();
  const createItem = api.itinerary.create.useMutation({
    onSuccess: () => {
      utils.trips.getById.invalidate({ tripId });
      onSuccess();
    },
    onError: (err) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Title is required"); return; }

    const costCents = cost ? Math.round(parseFloat(cost) * 100) : undefined;

    // Combine date + time into ISO datetime string for startTime
    let startTime: string | undefined;
    if (date) {
      startTime = time ? new Date(`${date}T${time}:00`).toISOString() : new Date(`${date}T00:00:00`).toISOString();
    }

    createItem.mutate({
      tripId,
      type,
      title: title.trim(),
      startTime,
      locationName: location.trim() || undefined,
      locationLat,
      locationLng,
      costCents: costCents && !isNaN(costCents) ? costCents : undefined,
      currency: cost ? currency : undefined,
      description: description.trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 pb-8">
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
            placeholder="e.g. Senso-ji Temple"
            className="w-full px-4 py-3 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[16px] text-[#1A1512] placeholder:text-[#A09B96] focus:outline-none focus:border-[#E8622A]"
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
          <input
            type="text"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setLocationLat(undefined);
              setLocationLng(undefined);
            }}
            onBlur={(e) => geocode(e.target.value)}
            placeholder="Search for a place..."
            className="w-full px-4 py-3 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[16px] text-[#1A1512] placeholder:text-[#A09B96] focus:outline-none focus:border-[#E8622A]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#6B6560] mb-1">Cost</label>
          <div className="flex gap-2">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="px-2.5 py-3 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[15px] text-[#1A1512] focus:outline-none focus:border-[#E8622A] flex-shrink-0"
            >
              {["HKD","USD","EUR","GBP","JPY","CNY","AUD","CAD","CHF","INR","SGD","MXN"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="number"
              inputMode="decimal"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="flex-1 px-4 py-3 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[16px] text-[#1A1512] placeholder:text-[#A09B96] focus:outline-none focus:border-[#E8622A]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#6B6560] mb-1">Notes</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any details..."
            rows={3}
            className="w-full px-4 py-3 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[16px] text-[#1A1512] placeholder:text-[#A09B96] focus:outline-none focus:border-[#E8622A] resize-none"
          />
        </div>
      </div>

      {error && <p className="text-sm text-[#E84040] mt-2">{error}</p>}

      <button
        type="submit"
        disabled={createItem.isPending}
        className="w-full mt-5 py-4 bg-[#E8622A] text-white font-bold text-[15px] rounded-[12px] shadow-[0_2px_8px_rgba(232,98,42,0.30)] disabled:opacity-50"
      >
        {createItem.isPending ? "Adding…" : "Add to Itinerary"}
      </button>
    </form>
  );
}
