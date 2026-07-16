"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  FolderGit2,
  Github,
  Lock,
  Settings2,
  ShieldCheck,
  Trash2,
  Unplug,
  UserRound,
  RefreshCcw
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { signOut } from "@/src/lib/auth-client";

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
    githubId: number;
    hasCI: boolean; 
    webhookId: number | null;
    createdAt: string;
  }[];
};

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

async function refreshCI(repoId: string){
  const res = await fetch("api/github/refresh-ci", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoId })
  })
  if (!res.ok) throw new Error("Failed to refresh CI status");
  return res.json();
}

function SettingsLoading() {
  return (
    <div className="space-y-4">
      <SectionCard title="Loading settings" description="Fetching profile, repository, and access information.">
        <div className="space-y-4">
          <Skeleton className="h-10 w-72 rounded-lg" />
          <div className="grid gap-4 lg:grid-cols-2">
            {[0, 1].map((item) => (
              <Card key={item}>
                <CardContent className="space-y-3 p-6">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [disconnectAllOpen, setDisconnectAllOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [refreshingCIId, setRefreshingCIId] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
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
    mutationFn: (repo: { id: string; githubId: number }) => disconnectRepo(repo.githubId),
    onMutate: (repo) => setDisconnectingId(repo.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-profile"] });
      queryClient.invalidateQueries({ queryKey: ["repos"] });
    },
    onSettled: () => setDisconnectingId(null),
  });

  const refreshCIMutation = useMutation({
    mutationFn: (repoId: string) => refreshCI(repoId),
    onMutate: (repoId) => setRefreshingCIId(repoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-profile"] })
    },
    onSettled: () => setRefreshingCIId(null),
  })

  const user = data?.user;

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((name) => name[0])
        .join("")
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "?";

  const scopes =
    user?.accounts[0]?.scope?.split(",").map((scope) => scope.trim()) ?? [
      "read:user",
      "user:email",
      "repo",
      "write:repo_hook",
    ];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Workspace controls"
        title="Settings"
        description="Manage your account, review repository access, and handle the actions that affect your workspace."
        action={
          <Badge variant="secondary" className="h-8 rounded-full bg-primary/10 px-3 text-sm font-medium text-primary">
            <Settings2 className="size-4" />
            Account controls
          </Badge>
        }
      />

      {isLoading ? <SettingsLoading /> : null}

      {isError ? (
        <EmptyState
          icon={<AlertTriangle className="size-5" />}
          title="Failed to load settings"
          description="The settings data could not be loaded right now. Try refreshing the page and checking your session."
          className="border-destructive/20 bg-destructive/5"
        />
      ) : null}

      {!isLoading && !isError ? (
        <Tabs defaultValue="profile" className="w-full gap-6">
          <TabsList variant="line" className="flex-wrap gap-2 rounded-xl border border-border/70 bg-card/70 p-1">
            <TabsTrigger value="profile" className="rounded-lg px-3 text-sm">
              Profile
            </TabsTrigger>
            <TabsTrigger value="repositories" className="rounded-lg px-3 text-sm">
              Repositories
            </TabsTrigger>
            <TabsTrigger value="danger" className="rounded-lg px-3 text-sm">
              Danger zone
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <SectionCard title="GitHub account" description="Your connected identity and account lifetime.">
                {user ? (
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <Avatar className="size-16">
                      <AvatarImage src={user.image ?? ""} alt={user.name} />
                      <AvatarFallback className="bg-muted text-lg text-muted-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <p className="text-lg font-semibold text-foreground">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <p className="text-sm text-muted-foreground">
                        Member since{" "}
                        {new Date(user.createdAt).toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                ) : null}
              </SectionCard>

              <SectionCard title="Workspace summary" description="High-level access and repository coverage.">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      label: "Connected repositories",
                      value: user?.repos.length ?? 0,
                      tone: "text-info",
                      icon: FolderGit2,
                      surface: "bg-info/10",
                    },
                    {
                      label: "Granted scopes",
                      value: scopes.length,
                      tone: "text-success",
                      icon: ShieldCheck,
                      surface: "bg-success/10",
                    },
                    {
                      label: "GitHub accounts",
                      value: user?.accounts.length ?? 0,
                      tone: "text-primary",
                      icon: UserRound,
                      surface: "bg-primary/10",
                    },
                  ].map(({ label, value, tone, icon: Icon, surface }) => (
                    <div key={label} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">{label}</p>
                        <div className={`flex size-9 items-center justify-center rounded-lg ${surface} ${tone}`}>
                          <Icon className="size-4" />
                        </div>
                      </div>
                      <p className={`mt-4 text-2xl font-semibold ${tone}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Permissions" description="GitHub OAuth scopes granted to GitHubResolver.">
              <div className="flex flex-wrap gap-2">
                {scopes.map((scope) => (
                  <Badge key={scope} variant="outline" className="h-6 rounded-full px-2.5 text-xs">
                    {scope}
                  </Badge>
                ))}
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="repositories" className="space-y-4">
            <SectionCard
              title="Connected repositories"
              description="Manage repository-level access from settings or jump to the full repository manager."
              action={
                <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/repositories")}>
                  <FolderGit2 className="size-4" />
                  Manage repositories
                </Button>
              }
            >
              {user?.repos.length ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {user.repos.length} connected {user.repos.length === 1 ? "repository" : "repositories"}
                  </p>
                  <div className="space-y-3">
                    {user.repos.map((repo) => (
                      <div
                        key={repo.id}
                        className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/90 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium text-foreground">{repo.fullName}</p>
                            {repo.private ? (
                              <Badge variant="outline" className="h-6 rounded-full px-2.5 text-xs">
                                <Lock className="size-3" />
                                Private
                              </Badge>
                            ) : null}
                            {/* Show CI status badge */}
                            <Badge
                              variant="outline"
                              className={`h-6 rounded-full px-2.5 text-xs ${
                                repo.hasCI
                                  ? "border-success/20 bg-success/10 text-success"
                                  : "border-border/40 bg-muted/20 text-muted-foreground"
                              }`}
                            >
                              {repo.hasCI ? "CI detected" : "No CI"}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-2">
                              <span className="size-2 rounded-full bg-success" />
                              Webhook active
                            </span>
                            <span>
                              Connected {new Date(repo.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Refresh CI status — useful if CI was added after connecting */}
  <Button
    size="sm"
    variant="outline"
    disabled={refreshingCIId === repo.id}
    onClick={() => refreshCIMutation.mutate(repo.id)}
    className="hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
  >
    <RefreshCcw className="size-4" />
    {refreshingCIId === repo.id ? "Checking..." : "Refresh CI"}
  </Button>
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
                            className="hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Unplug className="size-4" />
                            {disconnectingId === repo.id ? "Disconnecting..." : "Disconnect"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<Github className="size-5" />}
                  title="No repositories connected"
                  description="Connect a repository to start monitoring GitHub events and running automated resolutions."
                  action={
                    <Button size="sm" onClick={() => router.push("/dashboard/repositories")}>
                      Connect a repository
                    </Button>
                  }
                />
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="danger" className="space-y-4">
            <SectionCard title="Disconnect all repositories" description="Remove every connected repository and delete all installed webhooks.">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-muted-foreground">
                  Repository history stays in the app, but active GitHub webhook connections are removed.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisconnectAllOpen(true)}
                  disabled={!user?.repos.length}
                  className="hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Unplug className="size-4" />
                  Disconnect all repositories
                </Button>
              </div>
            </SectionCard>

            <SectionCard
              title="Delete account"
              description="Permanently remove your account, connected repositories, webhooks, and event history."
              className="border-destructive/20"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-muted-foreground">
                  This action is destructive and cannot be undone. Make sure your team no longer depends on this workspace.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteAccountOpen(true)}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                  Delete my account
                </Button>
              </div>
            </SectionCard>
          </TabsContent>
        </Tabs>
      ) : null}

      <Dialog open={disconnectAllOpen} onOpenChange={setDisconnectAllOpen}>
        <DialogContent className="border-border/70 bg-card text-card-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disconnect all repositories?</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This removes all {user?.repos.length ?? 0} connected{" "}
              {user?.repos.length === 1 ? "repository" : "repositories"} and deletes their GitHub webhooks. Event history is preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDisconnectAllOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={disconnectAllMutation.isPending}
              onClick={() => disconnectAllMutation.mutate()}
              variant="destructive"
            >
              {disconnectAllMutation.isPending ? "Disconnecting..." : "Yes, disconnect all"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <DialogContent className="border-destructive/20 bg-card text-card-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete your account?</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This permanently deletes your account, repositories, webhooks, and event history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteAccountOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={deleteAccountMutation.isPending}
              onClick={() => deleteAccountMutation.mutate()}
              variant="destructive"
            >
              {deleteAccountMutation.isPending ? "Deleting..." : "Yes, delete my account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
