"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";

type Group = { id: string; name: string };

type Props = {
  groups: Group[];
};

export function NewTripForm({ groups }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");

  const createTrip = api.trips.create.useMutation({
    onSuccess: (trip) => {
      router.push(`/trips/${trip.id}`);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Trip name is required"); return; }
    if (!groupId) { setError("Select a group"); return; }
    createTrip.mutate({
      name: name.trim(),
      groupId,
      destination: destination.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  }

  return (
    <div className="px-5 pt-14 pb-6">
      <button
        onClick={() => router.back()}
        className="mb-6 text-sm font-medium text-[#E8622A] flex items-center gap-1"
      >
        ← Back
      </button>
      <h1 className="text-[26px] font-bold text-[#1A1512] tracking-tight mb-7">New Trip</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#1A1512] mb-1.5">Trip name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tokyo Adventure"
            className="w-full px-4 py-3 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[16px] text-[#1A1512] placeholder:text-[#A09B96] focus:outline-none focus:border-[#E8622A]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1A1512] mb-1.5">Destination</label>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. Tokyo, Japan"
            className="w-full px-4 py-3 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[16px] text-[#1A1512] placeholder:text-[#A09B96] focus:outline-none focus:border-[#E8622A]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1A1512] mb-1.5">Group *</label>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="w-full px-4 py-3 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[16px] text-[#1A1512] focus:outline-none focus:border-[#E8622A] appearance-none"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-[#1A1512] mb-1.5">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[16px] text-[#1A1512] focus:outline-none focus:border-[#E8622A]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1A1512] mb-1.5">End date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-3 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[16px] text-[#1A1512] focus:outline-none focus:border-[#E8622A]"
            />
          </div>
        </div>

        {error && <p className="text-sm text-[#E84040]">{error}</p>}

        <button
          type="submit"
          disabled={createTrip.isPending}
          className="w-full py-4 bg-[#E8622A] text-white font-bold text-[15px] rounded-[12px] shadow-[0_2px_8px_rgba(232,98,42,0.30)] disabled:opacity-50 mt-4"
        >
          {createTrip.isPending ? "Creating…" : "Create Trip"}
        </button>
      </form>
    </div>
  );
}
