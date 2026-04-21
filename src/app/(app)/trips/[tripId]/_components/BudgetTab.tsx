"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";
import { useSwipeToDelete } from "@/hooks/use-swipe-to-delete";
import { BottomSheet, BottomSheetTitle } from "@/components/ui/bottom-sheet";
import { formatCurrency } from "@/lib/utils";

type Category = "food" | "transport" | "accommodation" | "activity" | "other";

const CATEGORY_META: Record<Category, { label: string; emoji: string; color: string }> = {
  food:          { label: "Food",          emoji: "🍽️", color: "#E8622A" },
  transport:     { label: "Transport",     emoji: "🚗", color: "#2D6A8F" },
  accommodation: { label: "Accommodation", emoji: "🏨", color: "#A78BFA" },
  activity:      { label: "Activity",      emoji: "🎭", color: "#3D9970" },
  other:         { label: "Other",         emoji: "📦", color: "#F2A93B" },
};

const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

const SUPPORTED_CURRENCIES = [
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

type CurrencyCode = typeof SUPPORTED_CURRENCIES[number]["code"];

const ITEM_TYPE_TO_CATEGORY: Record<string, Category> = {
  flight:     "transport",
  hotel:      "accommodation",
  restaurant: "food",
  activity:   "activity",
  transport:  "transport",
  note:       "other",
};

// ── Types ─────────────────────────────────────────────────────────────────────

type Member = { userId: string; user: { id: string; name: string } };

type ItineraryItemProp = {
  id: string;
  type: string;
  title: string;
  costCents: number | null;
  currency: string | null;
};

type PlannedEntry = {
  kind: "planned";
  id: string;           // itinerary item id
  title: string;
  category: Category;
  amountCents: number;
  currency: string;
};

type ActualEntry = {
  kind: "actual";
  id: string;
  title: string;
  category: Category;
  amountCents: number;
  currency: string;
  payerName: string;
  paidBy: string;
  sortKey: Date;
};

type BudgetEntry = PlannedEntry | ActualEntry;

// ── SVG Donut chart ───────────────────────────────────────────────────────────

function DonutChart({ segments, total }: { segments: { category: Category; amount: number }[]; total: number }) {
  const SIZE = 140;
  const R = 52;
  const STROKE = 20;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const circumference = 2 * Math.PI * R;

  if (total === 0) {
    return (
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#F0EDE8" strokeWidth={STROKE} />
      </svg>
    );
  }

  let offset = 0;
  const arcs = segments.map(({ category, amount }) => {
    const dash = (amount / total) * circumference;
    const arc = { category, dash, gap: circumference - dash, offset };
    offset += dash;
    return arc;
  });

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: "rotate(-90deg)" }}>
      {arcs.map(({ category, dash, gap, offset: off }) => (
        <circle
          key={category}
          cx={cx} cy={cy} r={R}
          fill="none"
          stroke={CATEGORY_META[category].color}
          strokeWidth={STROKE}
          strokeDasharray={`${dash} ${gap}`}
          strokeDashoffset={-off}
        />
      ))}
    </svg>
  );
}

// ── Expense Form (add + edit) ─────────────────────────────────────────────────

type ExpenseFormProps =
  | { mode: "add"; tripId: string; members: Member[]; itineraryItemId?: string; initialValues?: { title: string; amountCents: number; currency: string; category: Category }; onSuccess: () => void }
  | { mode: "edit"; expenseId: string; initial: { title: string; amountCents: number; currency: string; category: Category; paidBy: string }; members: Member[]; onSuccess: () => void };

function ExpenseForm(props: ExpenseFormProps) {
  const init = props.mode === "edit" ? props.initial : (props.mode === "add" ? props.initialValues : null);
  const [title, setTitle] = useState(init?.title ?? "");
  const [amount, setAmount] = useState(init ? String(init.amountCents / 100) : "");
  const [currency, setCurrency] = useState<CurrencyCode>(
    SUPPORTED_CURRENCIES.some((c) => c.code === (init?.currency ?? "HKD"))
      ? ((init?.currency ?? "HKD") as CurrencyCode)
      : "HKD"
  );
  const [category, setCategory] = useState<Category>(init?.category ?? "other");
  const [paidByUserId, setPaidBy] = useState<string>(
    props.mode === "edit" ? (props.initial.paidBy ?? "") : ""
  );

  const add = api.budget.add.useMutation({ onSuccess: props.onSuccess });
  const update = api.budget.update.useMutation({ onSuccess: props.onSuccess });
  const isPending = add.isPending || update.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(parseFloat(amount) * 100);
    if (!title.trim() || isNaN(cents) || cents <= 0) return;
    if (props.mode === "edit") {
      update.mutate({
        expenseId: props.expenseId,
        title: title.trim(),
        amountCents: cents,
        currency,
        category,
        paidByUserId: paidByUserId || undefined,
      });
    } else {
      add.mutate({
        tripId: props.tripId,
        itineraryItemId: props.itineraryItemId,
        title: title.trim(),
        amountCents: cents,
        currency,
        category,
        paidByUserId: paidByUserId || undefined,
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-5 pb-8 space-y-4">
      <div>
        <label className="block text-xs font-semibold text-[#6B6560] mb-1.5">Description</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Dinner at Nobu"
          className="w-full px-3.5 py-3 bg-[#F0EDE8] rounded-[10px] text-[15px] text-[#1A1512] placeholder:text-[#A09B96] outline-none"
          required
          autoFocus={props.mode === "edit"}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#6B6560] mb-1.5">Amount</label>
        <div className="flex gap-2">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className="px-3 py-3 bg-[#F0EDE8] rounded-[10px] text-[14px] text-[#1A1512] outline-none flex-shrink-0"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.code} {c.symbol}</option>
            ))}
          </select>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            className="flex-1 px-3.5 py-3 bg-[#F0EDE8] rounded-[10px] text-[15px] text-[#1A1512] placeholder:text-[#A09B96] outline-none"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#6B6560] mb-1.5">Category</label>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((c) => {
            const meta = CATEGORY_META[c];
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-[10px] text-[11px] font-semibold transition-colors border ${
                  category === c
                    ? "border-[#E8622A] bg-[rgba(232,98,42,0.08)] text-[#E8622A]"
                    : "border-[#E5E0DA] bg-white text-[#6B6560]"
                }`}
              >
                <span className="text-lg">{meta.emoji}</span>
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {props.members.length > 1 && (
        <div>
          <label className="block text-xs font-semibold text-[#6B6560] mb-1.5">Who Paid</label>
          <select
            value={paidByUserId}
            onChange={(e) => setPaidBy(e.target.value)}
            className="w-full px-3.5 py-3 bg-[#F0EDE8] rounded-[10px] text-[15px] text-[#1A1512] outline-none"
          >
            <option value="">Me</option>
            {props.members.map((m) => (
              <option key={m.userId} value={m.userId}>{m.user.name}</option>
            ))}
          </select>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-4 bg-[#E8622A] text-white font-bold text-[15px] rounded-[12px] disabled:opacity-50"
      >
        {isPending
          ? (props.mode === "edit" ? "Saving…" : "Adding…")
          : (props.mode === "edit" ? "Save Changes" : "Add Expense")}
      </button>
    </form>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  tripId: string;
  userId: string;
  members: Member[];
  itineraryItems: ItineraryItemProp[];
  budgetCents: number;
  budgetCurrency: string;
};

function timeAgo(d: Date | string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function SwipeableExpenseRow({
  entry,
  meta,
  isOwn,
  onEdit,
  onDelete,
}: {
  entry: ActualEntry;
  meta: { emoji: string; color: string };
  isOwn: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { swiped, onTouchStart, onTouchEnd, onMouseDown, onClickCapture } = useSwipeToDelete();

  return (
    <div className="relative overflow-hidden" onClickCapture={isOwn ? onClickCapture : undefined}>
      {isOwn && (
        <div className="absolute inset-y-0 right-0 w-20 bg-[#E84040] flex items-center justify-center">
          <button onClick={onDelete} className="flex flex-col items-center gap-1">
            <span className="text-white text-xl">🗑</span>
            <span className="text-white text-[10px] font-semibold">Delete</span>
          </button>
        </div>
      )}
      <div
        onTouchStart={isOwn ? onTouchStart : undefined}
        onTouchEnd={isOwn ? onTouchEnd : undefined}
        onMouseDown={isOwn ? onMouseDown : undefined}
        style={isOwn ? { transform: swiped ? "translateX(-80px)" : "translateX(0)", transition: "transform 0.2s ease" } : undefined}
        className="flex items-center gap-3 px-4 py-3 active:bg-[#F0EDE8] transition-colors cursor-pointer bg-white select-none"
        onClick={() => isOwn && onEdit()}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
          style={{ backgroundColor: `${meta.color}20` }}
        >
          {meta.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#1A1512] truncate">{entry.title}</p>
          <p className="text-[11px] text-[#A09B96]">
            {entry.payerName.split(" ")[0]} · {timeAgo(entry.sortKey)}
            {isOwn && <span className="text-[#A09B96]"> · tap to edit</span>}
          </p>
        </div>
        <span className="text-[14px] font-bold text-[#1A1512] flex-shrink-0">
          {formatCurrency(entry.amountCents, entry.currency)}
        </span>
      </div>
    </div>
  );
}

export function BudgetTab({ tripId, userId, members, itineraryItems, budgetCents, budgetCurrency }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ActualEntry | null>(null);
  const [markingPaid, setMarkingPaid] = useState<PlannedEntry | null>(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [budgetCurInput, setBudgetCurInput] = useState<CurrencyCode>(
    SUPPORTED_CURRENCIES.some((c) => c.code === budgetCurrency)
      ? (budgetCurrency as CurrencyCode)
      : "HKD"
  );

  const utils = api.useUtils();
  const { data: expenses = [] } = api.budget.listByTrip.useQuery({ tripId });

  const deleteExpense = api.budget.delete.useMutation({
    onSuccess: () => utils.budget.listByTrip.invalidate({ tripId }),
  });

  const updateTrip = api.trips.update.useMutation({
    onSuccess: () => {
      utils.trips.getById.invalidate({ tripId });
      setEditingBudget(false);
    },
  });

  // ── Unified entry list ─────────────────────────────────────────────────────

  // Items that already have a linked expense are shown as actuals — exclude from planned
  const paidItemIds = new Set(expenses.map((e) => e.itineraryItemId).filter(Boolean));

  const plannedEntries: PlannedEntry[] = itineraryItems
    .filter((i) => (i.costCents ?? 0) > 0 && !paidItemIds.has(i.id))
    .map((i) => ({
      kind: "planned",
      id: i.id,
      title: i.title,
      category: ITEM_TYPE_TO_CATEGORY[i.type] ?? "other",
      amountCents: i.costCents!,
      currency: i.currency ?? "HKD",
    }));

  const actualEntries: ActualEntry[] = expenses.map((e) => ({
    kind: "actual",
    id: e.id,
    title: e.title,
    category: e.category as Category,
    amountCents: e.amountCents,
    currency: e.currency,
    payerName: e.payer.name,
    paidBy: e.paidBy,
    sortKey: new Date(e.paidAt),
  }));

  const allEntries: BudgetEntry[] = [
    ...actualEntries.sort((a, b) => b.sortKey.getTime() - a.sortKey.getTime()),
    ...plannedEntries,
  ];

  // ── Breakdown for donut (actuals + planned) ────────────────────────────────

  const breakdown = CATEGORIES.map((cat) => ({
    category: cat,
    amount:
      expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amountCents, 0) +
      itineraryItems
        .filter((i) => (i.costCents ?? 0) > 0 && !paidItemIds.has(i.id) && (ITEM_TYPE_TO_CATEGORY[i.type] ?? "other") === cat)
        .reduce((s, i) => s + (i.costCents ?? 0), 0),
  })).filter((s) => s.amount > 0);

  const totalForDonut = breakdown.reduce((s, b) => s + b.amount, 0);

  // ── Currency detection ─────────────────────────────────────────────────────

  const actualCents = expenses.reduce((s, e) => s + e.amountCents, 0);
  const allUsedCurrencies = [
    ...expenses.map((e) => e.currency),
    ...itineraryItems.filter((i) => (i.costCents ?? 0) > 0).map((i) => i.currency ?? "HKD"),
  ];
  const uniqueCurrencies = [...new Set(allUsedCurrencies)];
  const isMixed = uniqueCurrencies.length > 1;
  const singleCurrency = uniqueCurrencies[0] ?? budgetCurrency;

  // Per-currency breakdown used when isMixed — never mixes units
  const currencyBreakdown = uniqueCurrencies.map((cur) => {
    const curExpenses = expenses.filter((e) => e.currency === cur);
    const curItems = itineraryItems.filter(
      (i) => (i.costCents ?? 0) > 0 && !paidItemIds.has(i.id) && (i.currency ?? "HKD") === cur
    );
    const total =
      curExpenses.reduce((s, e) => s + e.amountCents, 0) +
      curItems.reduce((s, i) => s + (i.costCents ?? 0), 0);
    const cats = CATEGORIES.map((cat) => ({
      category: cat,
      amount:
        curExpenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amountCents, 0) +
        curItems
          .filter((i) => (ITEM_TYPE_TO_CATEGORY[i.type] ?? "other") === cat)
          .reduce((s, i) => s + (i.costCents ?? 0), 0),
    })).filter((c) => c.amount > 0);
    return { currency: cur, total, cats };
  });

  function saveBudget() {
    const cents = Math.round(parseFloat(budgetInput) * 100);
    if (isNaN(cents) || cents < 0) return;
    updateTrip.mutate({ tripId, budgetCents: cents, budgetCurrency: budgetCurInput });
  }

  return (
    <>
      <div className="space-y-4">
        {/* Summary card */}
        <div className="bg-white border border-[#E5E0DA] rounded-[16px] p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-[14px] font-semibold text-[#1A1512]">Budget Overview</p>
            <button
              onClick={() => {
                setBudgetInput(budgetCents > 0 ? String(budgetCents / 100) : "");
                setBudgetCurInput(
                  SUPPORTED_CURRENCIES.some((c) => c.code === budgetCurrency)
                    ? (budgetCurrency as CurrencyCode)
                    : "HKD"
                );
                setEditingBudget(true);
              }}
              className="flex items-center gap-1 text-[11px] text-[#A09B96]"
            >
              {budgetCents === 0 ? (
                <span className="text-[#E8622A] font-semibold">+ Set budget</span>
              ) : (
                <>
                  <span>Budget: {formatCurrency(budgetCents, budgetCurrency)}</span>
                  <span>✏️</span>
                </>
              )}
            </button>
          </div>

          {/* Inline budget edit form */}
          {editingBudget && (
            <div className="mb-4 p-3 bg-[#F0EDE8] rounded-[10px] space-y-2">
              <p className="text-[12px] font-semibold text-[#6B6560]">Set trip budget</p>
              <div className="flex gap-2">
                <select
                  value={budgetCurInput}
                  onChange={(e) => setBudgetCurInput(e.target.value as CurrencyCode)}
                  className="px-2.5 py-2 bg-white rounded-[8px] text-[13px] text-[#1A1512] outline-none flex-shrink-0 border border-[#E5E0DA]"
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code}</option>
                  ))}
                </select>
                <input
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="flex-1 px-3 py-2 bg-white rounded-[8px] text-[13px] text-[#1A1512] outline-none border border-[#E5E0DA]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveBudget}
                  disabled={updateTrip.isPending}
                  className="flex-1 py-2 bg-[#E8622A] text-white text-[13px] font-semibold rounded-[8px] disabled:opacity-50"
                >
                  {updateTrip.isPending ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setEditingBudget(false)}
                  className="flex-1 py-2 border border-[#E5E0DA] text-[#6B6560] text-[13px] font-semibold rounded-[8px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Single-currency: donut + category legend */}
          {!isMixed && (
            <>
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <DonutChart segments={breakdown} total={totalForDonut} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[11px] text-[#A09B96]">spent</span>
                    <span className="text-[15px] font-bold text-[#1A1512]">
                      {formatCurrency(actualCents, singleCurrency)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                {breakdown.length === 0 ? (
                  <p className="text-[13px] text-[#A09B96] text-center">No expenses yet</p>
                ) : (
                  breakdown.map(({ category, amount }) => {
                    const meta = CATEGORY_META[category];
                    const pct = totalForDonut > 0 ? Math.round((amount / totalForDonut) * 100) : 0;
                    return (
                      <div key={category} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                        <span className="text-[12px] text-[#6B6560] flex-1">{meta.label}</span>
                        <span className="text-[12px] font-semibold text-[#1A1512] flex-shrink-0">{formatCurrency(amount, singleCurrency)}</span>
                        <span className="text-[10px] text-[#A09B96] w-7 text-right flex-shrink-0">{pct}%</span>
                      </div>
                    );
                  })
                )}
                {budgetCents > 0 && (
                  <div className="pt-1 mt-1 border-t border-[#F0EDE8]">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#A09B96]">vs budget</span>
                      <span className={`text-[11px] font-semibold ${actualCents > budgetCents ? "text-[#E84040]" : "text-[#3D9970]"}`}>
                        {actualCents > budgetCents ? "+" : ""}
                        {formatCurrency(actualCents - budgetCents, singleCurrency)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Mixed-currency: per-currency stacked bar + category rows */}
          {isMixed && (
            <div className="space-y-4">
              {currencyBreakdown.map(({ currency: cur, total, cats }, idx) => (
                <div key={cur}>
                  {idx > 0 && <div className="border-t border-[#F0EDE8] pt-4" />}
                  {/* Currency header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-semibold text-[#6B6560]">{cur}</span>
                    <span className="text-[15px] font-bold text-[#1A1512]">{formatCurrency(total, cur)}</span>
                  </div>
                  {/* Stacked bar — proportions within this currency only */}
                  {cats.length > 0 && (
                    <div className="h-1.5 bg-[#F0EDE8] rounded-full overflow-hidden flex mb-2.5">
                      {cats.map(({ category, amount }) => (
                        <div
                          key={category}
                          style={{
                            width: `${(amount / total) * 100}%`,
                            backgroundColor: CATEGORY_META[category].color,
                          }}
                        />
                      ))}
                    </div>
                  )}
                  {/* Category rows */}
                  <div className="space-y-1.5">
                    {cats.map(({ category, amount }) => {
                      const meta = CATEGORY_META[category];
                      const pct = Math.round((amount / total) * 100);
                      return (
                        <div key={category} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                          <span className="text-[12px] text-[#6B6560] flex-1">{meta.label}</span>
                          <span className="text-[12px] font-semibold text-[#1A1512] flex-shrink-0">{formatCurrency(amount, cur)}</span>
                          <span className="text-[10px] text-[#A09B96] w-7 text-right flex-shrink-0">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add expense button */}
        <button
          onClick={() => setAddOpen(true)}
          className="w-full py-3.5 border-2 border-dashed border-[#E5E0DA] rounded-[12px] text-[14px] font-semibold text-[#6B6560] hover:border-[#E8622A] hover:text-[#E8622A] transition-colors"
        >
          + Add Expense
        </button>

        {/* Who paid log */}
        {allEntries.length > 0 && (
          <div className="bg-white border border-[#E5E0DA] rounded-[16px] overflow-hidden">
            <p className="text-[14px] font-semibold text-[#1A1512] px-4 pt-4 pb-3">Who Paid</p>
            <div className="divide-y divide-[#F0EDE8]">
              {allEntries.map((entry) => {
                const meta = CATEGORY_META[entry.category] ?? CATEGORY_META.other;

                if (entry.kind === "planned") {
                  return (
                    <div
                      key={`planned-${entry.id}`}
                      className="flex items-center gap-3 px-4 py-3 opacity-80 active:bg-[#F0EDE8] transition-colors cursor-pointer"
                      onClick={() => setMarkingPaid(entry)}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
                        style={{ backgroundColor: `${meta.color}20` }}
                      >
                        {meta.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[#1A1512] truncate">{entry.title}</p>
                        <p className="text-[11px] text-[#A09B96]">Planned · tap to mark as paid</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[13px] text-[#A09B96]">
                          {formatCurrency(entry.amountCents, entry.currency)}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#F0EDE8] text-[#6B6560] rounded-full">
                          Planned
                        </span>
                      </div>
                    </div>
                  );
                }

                // kind === "actual"
                const isOwn = entry.paidBy === userId;
                return (
                  <SwipeableExpenseRow
                    key={entry.id}
                    entry={entry}
                    meta={meta}
                    isOwn={isOwn}
                    onEdit={() => setEditingExpense(entry)}
                    onDelete={() => deleteExpense.mutate({ expenseId: entry.id })}
                  />
                );
              })}
            </div>
          </div>
        )}

        {allEntries.length === 0 && (
          <div className="flex flex-col items-center py-10 text-center">
            <span className="text-4xl mb-3">💸</span>
            <p className="text-[15px] font-semibold text-[#1A1512]">No expenses yet</p>
            <p className="text-sm text-[#6B6560] mt-1">Track who paid for what during the trip</p>
          </div>
        )}
      </div>

      <BottomSheet open={addOpen} onOpenChange={setAddOpen}>
        <BottomSheetTitle>Add Expense</BottomSheetTitle>
        <ExpenseForm
          mode="add"
          tripId={tripId}
          members={members}
          onSuccess={() => {
            setAddOpen(false);
            utils.budget.listByTrip.invalidate({ tripId });
          }}
        />
      </BottomSheet>

      <BottomSheet open={markingPaid !== null} onOpenChange={(open) => { if (!open) setMarkingPaid(null); }}>
        <BottomSheetTitle>Mark as Paid</BottomSheetTitle>
        {markingPaid && (
          <ExpenseForm
            mode="add"
            tripId={tripId}
            members={members}
            itineraryItemId={markingPaid.id}
            initialValues={{
              title: markingPaid.title,
              amountCents: markingPaid.amountCents,
              currency: markingPaid.currency,
              category: markingPaid.category,
            }}
            onSuccess={() => {
              setMarkingPaid(null);
              utils.budget.listByTrip.invalidate({ tripId });
            }}
          />
        )}
      </BottomSheet>

      <BottomSheet open={editingExpense !== null} onOpenChange={(open) => { if (!open) setEditingExpense(null); }}>
        <BottomSheetTitle>Edit Expense</BottomSheetTitle>
        {editingExpense && (
          <ExpenseForm
            mode="edit"
            expenseId={editingExpense.id}
            initial={{
              title: editingExpense.title,
              amountCents: editingExpense.amountCents,
              currency: editingExpense.currency,
              category: editingExpense.category,
              paidBy: editingExpense.paidBy,
            }}
            members={members}
            onSuccess={() => {
              setEditingExpense(null);
              utils.budget.listByTrip.invalidate({ tripId });
            }}
          />
        )}
      </BottomSheet>
    </>
  );
}
