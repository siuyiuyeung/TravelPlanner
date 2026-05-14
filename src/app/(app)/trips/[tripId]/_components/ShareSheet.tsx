"use client";

import { useState, useCallback, useRef } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { api } from "@/lib/trpc/client";
import { toast } from "sonner";

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
  const [copied, setCopied] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const utils = api.useUtils();

  const { data: members } = api.trips.getMemberAccess.useQuery(
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

  const grantEditor = api.trips.grantEditor.useMutation({
    onSuccess: () => {
      void utils.trips.getMemberAccess.invalidate({ tripId });
      setSelectedMember(null);
    },
    onError: () => toast.error("Failed to update access"),
  });

  const revokeEditor = api.trips.revokeEditor.useMutation({
    onSuccess: () => {
      void utils.trips.getMemberAccess.invalidate({ tripId });
      setSelectedMember(null);
    },
    onError: () => toast.error("Failed to update access"),
  });

  const removeFromTrip = api.trips.removeFromTrip.useMutation({
    onSuccess: () => {
      void utils.trips.getMemberAccess.invalidate({ tripId });
      setSelectedMember(null);
    },
    onError: () => toast.error("Failed to remove member"),
  });

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/trips/share/${shareToken}`
      : `/trips/share/${shareToken}`;

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      if (urlInputRef.current) {
        urlInputRef.current.select();
        document.execCommand("copy");
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  const handleResetLink = () => {
    if (confirm("Reset the share link? The old link will stop working.")) {
      regenerateToken.mutate({ tripId });
    }
  };

  const visibleMembers = (members ?? []).filter((m) => !m.isBlocked);
  const isPending = grantEditor.isPending || revokeEditor.isPending || removeFromTrip.isPending;

  return (
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

        {/* Hidden input for execCommand fallback — must live inside sheet DOM */}
        <input ref={urlInputRef} readOnly value={shareUrl} className="sr-only" aria-hidden />

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
              {copied ? "Copied!" : "Copy"}
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

      {/* Members section label */}
      <div className="px-5 mt-4">
        <p className="text-[11px] font-semibold text-[#A09B96] uppercase tracking-wide mb-2">
          Group members
        </p>
      </div>

      {/* Scrollable members list */}
      <div className="overflow-y-auto px-5 pb-6" style={{ maxHeight: "40vh" }}>
        {visibleMembers.map((member, idx) => {
          const isCurrentUser = member.userId === currentUserId;
          const isCreator = member.isCreator;
          const isSelected = selectedMember?.userId === member.userId;
          const colorClass = AVATAR_COLORS[idx % AVATAR_COLORS.length]!;

          return (
            <div
              key={member.userId}
              className="flex items-center py-2.5 border-b border-[#F0EDE8] last:border-b-0"
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0 ${colorClass}`}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>

              {/* Name */}
              <div className="ml-2.5 flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#1A1512] truncate">
                  {member.name}
                  {isCurrentUser && (
                    <span className="text-[#A09B96] font-normal ml-1">(you)</span>
                  )}
                </p>
                {isCreator && (
                  <p className="text-[11px] text-[#A09B96]">Trip creator</p>
                )}
              </div>

              {/* Right side: chips (expanded) or badge+⋮ (collapsed) or badge only (creator/self) */}
              {!isCreator && !isCurrentUser ? (
                isSelected ? (
                  <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                    <button
                      disabled={isPending}
                      onClick={() => {
                        if (!member.isEditor) grantEditor.mutate({ tripId, userId: member.userId });
                        else setSelectedMember(null);
                      }}
                      className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                        member.isEditor
                          ? "bg-[rgba(232,98,42,0.10)] text-[#E8622A] border border-[rgba(232,98,42,0.25)]"
                          : "bg-[#F0EDE8] text-[#6B6560]"
                      }`}
                    >
                      Editor
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() => {
                        if (member.isEditor) revokeEditor.mutate({ tripId, userId: member.userId });
                        else setSelectedMember(null);
                      }}
                      className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                        !member.isEditor
                          ? "bg-[rgba(232,98,42,0.10)] text-[#E8622A] border border-[rgba(232,98,42,0.25)]"
                          : "bg-[#F0EDE8] text-[#6B6560]"
                      }`}
                    >
                      Viewer
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() => removeFromTrip.mutate({ tripId, userId: member.userId })}
                      className="px-2 py-1 rounded-md text-[11px] font-semibold text-[#E84040] bg-[rgba(232,64,64,0.08)] transition-colors disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-md flex-shrink-0 ${
                        member.isEditor
                          ? "bg-[rgba(232,98,42,0.10)] text-[#E8622A]"
                          : "bg-[#F0EDE8] text-[#6B6560]"
                      }`}
                    >
                      {member.isEditor ? "Editor" : "Viewer"}
                    </span>
                    <button
                      onClick={() => setSelectedMember(member)}
                      className="ml-2 w-8 h-8 flex items-center justify-center rounded-full text-[#A09B96] hover:bg-[#F0EDE8] hover:text-[#6B6560] active:bg-[#E5E0DA] transition-colors flex-shrink-0"
                      aria-label={`Manage access for ${member.name}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                        <circle cx="8" cy="3.5" r="1.5" />
                        <circle cx="8" cy="8" r="1.5" />
                        <circle cx="8" cy="12.5" r="1.5" />
                      </svg>
                    </button>
                  </>
                )
              ) : (
                <span
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-md flex-shrink-0 ${
                    member.isEditor
                      ? "bg-[rgba(232,98,42,0.10)] text-[#E8622A]"
                      : "bg-[#F0EDE8] text-[#6B6560]"
                  }`}
                >
                  {member.isEditor ? "Editor" : "Viewer"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </BottomSheet>
  );
}
