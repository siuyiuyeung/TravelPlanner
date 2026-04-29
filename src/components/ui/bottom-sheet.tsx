"use client";

import { useEffect } from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

// Keep drawer fixed at bottom; scroll content inside when keyboard appears
function useKeyboardAwareScroll(open: boolean) {
  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    function onFocusIn(e: FocusEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Check if focused element is an input inside the drawer
      if (
        target?.closest("[data-vaul-drawer]") &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.contentEditable === "true")
      ) {
        // Wait for keyboard animation to complete, then scroll input into view
        setTimeout(() => {
          target.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 350);
      }
    }

    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);
}

export function BottomSheet({ open, onOpenChange, children }: BottomSheetProps) {
  useKeyboardAwareScroll(open);

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
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