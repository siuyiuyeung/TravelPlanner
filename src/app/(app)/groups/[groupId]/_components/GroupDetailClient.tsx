"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { api } from "@/lib/trpc/client";

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

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  planning: { bg: "bg-[rgba(167,139,250,0.15)]", text: "text-[#A78BFA]", dot: "bg-[#A78BFA]", label: "Planning" },
  active: { bg: "bg-[rgba(61,153,112,0.15)]", text: "text-[#3D9970]", dot: "bg-[#3D9970]", label: "Active" },
  completed: { bg: "bg-[rgba(160,155,150,0.15)]", text: "text-[#A09B96]", dot: "bg-[#A09B96]", label: "Done" },
};

export function GroupDetailClient({ group: initialGroup }: Props) {
  const router = useRouter();
  const utils = api.useUtils();

  const [group, setGroup] = useState(initialGroup);
  const [copied, setCopied] = useState(false);
  const [contextMember, setContextMember] = useState<Member | null>(null);
  const [removedUserIds, setRemovedUserIds] = useState<Set<string>>(new Set());

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const token = group.inviteToken ?? "";
  const inviteLink = typeof window !== "undefined"
    ? `${window.location.origin}/join/${token}`
    : `/join/${token}`;

  async function copyInvite() {
    await navigator.clipboard.writeText(`${window.location.origin}/join/${token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const regenerate = api.groups.regenerateInvite.useMutation({
    onSuccess: (updated) => {
      if (updated) setGroup((g) => ({ ...g, inviteToken: updated.inviteToken }));
    },
  });

  const updateRole = api.groups.updateMemberRole.useMutation({
    onSuccess: () => {
      utils.groups.getById.invalidate({ groupId: group.id });
      setContextMember(null);
    },
  });

  const removeMember = api.groups.removeMember.useMutation({
    onSuccess: (_, vars) => {
      setRemovedUserIds((prev) => new Set([...prev, vars.targetUserId]));
      setContextMember(null);
    },
  });

  const isOwnerOrAdmin = group.role === "owner" || group.role === "admin";

  function handleMemberLongPress(member: Member) {
    if (!isOwnerOrAdmin) return;
    if (member.role === "owner") return;
    if (navigator.vibrate) navigator.vibrate(10);
    setContextMember(member);
  }

  function startLongPress(member: Member) {
    longPressTimer.current = setTimeout(() => handleMemberLongPress(member), 400);
  }
  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

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
        <h2 className="text-[17px] font-bold text-[#1A1512] mb-1">Members</h2>
        {isOwnerOrAdmin && (
          <p className="text-[11px] text-[#A09B96] mb-3">Hold a member to manage their role</p>
        )}
        <div className="space-y-2">
          {visibleMembers.map((m) => {
            const colors = ["bg-[#E8622A]", "bg-[#2D6A8F]", "bg-[#3D9970]", "bg-[#A78BFA]"];
            const colorIndex = m.userId.charCodeAt(0) % colors.length;
            return (
              <div
                key={m.userId}
                className="bg-white border border-[#E5E0DA] rounded-[12px] p-3 flex items-center gap-3 select-none"
                onTouchStart={() => startLongPress(m)}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
                onMouseDown={() => startLongPress(m)}
                onMouseUp={cancelLongPress}
                onMouseLeave={cancelLongPress}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white ${colors[colorIndex]}`}>
                  {m.user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#1A1512] truncate">{m.user.name}</p>
                </div>
                <span className="text-[11px] font-medium text-[#A09B96] capitalize">{m.role}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trips */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[17px] font-bold text-[#1A1512]">Trips</h2>
          <Link href={`/trips/new`} className="text-sm font-medium text-[#E8622A]">+ New</Link>
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

      {/* Member context menu */}
      {contextMember && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-[#1A1512]/40" onClick={() => setContextMember(null)} />
          <div className="relative w-full bg-white rounded-t-[24px] p-5 pb-10">
            <div className="w-9 h-1 rounded-full bg-[#E5E0DA] mx-auto mb-5" />
            <p className="text-[15px] font-bold text-[#1A1512] mb-1">{contextMember.user.name}</p>
            <p className="text-[12px] text-[#A09B96] mb-5 capitalize">Current role: {contextMember.role}</p>
            <div className="space-y-2">
              {contextMember.role === "member" && (
                <button
                  onClick={() => updateRole.mutate({ groupId: group.id, targetUserId: contextMember.userId, role: "admin" })}
                  disabled={updateRole.isPending}
                  className="w-full py-3.5 bg-[#F0EDE8] text-[#1A1512] font-semibold text-[14px] rounded-[12px] disabled:opacity-50"
                >
                  Make admin
                </button>
              )}
              {contextMember.role === "admin" && (
                <button
                  onClick={() => updateRole.mutate({ groupId: group.id, targetUserId: contextMember.userId, role: "member" })}
                  disabled={updateRole.isPending}
                  className="w-full py-3.5 bg-[#F0EDE8] text-[#1A1512] font-semibold text-[14px] rounded-[12px] disabled:opacity-50"
                >
                  Make member
                </button>
              )}
              <button
                onClick={() => removeMember.mutate({ groupId: group.id, targetUserId: contextMember.userId })}
                disabled={removeMember.isPending}
                className="w-full py-3.5 bg-[rgba(232,64,64,0.10)] text-[#E84040] font-semibold text-[14px] rounded-[12px] disabled:opacity-50"
              >
                {removeMember.isPending ? "Removing…" : "Remove from group"}
              </button>
              <button
                onClick={() => setContextMember(null)}
                className="w-full py-3.5 border border-[#E5E0DA] text-[#6B6560] font-semibold text-[14px] rounded-[12px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
