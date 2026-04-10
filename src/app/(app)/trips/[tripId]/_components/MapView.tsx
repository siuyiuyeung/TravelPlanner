"use client";

import dynamic from "next/dynamic";

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

const MapViewInner = dynamic(
  () => import("./MapViewInner").then((m) => m.MapViewInner),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F0EDE8",
        }}
      >
        <div className="w-8 h-8 rounded-full border-2 border-[#E8622A] border-t-transparent animate-spin" />
      </div>
    ),
  }
);

export function MapView({ items, onSelectItem }: Props) {
  return (
    // flex-1 grows to fill the tab content area; position:relative + absolute child gives Leaflet real px dimensions
    <div style={{ flex: 1, position: "relative", minHeight: 0, zIndex: 0 }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <MapViewInner items={items} onSelectItem={onSelectItem} />
      </div>
    </div>
  );
}
