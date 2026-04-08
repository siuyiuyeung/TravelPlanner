"use client";

import Link from "next/link";

type Trip = {
  id: string;
  name: string;
  destination: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
};

type Group = {
  id: string;
  name: string;
  trips: Trip[];
};

type Props = {
  groups: Group[];
};

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  planning: { bg: "bg-[rgba(167,139,250,0.15)]", text: "text-[#A78BFA]", dot: "bg-[#A78BFA]", label: "Planning" },
  active: { bg: "bg-[rgba(61,153,112,0.15)]", text: "text-[#3D9970]", dot: "bg-[#3D9970]", label: "Active" },
  completed: { bg: "bg-[rgba(160,155,150,0.15)]", text: "text-[#A09B96]", dot: "bg-[#A09B96]", label: "Done" },
};

export function TripsClient({ groups }: Props) {
  const allTrips = groups.flatMap((g) =>
    g.trips.map((t) => ({ ...t, groupName: g.name, groupId: g.id }))
  );

  return (
    <div className="px-5 pt-14 pb-6">
      <div className="mb-7 flex items-center justify-between">
        <h1 className="text-[26px] font-bold text-[#1A1512] tracking-tight">Trips</h1>
        <Link
          href="/trips/new"
          className="px-4 py-2 bg-[#E8622A] text-white text-sm font-bold rounded-[12px] shadow-[0_2px_8px_rgba(232,98,42,0.30)]"
        >
          + New
        </Link>
      </div>

      {allTrips.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <span className="text-5xl mb-4">🗺️</span>
          <p className="text-[17px] font-semibold text-[#1A1512]">No trips yet</p>
          <p className="text-sm text-[#6B6560] mt-1 mb-6">Start planning your next adventure</p>
          <Link
            href="/trips/new"
            className="px-6 py-3 bg-[#E8622A] text-white font-bold rounded-[12px] shadow-[0_2px_8px_rgba(232,98,42,0.30)]"
          >
            Create a trip
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {allTrips.map((trip) => {
            const style = STATUS_STYLES[trip.status] ?? STATUS_STYLES.planning!;
            return (
              <Link key={trip.id} href={`/trips/${trip.id}`}>
                <div className="bg-white border border-[#E5E0DA] rounded-[16px] p-4 shadow-[0_1px_3px_rgba(26,21,18,0.06)]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-[#1A1512] truncate">{trip.name}</p>
                      {trip.destination && (
                        <p className="text-xs text-[#6B6560] mt-0.5">📍 {trip.destination}</p>
                      )}
                      <p className="text-xs text-[#A09B96] mt-0.5">{trip.groupName}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0 ${style.bg} ${style.text}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                      {style.label}
                    </span>
                  </div>
                  {(trip.startDate || trip.endDate) && (
                    <p className="text-xs text-[#A09B96] mt-2">
                      {trip.startDate}
                      {trip.endDate ? ` – ${trip.endDate}` : ""}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
