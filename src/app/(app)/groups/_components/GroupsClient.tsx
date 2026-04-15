"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";
import { useSwipeToDelete } from "@/hooks/use-swipe-to-delete";
import { BottomSheet, BottomSheetTitle } from "@/components/ui/bottom-sheet";

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

function SwipeableGroupRow({
  group,
  onDeleteRequest,
  onLeave,
}: {
  group: Group;
  onDeleteRequest: () => void;
  onLeave: () => void;
}) {
  const { swiped, onTouchStart, onTouchEnd } = useSwipeToDelete();
  const isOwner = group.role === "owner";

  return (
    <div className="relative overflow-hidden rounded-[16px]">
      <div className="absolute inset-y-0 right-0 w-20 bg-[#E84040] flex flex-col items-center justify-center rounded-r-[16px]">
        <button onClick={isOwner ? onDeleteRequest : onLeave} className="flex flex-col items-center gap-1">
          <span className="text-white text-xl">🗑</span>
          <span className="text-white text-[10px] font-semibold">{isOwner ? "Delete" : "Leave"}</span>
        </button>
      </div>
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ transform: swiped ? "translateX(-80px)" : "translateX(0)", transition: "transform 0.2s ease" }}
      >
        <Link
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
            <AvatarStack members={group.members} />
          </div>
          {group.role === "owner" && (
            <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(232,98,42,0.12)] text-[#E8622A]">
              Owner
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}

export function GroupsClient({ groups: initialGroups }: Props) {
  const router = useRouter();
  const utils = api.useUtils();
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const deleteGroup = api.groups.delete.useMutation({
    onSuccess: (_, variables) => {
      setRemovedIds((prev) => new Set([...prev, variables.groupId]));
      setDeleteConfirmId(null);
      utils.groups.list.invalidate();
    },
  });

  const leaveGroup = api.groups.leave.useMutation({
    onSuccess: (_, variables) => {
      setRemovedIds((prev) => new Set([...prev, variables.groupId]));
      utils.groups.list.invalidate();
      router.refresh();
    },
  });

  const groups = initialGroups.filter((g) => !removedIds.has(g.id));
  const deleteConfirmGroup = groups.find((g) => g.id === deleteConfirmId) ?? null;

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
            <SwipeableGroupRow
              key={group.id}
              group={group}
              onDeleteRequest={() => setDeleteConfirmId(group.id)}
              onLeave={() => leaveGroup.mutate({ groupId: group.id })}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <BottomSheet open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <BottomSheetTitle>Delete group?</BottomSheetTitle>
        <div className="px-5 pb-8 space-y-3">
          <p className="text-sm text-[#6B6560]">
            Deleting this group will permanently remove all trips, itinerary items, and data. This cannot be undone.
          </p>
          <button
            onClick={() => { if (deleteConfirmGroup) deleteGroup.mutate({ groupId: deleteConfirmGroup.id }); }}
            disabled={deleteGroup.isPending}
            className="w-full py-4 bg-[#E84040] text-white font-bold text-[15px] rounded-[12px] disabled:opacity-50 mt-2"
          >
            {deleteGroup.isPending ? "Deleting…" : "Delete group"}
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
