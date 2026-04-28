import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { BottomNav } from "@/components/navigation/BottomNav";
import { ScrollButtons } from "@/components/navigation/ScrollButtons";
import { Onboarding } from "@/components/Onboarding";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  // Redirect unverified users — verified users and guests are handled by
  // individual pages (guests → /login, verified → proceed).
  if (session && !session.user.emailVerified) {
    redirect("/verify-email");
  }

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#FAF8F5]">
      <Onboarding />
      <main id="main-scroll" className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(58px + env(safe-area-inset-bottom, 0px))' }}>
        {children}
      </main>
      <BottomNav />
      <ScrollButtons />
    </div>
  );
}
