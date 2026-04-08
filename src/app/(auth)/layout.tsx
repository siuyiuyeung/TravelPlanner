export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-12 bg-[#FAF8F5]">
      {children}
    </main>
  );
}
