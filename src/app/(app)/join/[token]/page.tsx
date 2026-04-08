import { createServerCaller } from "@/lib/trpc/server";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { headers } from "next/headers";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(`/login?next=/join/${token}`);

  const api = await createServerCaller();
  const group = await api.groups.join({ inviteToken: token });

  redirect(`/groups/${group.id}`);
}
