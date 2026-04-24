"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type MapItem = {
  id: string;
  title: string;
  type: string;
  locationName: string | null;
  locationLat: string | null;
  locationLng: string | null;
  startTime: Date | string | null;
};

type Props = {
  items: MapItem[];
  onSelectItem: (id: string) => void;
  routeSegments: [number, number][][];
  totalKm?: number | undefined;
};

const ITEM_EMOJI: Record<string, string> = {
  flight: "✈️",
  hotel: "🏨",
  restaurant: "🍜",
  activity: "🎡",
  transport: "🚗",
  note: "📝",
};

function makeIcon(emoji: string, seq: number) {
  return L.divIcon({
    html: `<div style="position:relative;width:36px;height:36px;">
      <div style="
        width:36px;height:36px;
        background:#E8622A;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 6px rgba(0,0,0,0.3);
        border:2px solid white;
      ">
        <span style="transform:rotate(45deg);font-size:16px;line-height:1">${emoji}</span>
      </div>
      <div style="
        position:absolute;top:-8px;right:-8px;
        width:18px;height:18px;border-radius:50%;
        background:#1A1512;color:#fff;
        font-size:10px;font-weight:700;font-family:monospace;
        display:flex;align-items:center;justify-content:center;
        border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4);
      ">${seq}</div>
    </div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -42],
  });
}

type LocateStatus = "idle" | "loading" | "error";

function LocateControl({
  onLocate,
}: {
  onLocate: (pos: [number, number]) => void;
}) {
  const map = useMap();
  const [status, setStatus] = useState<LocateStatus>("idle");

  function handleLocate() {
    if (!navigator.geolocation) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        map.setView(coords, 16, { animate: true });
        onLocate(coords);
        setStatus("idle");
      },
      () => {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 2000);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        right: 12,
        zIndex: 1000,
      }}
    >
      <button
        onClick={handleLocate}
        title="Go to my location"
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "#fff",
          border: "none",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "box-shadow 0.15s",
        }}
      >
        {status === "loading" ? (
          <div
            style={{
              width: 18,
              height: 18,
              border: "2.5px solid #2D6A8F",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
            }}
          />
        ) : status === "error" ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E8622A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2D6A8F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            <circle cx="12" cy="12" r="8" />
          </svg>
        )}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ItemChips({
  pinned,
  positions,
}: {
  pinned: MapItem[];
  positions: [number, number][];
}) {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    L.DomEvent.disableScrollPropagation(containerRef.current);
    L.DomEvent.disableClickPropagation(containerRef.current);
  }, []);

  if (pinned.length === 0) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        bottom: 72,
        left: 0,
        right: 0,
        zIndex: 1000,
        pointerEvents: "auto",
        display: "flex",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        padding: "0 12px",
        gap: 8,
        scrollbarWidth: "none",
      } as React.CSSProperties}
    >
      {pinned.map((item, idx) => {
        const pos = positions[idx]!;
        const emoji = ITEM_EMOJI[item.type] ?? "📌";
        return (
          <button
            key={item.id}
            style={{ flexShrink: 0 }}
            onClick={(e) => {
              map.flyTo(pos, 16, { animate: true });
              e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
            }}
            className="w-[112px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/90 backdrop-blur-sm shadow-sm text-[#1A1512] border border-white/60 overflow-hidden"
          >
            <span className="text-[10px] font-mono font-bold text-[#A09B96] leading-none flex-shrink-0">
              {idx + 1}
            </span>
            <span className="text-[13px] leading-none flex-shrink-0">{emoji}</span>
            <span className="text-[12px] font-semibold truncate min-w-0 flex-1">
              {item.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (positions.length === 0 || fitted.current) return;
    fitted.current = true;
    if (positions.length === 1) {
      map.setView(positions[0]!, 14);
    } else {
      map.fitBounds(positions, { padding: [40, 40] });
    }
  }, [map, positions]);

  return null;
}

export function MapViewInner({ items, onSelectItem, routeSegments, totalKm }: Props) {
  const [userPos, setUserPos] = useState<[number, number] | null>(null);

  const pinned = items.filter(
    (i) => i.locationLat !== null && i.locationLng !== null
  );

  const positions: [number, number][] = pinned.map((i) => [
    parseFloat(i.locationLat!),
    parseFloat(i.locationLng!),
  ]);

  const defaultCenter: [number, number] = positions[0] ?? [22.3193, 114.1694];

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {pinned.length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div className="bg-white/90 rounded-2xl px-6 py-5 shadow text-center mx-6">
            <span className="text-4xl block mb-2">🗺️</span>
            <p className="font-semibold text-[#1A1512]">No locations yet</p>
            <p className="text-sm text-[#6B6560] mt-1">
              Add a location to itinerary items to see them here
            </p>
          </div>
        </div>
      )}

      {totalKm !== undefined && totalKm > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: 12,
            zIndex: 1000,
            pointerEvents: "none",
          }}
        >
          <div className="bg-white/95 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-md flex items-center gap-1.5 border border-[#E5E0DA]">
            <span className="text-[12px]">🚗</span>
            <span className="text-[12px] font-semibold text-[#1A1512] font-mono">
              {totalKm < 1 ? `${Math.round(totalKm * 1000)} m` : `${totalKm.toFixed(1)} km`}
            </span>
          </div>
        </div>
      )}

      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`}
          tileSize={512}
          zoomOffset={-1}
        />
        <FitBounds positions={positions} />
        <LocateControl onLocate={setUserPos} />
        <ItemChips pinned={pinned} positions={positions} />

        {/* User location dot */}
        {userPos && (
          <>
            <CircleMarker
              center={userPos}
              radius={10}
              pathOptions={{ color: "#fff", weight: 2, fillColor: "#4285F4", fillOpacity: 0.25 }}
            />
            <CircleMarker
              center={userPos}
              radius={6}
              pathOptions={{ color: "#fff", weight: 2, fillColor: "#4285F4", fillOpacity: 1 }}
            />
          </>
        )}

        {routeSegments.map((seg, i) =>
          seg.length > 1 && (
            <Polyline
              key={i}
              positions={seg}
              pathOptions={{ color: "#E8622A", weight: 2.5, opacity: 0.6 }}
            />
          )
        )}

        {pinned.map((item, idx) => {
          const pos = positions[idx]!;
          const emoji = ITEM_EMOJI[item.type] ?? "📌";
          return (
            <Marker key={item.id} position={pos} icon={makeIcon(emoji, idx + 1)}>
              <Popup>
                <div style={{ minWidth: 160 }}>
                  <div
                    className="cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setTimeout(() => onSelectItem(item.id), 50); }}
                  >
                    <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                      {emoji} {item.title}
                    </p>
                    {item.locationName && (
                      <p style={{ fontSize: 12, color: "#6B6560", marginBottom: 4 }}>
                        {item.locationName}
                      </p>
                    )}
                    {item.startTime && (
                      <p style={{ fontSize: 12, color: "#A09B96" }}>
                        {new Date(item.startTime).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                    <p style={{ fontSize: 12, color: "#E8622A", fontWeight: 600, marginTop: 6 }}>
                      View details →
                    </p>
                  </div>
                  <a
                    href={`https://maps.google.com?q=${item.locationLat},${item.locationLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: "block", marginTop: 6, textAlign: "center", fontSize: 12, color: "#2D6A8F", textDecoration: "underline" }}
                  >
                    Open in Maps ↗
                  </a>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
