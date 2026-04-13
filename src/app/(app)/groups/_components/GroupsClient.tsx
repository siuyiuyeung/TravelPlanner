"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";

type Member = {
  userId: string;
  role: string;
  user: { name: string; image: string | null };
};

type Group = {
  id: string;
  name: string;
  trips: { id: string }[];
  members: Member[];
  role: string;
};

type Props = {
  groups: Group[];
};

function AvatarStack({ members }: { members: Member[] }) {
  const shown = members.slice(0, 4);
  const extra = members.length - shown.length;
  const colors = ["bg-[#E8622A]", "bg-[#2D6A8F]", "bg-[#3D9970]", "bg-[#A78BFA]", "bg-[#F2A93B]"];

  return (
    <div className="flex items-center">
      {shown.map((m, i) => (
        <div
          key={m.userId}
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

export function GroupsClient({ groups: initialGroups }: Props) {
  const router = useRouter();
  const utils = api.useUtils();
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [actionGroupId, setActionGroupId] = useState<string | null>(null);

  const deleteGroup = api.groups.delete.useMutation({
    onSuccess: (_, variables) => {
      setRemovedIds((prev) => new Set([...prev, variables.groupId]));
      setActionGroupId(null);
      utils.groups.list.invalidate();
    },
  });

  const leaveGroup = api.groups.leave.useMutation({
    onSuccess: (_, variables) => {
      setRemovedIds((prev) => new Set([...prev, variables.groupId]));
      setActionGroupId(null);
      utils.groups.list.invalidate();
      router.refresh();
    },
  });

  const groups = initialGroups.filter((g) => !removedIds.has(g.id));
  const actionGroup = groups.find((g) => g.id === actionGroupId) ?? null;
  const isPending = deleteGroup.isPending || leaveGroup.isPending;

  return (
    <div className="px-5 pt-14 pb-6">
      <div className="mb-7 flex items-center justify-between">
        <h1 className="text-[26px] font-bold text-[#1A1512] tracking-tight">Groups</h1>
        <Link
          href="/groups/new"
          className="px-4 py-2 bg-[#E8622A] text-white text-sm font-bold rounded-[12px] shadow-[0_2px_8px_rgba(232,98,42,0.30)]"
        >
          + New
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <span className="text-5xl mb-4">👥</span>
          <p className="text-[17px] font-semibold text-[#1A1512]">No groups yet</p>
          <p className="text-sm text-[#6B6560] mt-1 mb-6">Create a group to start planning trips together</p>
          <Link
            href="/groups/new"
            className="px-6 py-3 bg-[#E8622A] text-white font-bold rounded-[12px] shadow-[0_2px_8px_rgba(232,98,42,0.30)]"
          >
            Create a group
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="block bg-white border border-[#E5E0DA] rounded-[16px] p-4 shadow-[0_1px_3px_rgba(26,21,18,0.06)] transition-shadow hover:shadow-[0_4px_16px_rgba(26,21,18,0.10)] active:scale-[0.99]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-[#1A1512] truncate">{group.name}</p>
                  <p className="text-xs text-[#A09B96] mt-0.5">
                    {group.trips.length} trip{group.trips.length !== 1 ? "s" : ""} · {group.members.length} member{group.members.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <AvatarStack members={group.members} />
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActionGroupId(group.id); }}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-[#A09B96] hover:bg-[#F0EDE8] hover:text-[#E84040] transition-colors text-[18px] leading-none flex-shrink-0"
                    aria-label="Group options"
                  >
                    ···
                  </button>
                </div>
              </div>
              {group.role === "owner" && (
                <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(232,98,42,0.12)] text-[#E8622A]">
                  Owner
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Group action sheet */}
      {actionGroup && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-[#1A1512]/40" onClick={() => setActionGroupId(null)} />
          <div className="relative w-full bg-white rounded-t-[24px] p-5 pb-10 space-y-3">
            <div className="w-9 h-1 rounded-full bg-[#E5E0DA] mx-auto mb-4" />
            <p className="text-[17px] font-bold text-[#1A1512]">{actionGroup.name}</p>

            {actionGroup.role === "owner" ? (
              <>
                <p className="text-sm text-[#6B6560]">
                  Deleting this group will permanently remove all trips, itinerary items, and data. This cannot be undone.
                </p>
                <button
                  onClick={() => deleteGroup.mutate({ groupId: actionGroup.id })}
                  disabled={isPending}
                  className="w-full py-4 bg-[#E84040] text-white font-bold text-[15px] rounded-[12px] disabled:opacity-50 mt-2"
                >
                  {deleteGroup.isPending ? "Deleting…" : "Delete group"}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-[#6B6560]">
                  You will lose access to all trips in this group.
                </p>
                <button
                  onClick={() => leaveGroup.mutate({ groupId: actionGroup.id })}
                  disabled={isPending}
                  className="w-full py-4 bg-[#E84040] text-white font-bold text-[15px] rounded-[12px] disabled:opacity-50 mt-2"
                >
                  {leaveGroup.isPending ? "Leaving…" : "Leave group"}
                </button>
              </>
            )}

            <button
              onClick={() => setActionGroupId(null)}
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
