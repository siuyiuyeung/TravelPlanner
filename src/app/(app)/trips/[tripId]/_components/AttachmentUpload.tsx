"use client";

import { useRef, useState } from "react";

type Props = {
  tripId: string;
  itemId?: string;
  onUploaded: () => void;
};

export function AttachmentUpload({ tripId, itemId, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("tripId", tripId);
      if (itemId) form.append("itemId", itemId);

      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Upload failed");
      }
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[8px] text-[12px] font-semibold text-[#6B6560] disabled:opacity-50 transition-opacity"
      >
        {uploading ? (
          <>
            <span className="w-3 h-3 rounded-full border-2 border-[#E8622A] border-t-transparent animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <span>📎</span> Add file
          </>
        )}
      </button>
      {error && <p className="text-[11px] text-[#E84040] mt-1">{error}</p>}
    </div>
  );
}
