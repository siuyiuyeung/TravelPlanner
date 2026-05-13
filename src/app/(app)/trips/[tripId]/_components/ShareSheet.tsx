"use client";

import { useState, useCallback } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { api } from "@/lib/trpc/client";
import { toast } from "sonner";
import { MemberAccessSheet } from "./MemberAccessSheet";

type Member = {
  userId: string;
  name: string;
  image: string | null;
  isEditor: boolean;
  isBlocked: boolean;
  isCreator: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  isPublic: boolean;
  shareToken: string;
  currentUserId: string;
};

const AVATAR_COLORS = [
  "bg-[#E8622A]",
  "bg-[#2D6A8F]",
  "bg-[#3D9970]",
  "bg-[#A78BFA]",
  "bg-[#F2A93B]",
];

export function ShareSheet({ open, onOpenChange, tripId, isPublic, shareToken, currentUserId }: Props) {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberSheetOpen, setMemberSheetOpen] = useState(false);

  const utils = api.useUtils();

  const { data: members, refetch: refetchMembers } = api.trips.getMemberAccess.useQuery(
    { tripId },
    { enabled: open },
  );

  const updateSharing = api.trips.updateSharing.useMutation({
    onSuccess: () => void utils.trips.getById.invalidate({ tripId }),
    onError: () => toast.error("Failed to update sharing"),
  });

  const regenerateToken = api.trips.regenerateToken.useMutation({
    onSuccess: () => {
      void utils.trips.getById.invalidate({ tripId });
      toast.success("Share link reset");
    },
    onError: () => toast.error("Failed to reset link"),
  });

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/trips/share/${shareToken}`
      : `/trips/share/${shareToken}`;

  const copyLink = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success("Link copied");
    }).catch(() => {
      // Fallback for when clipboard API is blocked (e.g. focus trap in sheet)
      const el = document.createElement("input");
      el.style.cssText = "position:fixed;opacity:0";
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      toast.success("Link copied");
    });
  }, [shareUrl]);

  const handleResetLink = () => {
    if (confirm("Reset the share link? The old link will stop working.")) {
      regenerateToken.mutate({ tripId });
    }
  };

  const visibleMembers = (members ?? []).filter((m) => !m.isBlocked);

  return (
    <>
      <BottomSheet open={open} onOpenChange={onOpenChange}>
        {/* Title */}
        <p className="text-[17px] font-bold text-[#1A1512] px-5 pt-4 pb-2">Share trip</p>

        {/* Public link section */}
        <div className="px-5">
          <p className="text-[11px] font-semibold text-[#A09B96] uppercase tracking-wide mb-2">
            Public link
          </p>

          {/* Toggle row */}
          <div className="flex items-center justify-between px-3.5 py-3 bg-[#FAF8F5] border border-[#E5E0DA] rounded-[14px]">
            <div>
              <p className="text-[14px] font-semibold text-[#1A1512]">Anyone with link can view</p>
              <p className="text-[11px] text-[#A09B96] mt-0.5">No sign-in required · Read only</p>
            </div>
            <button
              onClick={() => updateSharing.mutate({ tripId, isPublic: !isPublic })}
              disabled={updateSharing.isPending}
              className={`w-11 h-[26px] rounded-full relative transition-colors flex-shrink-0 disabled:opacity-50 ${
                isPublic ? "bg-[#E8622A]" : "bg-[#E5E0DA]"
              }`}
            >
              <span
                className={`absolute left-0 top-[3px] w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  isPublic ? "translate-x-[22px]" : "translate-x-[3px]"
                }`}
              />
            </button>
          </div>

          {/* Link row — show only when public */}
          {isPublic && (
            <div className="flex gap-2 mt-2 items-center">
              <div className="flex-1 px-3 py-2.5 bg-[#F0EDE8] rounded-[10px] text-[11px] text-[#6B6560] overflow-hidden text-ellipsis whitespace-nowrap">
                {shareUrl}
              </div>
              <button
                onClick={copyLink}
                className="px-3.5 py-2.5 bg-[#E8622A] text-white text-[12px] font-bold rounded-[12px] shadow-[0_2px_8px_rgba(232,98,42,0.30)] whitespace-nowrap"
              >
                Copy
              </button>
              <button
                onClick={handleResetLink}
                disabled={regenerateToken.isPending}
                className="px-3 py-2.5 border border-[#E5E0DA] text-[#6B6560] text-[12px] font-semibold rounded-[12px] whitespace-nowrap disabled:opacity-50"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Members section */}
        <div className="px-5 mt-4">
          <p className="text-[11px] font-semibold text-[#A09B96] uppercase tracking-wide mb-2">
            Group members
          </p>
        </div>

        {/* Scrollable members list */}
        <div className="overflow-y-auto px-5 pb-8" style={{ maxHeight: "40vh" }}>
          {visibleMembers.map((member, idx) => {
            const isCurrentUser = member.userId === currentUserId;
            const isCreator = member.isCreator;
            const colorClass = AVATAR_COLORS[idx % AVATAR_COLORS.length]!;

            return (
              <div
                key={member.userId}
                className="flex items-center py-2.5 border-b border-[#F0EDE8] last:border-b-0"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0 ${colorClass}`}
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div className="ml-2.5 flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#1A1512]">
                    {member.name}
                    {isCurrentUser && (
                      <span className="text-[#A09B96] font-normal ml-1">(you)</span>
                    )}
                  </p>
                  {isCreator && (
                    <p className="text-[11px] text-[#A09B96]">Trip creator</p>
                  )}
                </div>
                <span
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-md flex-shrink-0 ${
                    member.isEditor
                      ? "bg-[rgba(232,98,42,0.10)] text-[#E8622A]"
                      : "bg-[#F0EDE8] text-[#6B6560]"
                  }`}
                >
                  {member.isEditor ? "Editor" : "Viewer"}
                </span>
                {/* Show ··· only for non-creator, non-self members */}
                {!isCreator && !isCurrentUser && (
                  <button
                    onClick={() => {
                      setSelectedMember(member);
                      setMemberSheetOpen(true);
                    }}
                    className="ml-1 w-7 h-7 flex items-center justify-center rounded-full text-[#A09B96] hover:bg-[#F0EDE8] transition-colors flex-shrink-0 text-[16px] tracking-tighter"
                    aria-label={`Manage access for ${member.name}`}
                  >
                    ···
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </BottomSheet>

      {/* Stacked member action sheet */}
      <MemberAccessSheet
        open={memberSheetOpen}
        onOpenChange={setMemberSheetOpen}
        tripId={tripId}
        member={selectedMember}
        onSuccess={() => void refetchMembers()}
      />
    </>
  );
}
