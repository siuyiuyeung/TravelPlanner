"use client";

import { useState } from "react";
import Map, { Marker } from "react-map-gl/mapbox";
import type { MapMouseEvent } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

type Props = {
  initialLat?: number | undefined;
  initialLng?: number | undefined;
  onPick: (lat: string, lng: string, placeName: string) => void;
};

function PinIcon() {
  return (
    <div
      style={{
        width: 24,
        height: 24,
        background: "#E8622A",
        borderRadius: "50% 50% 50% 0",
        transform: "rotate(-45deg)",
        border: "2px solid #fff",
        boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
      }}
    />
  );
}

export function MapPickerMini({ initialLat, initialLng, onPick }: Props) {
  const hasInitial = initialLat !== undefined && initialLng !== undefined;
  const defaultLng = hasInitial ? initialLng : 114.1694;
  const defaultLat = hasInitial ? initialLat : 22.3193;

  const [picked, setPicked] = useState<{ lng: number; lat: number } | null>(
    hasInitial ? { lng: initialLng, lat: initialLat } : null,
  );

  async function handleClick(e: MapMouseEvent) {
    const { lng, lat } = e.lngLat;
    const latStr = lat.toFixed(6);
    const lngStr = lng.toFixed(6);
    let placeName = `${latStr}, ${lngStr}`;
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lngStr},${latStr}.json?limit=1&access_token=${TOKEN}`,
      );
      const json = await res.json() as { features?: { place_name?: string }[] };
      if (json.features?.[0]?.place_name) placeName = json.features[0].place_name;
    } catch {
      // keep coordinate string as fallback
    }
    setPicked({ lng, lat });
    onPick(latStr, lngStr, placeName);
  }

  return (
    <div>
      <div style={{ height: 192, borderRadius: 12, overflow: "hidden", border: "1px solid #E5E0DA" }}>
        <Map
          mapboxAccessToken={TOKEN}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          initialViewState={{ longitude: defaultLng, latitude: defaultLat, zoom: 13 }}
          style={{ height: "100%", width: "100%" }}
          dragRotate={false}
          pitchWithRotate={false}
          onClick={handleClick}
          cursor="crosshair"
        >
          {picked && (
            <Marker longitude={picked.lng} latitude={picked.lat} anchor="bottom">
              <PinIcon />
            </Marker>
          )}
        </Map>
      </div>
      <p style={{ fontSize: 11, color: "#A09B96", textAlign: "center", marginTop: 4 }}>
        Tap map to place pin
      </p>
    </div>
  );
}
