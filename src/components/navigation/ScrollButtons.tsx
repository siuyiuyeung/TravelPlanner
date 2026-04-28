'use client'

import { useEffect, useState, useCallback } from 'react'

const SHOW_TOP_THRESHOLD = 200
const NEAR_BOTTOM_THRESHOLD = 100

export function ScrollButtons() {
  const [showTop, setShowTop] = useState(false)
  const [showBottom, setShowBottom] = useState(false)

  const update = useCallback((el: HTMLElement) => {
    const scrolled = el.scrollTop
    const remaining = el.scrollHeight - el.clientHeight - scrolled
    setShowTop(scrolled > SHOW_TOP_THRESHOLD)
    setShowBottom(remaining > NEAR_BOTTOM_THRESHOLD)
  }, [])

  useEffect(() => {
    const el = document.getElementById('main-scroll')
    if (!el) return
    const handler = () => update(el)
    el.addEventListener('scroll', handler, { passive: true })
    update(el)
    return () => el.removeEventListener('scroll', handler)
  }, [update])

  const scrollTo = (pos: 'top' | 'bottom') => {
    const el = document.getElementById('main-scroll')
    if (!el) return
    el.scrollTo({ top: pos === 'top' ? 0 : el.scrollHeight, behavior: 'smooth' })
  }

  if (!showTop && !showBottom) return null

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 flex gap-2 z-40">
      {showTop && (
        <button
          onClick={() => scrollTo('top')}
          className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm border border-[#E5E0DA] shadow-md flex items-center justify-center text-[#8B7355] active:scale-95 transition-transform"
          aria-label="Scroll to top"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
      )}
      {showBottom && (
        <button
          onClick={() => scrollTo('bottom')}
          className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm border border-[#E5E0DA] shadow-md flex items-center justify-center text-[#8B7355] active:scale-95 transition-transform"
          aria-label="Scroll to bottom"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}
    </div>
  )
}
