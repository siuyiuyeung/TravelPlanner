"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import { toast } from "sonner";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        if (result.error.status === 403) {
          // Email not verified — a fresh verification email was auto-sent by the server
          toast.info("Check your inbox — we've sent you a verification link.");
          router.push("/verify-email");
        } else {
          toast.error(result.error.message ?? "Invalid credentials");
        }
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo / Brand */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#E8622A] mb-4">
          <span className="text-2xl">✈️</span>
        </div>
        <h1 className="text-2xl font-bold text-[#1A1512] tracking-tight">TravelPlanner</h1>
        <p className="text-sm text-[#6B6560] mt-1">Plan together, travel better</p>
      </div>

      <div className="bg-white rounded-[20px] p-6 shadow-[0_2px_16px_rgba(26,21,18,0.08)]">
        <h2 className="text-lg font-bold text-[#1A1512] mb-5">Sign in</h2>

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

          <div className="space-y-1.5" suppressHydrationWarning>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#6B6560] uppercase tracking-wide">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs text-[#E8622A] font-semibold">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              suppressHydrationWarning
              className="w-full px-3.5 py-2.5 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[#1A1512] placeholder:text-[#A09B96] focus:outline-none focus:border-[#E8622A] focus:bg-white transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#E8622A] text-white font-bold rounded-[12px] shadow-[0_2px_8px_rgba(232,98,42,0.30)] active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-[#6B6560] mt-5">
          No account?{" "}
          <Link href="/register" className="text-[#E8622A] font-semibold">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
