"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      if (result.error) {
        toast.error(result.error.message ?? "Could not send reset email");
      } else {
        setSubmitted(true);
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
        {submitted ? (
          <div className="text-center py-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F0EDE8] mb-3">
              <span className="text-2xl">📧</span>
            </div>
            <h2 className="text-lg font-bold text-[#1A1512] mb-2">Check your inbox</h2>
            <p className="text-sm text-[#6B6560]">
              If an account exists for{" "}
              <span className="font-semibold text-[#1A1512]">{email}</span>,
              you&apos;ll receive a password reset link shortly.
            </p>
            <Link
              href="/login"
              className="inline-block mt-5 text-sm font-semibold text-[#E8622A]"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-[#1A1512] mb-2">Forgot password?</h2>
            <p className="text-sm text-[#6B6560] mb-5">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5" suppressHydrationWarning>
                <label className="text-xs font-semibold text-[#6B6560] uppercase tracking-wide">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  suppressHydrationWarning
                  className="w-full px-3.5 py-2.5 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[#1A1512] placeholder:text-[#A09B96] focus:outline-none focus:border-[#E8622A] focus:bg-white transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#E8622A] text-white font-bold rounded-[12px] shadow-[0_2px_8px_rgba(232,98,42,0.30)] active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="text-center text-sm text-[#6B6560] mt-5">
              <Link href="/login" className="text-[#E8622A] font-semibold">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
