"use client";

import React, { useEffect, useRef, useState } from "react";
import Map, {
  Layer,
  Marker,
  Popup,
  Source,
  useMap,
  type MapRef,
} from "react-map-gl/mapbox";
import type { GeoJSON } from "geojson";
import "mapbox-gl/dist/mapbox-gl.css";

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
  legDistances?: Record<string, number> | undefined;
  legDurations?: Record<string, number> | undefined;
};

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const ROUTE_COLORS = [
  "#1A73E8",
  "#E8622A",
  "#22C55E",
  "#9333EA",
  "#EF4444",
  "#14B8A6",
  "#F59E0B",
];

const STYLES = {
  streets: "mapbox://styles/mapbox/streets-v12",
  outdoors: "mapbox://styles/mapbox/outdoors-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
} as const;
type StyleKey = keyof typeof STYLES;

const STYLE_LABELS: Record<StyleKey, string> = {
  streets: "Streets",
  outdoors: "Outdoors",
  satellite: "Satellite",
};

const ITEM_EMOJI: Record<string, string> = {
  flight: "✈️",
  hotel: "🏨",
  restaurant: "🍜",
  activity: "🎡",
  transport: "🚗",
  note: "📝",
};

function fmtDist(km: number) {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

function fmtDur(secs: number) {
  const mins = Math.round(secs / 60);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

function MarkerPin({ emoji, seq }: { emoji: string; seq: number }) {
  return (
    <div style={{ position: "relative", width: 36, height: 36 }}>
      <div
        style={{
          width: 36,
          height: 36,
          background: "#E8622A",
          borderRadius: "50% 50% 50% 0",
          transform: "rotate(-45deg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
          border: "2px solid white",
        }}
      >
        <span style={{ transform: "rotate(45deg)", fontSize: 16, lineHeight: 1 }}>
          {emoji}
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          top: -8,
          right: -8,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#1A1512",
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          fontFamily: "monospace",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1.5px solid #fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }}
      >
        {seq}
      </div>
    </div>
  );
}

type LocateStatus = "idle" | "loading" | "error";

function LocateControl({ onLocate }: { onLocate: (lng: number, lat: number) => void }) {
  const { current: mapRef } = useMap();
  const [status, setStatus] = useState<LocateStatus>("idle");

  function handleLocate() {
    if (!navigator.geolocation) { setStatus("error"); return; }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        mapRef?.flyTo({ center: [lng, lat], zoom: 16, animate: true });
        onLocate(lng, lat);
        setStatus("idle");
      },
      () => {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 2000);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div style={{ position: "absolute", bottom: "calc(110px + env(safe-area-inset-bottom, 0px))", right: 12, zIndex: 2 }}>
      <button
        onClick={handleLocate}
        title="Go to my location"
        style={{
          width: 40, height: 40, borderRadius: "50%", background: "#fff", border: "none",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)", display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer",
        }}
      >
        {status === "loading" ? (
          <div style={{ width: 18, height: 18, border: "2.5px solid #2D6A8F", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        ) : status === "error" ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E8622A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2D6A8F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" />
          </svg>
        )}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function CompassReset() {
  const { current: mapRef } = useMap();
  const [bearing, setBearing] = useState(0);

  useEffect(() => {
    if (!mapRef) return;
    const map = mapRef.getMap();
    const update = () => setBearing(map.getBearing());
    map.on("rotate", update);
    update();
    return () => { map.off("rotate", update); };
  }, [mapRef]);

  return (
    <div style={{ position: "absolute", bottom: "calc(158px + env(safe-area-inset-bottom, 0px))", right: 12, zIndex: 2 }}>
      <button
        onClick={() => mapRef?.easeTo({ pitch: 0, bearing: 0, duration: 500 })}
        title="Reset pitch and rotation"
        style={{
          width: 40, height: 40, borderRadius: "50%", background: "#fff", border: "none",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)", display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer",
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 22 22"
          style={{ transform: `rotate(${-bearing}deg)`, transition: "transform 0.1s ease-out" }}
        >
          {/* North — red */}
          <path d="M11 2 L13.2 11 L11 10 L8.8 11 Z" fill="#DB4437" />
          {/* South — gray */}
          <path d="M11 20 L13.2 11 L11 12 L8.8 11 Z" fill="#9E9E9E" />
          <circle cx="11" cy="11" r="1.8" fill="white" stroke="#ccc" strokeWidth="0.5" />
        </svg>
      </button>
    </div>
  );
}

function ItemChips({
  pinned,
  positions,
  legDistances,
  legDurations,
  mapRef,
  onSelect,
}: {
  pinned: MapItem[];
  positions: { lng: number; lat: number }[];
  legDistances?: Record<string, number> | undefined;
  legDurations?: Record<string, number> | undefined;
  mapRef: React.RefObject<MapRef | null>;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener("wheel", stop, { passive: false });
    return () => {
      el.removeEventListener("wheel", stop);
    };
  }, []);

  if (pinned.length === 0) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute", bottom: "calc(66px + env(safe-area-inset-bottom, 0px))", left: 0, right: 0, zIndex: 2,
        pointerEvents: "auto", display: "flex", alignItems: "center",
        overflowX: "auto", WebkitOverflowScrolling: "touch",
        padding: "0 12px", gap: 0, scrollbarWidth: "none",
        touchAction: "pan-x",
      } as React.CSSProperties}
    >
      {pinned.map((item, idx) => {
        const pos = positions[idx]!;
        const emoji = ITEM_EMOJI[item.type] ?? "📌";
        const legKm = legDistances?.[item.id];
        const legSecs = legDurations?.[item.id];
        const hasLeg = legKm !== undefined && legKm > 0;
        const isLast = idx === pinned.length - 1;
        return (
          <React.Fragment key={item.id}>
            <button
              style={{ flexShrink: 0 }}
              onClick={(e) => {
                mapRef.current?.flyTo({ center: [pos.lng, pos.lat], zoom: 16, animate: true });
                e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                onSelect(item.id);
              }}
              className="w-[112px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/90 backdrop-blur-sm shadow-sm text-[#1A1512] border border-white/60 overflow-hidden"
            >
              <span className="text-[10px] font-mono font-bold text-[#A09B96] leading-none flex-shrink-0">{idx + 1}</span>
              <span className="text-[13px] leading-none flex-shrink-0">{emoji}</span>
              <span className="text-[12px] font-semibold truncate min-w-0 flex-1">{item.title}</span>
            </button>
            {!isLast && (
              <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 3, padding: "0 4px" }}>
                <div style={{ width: 6, height: 1, background: "#C8C0B8" }} />
                {hasLeg ? (
                  <div style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(4px)", border: "1px solid rgba(229,224,218,0.8)", borderRadius: 999, padding: "3px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, flexShrink: 0 }}>
                    <span style={{ fontSize: 9, fontFamily: "monospace", fontWeight: 700, color: "#6B6560", lineHeight: 1, whiteSpace: "nowrap" }}>{fmtDist(legKm!)}</span>
                    {legSecs !== undefined && legSecs > 0 && (
                      <span style={{ fontSize: 9, fontFamily: "monospace", fontWeight: 600, color: "#A09B96", lineHeight: 1, whiteSpace: "nowrap" }}>{fmtDur(legSecs)}</span>
                    )}
                  </div>
                ) : (
                  <div style={{ width: 16, height: 1, background: "#C8C0B8", borderTop: "1px dashed #C8C0B8" }} />
                )}
                <div style={{ width: 6, height: 1, background: "#C8C0B8" }} />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function TerrainSetter() {
  const { current: mapRef } = useMap();
  useEffect(() => {
    if (!mapRef) return;
    const map = mapRef.getMap();
    let applied = false;

    function tryApplyTerrain() {
      if (applied) return;
      if (map.getSource("mapbox-dem")) {
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
        applied = true;
        map.off("sourcedata", tryApplyTerrain);
      }
    }

    function onStyleLoad() {
      applied = false;
      map.on("sourcedata", tryApplyTerrain);
      tryApplyTerrain();
    }

    map.on("style.load", onStyleLoad);
    if (map.isStyleLoaded()) {
      map.on("sourcedata", tryApplyTerrain);
      tryApplyTerrain();
    }

    return () => {
      map.off("style.load", onStyleLoad);
      map.off("sourcedata", tryApplyTerrain);
    };
  }, [mapRef]);
  return null;
}

export function MapViewInner({ items, onSelectItem, routeSegments, totalKm, legDistances, legDurations }: Props) {
  const mapRef = useRef<MapRef>(null);
  const fitted = useRef(false);
  const [styleKey, setStyleKey] = useState<StyleKey>("streets");
  const [styleOpen, setStyleOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<{ lng: number; lat: number } | null>(null);

  const pinned = items.filter((i) => i.locationLat !== null && i.locationLng !== null);
  const positions = pinned.map((i) => ({
    lng: parseFloat(i.locationLng!),
    lat: parseFloat(i.locationLat!),
  }));

  const defaultCenter = positions[0] ?? { lng: 114.1694, lat: 22.3193 };
  const selectedIdx = pinned.findIndex((i) => i.id === selectedItemId);
  const selectedItem = selectedIdx >= 0 ? pinned[selectedIdx] : null;
  const selectedPos = selectedIdx >= 0 ? positions[selectedIdx] : null;

  const isSatellite = styleKey === "satellite";

  const routeGeoJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: routeSegments
      .filter((seg) => seg.length > 1)
      .map((seg, i) => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          // incoming segments are [lat, lng] — flip to [lng, lat] for GL
          coordinates: seg.map(([lat, lng]) => [lng, lat]),
        },
        properties: { color: ROUTE_COLORS[i % ROUTE_COLORS.length] },
      })),
  };

  const userPosGeoJSON: GeoJSON.FeatureCollection | null = userPos
    ? {
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          geometry: { type: "Point", coordinates: [userPos.lng, userPos.lat] },
          properties: {},
        }],
      }
    : null;

  function handleLoad() {
    if (positions.length === 0 || fitted.current) return;
    fitted.current = true;
    if (positions.length === 1) {
      mapRef.current?.flyTo({ center: [positions[0]!.lng, positions[0]!.lat], zoom: 14 });
    } else {
      const lngs = positions.map((p) => p.lng);
      const lats = positions.map((p) => p.lat);
      mapRef.current?.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 60 },
      );
    }
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Empty state */}
      {pinned.length === 0 && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div className="bg-white/90 rounded-2xl px-6 py-5 shadow text-center mx-6">
            <span className="text-4xl block mb-2">🗺️</span>
            <p className="font-semibold text-[#1A1512]">No locations yet</p>
            <p className="text-sm text-[#6B6560] mt-1">Add a location to itinerary items to see them here</p>
          </div>
        </div>
      )}

      {/* Style switcher — compact layers button */}
      <div
        tabIndex={-1}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setStyleOpen(false);
          }
        }}
        style={{ position: "absolute", bottom: "calc(206px + env(safe-area-inset-bottom, 0px))", right: 12, zIndex: 3, outline: "none" }}
      >
        <button
          onClick={() => setStyleOpen((o) => !o)}
          title="Map style"
          style={{
            width: 40, height: 40, borderRadius: "50%", background: "#fff", border: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)", display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer",
            color: styleOpen ? "#E8622A" : "#1A1512",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 22 8.5 12 15 2 8.5" />
            <polyline points="2 15.5 12 22 22 15.5" />
            <polyline points="2 11.5 12 18 22 11.5" />
          </svg>
        </button>
        {styleOpen && (
          <div style={{ position: "absolute", top: 48, right: 0, display: "flex", flexDirection: "column", gap: 4, minWidth: 100 }}>
            {(["streets", "outdoors", "satellite"] as StyleKey[]).map((key) => (
              <button
                key={key}
                onClick={() => { setStyleKey(key); setStyleOpen(false); }}
                style={{
                  padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: styleKey === key ? "#1A1512" : "rgba(255,255,255,0.95)",
                  color: styleKey === key ? "#fff" : "#1A1512",
                  border: "1.5px solid rgba(255,255,255,0.6)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                  backdropFilter: "blur(6px)",
                  textAlign: "left",
                  whiteSpace: "nowrap",
                }}
              >
                {STYLE_LABELS[key]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Total km badge */}
      {totalKm !== undefined && totalKm > 0 && (
        <div style={{ position: "absolute", bottom: "calc(110px + env(safe-area-inset-bottom, 0px))", left: 12, zIndex: 2, pointerEvents: "none" }}>
          <div className="bg-white/95 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-md flex items-center gap-1.5 border border-[#E5E0DA]">
            <span className="text-[12px]">🚗</span>
            <span className="text-[12px] font-semibold text-[#1A1512] font-mono">
              {totalKm < 1 ? `${Math.round(totalKm * 1000)} m` : `${totalKm.toFixed(1)} km`}
            </span>
          </div>
        </div>
      )}

      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={STYLES[styleKey]}
        initialViewState={{
          longitude: defaultCenter.lng,
          latitude: defaultCenter.lat,
          zoom: 13,
          pitch: 45,
          bearing: 0,
        }}
        dragRotate={true}
        style={{ width: "100%", height: "100%" }}
        onLoad={handleLoad}
      >
        <TerrainSetter />

        {/* Terrain DEM source */}
        <Source
          id="mapbox-dem"
          type="raster-dem"
          url="mapbox://mapbox.mapbox-terrain-dem-v1"
          tileSize={512}
          maxzoom={14}
        />

        {/* 3D buildings — skip on satellite (imagery already shows buildings) */}
        {!isSatellite && (
          <Layer
            id="3d-buildings"
            source="composite"
            source-layer="building"
            filter={["==", "extrude", "true"]}
            type="fill-extrusion"
            minzoom={15}
            paint={{
              "fill-extrusion-color": "#aaa",
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.6,
            }}
          />
        )}

        {/* Route polylines — casing + fill, Google Maps style */}
        <Source id="routes" type="geojson" data={routeGeoJSON}>
          <Layer
            id="route-casing"
            type="line"
            paint={{ "line-color": "#ffffff", "line-width": 10, "line-opacity": 0.9 }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
          <Layer
            id="route-line"
            type="line"
            paint={{ "line-color": ["get", "color"], "line-width": 6, "line-opacity": 1 }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
        </Source>

        {/* User location */}
        {userPosGeoJSON && (
          <Source id="user-loc" type="geojson" data={userPosGeoJSON}>
            <Layer
              id="user-outer"
              type="circle"
              paint={{ "circle-radius": 10, "circle-color": "#4285F4", "circle-opacity": 0.25, "circle-stroke-width": 2, "circle-stroke-color": "#fff" }}
            />
            <Layer
              id="user-inner"
              type="circle"
              paint={{ "circle-radius": 6, "circle-color": "#4285F4", "circle-stroke-width": 2, "circle-stroke-color": "#fff" }}
            />
          </Source>
        )}

        {/* Item markers */}
        {pinned.map((item, idx) => {
          const pos = positions[idx]!;
          const emoji = ITEM_EMOJI[item.type] ?? "📌";
          return (
            <Marker
              key={item.id}
              longitude={pos.lng}
              latitude={pos.lat}
              anchor="bottom"
              onClick={() => setSelectedItemId(item.id)}
            >
              <MarkerPin emoji={emoji} seq={idx + 1} />
            </Marker>
          );
        })}

        {/* Popup */}
        {selectedItem && selectedPos && (
          <Popup
            longitude={selectedPos.lng}
            latitude={selectedPos.lat}
            anchor="bottom"
            offset={42}
            onClose={() => setSelectedItemId(null)}
            closeButton={false}
            closeOnClick={false}
            maxWidth="200px"
          >
            <div style={{ minWidth: 180, padding: "12px 14px 12px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                <p style={{ fontWeight: 700, fontSize: 14, margin: 0, flex: 1 }}>
                  {ITEM_EMOJI[selectedItem.type] ?? "📌"} {selectedItem.title}
                </p>
                <button
                  onClick={() => setSelectedItemId(null)}
                  style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: "#F0EDE8", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#6B6560", lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
              {selectedItem.locationName && (
                <p style={{ fontSize: 12, color: "#6B6560", margin: "0 0 4px" }}>{selectedItem.locationName}</p>
              )}
              {selectedItem.startTime && (
                <p style={{ fontSize: 12, color: "#A09B96", margin: "0 0 8px" }}>
                  {new Date(selectedItem.startTime).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => { setSelectedItemId(null); setTimeout(() => onSelectItem(selectedItem.id), 50); }}
                  style={{ flex: 1, padding: "6px 0", borderRadius: 8, background: "#E8622A", color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}
                >
                  View details
                </button>
                <a
                  href={`https://maps.google.com?q=${selectedItem.locationLat},${selectedItem.locationLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, padding: "6px 0", borderRadius: 8, background: "#F0EDE8", color: "#2D6A8F", fontSize: 12, fontWeight: 600, textAlign: "center", textDecoration: "none", display: "block" }}
                >
                  Maps ↗
                </a>
              </div>
            </div>
          </Popup>
        )}

        <LocateControl onLocate={(lng, lat) => setUserPos({ lng, lat })} />
        <CompassReset />
      </Map>
      <ItemChips pinned={pinned} positions={positions} legDistances={legDistances} legDurations={legDurations} mapRef={mapRef} onSelect={setSelectedItemId} />
    </div>
  );
}
