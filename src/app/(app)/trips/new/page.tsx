import { createServerCaller } from "@/lib/trpc/server";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { NewTripForm } from "./_components/NewTripForm";

export default async function NewTripPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const api = await createServerCaller();
  const groups = await api.groups.list();

  if (groups.length === 0) redirect("/groups/new");

  return <NewTripForm groups={groups} />;
}
