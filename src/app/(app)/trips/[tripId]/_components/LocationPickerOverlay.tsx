"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Map, { type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

type Suggestion = {
  placeName: string;
  lat: string;
  lng: string;
};

type Props = {
  initialLat?: number;
  initialLng?: number;
  initialName?: string;
  onConfirm: (locationName: string, lat: string, lng: string) => void;
  onClose: () => void;
};

function CrosshairPin({ locked }: { locked: boolean }) {
  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -100%)",
        pointerEvents: "none",
        zIndex: 10,
        transition: "transform 0.15s ease",
        ...(locked ? { transform: "translate(-50%, -100%) scale(0.92)" } : {}),
      }}
    >
      <svg width="32" height="44" viewBox="0 0 32 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="15" r="13" fill="#E8622A" stroke="white" strokeWidth="2.5" />
        <circle cx="16" cy="15" r="5" fill="white" />
        <path d="M16 28 L16 44" stroke="#E8622A" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="16" cy="44" rx="5" ry="2.5" fill="rgba(0,0,0,0.18)" />
      </svg>
    </div>
  );
}

export function LocationPickerOverlay({ initialLat, initialLng, initialName = "", onConfirm, onClose }: Props) {
  const hasInitial = initialLat !== undefined && initialLng !== undefined;

  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [placeName, setPlaceName] = useState(initialName);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [pinLocked, setPinLocked] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(
    hasInitial ? { lat: initialLat, lng: initialLng } : null,
  );

  const mapRef = useRef<MapRef>(null);
  const abortRef = useRef<AbortController | null>(null);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);

  const reverseGeocode = useCallback(() => {
    const center = mapRef.current?.getCenter();
    if (!center) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsGeocoding(true);
    setPinLocked(true);
    setMapCenter({ lat: center.lat, lng: center.lng });

    const lat = center.lat;
    const lng = center.lng;

    fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng.toFixed(6)},${lat.toFixed(6)}.json?limit=1&access_token=${TOKEN}`,
      { signal: controller.signal },
    )
      .then((r) => r.json())
      .then((data: { features?: { place_name?: string }[] }) => {
        setPlaceName(data.features?.[0]?.place_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        setIsGeocoding(false);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name !== "AbortError") {
          const c = mapRef.current?.getCenter();
          if (c) setPlaceName(`${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`);
          setIsGeocoding(false);
        }
      });
  }, []);

  function handleMoveEnd() {
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = setTimeout(reverseGeocode, 400);
  }

  function handleMoveStart() {
    setPinLocked(false);
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    if (abortRef.current) abortRef.current.abort();
  }

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setDropdownOpen(false);
      return;
    }
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=5&access_token=${TOKEN}`,
      );
      const data = await res.json() as { features: { place_name: string; center: [number, number] }[] };
      const results: Suggestion[] = (data.features ?? []).map((f) => ({
        placeName: f.place_name,
        lat: String(f.center[1]),
        lng: String(f.center[0]),
      }));
      setSuggestions(results);
      setDropdownOpen(results.length > 0);
    } catch {
      setSuggestions([]);
      setDropdownOpen(false);
    }
  }, []);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setSearchQuery(q);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => void fetchSuggestions(q), 350);
  }

  function selectSuggestion(s: Suggestion) {
    setSearchQuery("");
    setSuggestions([]);
    setDropdownOpen(false);
    setPlaceName(s.placeName);
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lng);
    setMapCenter({ lat, lng });
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 14 });
  }

  function clearSearch() {
    setSearchQuery("");
    setSuggestions([]);
    setDropdownOpen(false);
  }

  function handleConfirm() {
    const lat = mapCenter ? String(mapCenter.lat) : (initialLat ? String(initialLat) : "0");
    const lng = mapCenter ? String(mapCenter.lng) : (initialLng ? String(initialLng) : "0");
    const name = placeName || (mapCenter ? `${mapCenter.lat.toFixed(5)}, ${mapCenter.lng.toFixed(5)}` : "");
    onConfirm(name, lat, lng);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (searchBarRef.current && !searchBarRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Trigger initial reverse geocode after map loads
  const handleMapLoad = useCallback(() => {
    if (!initialName) {
      reverseGeocode();
    }
  }, [initialName, reverseGeocode]);

  const content = (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999 }}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* Map */}
      <Map
        ref={mapRef}
        mapboxAccessToken={TOKEN}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        initialViewState={{
          longitude: hasInitial ? initialLng : 114.1694,
          latitude: hasInitial ? initialLat : 22.3193,
          zoom: hasInitial ? 14 : 10,
        }}
        style={{ width: "100%", height: "100%" }}
        dragRotate={false}
        pitchWithRotate={false}
        onMoveStart={handleMoveStart}
        onMoveEnd={handleMoveEnd}
        onLoad={handleMapLoad}
      />

      {/* Fixed crosshair */}
      <CrosshairPin locked={pinLocked} />

      {/* Floating search bar */}
      <div
        ref={searchBarRef}
        style={{
          position: "absolute",
          top: "calc(12px + env(safe-area-inset-top, 0px))",
          left: 12,
          right: 12,
          zIndex: 20,
        }}
      >
        <div className="flex items-center gap-2 bg-white rounded-2xl shadow-lg px-3 h-14">
          {/* Back button */}
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-[#6B6560] hover:bg-[#F0EDE8] transition-colors"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 15L7 10L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Search input */}
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search location…"
            autoComplete="off"
            autoFocus
            className="flex-1 text-[15px] text-[#1A1512] placeholder:text-[#A09B96] bg-transparent outline-none"
          />

          {/* Clear button */}
          {searchQuery.length > 0 && (
            <button
              type="button"
              onClick={clearSearch}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-[#A09B96] hover:bg-[#F0EDE8] transition-colors"
              aria-label="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Search dropdown */}
        {dropdownOpen && suggestions.length > 0 && (
          <div className="mt-1 bg-white rounded-2xl shadow-lg overflow-hidden border border-[#E5E0DA]">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  selectSuggestion(s);
                }}
                className="w-full text-left px-4 py-3 text-[14px] text-[#1A1512] hover:bg-[#FAF8F5] flex items-start gap-2 transition-colors"
              >
                <span className="flex-shrink-0 text-[#A09B96] mt-0.5">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1C4.79 1 3 2.79 3 5c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4zm0 5.5A1.5 1.5 0 1 1 7 3a1.5 1.5 0 0 1 0 3z" fill="currentColor" />
                  </svg>
                </span>
                <span className="leading-snug">{s.placeName}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom confirm card */}
      <div
        style={{
          position: "absolute",
          bottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
          left: 12,
          right: 12,
          zIndex: 20,
        }}
      >
        <div className="bg-white rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {isGeocoding ? (
              <div className="space-y-1.5">
                <div className="h-4 bg-[#E5E0DA] rounded animate-pulse w-3/4" />
                <div className="h-3 bg-[#F0EDE8] rounded animate-pulse w-1/2" />
              </div>
            ) : (
              <>
                <p className="text-[15px] font-semibold text-[#1A1512] truncate leading-tight">
                  {placeName || "Locating…"}
                </p>
                {mapCenter && (
                  <p className="text-[11px] text-[#A09B96] mt-0.5">
                    {mapCenter.lat.toFixed(5)}, {mapCenter.lng.toFixed(5)}
                  </p>
                )}
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isGeocoding && !placeName}
            className="flex-shrink-0 px-5 py-2.5 bg-[#E8622A] text-white text-[14px] font-semibold rounded-xl hover:bg-[#D4541F] active:bg-[#BF4A1A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );

  return content;
}
