"use client";

import { useEffect, useRef, useState } from "react";

export type SearchResult = {
  placeName: string;
  lat: number;
  lng: number;
};

type Props = {
  onSelect: (result: SearchResult) => void;
  onClear: () => void;
  proximity?: { lng: number; lat: number };
};

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export function MapSearchBar({ onSelect, onClear, proximity }: Props) {
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchExpanded) inputRef.current?.focus();
  }, [searchExpanded]);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  async function fetchSuggestions(query: string) {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setDropdownOpen(false);
      return;
    }
    try {
      const proximityParam = proximity
        ? `&proximity=${proximity.lng.toFixed(4)},${proximity.lat.toFixed(4)}`
        : "";
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=5${proximityParam}&access_token=${MAPBOX_TOKEN}`
      );
      const data = (await res.json()) as {
        features: { place_name: string; center: [number, number] }[];
      };
      const results: SearchResult[] = (data.features ?? []).map((f) => ({
        placeName: f.place_name,
        lat: f.center[1],
        lng: f.center[0],
      }));
      setSuggestions(results);
      setDropdownOpen(results.length > 0);
    } catch {
      setSuggestions([]);
      setDropdownOpen(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 350);
  }

  function handleSelect(result: SearchResult) {
    setSearchQuery(result.placeName);
    setSuggestions([]);
    setDropdownOpen(false);
    onSelect(result);
  }

  function handleClear() {
    setSearchQuery("");
    setSearchExpanded(false);
    setSuggestions([]);
    setDropdownOpen(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onClear();
  }

  const btnStyle: React.CSSProperties = {
    width: 40, height: 40, borderRadius: "50%", background: "#fff", border: "none",
    boxShadow: "0 2px 8px rgba(0,0,0,0.25)", display: "flex", alignItems: "center",
    justifyContent: "center", cursor: "pointer", flexShrink: 0,
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        bottom: "calc(350px + env(safe-area-inset-bottom, 0px))",
        right: 12,
        zIndex: 3,
      }}
    >
      {!searchExpanded ? (
        <button onClick={() => setSearchExpanded(true)} title="Search location" style={btnStyle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1512" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      ) : (
        /* Row-reverse: X button on right (at right:12), input expands left */
        <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
          <button onClick={handleClear} title="Clear search" style={btnStyle}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#6B6560" strokeWidth="2" strokeLinecap="round">
              <line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" />
            </svg>
          </button>
          <div style={{ position: "relative" }}>
            <input
              ref={inputRef}
              value={searchQuery}
              onChange={handleInputChange}
              onKeyDown={(e) => { if (e.key === "Escape") handleClear(); }}
              placeholder="Search location…"
              style={{
                width: 220, height: 40, padding: "0 14px", borderRadius: 999,
                background: "#fff", border: "1.5px solid #E5E0DA",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)", fontSize: 14,
                color: "#1A1512", outline: "none", display: "block",
              }}
            />
            {dropdownOpen && suggestions.length > 0 && (
              <ul style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)",
                borderRadius: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
                border: "1px solid rgba(229,224,218,0.6)",
                listStyle: "none", margin: 0, padding: 4, zIndex: 9999,
                maxHeight: 220, overflowY: "auto", WebkitOverflowScrolling: "touch",
              }}>
                {suggestions.map((s, i) => (
                  <li key={i}>
                    <button
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(s)}
                      style={{
                        width: "100%", textAlign: "left", padding: "9px 12px",
                        background: "transparent", border: "none", cursor: "pointer",
                        fontSize: 13, color: "#1A1512", borderRadius: 8,
                        display: "flex", alignItems: "flex-start", gap: 8,
                      }}
                    >
                      <span style={{ flexShrink: 0, marginTop: 1, fontSize: 12 }}>📍</span>
                      <span style={{ lineHeight: 1.3 }}>{s.placeName}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
