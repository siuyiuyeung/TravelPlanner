"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";
import { toast } from "sonner";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const result = await signUp.email({ name, email, password });
      if (result.error) {
        toast.error(result.error.message ?? "Sign up failed");
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
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#E8622A] mb-4">
          <span className="text-2xl">✈️</span>
        </div>
        <h1 className="text-2xl font-bold text-[#1A1512] tracking-tight">TravelPlanner</h1>
        <p className="text-sm text-[#6B6560] mt-1">Plan together, travel better</p>
      </div>

      <div className="bg-white rounded-[20px] p-6 shadow-[0_2px_16px_rgba(26,21,18,0.08)]">
        <h2 className="text-lg font-bold text-[#1A1512] mb-5">Create account</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5" suppressHydrationWarning>
            <label className="text-xs font-semibold text-[#6B6560] uppercase tracking-wide">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Alex Johnson"
              suppressHydrationWarning
              className="w-full px-3.5 py-2.5 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[#1A1512] placeholder:text-[#A09B96] focus:outline-none focus:border-[#E8622A] focus:bg-white transition-colors"
            />
          </div>

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
            <label className="text-xs font-semibold text-[#6B6560] uppercase tracking-wide">
              Password
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#E8622A] text-white font-bold rounded-[12px] shadow-[0_2px_8px_rgba(232,98,42,0.30)] active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-[#6B6560] mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-[#E8622A] font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
