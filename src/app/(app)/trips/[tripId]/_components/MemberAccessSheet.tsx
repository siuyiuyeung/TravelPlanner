"use client";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { api } from "@/lib/trpc/client";
import { toast } from "sonner";

type Member = {
  userId: string;
  name: string;
  isEditor: boolean;
  isCreator: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  member: Member | null;
  onSuccess: () => void;
};

export function MemberAccessSheet({ open, onOpenChange, tripId, member, onSuccess }: Props) {
  const utils = api.useUtils();

  const grantEditor = api.trips.grantEditor.useMutation({
    onSuccess: () => {
      void utils.trips.getMemberAccess.invalidate({ tripId });
      onSuccess();
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to update access"),
  });

  const revokeEditor = api.trips.revokeEditor.useMutation({
    onSuccess: () => {
      void utils.trips.getMemberAccess.invalidate({ tripId });
      onSuccess();
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to update access"),
  });

  const removeFromTrip = api.trips.removeFromTrip.useMutation({
    onSuccess: () => {
      void utils.trips.getMemberAccess.invalidate({ tripId });
      onSuccess();
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to remove member"),
  });

  if (!member) return null;

  const isPending = grantEditor.isPending || revokeEditor.isPending || removeFromTrip.isPending;

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      {/* Title */}
      <p className="text-[17px] font-bold text-[#1A1512] px-5 pt-4 pb-1">{member.name}</p>
      <p className="text-[12px] text-[#A09B96] px-5 pb-3">Trip access</p>

      <div className="h-px bg-[#F0EDE8] mx-5" />

      {/* Editor option */}
      <button
        disabled={isPending}
        onClick={() => {
          if (!member.isEditor) {
            grantEditor.mutate({ tripId, userId: member.userId });
          }
        }}
        className="w-full flex items-center justify-between px-5 py-4 disabled:opacity-50"
      >
        <div className="text-left">
          <p className="text-[15px] font-semibold text-[#1A1512]">Editor</p>
          <p className="text-[12px] text-[#A09B96] mt-0.5">Can add, edit and delete items</p>
        </div>
        {member.isEditor && (
          <span className="text-[16px] font-bold text-[#E8622A]">✓</span>
        )}
      </button>

      <div className="h-px bg-[#F0EDE8] mx-5" />

      {/* Viewer option */}
      <button
        disabled={isPending}
        onClick={() => {
          if (member.isEditor) {
            revokeEditor.mutate({ tripId, userId: member.userId });
          }
        }}
        className="w-full flex items-center justify-between px-5 py-4 disabled:opacity-50"
      >
        <div className="text-left">
          <p className="text-[15px] font-semibold text-[#1A1512]">Viewer</p>
          <p className="text-[12px] text-[#A09B96] mt-0.5">Can view itinerary and map only</p>
        </div>
        {!member.isEditor && (
          <span className="text-[16px] font-bold text-[#E8622A]">✓</span>
        )}
      </button>

      {/* Thick divider before destructive action */}
      <div className="h-1.5 bg-[#F0EDE8] mx-5 rounded-full my-1" />

      {/* Remove from trip */}
      <button
        disabled={isPending}
        onClick={() => {
          removeFromTrip.mutate({ tripId, userId: member.userId });
        }}
        className="w-full flex items-center px-5 py-4 disabled:opacity-50"
      >
        <p className="text-[15px] font-semibold text-[#E84040]">Remove from trip</p>
      </button>

      <div className="h-px bg-[#F0EDE8] mx-5 mb-4" />
    </BottomSheet>
  );
}
