"use client";

import { useRef, useState } from "react";

type Attachment = {
  id: string;
  filename: string;
  mimeType: string;
  storagePath: string;
  sizeBytes: number;
};

function fileUrl(storagePath: string) {
  return `/api/uploads/${storagePath}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

// ── Full-screen viewer ────────────────────────────────────────────────────────

function FullScreenViewer({
  attachment,
  onClose,
}: {
  attachment: Attachment;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapCount = useRef(0);

  function handleImageTap() {
    tapCount.current += 1;
    if (tapCount.current === 1) {
      tapTimer.current = setTimeout(() => {
        // Single tap: close only when not zoomed in
        if (scale === 1) onClose();
        tapCount.current = 0;
      }, 250);
    } else {
      // Double tap: toggle zoom
      if (tapTimer.current) clearTimeout(tapTimer.current);
      tapCount.current = 0;
      setScale((s) => (s === 1 ? 2.5 : 1));
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-14 pb-3 flex-shrink-0">
        <p className="text-white/70 text-sm truncate flex-1 mr-4">{attachment.filename}</p>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-light"
        >
          ×
        </button>
      </div>

      {/* Image — tap to close (when not zoomed), double-tap to zoom */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden"
        onClick={handleImageTap}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fileUrl(attachment.storagePath)}
          alt={attachment.filename}
          className="max-w-full max-h-full object-contain transition-transform duration-200"
          style={{ transform: `scale(${scale})` }}
          draggable={false}
        />
      </div>

      <p className="text-white/40 text-xs text-center pb-10 flex-shrink-0">
        {scale === 1 ? "Tap to close · Double-tap to zoom" : "Double-tap to zoom out"}
      </p>
    </div>
  );
}

// ── Gallery ───────────────────────────────────────────────────────────────────

type Props = {
  attachments: Attachment[];
  onDelete?: (id: string) => void;
  currentUserId?: string;
  uploaderIds?: Record<string, string>; // attachmentId → userId
};

export function AttachmentGallery({ attachments, onDelete, currentUserId, uploaderIds }: Props) {
  const [viewing, setViewing] = useState<Attachment | null>(null);

  if (attachments.length === 0) return null;

  return (
    <>
      <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {attachments.map((a) => (
          <div key={a.id} className="relative flex-shrink-0 group">
            {isImage(a.mimeType) ? (
              <button
                onClick={() => setViewing(a)}
                className="w-20 h-20 rounded-[10px] overflow-hidden border border-[#E5E0DA] bg-[#F0EDE8] block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileUrl(a.storagePath)}
                  alt={a.filename}
                  className="w-full h-full object-cover"
                />
              </button>
            ) : (
              <a
                href={fileUrl(a.storagePath)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-20 h-20 rounded-[10px] border border-[#E5E0DA] bg-[#F0EDE8] flex flex-col items-center justify-center gap-1 block"
              >
                <span className="text-2xl">📄</span>
                <span className="text-[9px] text-[#6B6560] text-center px-1 truncate w-full text-center">
                  {formatBytes(a.sizeBytes)}
                </span>
              </a>
            )}

            {/* Delete button — own uploads only */}
            {onDelete && uploaderIds?.[a.id] === currentUserId && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(a.id); }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#E84040] rounded-full text-white text-[11px] flex items-center justify-center shadow-md z-10"
                title="Remove"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {viewing && isImage(viewing.mimeType) && (
        <FullScreenViewer attachment={viewing} onClose={() => setViewing(null)} />
      )}
    </>
  );
}
