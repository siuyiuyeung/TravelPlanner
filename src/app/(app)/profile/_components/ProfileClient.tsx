"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import type { Session } from "@/server/auth";

type Props = { session: Session };

export function ProfileClient({ session }: Props) {
  const router = useRouter();
  const { user } = session;
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <div className="px-5 pt-14 pb-6">
      <h1 className="text-[26px] font-bold text-[#1A1512] tracking-tight mb-7">Profile</h1>

      {/* Avatar + name */}
      <div className="flex flex-col items-center py-8 bg-white border border-[#E5E0DA] rounded-[16px] mb-6">
        <div className="w-20 h-20 rounded-full bg-[#E8622A] flex items-center justify-center text-[28px] font-bold text-white mb-3">
          {initials}
        </div>
        <p className="text-[17px] font-bold text-[#1A1512]">{user.name}</p>
        <p className="text-sm text-[#A09B96] mt-0.5">{user.email}</p>
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="w-full py-4 border border-[#E84040] text-[#E84040] font-bold text-[15px] rounded-[12px]"
      >
        Sign out
      </button>
    </div>
  );
}
