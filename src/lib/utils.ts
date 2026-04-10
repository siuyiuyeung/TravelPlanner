import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents: number, currency = "HKD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "JPY" || currency === "CNY" ? 0 : 2,
  }).format(cents / 100);
}

export function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (s.getFullYear() !== e.getFullYear()) {
    return `${s.toLocaleDateString("en-US", { ...opts, year: "numeric" })} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
  }
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}
