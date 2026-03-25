"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertCircle,
  FolderGit2,
  Github,
  Lock,
  RefreshCcw,
  Search,
  Sparkles,
  Unplug,
} from "lucide-react";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

type Repo = {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  description: string | null;
  language: string | null;
  updatedAt: string;
  connected: boolean;
};

async function fetchRepos(): Promise<{ repos: Repo[] }> {
  const res = await fetch("/api/github/repos");
  if (!res.ok) throw new Error("Failed to fetch repos");
  return res.json();
}

async function connectRepo(repo: Repo) {
  const res = await fetch("/api/github/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      githubId: repo.id,
      name: repo.name,
      fullName: repo.fullName,
      isPrivate: repo.private,
    }),
  });

  if (!res.ok) throw new Error("Failed to connect Repo");
  return res.json();
}

async function disconnectRepo(githubId: number) {
  const res = await fetch("/api/github/disconnect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ githubId }),
  });

  if (!res.ok) throw new Error("Failed to disconnect Repo");
  return res.json();
}

const languageToneClasses: Record<string, string> = {
  TypeScript: "bg-info",
  JavaScript: "bg-warning",
  Python: "bg-success",
  Rust: "bg-destructive",
  Go: "bg-info",
  CSS: "bg-primary",
  HTML: "bg-destructive",
  Java: "bg-warning",
  Ruby: "bg-destructive",
  Swift: "bg-warning",
};

function RepositoryRows({
  repos,
  loadingId,
  onConnect,
  onDisconnect,
}: {
  repos: Repo[];
  loadingId: number | null;
  onConnect: (repo: Repo) => void;
  onDisconnect: (githubId: number) => void;
}) {
  return (
    <>
      {repos.map((repo) => {
        const isThisLoading = loadingId === repo.id;
        const languageToneClassName = repo.language
          ? languageToneClasses[repo.language] ?? "bg-muted-foreground"
          : "bg-muted-foreground";

        return (
          <TableRow key={repo.id}>
            <TableCell className="min-w-64">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{repo.fullName}</span>
                  {repo.private ? (
                    <Badge variant="outline" className="h-6 rounded-full px-2.5 text-xs">
                      <Lock className="size-3" />
                      Private
                    </Badge>
                  ) : null}
                  {repo.connected ? (
                    <Badge variant="outline" className="h-6 rounded-full border-success/20 bg-success/10 px-2.5 text-xs text-success">
                      Connected
                    </Badge>
                  ) : null}
                </div>
                <p className="max-w-xl truncate text-sm text-muted-foreground">
                  {repo.description || "No description provided"}
                </p>
              </div>
            </TableCell>
            <TableCell>
              {repo.language ? (
                <div className="inline-flex items-center gap-2">
                  <span className={`size-2 rounded-full ${languageToneClassName}`} />
                  <span className="text-sm text-muted-foreground">{repo.language}</span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Unknown</span>
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {new Date(repo.updatedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </TableCell>
            <TableCell className="text-right">
              {repo.connected ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isThisLoading}
                  onClick={() => onDisconnect(repo.id)}
                  className="hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Unplug className="size-4" />
                  {isThisLoading ? "Disconnecting..." : "Disconnect"}
                </Button>
              ) : (
                <Button size="sm" disabled={isThisLoading} onClick={() => onConnect(repo)}>
                  {isThisLoading ? "Connecting..." : "Connect"}
                </Button>
              )}
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}

function RepositoryCards({
  repos,
  loadingId,
  onConnect,
  onDisconnect,
}: {
  repos: Repo[];
  loadingId: number | null;
  onConnect: (repo: Repo) => void;
  onDisconnect: (githubId: number) => void;
}) {
  return (
    <div className="space-y-3 md:hidden">
      {repos.map((repo) => {
        const isThisLoading = loadingId === repo.id;
        const languageToneClassName = repo.language
          ? languageToneClasses[repo.language] ?? "bg-muted-foreground"
          : "bg-muted-foreground";

        return (
          <Card key={repo.id} className="bg-card/90">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{repo.fullName}</p>
                    {repo.private ? (
                      <Badge variant="outline" className="h-6 rounded-full px-2.5 text-xs">
                        <Lock className="size-3" />
                        Private
                      </Badge>
                    ) : null}
                    {repo.connected ? (
                      <Badge variant="outline" className="h-6 rounded-full border-success/20 bg-success/10 px-2.5 text-xs text-success">
                        Connected
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {repo.description || "No description provided"}
                  </p>
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/40 text-muted-foreground">
                  <Github className="size-5" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span className={`size-2 rounded-full ${languageToneClassName}`} />
                  {repo.language || "Unknown"}
                </span>
                <span>
                  Updated{" "}
                  {new Date(repo.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              {repo.connected ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isThisLoading}
                  onClick={() => onDisconnect(repo.id)}
                  className="w-full hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Unplug className="size-4" />
                  {isThisLoading ? "Disconnecting..." : "Disconnect"}
                </Button>
              ) : (
                <Button size="sm" disabled={isThisLoading} onClick={() => onConnect(repo)} className="w-full">
                  {isThisLoading ? "Connecting..." : "Connect"}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RepositoriesLoading() {
  return (
    <div className="space-y-4">
      <SectionCard title="Search repositories" description="Loading connected repositories and sync state.">
        <Skeleton className="h-10 w-full rounded-lg" />
      </SectionCard>
      <SectionCard title="Repository inventory" description="Fetching the latest repository metadata.">
        <div className="space-y-3">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="rounded-xl border border-border/70 p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-72" />
                </div>
                <Skeleton className="h-9 w-28" />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

export default function RepositoriesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["repos"],
    queryFn: fetchRepos,
    staleTime: 1000 * 60 * 2,
  });

  const connectMutation = useMutation({
    mutationFn: connectRepo,
    onMutate: (repo) => setLoadingId(repo.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repos"] });
    },
    onSettled: () => setLoadingId(null),
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectRepo,
    onMutate: (id) => setLoadingId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repos"] });
    },
    onSettled: () => setLoadingId(null),
  });

  const filtered =
    data?.repos.filter((repo) =>
      repo.fullName.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];

  const connectedCount = data?.repos.filter((repo) => repo.connected).length ?? 0;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Repository management"
        title="Repositories"
        description="Connect repositories, scan their sync state, and keep your monitoring coverage consistent across the workspace."
        action={
          connectedCount > 0 ? (
            <Badge variant="secondary" className="h-8 rounded-full border border-success/20 bg-success/10 px-3 text-sm text-success">
              <Sparkles className="size-4" />
              {connectedCount} connected
            </Badge>
          ) : undefined
        }
      />

      {isLoading ? <RepositoriesLoading /> : null}

      {isError ? (
        <EmptyState
          icon={<AlertCircle className="size-5" />}
          title="Failed to load repositories"
          description="Check your GitHub connection and try again. The repository inventory could not be refreshed."
          className="border-destructive/20 bg-destructive/5"
        />
      ) : null}

      {!isLoading && !isError ? (
        <>
          <SectionCard
            title="Search repositories"
            description="Filter by full repository name to find the repo you want to monitor."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["repos"] })}
              >
                <RefreshCcw className="size-4" />
                Refresh
              </Button>
            }
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search repositories"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </SectionCard>

          {!filtered.length ? (
            <EmptyState
              icon={<FolderGit2 className="size-5" />}
              title="No repositories found"
              description="Try a different search term or refresh the inventory to pull the latest repositories from GitHub."
            />
          ) : (
            <>
              <RepositoryCards
                repos={filtered}
                loadingId={loadingId}
                onConnect={(repo) => connectMutation.mutate(repo)}
                onDisconnect={(id) => disconnectMutation.mutate(id)}
              />
              <div className="hidden md:block">
                <DataTable
                  title="Repository inventory"
                  description="Consistent repository metadata with connection state and quick actions."
                  columns={["Repository", "Language", "Updated", "Action"]}
                >
                  <RepositoryRows
                    repos={filtered}
                    loadingId={loadingId}
                    onConnect={(repo) => connectMutation.mutate(repo)}
                    onDisconnect={(id) => disconnectMutation.mutate(id)}
                  />
                </DataTable>
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
