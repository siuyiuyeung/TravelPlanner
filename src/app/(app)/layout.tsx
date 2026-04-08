import { BottomNav } from "@/components/navigation/BottomNav";
import { Onboarding } from "@/components/Onboarding";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full min-h-screen bg-[#FAF8F5]">
      <Onboarding />
      <main className="flex-1 overflow-y-auto pb-[82px]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
