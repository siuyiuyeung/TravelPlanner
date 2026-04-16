"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

export function VerifyEmailClient() {
  const { data: session } = authClient.useSession();
  const email = session?.user.email ?? "";
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleResend() {
    if (!email) {
      toast.error("Sign in first to resend a verification email");
      return;
    }
    setLoading(true);
    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: "/dashboard",
      });
      if (result.error) {
        toast.error(result.error.message ?? "Could not resend email");
      } else {
        setSent(true);
        toast.success("Verification email sent!");
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
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F0EDE8] mb-3">
            <span className="text-2xl">📧</span>
          </div>
          <h2 className="text-lg font-bold text-[#1A1512]">Check your inbox</h2>
          {email ? (
            <p className="text-sm text-[#6B6560] mt-1">
              We sent a confirmation link to{" "}
              <span className="font-semibold text-[#1A1512]">{email}</span>
            </p>
          ) : (
            <p className="text-sm text-[#6B6560] mt-1">
              Click the link in your email to verify your account.
            </p>
          )}
        </div>

        <div className="bg-[#F0EDE8] rounded-[12px] p-4 text-sm text-[#6B6560] mb-5">
          <p>
            Didn&apos;t receive it? Check your spam folder, or tap below to resend.
          </p>
        </div>

        <button
          onClick={handleResend}
          disabled={loading || sent}
          className="w-full py-3.5 bg-[#E8622A] text-white font-bold rounded-[12px] shadow-[0_2px_8px_rgba(232,98,42,0.30)] active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Sending…" : sent ? "Email sent ✓" : "Resend verification email"}
        </button>

        <p className="text-center text-sm text-[#6B6560] mt-5">
          <Link href="/login" className="text-[#E8622A] font-semibold">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
