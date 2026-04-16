"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#E8622A] mb-4">
            <span className="text-2xl">✈️</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1A1512] tracking-tight">TravelPlanner</h1>
        </div>
        <div className="bg-white rounded-[20px] p-6 shadow-[0_2px_16px_rgba(26,21,18,0.08)] text-center">
          <p className="text-sm text-[#6B6560] mb-4">
            This reset link is invalid or has expired.
          </p>
          <Link href="/forgot-password" className="text-[#E8622A] font-semibold text-sm">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Could not reset password");
      } else {
        toast.success("Password reset! Please sign in.");
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#E8622A] mb-4">
          <span className="text-2xl">✈️</span>
        </div>
        <h1 className="text-2xl font-bold text-[#1A1512] tracking-tight">TravelPlanner</h1>
        <p className="text-sm text-[#6B6560] mt-1">Plan together, travel better</p>
      </div>

      <div className="bg-white rounded-[20px] p-6 shadow-[0_2px_16px_rgba(26,21,18,0.08)]">
        <h2 className="text-lg font-bold text-[#1A1512] mb-2">Set new password</h2>
        <p className="text-sm text-[#6B6560] mb-5">
          Choose a strong password with at least 8 characters.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5" suppressHydrationWarning>
            <label className="text-xs font-semibold text-[#6B6560] uppercase tracking-wide">
              New password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Min 8 characters"
              suppressHydrationWarning
              className="w-full px-3.5 py-2.5 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[#1A1512] placeholder:text-[#A09B96] focus:outline-none focus:border-[#E8622A] focus:bg-white transition-colors"
            />
          </div>

          <div className="space-y-1.5" suppressHydrationWarning>
            <label className="text-xs font-semibold text-[#6B6560] uppercase tracking-wide">
              Confirm password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              placeholder="Repeat your password"
              suppressHydrationWarning
              className="w-full px-3.5 py-2.5 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[#1A1512] placeholder:text-[#A09B96] focus:outline-none focus:border-[#E8622A] focus:bg-white transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#E8622A] text-white font-bold rounded-[12px] shadow-[0_2px_8px_rgba(232,98,42,0.30)] active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Resetting…" : "Reset password"}
          </button>
        </form>

        <p className="text-center text-sm text-[#6B6560] mt-5">
          <Link href="/login" className="text-[#E8622A] font-semibold">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
