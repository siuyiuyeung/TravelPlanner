import { createServerCaller } from "@/lib/trpc/server";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { TripsClient } from "./_components/TripsClient";

export default async function TripsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const api = await createServerCaller();
  const groups = await api.groups.list();

  return <TripsClient groups={groups} />;
}
