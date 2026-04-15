import { useState, useRef } from "react";

export function useSwipeToDelete() {
  const [swiped, setSwiped] = useState(false);
  const startX = useRef(0);
  const isDragging = useRef(false);
  const hasDragged = useRef(false);

  // ── Touch (mobile) ────────────────────────────────────────────────
  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0]!.clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0]!.clientX - startX.current;
    if (dx < -50) setSwiped(true);
    else if (dx > 20) setSwiped(false);
  }

  // ── Mouse (desktop) ───────────────────────────────────────────────
  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    startX.current = e.clientX;
    isDragging.current = true;
    hasDragged.current = false;

    function onMouseMove(ev: MouseEvent) {
      if (!isDragging.current) return;
      const dx = ev.clientX - startX.current;
      if (Math.abs(dx) > 5) hasDragged.current = true;
      if (dx < -50) { setSwiped(true); cleanup(); }
      else if (dx > 20) setSwiped(false);
    }
    function onMouseUp() { isDragging.current = false; cleanup(); }
    function cleanup() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  // Suppress Link/onClick navigation that fires immediately after a drag ends.
  // Place onClickCapture on the outer wrapper div (parent of the Link / clickable child).
  // Fires in the capture phase — before children — so stopPropagation prevents navigation.
  function onClickCapture(e: React.MouseEvent) {
    if (hasDragged.current) {
      hasDragged.current = false;
      e.stopPropagation();
    }
  }

  return { swiped, setSwiped, onTouchStart, onTouchEnd, onMouseDown, onClickCapture };
}
