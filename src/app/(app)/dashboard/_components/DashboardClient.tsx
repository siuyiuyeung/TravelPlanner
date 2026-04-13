"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";
import type { Session } from "@/server/auth";

type Group = {
  id: string;
  name: string;
  trips: { id: string; name: string; destination: string | null; status: string; startDate: string | null; endDate: string | null }[];
  members: { userId: string; user: { name: string; image: string | null } }[];
  role: string;
};

type Props = {
  session: Session;
  groups: Group[];
};

const TRIP_GRADIENTS = [
  "from-[#1a1a3e] via-[#2d2060] to-[#6b2080]",
  "from-[#c0392b] via-[#e67e22] to-[#f1c40f]",
  "from-[#1a3a4a] via-[#2d6a8f] to-[#3d9970]",
  "from-[#2c1654] via-[#4a1060] to-[#c0392b]",
];

function getGradient(index: number) {
  return TRIP_GRADIENTS[index % TRIP_GRADIENTS.length];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function AvatarStack({ members }: { members: { user: { name: string } }[] }) {
  const shown = members.slice(0, 4);
  const extra = members.length - shown.length;
  const colors = ["bg-[#E8622A]", "bg-[#2D6A8F]", "bg-[#3D9970]", "bg-[#A78BFA]", "bg-[#F2A93B]"];

  return (
    <div className="flex items-center">
      {shown.map((m, i) => (
        <div
          key={i}
          className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white ${colors[i % colors.length]} ${i > 0 ? "-ml-2" : ""}`}
        >
          {m.user.name.charAt(0).toUpperCase()}
        </div>
      ))}
      {extra > 0 && (
        <div className="-ml-2 w-7 h-7 rounded-full border-2 border-white bg-[#F0EDE8] flex items-center justify-center text-[9px] font-bold text-[#6B6560]">
          +{extra}
        </div>
      )}
    </div>
  );
}

// ── Swipeable trip card ───────────────────────────────────────────────────────

function SwipeableTripCard({
  trip,
  gradientIndex,
  groupName,
  groupMembers,
  canDelete,
  onDeleteRequest,
}: {
  trip: { id: string; name: string; destination: string | null; status: string; startDate: string | null; endDate: string | null };
  gradientIndex: number;
  groupName: string;
  groupMembers: { user: { name: string } }[];
  canDelete: boolean;
  onDeleteRequest: (tripId: string) => void;
}) {
  const startX = useRef(0);
  const [swipeX, setSwipeX] = useState(0);
  const [swiped, setSwiped] = useState(false);

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0]!.clientX;
  }
  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0]!.clientX - startX.current;
    if (dx < 0) setSwipeX(Math.max(dx, -80));
  }
  function onTouchEnd() {
    if (swipeX < -50) {
      setSwipeX(-80);
      setSwiped(true);
    } else {
      setSwipeX(0);
      setSwiped(false);
    }
  }

  function dismissSwipe() {
    setSwipeX(0);
    setSwiped(false);
  }

  return (
    <div className="relative overflow-hidden rounded-[16px]">
      {/* Delete action revealed by swipe */}
      <div className="absolute inset-y-0 right-0 w-20 flex items-center justify-center bg-[#E84040] rounded-r-[16px]">
        <button
          onClick={() => onDeleteRequest(trip.id)}
          className="flex flex-col items-center gap-1 text-white"
        >
          <span className="text-lg">🗑️</span>
          <span className="text-[10px] font-bold">Delete</span>
        </button>
      </div>

      {/* Card */}
      <div
        className="relative shadow-[0_2px_8px_rgba(26,21,18,0.08)] transition-transform duration-150"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {swiped && (
          // Tap elsewhere to dismiss
          <div className="absolute inset-0 z-10" onClick={dismissSwipe} />
        )}
        <Link
          href={`/trips/${trip.id}`}
          onClick={(e) => { if (swiped) { e.preventDefault(); dismissSwipe(); } }}
          className="block rounded-[16px] overflow-hidden transition-shadow hover:shadow-[0_4px_16px_rgba(26,21,18,0.10)] active:scale-[0.99]"
        >
          <div className={`h-[120px] bg-gradient-to-br ${getGradient(gradientIndex)} p-3.5 flex flex-col justify-end`}>
            <p className="text-[18px] font-bold text-white leading-tight">{trip.name}</p>
            <p className="text-xs text-white/80 mt-0.5">
              {trip.destination ? `📍 ${trip.destination}` : ""}
              {trip.startDate ? ` · ${trip.startDate}` : ""}
              {trip.endDate ? ` – ${trip.endDate}` : ""}
            </p>
          </div>
          <div className="bg-white px-3.5 py-3 flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-[#A09B96] font-medium">{groupName}</span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold w-fit
                  ${trip.status === "planning" ? "bg-[rgba(167,139,250,0.15)] text-[#A78BFA]" : ""}
                  ${trip.status === "active" ? "bg-[rgba(61,153,112,0.15)] text-[#3D9970]" : ""}
                `}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full
                    ${trip.status === "planning" ? "bg-[#A78BFA]" : ""}
                    ${trip.status === "active" ? "bg-[#3D9970]" : ""}
                  `}
                />
                {trip.status === "planning" ? "Planning" : "Active"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AvatarStack members={groupMembers} />
              {canDelete && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteRequest(trip.id); }}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-[#A09B96] hover:bg-[#F0EDE8] hover:text-[#E84040] transition-colors text-[18px] leading-none flex-shrink-0"
                  aria-label="Trip options"
                >
                  ···
                </button>
              )}
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export function DashboardClient({ session, groups }: Props) {
  const router = useRouter();
  const utils = api.useUtils();
  const [deletedTripIds, setDeletedTripIds] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const deleteTrip = api.trips.delete.useMutation({
    onSuccess: (_, variables) => {
      setDeletedTripIds((prev) => new Set([...prev, variables.tripId]));
      setDeleteConfirmId(null);
      utils.groups.list.invalidate();
    },
  });

  const allTrips = groups.flatMap((g) =>
    g.trips.map((t) => ({ ...t, group: { id: g.id, name: g.name, members: g.members, role: g.role } }))
  ).filter((t) => !deletedTripIds.has(t.id));

  const upcoming = allTrips.filter((t) => t.status !== "completed");
  const past = allTrips.filter((t) => t.status === "completed");
  const firstName = session.user.name.split(" ")[0] ?? session.user.name;

  return (
    <div className="px-5 pt-14 pb-6">
      {/* Greeting */}
      <div className="mb-7">
        <h1 className="text-[26px] font-bold text-[#1A1512] tracking-tight leading-tight">
          {getGreeting()}, {firstName} 👋
        </h1>
        <p className="text-sm text-[#6B6560] mt-1">
          {upcoming.length > 0
            ? `You have ${upcoming.length} upcoming trip${upcoming.length !== 1 ? "s" : ""}`
            : "No upcoming trips — start planning!"}
        </p>
      </div>

      {/* Upcoming trips */}
      {upcoming.length > 0 && (
        <section className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-[17px] font-bold text-[#1A1512]">Upcoming Trips</h2>
            <Link href="/trips" className="text-sm font-medium text-[#E8622A]">
              See all
            </Link>
          </div>
          <div className="space-y-3.5">
            {upcoming.map((trip, i) => (
              <SwipeableTripCard
                key={trip.id}
                trip={trip}
                gradientIndex={i}
                groupName={trip.group.name}
                groupMembers={trip.group.members}
                canDelete={trip.group.role !== "member"}
                onDeleteRequest={(id) => {
                  if (trip.group.role === "member") return;
                  setDeleteConfirmId(id);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {groups.length === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <span className="text-5xl mb-4">✈️</span>
          <p className="text-[17px] font-semibold text-[#1A1512]">No trips yet</p>
          <p className="text-sm text-[#6B6560] mt-1 mb-6">Create a group to start planning</p>
          <Link
            href="/groups/new"
            className="px-6 py-3 bg-[#E8622A] text-white font-bold rounded-[12px] shadow-[0_2px_8px_rgba(232,98,42,0.30)]"
          >
            Create a group
          </Link>
        </div>
      )}

      {/* Past trips */}
      {past.length > 0 && (
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-[17px] font-bold text-[#1A1512]">Past Trips</h2>
          </div>
          <div className="space-y-2.5">
            {past.slice(0, 3).map((trip) => (
              <Link key={trip.id} href={`/trips/${trip.id}`}>
                <div className="bg-white border border-[#E5E0DA] rounded-[16px] p-3.5 flex items-center gap-3 opacity-75">
                  <div className="w-12 h-12 rounded-[10px] bg-gradient-to-br from-[#2c3e50] to-[#4a5568] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#1A1512] truncate">{trip.name}</p>
                    <p className="text-xs text-[#A09B96] mt-0.5">
                      {trip.startDate} – {trip.endDate}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[rgba(160,155,150,0.15)] text-[#A09B96]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#A09B96]" />
                    Done
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Delete confirm overlay */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-[#1A1512]/40" onClick={() => setDeleteConfirmId(null)} />
          <div className="relative w-full bg-white rounded-t-[24px] p-5 pb-10 space-y-3">
            <div className="w-9 h-1 rounded-full bg-[#E5E0DA] mx-auto mb-4" />
            <p className="text-[17px] font-bold text-[#1A1512]">Delete trip?</p>
            <p className="text-sm text-[#6B6560]">This will permanently delete the trip and all its itinerary items. This cannot be undone.</p>
            <button
              onClick={() => deleteTrip.mutate({ tripId: deleteConfirmId })}
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
        </div>
      )}
    </div>
  );
}
