"use client";

import { useState, useRef, useEffect } from "react";

const SCREENS = [
  {
    emoji: "✈️",
    title: "Plan together,\ntravel better",
    body: "Invite your friends and family to a group. Collaborate on every detail — flights, hotels, restaurants, and more.",
  },
  {
    emoji: "🗺️",
    title: "Your itinerary,\nalways in sync",
    body: "Real-time updates, file sharing, and group chat keep everyone on the same page — wherever you are in the world.",
  },
];

const STORAGE_KEY = "tp_onboarding_done";

export function Onboarding() {
  const [visible, setVisible] = useState(false);
  const [screen, setScreen] = useState(0);
  const [dragX, setDragX] = useState(0);
  const startX = useRef(0);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  function next() {
    if (screen < SCREENS.length - 1) {
      setScreen((s) => s + 1);
    } else {
      dismiss();
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0]!.clientX;
  }
  function onTouchMove(e: React.TouchEvent) {
    setDragX(e.touches[0]!.clientX - startX.current);
  }
  function onTouchEnd() {
    if (dragX < -50 && screen < SCREENS.length - 1) {
      setScreen((s) => s + 1);
    } else if (dragX > 50 && screen > 0) {
      setScreen((s) => s - 1);
    }
    setDragX(0);
  }

  if (!visible) return null;

  const current = SCREENS[screen]!;

  return (
    <div className="fixed inset-0 z-[100] bg-[#FAF8F5] flex flex-col">
      {/* Skip */}
      <div className="flex justify-end px-5 pt-14">
        <button onClick={dismiss} className="text-sm text-[#A09B96] font-medium">
          Skip
        </button>
      </div>

      {/* Slide content */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-8 text-center select-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: `translateX(${dragX * 0.1}px)` }}
      >
        <div className="text-[80px] mb-8 leading-none">{current.emoji}</div>
        <h1 className="text-[28px] font-bold text-[#1A1512] leading-tight whitespace-pre-line mb-4">
          {current.title}
        </h1>
        <p className="text-[15px] text-[#6B6560] leading-relaxed max-w-[300px]">
          {current.body}
        </p>
      </div>

      {/* Dots + CTA */}
      <div className="px-8 pb-14 flex flex-col items-center gap-6">
        {/* Dot indicators */}
        <div className="flex gap-2">
          {SCREENS.map((_, i) => (
            <button
              key={i}
              onClick={() => setScreen(i)}
              className={`rounded-full transition-all duration-300 ${
                i === screen
                  ? "w-6 h-2 bg-[#E8622A]"
                  : "w-2 h-2 bg-[#E5E0DA]"
              }`}
            />
          ))}
        </div>

        <button
          onClick={next}
          className="w-full py-4 bg-[#E8622A] text-white font-bold text-[16px] rounded-[14px] shadow-[0_4px_16px_rgba(232,98,42,0.35)]"
        >
          {screen < SCREENS.length - 1 ? "Next" : "Get started"}
        </button>
      </div>
    </div>
  );
}
