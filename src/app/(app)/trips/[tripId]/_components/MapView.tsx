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

type AddToPlanPayload = {
  title: string;
  locationName: string;
  locationLat: string;
  locationLng: string;
};

type Props = {
  items: MapItem[];
  onSelectItem: (id: string) => void;
  routeSegments: [number, number][][];
  totalKm?: number | undefined;
  legDistances?: Record<string, number> | undefined;
  legDurations?: Record<string, number> | undefined;
  onAddToPlan: (payload: AddToPlanPayload) => void;
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

export function MapView({ items, onSelectItem, routeSegments, totalKm, legDistances, legDurations, onAddToPlan }: Props) {
  return (
    // flex-1 grows to fill the tab content area; position:relative + absolute child gives Leaflet real px dimensions
    <div style={{ flex: 1, position: "relative", minHeight: 0, zIndex: 0 }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <MapViewInner items={items} onSelectItem={onSelectItem} routeSegments={routeSegments} totalKm={totalKm} legDistances={legDistances} legDurations={legDurations} onAddToPlan={onAddToPlan} />
      </div>
    </div>
  );
}
