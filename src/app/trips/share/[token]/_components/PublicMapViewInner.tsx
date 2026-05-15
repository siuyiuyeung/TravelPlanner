"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Map, { Layer, Marker, Popup, Source, useMap, type MapRef } from "react-map-gl/mapbox";
import type { GeoJSON } from "geojson";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const ROUTE_COLORS = ["#1A73E8", "#E8622A", "#22C55E", "#9333EA", "#EF4444", "#14B8A6", "#F59E0B"];

const STYLES = {
  streets: "mapbox://styles/mapbox/streets-v12",
  outdoors: "mapbox://styles/mapbox/outdoors-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
} as const;
type StyleKey = keyof typeof STYLES;
const STYLE_LABELS: Record<StyleKey, string> = { streets: "Streets", outdoors: "Outdoors", satellite: "Satellite" };

const ITEM_EMOJI: Record<string, string> = {
  flight: "✈️", hotel: "🏨", restaurant: "🍜", activity: "🎡", transport: "🚗", note: "📝",
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
  routeSegments: { coords: [number, number][]; dayIndex: number }[];
  totalKm: number | undefined;
  legDistances: Record<string, number>;
  legDurations: Record<string, number>;
};

function MarkerPin({ emoji, seq }: { emoji: string; seq: number }) {
  return (
    <div style={{ position: "relative", width: 36, height: 36 }}>
      <div style={{
        width: 36, height: 36, background: "#E8622A", borderRadius: "50% 50% 50% 0",
        transform: "rotate(-45deg)", display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 2px 6px rgba(0,0,0,0.3)", border: "2px solid white",
      }}>
        <span style={{ transform: "rotate(45deg)", fontSize: 16, lineHeight: 1 }}>{emoji}</span>
      </div>
      <div style={{
        position: "absolute", top: -8, right: -8, width: 18, height: 18, borderRadius: "50%",
        background: "#1A1512", color: "#fff", fontSize: 10, fontWeight: 700, fontFamily: "monospace",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "1.5px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
      }}>
        {seq}
      </div>
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

export function PublicMapViewInner({ items, routeSegments, totalKm, legDistances, legDurations }: Props) {
  const mapRef = useRef<MapRef>(null);
  const fitted = useRef(false);
  const chipsContainerRef = useRef<HTMLDivElement>(null);
  const [styleKey, setStyleKey] = useState<StyleKey>("streets");
  const [styleOpen, setStyleOpen] = useState(false);
  const [showRoutes, setShowRoutes] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [bearing, setBearing] = useState(0);

  useEffect(() => {
    const el = chipsContainerRef.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener("wheel", stop, { passive: false });
    return () => { el.removeEventListener("wheel", stop); };
  }, []);

  const pinned = items.filter((i) => i.locationLat !== null && i.locationLng !== null);
  const positions = pinned.map((i) => ({ lng: parseFloat(i.locationLng!), lat: parseFloat(i.locationLat!) }));
  const defaultCenter = positions[0] ?? { lng: 114.1694, lat: 22.3193 };

  const selectedIdx = pinned.findIndex((i) => i.id === selectedItemId);
  const selectedItem = selectedIdx >= 0 ? pinned[selectedIdx] : null;
  const selectedPos = selectedIdx >= 0 ? positions[selectedIdx] : null;
  const isSatellite = styleKey === "satellite";

  const routeCasingGeoJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: routeSegments.filter((s) => s.coords.length > 1).map((s) => ({
      type: "Feature" as const,
      geometry: { type: "LineString" as const, coordinates: s.coords.map(([lat, lng]) => [lng, lat]) },
      properties: {},
    })),
  };

  const routeSegmentLayers = routeSegments.filter((s) => s.coords.length > 1).map((s, idx) => ({
    idx,
    color: ROUTE_COLORS[s.dayIndex % ROUTE_COLORS.length]!,
    geoJson: {
      type: "FeatureCollection" as const,
      features: [{
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: s.coords.map(([lat, lng]) => [lng, lat]) },
        properties: {},
      }],
    },
  }));

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

  const handleResetDirection = useCallback(() => {
    mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 300 });
  }, []);

  const btnStyle: React.CSSProperties = {
    width: 40, height: 40, borderRadius: "50%", background: "#fff", border: "none",
    boxShadow: "0 2px 8px rgba(0,0,0,0.25)", display: "flex", alignItems: "center",
    justifyContent: "center", cursor: "pointer",
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {pinned.length === 0 && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div className="bg-white/90 rounded-2xl px-6 py-5 shadow text-center mx-6">
            <span className="text-4xl block mb-2">🗺️</span>
            <p className="font-semibold text-[#1A1512]">No locations yet</p>
          </div>
        </div>
      )}

      {/* Style switcher — top button, dropdown opens upward */}
      <div
        tabIndex={-1}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setStyleOpen(false); }}
        style={{ position: "absolute", bottom: 160, right: 12, zIndex: 3, outline: "none" }}
      >
        <button
          onClick={() => setStyleOpen((o) => !o)}
          title="Map style"
          style={{ ...btnStyle, color: styleOpen ? "#E8622A" : "#1A1512" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 22 8.5 12 15 2 8.5" />
            <polyline points="2 15.5 12 22 22 15.5" />
            <polyline points="2 11.5 12 18 22 11.5" />
          </svg>
        </button>
        {styleOpen && (
          <div style={{ position: "absolute", bottom: 44, right: 0, display: "flex", flexDirection: "column", gap: 4, minWidth: 100 }}>
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
                  textAlign: "left", whiteSpace: "nowrap",
                }}
              >
                {STYLE_LABELS[key]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Route toggle */}
      <div style={{ position: "absolute", bottom: 112, right: 12, zIndex: 3 }}>
        <button
          onClick={() => setShowRoutes((v) => !v)}
          title={showRoutes ? "Hide routes" : "Show routes"}
          style={{ ...btnStyle, color: showRoutes ? "#1A1512" : "#A09B96" }}
        >
          {showRoutes ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          )}
        </button>
      </div>

      {/* Reset direction button */}
      <div style={{ position: "absolute", bottom: 64, right: 12, zIndex: 3 }}>
        <button
          onClick={handleResetDirection}
          title="Reset direction"
          style={{ ...btnStyle }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22"
            style={{ transform: `rotate(${-bearing}deg)`, transition: "transform 0.1s ease-out" }}
          >
            <path d="M11 2 L13.2 11 L11 10 L8.8 11 Z" fill="#DB4437" />
            <path d="M11 20 L13.2 11 L11 12 L8.8 11 Z" fill="#9E9E9E" />
            <circle cx="11" cy="11" r="1.8" fill="white" stroke="#ccc" strokeWidth="0.5" />
          </svg>
        </button>
      </div>

      {/* Total km badge */}
      {totalKm !== undefined && totalKm > 0 && (
        <div style={{ position: "absolute", bottom: 64, left: 12, zIndex: 2, pointerEvents: "none" }}>
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
        initialViewState={{ longitude: defaultCenter.lng, latitude: defaultCenter.lat, zoom: 13, pitch: 45, bearing: 0 }}
        dragRotate={true}
        style={{ width: "100%", height: "100%" }}
        onLoad={handleLoad}
        onClick={() => setSelectedItemId(null)}
        onRotate={(e) => setBearing(e.target.getBearing())}
      >
        <TerrainSetter />

        <Source id="mapbox-dem" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} maxzoom={14} />

        {!isSatellite && (
          <Layer
            id="3d-buildings"
            source="composite"
            source-layer="building"
            filter={["==", "extrude", "true"]}
            type="fill-extrusion"
            minzoom={15}
            paint={{ "fill-extrusion-color": "#aaa", "fill-extrusion-height": ["get", "height"], "fill-extrusion-base": ["get", "min_height"], "fill-extrusion-opacity": 0.6 }}
          />
        )}

        <Source id="routes-casing" type="geojson" data={routeCasingGeoJSON}>
          <Layer
            id="route-casing-all"
            type="line"
            paint={{ "line-color": "#ffffff", "line-width": 10, "line-opacity": 0.8 }}
            layout={{ "line-cap": "round", "line-join": "round", visibility: showRoutes ? "visible" : "none" }}
          />
        </Source>
        {routeSegmentLayers.map(({ idx, color, geoJson }) => (
          <Source key={idx} id={`routes-seg-${idx}`} type="geojson" data={geoJson}>
            <Layer
              id={`route-line-${idx}`}
              type="line"
              paint={{ "line-color": color, "line-width": 6, "line-opacity": 0.5 }}
              layout={{ "line-cap": "round", "line-join": "round", visibility: showRoutes ? "visible" : "none" }}
            />
          </Source>
        ))}

        {pinned.map((item, idx) => {
          const pos = positions[idx]!;
          return (
            <Marker
              key={item.id}
              longitude={pos.lng}
              latitude={pos.lat}
              anchor="bottom"
              onClick={(e) => { e.originalEvent.stopPropagation(); setSelectedItemId(item.id); }}
            >
              <MarkerPin emoji={ITEM_EMOJI[item.type] ?? "📌"} seq={idx + 1} />
            </Marker>
          );
        })}

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
            <div style={{ minWidth: 180, padding: "12px 14px" }}>
              <p style={{ fontWeight: 700, fontSize: 14, margin: "0 0 4px" }}>
                {ITEM_EMOJI[selectedItem.type] ?? "📌"} {selectedItem.title}
              </p>
              {selectedItem.locationName && (
                <p style={{ fontSize: 12, color: "#6B6560", margin: "0 0 4px" }}>{selectedItem.locationName}</p>
              )}
              {selectedItem.startTime && (
                <p style={{ fontSize: 12, color: "#A09B96", margin: "0 0 8px" }}>
                  {new Date(selectedItem.startTime).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              )}
              <a
                href={`https://maps.google.com?q=${selectedItem.locationLat},${selectedItem.locationLng}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "block", padding: "6px 0", borderRadius: 8, background: "#F0EDE8", color: "#2D6A8F", fontSize: 12, fontWeight: 600, textAlign: "center", textDecoration: "none" }}
              >
                Open in Maps ↗
              </a>
            </div>
          </Popup>
        )}
      </Map>

      {/* Item chips row */}
      {pinned.length > 0 && (
        <div
          ref={chipsContainerRef}
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 3,
            pointerEvents: "auto", display: "flex", alignItems: "center",
            overflowX: "auto", WebkitOverflowScrolling: "touch",
            padding: "8px 12px", gap: 0, scrollbarWidth: "none",
            touchAction: "pan-x",
            background: "linear-gradient(to top, rgba(250,248,245,0.95) 60%, transparent)",
          } as React.CSSProperties}
        >
          {pinned.map((item, idx) => {
            const pos = positions[idx]!;
            const emoji = ITEM_EMOJI[item.type] ?? "📌";
            const legKm = legDistances[item.id];
            const legSecs = legDurations[item.id];
            const hasLeg = legKm !== undefined && legKm > 0;
            const isLast = idx === pinned.length - 1;
            return (
              <Fragment key={item.id}>
                <button
                  style={{ flexShrink: 0 }}
                  onClick={() => {
                    mapRef.current?.flyTo({ center: [pos.lng, pos.lat], zoom: 16, animate: true });
                    setSelectedItemId(item.id);
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
                      <div style={{ width: 16, height: 1, borderTop: "1px dashed #C8C0B8" }} />
                    )}
                    <div style={{ width: 6, height: 1, background: "#C8C0B8" }} />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
