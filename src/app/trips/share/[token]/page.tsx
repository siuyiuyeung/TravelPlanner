import { notFound } from "next/navigation";
import { createServerCaller } from "@/lib/trpc/server";
import { PublicTripView } from "./_components/PublicTripView";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function PublicTripPage({ params }: Props) {
  const { token } = await params;

  const api = await createServerCaller();
  let trip;
  try {
    trip = await api.trips.getPublic({ shareToken: token });
  } catch {
    notFound();
  }

  return <PublicTripView trip={trip} />;
}
