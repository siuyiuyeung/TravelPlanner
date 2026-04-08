"use client";

import { Drawer } from "vaul";
import { cn } from "@/lib/utils";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

export function BottomSheet({ open, onOpenChange, children }: BottomSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-[rgba(26,21,18,0.40)] backdrop-blur-[2px] z-40" />
        <Drawer.Content
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50",
            "bg-white rounded-t-[24px]",
            "shadow-[0_-8px_40px_rgba(26,21,18,0.18)]",
            "max-h-[92vh] flex flex-col",
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
    <Drawer.Title className={cn("text-[17px] font-bold text-[#1A1512] px-5 pb-4", className)}>
      {children}
    </Drawer.Title>
  );
}
