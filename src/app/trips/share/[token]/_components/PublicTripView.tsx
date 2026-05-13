"use client";

import { useState } from "react";
import type { createServerCaller } from "@/lib/trpc/server";

type PublicTrip = Awaited<ReturnType<Awaited<ReturnType<typeof createServerCaller>>["trips"]["getPublic"]>>;

export function PublicTripView({ trip }: { trip: PublicTrip }) {
  const [tab, setTab] = useState<"itinerary" | "map">("itinerary");

  const ITEM_ICONS: Record<string, string> = {
    flight: "✈️",
    hotel: "🏨",
    activity: "🎯",
    restaurant: "🍽️",
    transport: "🚗",
    note: "📝",
  };

  const itemsByDay = trip.itineraryItems.reduce<Record<string, typeof trip.itineraryItems>>(
    (acc, item) => {
      const day = item.startTime
        ? new Date(item.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "Unscheduled";
      if (!acc[day]) acc[day] = [];
      acc[day]!.push(item);
      return acc;
    },
    {},
  );

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col max-w-lg mx-auto">
      {/* Read-only banner */}
      <div className="bg-[#FEF3C7] border-b border-[#FDE68A] px-4 py-2 flex items-center gap-2 text-[11px] font-semibold text-[#92400E] sticky top-0 z-10">
        <span>👁️</span>
        <span>View only — shared trip</span>
        <a
          href="/login"
          className="ml-auto px-3 py-1 bg-[#E8622A] text-white text-[11px] font-bold rounded-lg"
        >
          Sign in to edit
        </a>
      </div>

      {/* Trip header */}
      <div className="bg-gradient-to-br from-[#1a3a4a] via-[#2d6a8f] to-[#3d9970] px-5 py-6 text-white">
        <h1 className="text-[20px] font-bold">{trip.name}</h1>
        {trip.destination && (
          <p className="text-[12px] text-white/75 mt-1">📍 {trip.destination}</p>
        )}
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
              tab === t
                ? "text-[#E8622A] border-b-2 border-[#E8622A]"
                : "text-[#A09B96]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {tab === "itinerary" && (
          <div className="flex flex-col gap-2">
            {Object.entries(itemsByDay).map(([day, items]) => (
              <div key={day}>
                <p className="text-[11px] font-bold text-[#E8622A] uppercase tracking-wide mb-2 mt-2">
                  {day}
                </p>
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 bg-white border border-[#E5E0DA] rounded-[14px] mb-2"
                  >
                    <span className="text-xl flex-shrink-0 mt-0.5">
                      {ITEM_ICONS[item.type] ?? "📌"}
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-[#1A1512]">{item.title}</p>
                      {item.startTime && (
                        <p className="text-[11px] text-[#A09B96] mt-0.5">
                          {new Date(item.startTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                      {item.description && (
                        <p className="text-[12px] text-[#6B6560] mt-1">{item.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {trip.itineraryItems.length === 0 && (
              <p className="text-[13px] text-[#A09B96] text-center py-12">No items yet.</p>
            )}
          </div>
        )}
        {tab === "map" && (
          <p className="text-[13px] text-[#A09B96] text-center py-12">
            Map view available in the app.
          </p>
        )}
      </div>
    </div>
  );
}
