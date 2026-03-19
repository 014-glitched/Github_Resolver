import { auth } from "@/src/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-[#0A0A0A] overflow-hidden">
        <AppSidebar user={session.user} />
        <main className="flex-1 overflow-y-auto bg-[#0A0A0A] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#1E1E1E]">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}