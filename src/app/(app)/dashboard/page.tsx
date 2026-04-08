import { createServerCaller } from "@/lib/trpc/server";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { DashboardClient } from "./_components/DashboardClient";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const api = await createServerCaller();
  const groups = await api.groups.list();

  return <DashboardClient session={session} groups={groups} />;
}
