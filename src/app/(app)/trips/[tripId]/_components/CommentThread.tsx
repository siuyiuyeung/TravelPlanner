"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/trpc/client";
import type { AppRouter } from "@/server/routers/_app";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutput = inferRouterOutputs<AppRouter>;
type Comment = RouterOutput["comments"]["list"][number];

const REACTIONS = ["👍", "🎉", "❤️", "😂", "✅"] as const;
type Reaction = (typeof REACTIONS)[number];

function formatTime(date: Date | string) {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CommentBubble({
  comment,
  currentUserId,
  onDelete,
  onReact,
}: {
  comment: Comment;
  currentUserId: string;
  onDelete: (id: string) => void;
  onReact: (commentId: string, emoji: Reaction) => void;
}) {
  const isOwn = comment.userId === currentUserId;
  const reactions = (comment.reactions ?? {}) as Record<string, string[]>;
  const initials = comment.user.name.charAt(0).toUpperCase();
  const colors = ["bg-[#E8622A]", "bg-[#2D6A8F]", "bg-[#3D9970]", "bg-[#A78BFA]", "bg-[#F2A93B]"];
  const avatarColor = colors[comment.user.id.charCodeAt(0) % colors.length];

  return (
    <div className={`flex gap-2.5 ${isOwn ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white mt-1 ${avatarColor}`}
      >
        {initials}
      </div>

      <div className={`flex flex-col gap-1 max-w-[75%] ${isOwn ? "items-end" : "items-start"}`}>
        {/* Name + time */}
        <div className={`flex items-baseline gap-1.5 ${isOwn ? "flex-row-reverse" : ""}`}>
          <span className="text-[12px] font-semibold text-[#1A1512]">{comment.user.name.split(" ")[0]}</span>
          <span className="text-[10px] text-[#A09B96]">{formatTime(comment.createdAt)}</span>
        </div>

        {/* Bubble */}
        <div
          className={`relative px-3 py-2 rounded-[14px] text-[14px] leading-snug ${
            isOwn
              ? "bg-[#E8622A] text-white rounded-tr-[4px]"
              : "bg-white border border-[#E5E0DA] text-[#1A1512] rounded-tl-[4px]"
          }`}
        >
          {comment.body}

          {/* Delete button for own messages */}
          {isOwn && (
            <button
              onClick={() => onDelete(comment.id)}
              className="absolute -top-2 -right-1 w-5 h-5 bg-[#E5E0DA] rounded-full text-[10px] flex items-center justify-center text-[#6B6560] opacity-0 group-hover:opacity-100 hover:bg-[#E84040] hover:text-white transition-all"
              title="Delete"
            >
              ×
            </button>
          )}
        </div>

        {/* Reactions */}
        <div className={`flex flex-wrap gap-1 ${isOwn ? "justify-end" : ""}`}>
          {REACTIONS.map((emoji) => {
            const users = reactions[emoji] ?? [];
            const hasReacted = users.includes(currentUserId);
            if (users.length === 0 && !hasReacted) return null;
            return (
              <button
                key={emoji}
                onClick={() => onReact(comment.id, emoji)}
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] transition-colors ${
                  hasReacted
                    ? "bg-[rgba(232,98,42,0.15)] border border-[rgba(232,98,42,0.3)] text-[#E8622A]"
                    : "bg-[#F0EDE8] text-[#6B6560]"
                }`}
              >
                {emoji} {users.length}
              </button>
            );
          })}

          {/* Add reaction picker */}
          <ReactionPicker onPick={(emoji) => onReact(comment.id, emoji)} />
        </div>
      </div>
    </div>
  );
}

function ReactionPicker({ onPick }: { onPick: (emoji: Reaction) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] bg-[#F0EDE8] text-[#A09B96] hover:text-[#6B6560] transition-colors"
      >
        + 😊
      </button>
      {open && (
        <div className="absolute bottom-7 left-0 flex gap-1 bg-white border border-[#E5E0DA] rounded-[10px] px-2 py-1.5 shadow-lg z-20">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onPick(emoji);
                setOpen(false);
              }}
              className="text-[18px] hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Props = {
  tripId: string;
  userId: string;
  parentType?: "trip" | "item";
  parentId?: string;
};

export function CommentThread({ tripId, userId, parentType = "trip", parentId }: Props) {
  const utils = api.useUtils();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const queryInput = { tripId, parentType, ...(parentId && { parentId }) };

  const { data: comments = [], isLoading } = api.comments.list.useQuery(queryInput);

  const postComment = api.comments.create.useMutation({
    onSuccess: () => {
      setText("");
      utils.comments.list.invalidate(queryInput);
    },
  });

  const deleteComment = api.comments.delete.useMutation({
    onSuccess: () => utils.comments.list.invalidate(queryInput),
  });

  const toggleReaction = api.comments.toggleReaction.useMutation({
    onSuccess: () => utils.comments.list.invalidate(queryInput),
  });

  // Scroll to bottom when new comments arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  // Visual viewport for keyboard-aware layout
  useEffect(() => {
    function onResize() {
      if (!inputRef.current) return;
      // Let the browser handle it — just ensure bottom div stays visible
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
    window.visualViewport?.addEventListener("resize", onResize);
    return () => window.visualViewport?.removeEventListener("resize", onResize);
  }, []);

  function handleSubmit() {
    const body = text.trim();
    if (!body) return;
    postComment.mutate({
      tripId,
      parentType,
      ...(parentId && { parentId }),
      body,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 px-4 py-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-2.5 animate-pulse">
            <div className="w-7 h-7 rounded-full bg-[#E5E0DA] flex-shrink-0" />
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="h-3 w-16 bg-[#E5E0DA] rounded" />
              <div className="h-9 w-48 bg-[#E5E0DA] rounded-[14px]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-2">
        {comments.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <span className="text-4xl mb-3">💬</span>
            <p className="text-[15px] font-semibold text-[#1A1512]">No messages yet</p>
            <p className="text-sm text-[#6B6560] mt-1">Be the first to say something</p>
          </div>
        ) : (
          comments.map((comment) => (
            <CommentBubble
              key={comment.id}
              comment={comment}
              currentUserId={userId}
              onDelete={(id) => deleteComment.mutate({ commentId: id })}
              onReact={(commentId, emoji) => toggleReaction.mutate({ commentId, emoji })}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar — pinned to bottom */}
      <div className="flex-shrink-0 border-t border-[#E5E0DA] bg-white px-4 pt-3 pb-4">
        <div className="flex items-end gap-2.5">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a message…"
            rows={1}
            className="flex-1 resize-none bg-[#F0EDE8] border border-[#E5E0DA] focus:border-[#E8622A] rounded-[12px] px-3 py-2.5 text-[16px] text-[#1A1512] placeholder:text-[#A09B96] outline-none transition-colors max-h-24 overflow-y-auto"
            style={{ fontSize: "16px" }}
          />
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || postComment.isPending}
            className="w-10 h-10 rounded-full bg-[#E8622A] flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity shadow-[0_2px_8px_rgba(232,98,42,0.30)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
