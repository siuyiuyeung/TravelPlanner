"use client";

import { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const pinIcon = L.divIcon({
  html: `<div style="
    width:24px;height:24px;
    background:#E8622A;
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    border:2px solid #fff;
    box-shadow:0 2px 4px rgba(0,0,0,0.3);
  "></div>`,
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

type Props = {
  initialLat?: number | undefined;
  initialLng?: number | undefined;
  onPick: (lat: string, lng: string, placeName: string) => void;
};

function ClickHandler({ onPick }: { onPick: (lat: string, lng: string, placeName: string) => void }) {
  useMapEvents({
    async click(e) {
      const { lat, lng } = e.latlng;
      const latStr = lat.toFixed(6);
      const lngStr = lng.toFixed(6);
      let placeName = `${latStr}, ${lngStr}`;
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lngStr},${latStr}.json?limit=1&access_token=${TOKEN}`
        );
        const json = await res.json() as { features?: { place_name?: string }[] };
        if (json.features?.[0]?.place_name) placeName = json.features[0].place_name;
      } catch {
        // keep coordinate string as fallback
      }
      onPick(latStr, lngStr, placeName);
    },
  });
  return null;
}

export function MapPickerMini({ initialLat, initialLng, onPick }: Props) {
  const center: [number, number] =
    initialLat !== undefined && initialLng !== undefined
      ? [initialLat, initialLng]
      : [22.3193, 114.1694];

  const [picked, setPicked] = useState<[number, number] | null>(
    initialLat !== undefined && initialLng !== undefined ? [initialLat, initialLng] : null
  );

  function handlePick(lat: string, lng: string, placeName: string) {
    setPicked([parseFloat(lat), parseFloat(lng)]);
    onPick(lat, lng, placeName);
  }

  return (
    <div>
      <div style={{ height: 192, borderRadius: 12, overflow: "hidden", border: "1px solid #E5E0DA", zIndex: 0 }}>
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${TOKEN}`}
            tileSize={512}
            zoomOffset={-1}
          />
          <ClickHandler onPick={handlePick} />
          {picked && <Marker position={picked} icon={pinIcon} />}
        </MapContainer>
      </div>
      <p style={{ fontSize: 11, color: "#A09B96", textAlign: "center", marginTop: 4 }}>
        Tap map to place pin
      </p>
    </div>
  );
}
