"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/trpc/client";
import { useSwipeToDelete } from "@/hooks/use-swipe-to-delete";
import { BottomSheet, BottomSheetTitle } from "@/components/ui/bottom-sheet";

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
  role: string;
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

type TripRow = Trip & { groupName: string; groupId: string; groupRole: string };

function SwipeableTripRow({ trip, onDeleteRequest }: { trip: TripRow; onDeleteRequest: () => void }) {
  const { swiped, onTouchStart, onTouchEnd } = useSwipeToDelete();
  const style = STATUS_STYLES[trip.status] ?? STATUS_STYLES.planning!;
  const canDelete = trip.groupRole !== "member";

  return (
    <div className="relative overflow-hidden rounded-[16px]">
      {canDelete && (
        <div className="absolute inset-y-0 right-0 w-20 bg-[#E84040] flex flex-col items-center justify-center rounded-r-[16px]">
          <button onClick={onDeleteRequest} className="flex flex-col items-center gap-1">
            <span className="text-white text-xl">🗑</span>
            <span className="text-white text-[10px] font-semibold">Delete</span>
          </button>
        </div>
      )}
      <div
        onTouchStart={canDelete ? onTouchStart : undefined}
        onTouchEnd={canDelete ? onTouchEnd : undefined}
        style={canDelete ? { transform: swiped ? "translateX(-80px)" : "translateX(0)", transition: "transform 0.2s ease" } : undefined}
      >
        <Link
          href={`/trips/${trip.id}`}
          className="block bg-white border border-[#E5E0DA] rounded-[16px] p-4 shadow-[0_1px_3px_rgba(26,21,18,0.06)] transition-shadow hover:shadow-[0_4px_16px_rgba(26,21,18,0.10)] active:scale-[0.99]"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-[#1A1512] truncate">{trip.name}</p>
              {trip.destination && (
                <p className="text-xs text-[#6B6560] mt-0.5">📍 {trip.destination}</p>
              )}
              <p className="text-xs text-[#A09B96] mt-0.5">{trip.groupName}</p>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${style.bg} ${style.text}`}
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
        </Link>
      </div>
    </div>
  );
}

export function TripsClient({ groups }: Props) {
  const utils = api.useUtils();
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const deleteTrip = api.trips.delete.useMutation({
    onSuccess: (_, variables) => {
      setDeletedIds((prev) => new Set([...prev, variables.tripId]));
      setDeleteConfirmId(null);
      utils.groups.list.invalidate();
    },
  });

  const allTrips = groups
    .flatMap((g) =>
      g.trips.map((t) => ({ ...t, groupName: g.name, groupId: g.id, groupRole: g.role }))
    )
    .filter((t) => !deletedIds.has(t.id));

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
          {allTrips.map((trip) => (
            <SwipeableTripRow
              key={trip.id}
              trip={trip}
              onDeleteRequest={() => setDeleteConfirmId(trip.id)}
            />
          ))}
        </div>
      )}

      {/* Delete confirm sheet */}
      <BottomSheet open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <BottomSheetTitle>Delete trip?</BottomSheetTitle>
        <div className="px-5 pb-8 space-y-3">
          <p className="text-sm text-[#6B6560]">This will permanently delete the trip and all its itinerary items. This cannot be undone.</p>
          <button
            onClick={() => { if (deleteConfirmId) deleteTrip.mutate({ tripId: deleteConfirmId }); }}
            disabled={deleteTrip.isPending}
            className="w-full py-4 bg-[#E84040] text-white font-bold text-[15px] rounded-[12px] disabled:opacity-50 mt-2"
          >
            {deleteTrip.isPending ? "Deleting…" : "Delete trip"}
          </button>
          <button
            onClick={() => setDeleteConfirmId(null)}
            className="w-full py-4 border border-[#E5E0DA] text-[#6B6560] font-semibold text-[15px] rounded-[12px]"
          >
            Cancel
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
