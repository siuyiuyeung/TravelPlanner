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
  routeSegments: { coords: [number, number][]; dayIndex: number }[];
  totalKm: number | undefined;
  legDistances: Record<string, number>;
  legDurations: Record<string, number>;
};

const PublicMapViewInner = dynamic(
  () => import("./PublicMapViewInner").then((m) => m.PublicMapViewInner),
  {
    ssr: false,
    loading: () => (
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#F0EDE8" }}>
        <div className="w-8 h-8 rounded-full border-2 border-[#E8622A] border-t-transparent animate-spin" />
      </div>
    ),
  }
);

export function PublicMapView({ items, routeSegments, totalKm, legDistances, legDurations }: Props) {
  return (
    <div style={{ flex: 1, position: "relative", minHeight: 0, zIndex: 0 }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <PublicMapViewInner items={items} routeSegments={routeSegments} totalKm={totalKm} legDistances={legDistances} legDurations={legDurations} />
      </div>
    </div>
  );
}
