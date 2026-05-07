"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { newUUID } from "@/lib/utils";

const LocationPickerOverlay = dynamic(
  () => import("./LocationPickerOverlay").then((m) => ({ default: m.LocationPickerOverlay })),
  { ssr: false }
);

type Suggestion = {
  mapbox_id: string;
  displayName: string;
};

type Props = {
  value: string;
  lat?: string | undefined;
  lng?: string | undefined;
  onChange: (value: string, lat?: string, lng?: string) => void;
  placeholder?: string;
  proximity?: { lat: number; lng: number };
};

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export function LocationAutocomplete({ value, lat, lng, onChange, placeholder = "Search for a place…", proximity }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayInit, setOverlayInit] = useState<{ lat: number; lng: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const committed = useRef(false);
  const latRef = useRef<string | undefined>(lat);
  const lngRef = useRef<string | undefined>(lng);
  const sessionToken = useRef(newUUID());

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    try {
      const url = new URL("https://api.mapbox.com/search/searchbox/v1/suggest");
      url.searchParams.set("q", query);
      url.searchParams.set("limit", "5");
      url.searchParams.set("session_token", sessionToken.current);
      url.searchParams.set("access_token", TOKEN ?? "");
      if (proximity) {
        url.searchParams.set("proximity", `${proximity.lng.toFixed(4)},${proximity.lat.toFixed(4)}`);
      }
      const res = await fetch(url.toString());
      const data = await res.json() as {
        suggestions: { mapbox_id: string; name: string; place_formatted?: string }[];
      };
      const results: Suggestion[] = (data.suggestions ?? []).map((s) => ({
        mapbox_id: s.mapbox_id,
        displayName: s.place_formatted ? `${s.name}, ${s.place_formatted}` : s.name,
      }));
      setSuggestions(results);
      setOpen(results.length > 0);
      setActiveIdx(-1);
    } catch {
      setSuggestions([]);
      setOpen(false);
    }
  }, [proximity]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    committed.current = false;
    onChange(q, undefined, undefined);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void fetchSuggestions(q), 350);
  }

  async function selectSuggestion(s: Suggestion) {
    setSuggestions([]);
    setOpen(false);
    try {
      const url = new URL(`https://api.mapbox.com/search/searchbox/v1/retrieve/${s.mapbox_id}`);
      url.searchParams.set("session_token", sessionToken.current);
      url.searchParams.set("access_token", TOKEN ?? "");
      sessionToken.current = newUUID();
      const res = await fetch(url.toString());
      const data = await res.json() as {
        features: { geometry: { coordinates: [number, number] }; properties: { full_address?: string; name?: string } }[];
      };
      const feature = data.features?.[0];
      const placeName = feature?.properties.full_address ?? feature?.properties.name ?? s.displayName;
      const resolvedLat = feature ? String(feature.geometry.coordinates[1]) : undefined;
      const resolvedLng = feature ? String(feature.geometry.coordinates[0]) : undefined;
      committed.current = true;
      latRef.current = resolvedLat;
      lngRef.current = resolvedLng;
      onChange(placeName, resolvedLat, resolvedLng);
    } catch {
      // ignore retrieve errors
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      const s = suggestions[activeIdx];
      if (s) void selectSuggestion(s);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="flex-1 px-4 py-3 bg-[#F0EDE8] border border-[#E5E0DA] rounded-[10px] text-[16px] text-[#1A1512] placeholder:text-[#A09B96] focus:outline-none focus:border-[#E8622A]"
        />
        <button
          type="button"
          onClick={() => {
            setOverlayInit(
              latRef.current && lngRef.current
                ? { lat: parseFloat(latRef.current), lng: parseFloat(lngRef.current) }
                : null,
            );
            setShowOverlay(true);
          }}
          title="Pick on map"
          className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-[10px] border border-[#E5E0DA] bg-[#F0EDE8] text-[#6B6560] hover:border-[#E8622A] hover:bg-[rgba(232,98,42,0.08)] hover:text-[#E8622A] transition-colors"
        >
          📍
        </button>
      </div>

      {open && suggestions.length > 0 && (
        <ul
          style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999, WebkitOverflowScrolling: "touch" }}
          className="bg-white border border-[#E5E0DA] rounded-[12px] shadow-[0_4px_20px_rgba(0,0,0,0.12)] overflow-y-auto max-h-[220px]"
        >
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void selectSuggestion(s)}
                className={`w-full text-left px-4 py-3 text-[14px] transition-colors flex items-start gap-2 ${
                  i === activeIdx ? "bg-[#FDF1EC] text-[#E8622A]" : "text-[#1A1512] hover:bg-[#FAF8F5]"
                }`}
              >
                <span className="flex-shrink-0 text-[#A09B96] mt-0.5">📍</span>
                <span className="leading-snug">{s.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showOverlay && (
        <LocationPickerOverlay
          {...(overlayInit ? { initialLat: overlayInit.lat, initialLng: overlayInit.lng } : {})}
          initialName={value}
          onConfirm={(locationName, lat, lng) => {
            latRef.current = lat;
            lngRef.current = lng;
            committed.current = true;
            onChange(locationName, lat, lng);
            setShowOverlay(false);
          }}
          onClose={() => setShowOverlay(false)}
        />
      )}
    </div>
  );
}
