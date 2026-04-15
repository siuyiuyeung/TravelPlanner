import { useState, useRef } from "react";

export function useSwipeToDelete() {
  const [swiped, setSwiped] = useState(false);
  const startX = useRef(0);

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0]!.clientX;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0]!.clientX - startX.current;
    if (dx < -50) setSwiped(true);
    else if (dx > 20) setSwiped(false);
  }

  return { swiped, setSwiped, onTouchStart, onTouchEnd };
}
