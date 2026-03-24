"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOut } from "@/src/lib/auth-client";

// ── Types 
type UserProfile = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: string;
  accounts: {
    accountId: string;
    scope: string | null;
    createdAt: string;
  }[];
  repos: {
    id: string;
    name: string;
    fullName: string;
    private: boolean;
    webhookId: number | null;
    createdAt: string;
  }[];
};

// ── API 
async function fetchProfile(): Promise<{ user: UserProfile }> {
  const res = await fetch("/api/settings/profile");
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

async function disconnectAll() {
  const res = await fetch("/api/settings/disconnect-all", {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to disconnect all repos");
  return res.json();
}

async function deleteAccount() {
  const res = await fetch("/api/settings/delete-account", {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete account");
  return res.json();
}

async function disconnectRepo(githubId: number) {
  const res = await fetch("/api/github/disconnect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ githubId }),
  });
  if (!res.ok) throw new Error("Failed to disconnect repo");
  return res.json();
}

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [disconnectAllOpen, setDisconnectAllOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["settings-profile"],
    queryFn: fetchProfile,
  });

  const disconnectAllMutation = useMutation({
    mutationFn: disconnectAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-profile"] });
      queryClient.invalidateQueries({ queryKey: ["repos"] });
      setDisconnectAllOpen(false);
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: async () => {
      await signOut();
      router.push("/login");
    },
  });

  const disconnectRepoMutation = useMutation({
    mutationFn: (repo: { id: string; githubId: number }) =>
      disconnectRepo(repo.githubId),
    onMutate: (repo) => setDisconnectingId(repo.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-profile"] });
      queryClient.invalidateQueries({ queryKey: ["repos"] });
    },
    onSettled: () => setDisconnectingId(null),
  });

  const user = data?.user;

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="p-8 min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-[22px] font-semibold text-white/90 tracking-tight">
          Settings
        </h2>
        <p className="text-[13px] text-[#555] mt-1">
          Manage your account, repositories and preferences.
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="bg-[#111] border border-[#222] h-9 mb-6">
          <TabsTrigger
            value="profile"
            className="text-[12px] data-[state=active]:bg-white/8 data-[state=active]:text-white text-[#555]"
          >
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="repositories"
            className="text-[12px] data-[state=active]:bg-white/8 data-[state=active]:text-white text-[#555]"
          >
            Repositories
          </TabsTrigger>
          <TabsTrigger
            value="danger"
            className="text-[12px] data-[state=active]:bg-white/8 data-[state=active]:text-white text-[#555]"
          >
            Danger Zone
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab  */}
        <TabsContent value="profile">
          <div className="flex flex-col gap-4 max-w-xl">

            {/* User info */}
            <Card className="border-[#222] bg-[#111]">
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px] text-white/70 font-medium">
                  GitHub Account
                </CardTitle>
                <CardDescription className="text-[12px] text-[#444]">
                  Your connected GitHub identity
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-14 h-14 rounded-full bg-[#1A1A1A]" />
                    <div className="flex flex-col gap-2">
                      <Skeleton className="w-32 h-3.5 bg-[#1A1A1A] rounded" />
                      <Skeleton className="w-48 h-3 bg-[#1A1A1A] rounded" />
                    </div>
                  </div>
                ) : user ? (
                  <div className="flex items-center gap-4">
                    <Avatar className="w-14 h-14">
                      <AvatarImage src={user.image ?? ""} alt={user.name} />
                      <AvatarFallback className="bg-[#222] text-[#888] text-lg">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-[15px] font-medium text-white/85">
                        {user.name}
                      </p>
                      <p className="text-[13px] text-[#555] mt-0.5">
                        {user.email}
                      </p>
                      <p className="text-[11px] text-[#444] mt-1">
                        Member since{" "}
                        {new Date(user.createdAt).toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* GitHub permissions */}
            <Card className="border-[#222] bg-[#111]">
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px] text-white/70 font-medium">
                  Permissions
                </CardTitle>
                <CardDescription className="text-[12px] text-[#444]">
                  GitHub OAuth scopes granted to GitHubResolver
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex gap-2 flex-wrap">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton
                        key={i}
                        className="w-20 h-5 rounded-full bg-[#1A1A1A]"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {(
                      user?.accounts[0]?.scope?.split(",") ?? [
                        "read:user",
                        "user:email",
                        "repo",
                        "write:repo_hook",
                      ]
                    ).map((scope) => (
                      <Badge
                        key={scope}
                        variant="outline"
                        className="text-[11px] border-[#333] text-[#666] rounded-full"
                      >
                        {scope.trim()}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Repositories Tab */}
        <TabsContent value="repositories">
          <div className="flex flex-col gap-4 max-w-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] text-[#555]">
                {user?.repos.length ?? 0} connected{" "}
                {user?.repos.length === 1 ? "repository" : "repositories"}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push("/dashboard/repositories")}
                className="h-8 text-[12px] border-[#333] bg-transparent text-[#666] hover:text-white hover:border-[#444]"
              >
                Manage repos →
              </Button>
            </div>

            {isLoading ? (
              <div className="flex flex-col gap-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-16 rounded-xl bg-[#111]"
                  />
                ))}
              </div>
            ) : user?.repos.length === 0 ? (
              <div className="border border-dashed border-[#222] rounded-xl p-10 text-center">
                <p className="text-[13px] text-[#444]">
                  No repositories connected
                </p>
                <Button
                  size="sm"
                  onClick={() => router.push("/dashboard/repositories")}
                  className="mt-3 h-8 text-[12px] bg-white/90 text-black hover:bg-white"
                >
                  Connect a repo
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {user?.repos.map((repo) => (
                  <Card
                    key={repo.id}
                    className="border-[#222] bg-[#111] rounded-xl"
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-medium text-white/80">
                            {repo.fullName}
                          </p>
                          {repo.private && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-[#333] text-[#555] h-4 px-1.5"
                            >
                              Private
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <p className="text-[11px] text-[#444]">
                            Webhook active · Connected{" "}
                            {new Date(repo.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={disconnectingId === repo.id}
                        onClick={() =>
                          disconnectRepoMutation.mutate({
                            id: repo.id,
                            githubId: 0,
                          })
                        }
                        className="h-8 text-[12px] border-[#333] bg-transparent text-[#666] hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/5"
                      >
                        {disconnectingId === repo.id
                          ? "Disconnecting..."
                          : "Disconnect"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Danger Zone Tab */}
        <TabsContent value="danger">
          <div className="flex flex-col gap-4 max-w-xl">

            {/* Disconnect all */}
            <Card className="border-[#222] bg-[#111]">
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px] text-white/70 font-medium">
                  Disconnect All Repositories
                </CardTitle>
                <CardDescription className="text-[12px] text-[#444]">
                  Remove all connected repos and delete all webhooks from
                  GitHub. Your event history will be preserved.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDisconnectAllOpen(true)}
                  disabled={!user?.repos.length}
                  className="h-8 text-[12px] border-red-500/30 text-red-400/80 hover:bg-red-400/5 hover:border-red-400/50 bg-transparent disabled:opacity-30"
                >
                  Disconnect all repos
                </Button>
              </CardContent>
            </Card>

            {/* Delete account */}
            <Card className="border-red-500/20 bg-[#111]">
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px] text-red-400/80 font-medium">
                  Delete Account
                </CardTitle>
                <CardDescription className="text-[12px] text-[#444]">
                  Permanently delete your account, all connected repos,
                  webhooks, and event history. This action cannot be undone.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDeleteAccountOpen(true)}
                  className="h-8 text-[12px] border-red-500/30 text-red-400 hover:bg-red-400/10 hover:border-red-400/50 bg-transparent"
                >
                  Delete my account
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Disconnect All Confirmation */}
      <Dialog open={disconnectAllOpen} onOpenChange={setDisconnectAllOpen}>
        <DialogContent className="bg-[#111] border border-[#222] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[15px] text-white/90">
              Disconnect all repositories?
            </DialogTitle>
            <DialogDescription className="text-[12px] text-[#555]">
              This will remove all{" "}
              <span className="text-white/60">
                {user?.repos.length} connected{" "}
                {user?.repos.length === 1 ? "repo" : "repos"}
              </span>{" "}
              and delete their webhooks from GitHub. Your event history will
              be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDisconnectAllOpen(false)}
              className="h-8 text-[12px] border-[#333] bg-transparent text-[#666] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={disconnectAllMutation.isPending}
              onClick={() => disconnectAllMutation.mutate()}
              className="h-8 text-[12px] bg-red-500/80 hover:bg-red-500 text-white border-0"
            >
              {disconnectAllMutation.isPending
                ? "Disconnecting..."
                : "Yes, disconnect all"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation */}
      <Dialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <DialogContent className="bg-[#111] border border-red-500/20 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[15px] text-red-400">
              Delete your account?
            </DialogTitle>
            <DialogDescription className="text-[12px] text-[#555]">
              This will permanently delete your account, all connected repos,
              webhooks, and your entire event history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDeleteAccountOpen(false)}
              className="h-8 text-[12px] border-[#333] bg-transparent text-[#666] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={deleteAccountMutation.isPending}
              onClick={() => deleteAccountMutation.mutate()}
              className="h-8 text-[12px] bg-red-500/80 hover:bg-red-500 text-white border-0"
            >
              {deleteAccountMutation.isPending
                ? "Deleting..."
                : "Yes, delete my account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}