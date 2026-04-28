"use client";

import { useEffect } from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

// Vaul's repositionInputs checks document.activeElement when visualViewport
// resizes, but on mobile the resize fires during keyboard animation before
// activeElement updates. This supplement fires after the animation settles.
function useKeyboardRepositionFix(open: boolean) {
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    function applyReposition() {
      const kb = Math.round(window.innerHeight - (vv?.height ?? window.innerHeight));
      const el = document.querySelector("[data-vaul-drawer]") as HTMLElement | null;
      if (!el) return;
      const current = parseInt(el.style.bottom || "0", 10);
      if (kb > 50 && current < kb - 20) {
        el.style.bottom = `${kb}px`;
      }
    }

    function onFocusIn(e: FocusEvent) {
      const target = e.target as Element | null;
      if (
        target?.closest("[data-vaul-drawer]") &&
        target.matches("input, textarea, [contenteditable]")
      ) {
        setTimeout(applyReposition, 150);
        setTimeout(applyReposition, 400);
      }
    }

    function onFocusOut() {
      setTimeout(() => {
        const active = document.activeElement;
        if (!active?.matches("input, textarea, [contenteditable]")) {
          const el = document.querySelector("[data-vaul-drawer]") as HTMLElement | null;
          if (el) el.style.bottom = "0px";
        }
      }, 150);
    }

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [open]);
}

export function BottomSheet({ open, onOpenChange, children }: BottomSheetProps) {
  useKeyboardRepositionFix(open);

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-[rgba(26,21,18,0.40)] backdrop-blur-[2px] z-40" />
        <Drawer.Content
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50",
            "bg-white rounded-t-[24px]",
            "shadow-[0_-8px_40px_rgba(26,21,18,0.18)]",
            "max-h-[85vh] flex flex-col overflow-hidden",
            "focus:outline-none"
          )}
          aria-describedby={undefined}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
            <div className="w-9 h-1 rounded-full bg-[#C8C0B8]" />
          </div>
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function BottomSheetTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Drawer.Title className={cn("text-[17px] font-bold text-[#1A1512] px-5 pb-4 flex-shrink-0", className)}>
      {children}
    </Drawer.Title>
  );
}
