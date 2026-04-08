"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";

export function NewGroupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const createGroup = api.groups.create.useMutation({
    onSuccess: (group) => {
      router.push(`/groups/${group.id}`);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Group name is required"); return; }
    createGroup.mutate({ name: name.trim() });
  }

  return (
    <div className="px-5 pt-14 pb-6">
      <button
        onClick={() => router.back()}
        className="mb-6 text-sm font-medium text-[#E8622A] flex items-center gap-1"
      >
        ← Back
      </button>
      <h1 className="text-[26px] font-bold text-[#1A1512] tracking-tight mb-2">New Group</h1>
      <p className="text-sm text-[#6B6560] mb-7">Create a group to invite friends and plan trips together.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#1A1512] mb-1.5">Group name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. College Squad"
            autoFocus
            className="w-full px-4 py-3 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[16px] text-[#1A1512] placeholder:text-[#A09B96] focus:outline-none focus:border-[#E8622A]"
          />
        </div>

        {error && <p className="text-sm text-[#E84040]">{error}</p>}

        <button
          type="submit"
          disabled={createGroup.isPending}
          className="w-full py-4 bg-[#E8622A] text-white font-bold text-[15px] rounded-[12px] shadow-[0_2px_8px_rgba(232,98,42,0.30)] disabled:opacity-50 mt-4"
        >
          {createGroup.isPending ? "Creating…" : "Create Group"}
        </button>
      </form>
    </div>
  );
}
