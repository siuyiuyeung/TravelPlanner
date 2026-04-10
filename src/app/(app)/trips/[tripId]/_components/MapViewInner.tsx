"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
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
};

const ITEM_EMOJI: Record<string, string> = {
  flight: "✈️",
  hotel: "🏨",
  restaurant: "🍜",
  activity: "🎭",
  transport: "🚌",
  note: "📝",
};

function makeIcon(emoji: string) {
  return L.divIcon({
    html: `<div style="
      width:36px;height:36px;
      background:#E8622A;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
      border:2px solid white;
    ">
      <span style="transform:rotate(45deg);font-size:16px;line-height:1">${emoji}</span>
    </div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38],
  });
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

export function MapViewInner({ items, onSelectItem }: Props) {
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

      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds positions={positions} />

        {pinned.map((item, idx) => {
          const pos = positions[idx]!;
          const emoji = ITEM_EMOJI[item.type] ?? "📌";
          return (
            <Marker key={item.id} position={pos} icon={makeIcon(emoji)}>
              <Popup>
                <div
                  className="cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setTimeout(() => onSelectItem(item.id), 50); }}
                  style={{ minWidth: 160 }}
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
                  <p
                    style={{
                      fontSize: 12,
                      color: "#E8622A",
                      fontWeight: 600,
                      marginTop: 6,
                    }}
                  >
                    View details →
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
