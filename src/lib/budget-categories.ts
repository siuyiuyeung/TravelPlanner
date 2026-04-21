export type Category = "food" | "transport" | "accommodation" | "activity" | "other";

export const CATEGORY_META: Record<Category, { label: string; emoji: string; color: string }> = {
  food:          { label: "Food",          emoji: "🍽️", color: "#E8622A" },
  transport:     { label: "Transport",     emoji: "🚗", color: "#2D6A8F" },
  accommodation: { label: "Accommodation", emoji: "🏨", color: "#A78BFA" },
  activity:      { label: "Activity",      emoji: "🎭", color: "#3D9970" },
  other:         { label: "Other",         emoji: "📦", color: "#F2A93B" },
};

export const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

export const SUPPORTED_CURRENCIES = [
  { code: "HKD", label: "HK Dollar",      symbol: "HK$" },
  { code: "USD", label: "US Dollar",       symbol: "$"   },
  { code: "EUR", label: "Euro",            symbol: "€"   },
  { code: "GBP", label: "British Pound",   symbol: "£"   },
  { code: "JPY", label: "Japanese Yen",    symbol: "¥"   },
  { code: "CNY", label: "Chinese Yuan",    symbol: "CN¥" },
  { code: "AUD", label: "Australian $",    symbol: "A$"  },
  { code: "CAD", label: "Canadian $",      symbol: "C$"  },
  { code: "CHF", label: "Swiss Franc",     symbol: "Fr"  },
  { code: "INR", label: "Indian Rupee",    symbol: "₹"   },
  { code: "SGD", label: "Singapore $",     symbol: "S$"  },
  { code: "MXN", label: "Mexican Peso",    symbol: "MX$" },
] as const;

export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number]["code"];

export const DEFAULT_CURRENCY: CurrencyCode = "HKD";

const VALID_CURRENCY_CODES: Set<string> = new Set(SUPPORTED_CURRENCIES.map((c) => c.code));
export function toValidCurrency(code: string | null | undefined): CurrencyCode {
  return VALID_CURRENCY_CODES.has(code ?? "") ? (code as CurrencyCode) : DEFAULT_CURRENCY;
}
