import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { NewGroupForm } from "./_components/NewGroupForm";

export default async function NewGroupPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return <NewGroupForm />;
}
