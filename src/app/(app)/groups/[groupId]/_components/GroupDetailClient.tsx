"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/trpc/client";
import { useSwipeToDelete } from "@/hooks/use-swipe-to-delete";

type Member = {
  userId: string;
  role: string;
  user: { name: string; image: string | null };
};

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
  inviteToken: string | null;
  trips: Trip[];
  members: Member[];
  role: string;
};

type Props = { group: Group };

function SwipeableMemberRow({
  member,
  canRemove,
  onRemove,
}: {
  member: Member;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const { swiped, onTouchStart, onTouchEnd, onMouseDown, onClickCapture } = useSwipeToDelete();
  const colors = ["bg-[#E8622A]", "bg-[#2D6A8F]", "bg-[#3D9970]", "bg-[#A78BFA]"];
  const colorIndex = member.userId.charCodeAt(0) % colors.length;

  return (
    <div className="relative overflow-hidden rounded-[12px]" onClickCapture={canRemove ? onClickCapture : undefined}>
      {canRemove && (
        <div className="absolute inset-y-0 right-0 w-20 bg-[#E84040] flex flex-col items-center justify-center rounded-r-[12px]">
          <button onClick={onRemove} className="flex flex-col items-center gap-1">
            <span className="text-white text-xl">🗑</span>
            <span className="text-white text-[10px] font-semibold">Remove</span>
          </button>
        </div>
      )}
      <div
        onTouchStart={canRemove ? onTouchStart : undefined}
        onTouchEnd={canRemove ? onTouchEnd : undefined}
        onMouseDown={canRemove ? onMouseDown : undefined}
        style={canRemove ? { transform: swiped ? "translateX(-80px)" : "translateX(0)", transition: "transform 0.2s ease" } : undefined}
        className="bg-white border border-[#E5E0DA] rounded-[12px] p-3 flex items-center gap-3 select-none"
      >
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white ${colors[colorIndex]}`}>
          {member.user.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-[#1A1512] truncate">{member.user.name}</p>
        </div>
        <span className="text-[11px] font-medium text-[#A09B96] capitalize">{member.role}</span>
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  planning: { bg: "bg-[rgba(167,139,250,0.15)]", text: "text-[#A78BFA]", dot: "bg-[#A78BFA]", label: "Planning" },
  active: { bg: "bg-[rgba(61,153,112,0.15)]", text: "text-[#3D9970]", dot: "bg-[#3D9970]", label: "Active" },
  completed: { bg: "bg-[rgba(160,155,150,0.15)]", text: "text-[#A09B96]", dot: "bg-[#A09B96]", label: "Done" },
};

export function GroupDetailClient({ group: initialGroup }: Props) {
  const router = useRouter();
  const [group, setGroup] = useState(initialGroup);
  const [copied, setCopied] = useState(false);
  const [removedUserIds, setRemovedUserIds] = useState<Set<string>>(new Set());

  const token = group.inviteToken ?? "";
  const inviteLink = typeof window !== "undefined"
    ? `${window.location.origin}/join/${token}`
    : `/join/${token}`;

  async function copyInvite() {
    const text = `${window.location.origin}/join/${token}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for non-secure contexts or permission denied
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const regenerate = api.groups.regenerateInvite.useMutation({
    onSuccess: (updated) => {
      if (updated) setGroup((g) => ({ ...g, inviteToken: updated.inviteToken }));
    },
  });

  const removeMember = api.groups.removeMember.useMutation({
    onSuccess: (_, vars) => {
      setRemovedUserIds((prev) => new Set([...prev, vars.targetUserId]));
    },
  });

  const isOwnerOrAdmin = group.role === "owner" || group.role === "admin";

  const visibleMembers = group.members.filter((m) => !removedUserIds.has(m.userId));

  return (
    <div className="px-5 pt-14 pb-6">
      <button
        onClick={() => router.back()}
        className="mb-6 text-sm font-medium text-[#E8622A] flex items-center gap-1"
      >
        ← Back
      </button>

      <div className="mb-6">
        <h1 className="text-[26px] font-bold text-[#1A1512] tracking-tight">{group.name}</h1>
        <p className="text-sm text-[#A09B96] mt-0.5">
          {visibleMembers.length} member{visibleMembers.length !== 1 ? "s" : ""} · {group.trips.length} trip{group.trips.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Invite link */}
      {isOwnerOrAdmin && (
        <div className="bg-white border border-[#E5E0DA] rounded-[16px] p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-[#1A1512]">Invite link</p>
            <button
              onClick={() => regenerate.mutate({ groupId: group.id })}
              disabled={regenerate.isPending}
              className="text-[11px] font-semibold text-[#6B6560] disabled:opacity-40"
            >
              {regenerate.isPending ? "…" : "Regenerate"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-[#6B6560] bg-[#F0EDE8] rounded-[8px] px-3 py-2 flex-1 truncate font-mono">
              {inviteLink}
            </p>
            <button
              onClick={copyInvite}
              className="px-3 py-2 bg-[#E8622A] text-white text-xs font-bold rounded-[8px] flex-shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Members */}
      <section className="mb-6">
        <h2 className="text-[17px] font-bold text-[#1A1512] mb-3">Members</h2>
        <div className="space-y-2">
          {visibleMembers.map((m) => (
            <SwipeableMemberRow
              key={m.userId}
              member={m}
              canRemove={isOwnerOrAdmin && m.role !== "owner"}
              onRemove={() => removeMember.mutate({ groupId: group.id, targetUserId: m.userId })}
            />
          ))}
        </div>
      </section>

      {/* Trips */}
      <section>
        <div className="mb-3">
          <h2 className="text-[17px] font-bold text-[#1A1512]">Trips</h2>
        </div>
        {group.trips.length === 0 ? (
          <p className="text-sm text-[#A09B96] py-4 text-center">No trips yet</p>
        ) : (
          <div className="space-y-2">
            {group.trips.map((trip) => {
              const style = STATUS_STYLES[trip.status] ?? STATUS_STYLES.planning!;
              return (
                <Link key={trip.id} href={`/trips/${trip.id}`}>
                  <div className="bg-white border border-[#E5E0DA] rounded-[12px] p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-[#1A1512] truncate">{trip.name}</p>
                      {trip.startDate && (
                        <p className="text-xs text-[#A09B96] mt-0.5">{trip.startDate}{trip.endDate ? ` – ${trip.endDate}` : ""}</p>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${style.bg} ${style.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                      {style.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* FAB */}
      <Link
        href="/trips/new"
        className="fixed bottom-24 right-5 w-10 h-10 bg-[#E8622A] rounded-full shadow-[0_4px_16px_rgba(232,98,42,0.40)] flex items-center justify-center text-white z-40"
        aria-label="New trip"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
        </svg>
      </Link>
    </div>
  );
}
