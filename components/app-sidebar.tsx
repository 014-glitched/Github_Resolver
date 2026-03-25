"use client";

import { signOut } from "@/src/lib/auth-client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { FolderGit2, LayoutDashboard, LogOut, Settings, Waypoints } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="size-4" />,
  },
  {
    label: "Repositories",
    href: "/dashboard/repositories",
    icon: <FolderGit2 className="size-4" />,
  },
  {
    label: "Activity",
    href: "/dashboard/activity",
    icon: <Waypoints className="size-4" />,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: <Settings className="size-4" />,
  },
];

export function AppSidebar({
  user,
}: {
  user: { name?: string | null; email: string; image?: string | null };
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : user.email[0].toUpperCase();

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar/95 backdrop-blur">
      <SidebarHeader className="border-b border-sidebar-border px-5 py-5">
        <BrandMark compact />
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ label, href, icon }) => {
                const isActive = pathname === href;
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`h-10 rounded-lg border text-sm transition-all ${
                        isActive
                          ? "border-primary/20 bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                          : "border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }`}
                    >
                      <Link href={href} className="flex items-center gap-3">
                        {icon}
                        <span className="text-sm">{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator className="bg-sidebar-border" />

      <SidebarFooter className="p-3">
        <div className="mb-2 rounded-xl border border-sidebar-border bg-background/50 px-3 py-3">
          <div className="flex items-center gap-3">
            <Avatar className="size-9 shrink-0">
              <AvatarImage src={user.image ?? ""} alt={user.name ?? "User"} />
              <AvatarFallback className="bg-muted text-xs text-muted-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {user.name ?? "GitHub user"}
              </p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="h-10 w-full justify-start gap-3 rounded-lg px-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-4" />
          <span className="text-sm">Sign out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
