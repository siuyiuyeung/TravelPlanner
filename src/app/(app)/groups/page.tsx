import { createServerCaller } from "@/lib/trpc/server";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { GroupsClient } from "./_components/GroupsClient";

export default async function GroupsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const api = await createServerCaller();
  const groups = await api.groups.list();

  return <GroupsClient groups={groups} />;
}
