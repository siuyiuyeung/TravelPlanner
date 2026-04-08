import { createServerCaller } from "@/lib/trpc/server";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { GroupDetailClient } from "./_components/GroupDetailClient";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const api = await createServerCaller();
  const group = await api.groups.getById({ groupId });
  if (!group) notFound();

  return <GroupDetailClient group={group} />;
}
