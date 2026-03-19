"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

const languageColors: Record<string, string> = {
  TypeScript: "#3178C6",
  JavaScript: "#F7DF1E",
  Python: "#3572A5",
  Rust: "#DEA584",
  Go: "#00ADD8",
  CSS: "#563D7C",
  HTML: "#E34C26",
  Java: "#B07219",
  Ruby: "#701516",
  Swift: "#F05138",
};

export default function RepositoriesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["repos"],
    queryFn: fetchRepos,
    staleTime: 1000 * 60 * 2,
  });

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: connectRepo,
    onMutate: (repo) => setLoadingId(repo.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repos"] });
    },
    onSettled: () => setLoadingId(null),
  });

  // Disconnect Mutation
  const disconnectMutation = useMutation({
    mutationFn: disconnectRepo,
    onMutate: (id) => setLoadingId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repos"] });
    },
    onSettled: () => setLoadingId(null),
  });

  // Filter repos by search
  const filtered = data?.repos.filter((repo) =>
    repo.fullName.toLowerCase().includes(search.toLowerCase()),
  );
  const connectedCount =
    data?.repos.filter((repo) => repo?.connected).length || 0;

  return (
    <div className="p-8 min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[22px] font-semibold text-white/90 tracking-tight">
              Repositories
            </h2>
            <p className="text-[13px] text-[#555] mt-1">
              Connect repos to start monitoring GitHub issues automatically.
            </p>
          </div>
          {connectedCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[12px] text-emerald-500/80">
                {connectedCount} connected
              </span>
            </div>
          )}
        </div>
        {/* Search */}
        <div className="mt-5 relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#111] border border-[#1E1E1E] rounded-xl pl-10 pr-4 py-2.5 text-[13px] text-[#C4C4C4] placeholder:text-[#3A3A3A] focus:outline-none focus:border-[#2A2A2A] transition-colors"
          />
        </div>
      </div>
      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col gap-2.5">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="border border-[#1A1A1A] rounded-2xl p-5 bg-[#111] animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#1A1A1A] rounded-lg" />
                  <div className="flex flex-col gap-2">
                    <div className="w-40 h-3.5 bg-[#1A1A1A] rounded" />
                    <div className="w-64 h-3 bg-[#1A1A1A] rounded" />
                  </div>
                </div>
                <div className="w-20 h-8 bg-[#1A1A1A] rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Error state */}
      {isError && (
        <div className="border border-red-500/20 rounded-2xl p-8 bg-red-500/[0.03] text-center">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-3">
            <svg
              className="w-5 h-5 text-red-400/70"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <p className="text-[13px] text-red-400 font-medium">
            Failed to load repositories
          </p>
          <p className="text-[12px] text-red-400/50 mt-1">
            Check your GitHub connection and try again.
          </p>
        </div>
      )}
      {/* Repo list */}
      {!isLoading && !isError && (
        <div className="flex flex-col gap-2">
          {filtered?.length === 0 && (
            <div className="border border-dashed border-[#1E1E1E] rounded-2xl p-14 text-center">
              <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-[#222] flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-4 h-4 text-[#3A3A3A]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
              </div>
              <p className="text-[13px] text-[#444] font-medium">
                No repositories found
              </p>
              <p className="text-[12px] text-[#333] mt-1">
                Try a different search term
              </p>
            </div>
          )}
          {filtered?.map((repo) => {
            const isThisLoading = loadingId === repo.id;
            const langColor = repo.language
              ? (languageColors[repo.language] ?? "#666")
              : null;

            return (
              <div
                key={repo.id}
                className={`group border rounded-2xl p-5 transition-all duration-150 ${
                  repo.connected
                    ? "border-[#242424] bg-[#111] hover:border-[#2A2A2A]"
                    : "border-[#1A1A1A] bg-[#0D0D0D] hover:border-[#222] hover:bg-[#111]"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Left — repo icon + info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center ${
                        repo.connected
                          ? "bg-emerald-500/5 border-emerald-500/20"
                          : "bg-white/[0.03] border-[#222]"
                      }`}
                    >
                      <svg
                        className={`w-4 h-4 ${repo.connected ? "text-emerald-500/60" : "text-[#444]"}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[13px] font-medium text-white/80 truncate">
                          {repo.fullName}
                        </span>
                        {repo.private && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-4 border-[#2A2A2A] text-[#555] rounded-md"
                          >
                            Private
                          </Badge>
                        )}
                        {repo.connected && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-4 border-emerald-500/25 text-emerald-500/70 rounded-md bg-emerald-500/5"
                          >
                            Connected
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {repo.description && (
                          <p className="text-[11px] text-[#484848] truncate max-w-xs">
                            {repo.description}
                          </p>
                        )}
                        {repo.language && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: langColor ?? "#666" }}
                            />
                            <span className="text-[11px] text-[#4A4A4A]">
                              {repo.language}
                            </span>
                          </div>
                        )}
                        <span className="text-[11px] text-[#3A3A3A] shrink-0">
                          Updated{" "}
                          {new Date(repo.updatedAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Right — connect button */}
                  <div className="shrink-0">
                    {repo.connected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isThisLoading}
                        onClick={() => disconnectMutation.mutate(repo.id)}
                        className="h-8 text-[12px] border-[#2A2A2A] bg-transparent text-[#666] hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/5 transition-all cursor-pointer"
                      >
                        {isThisLoading ? "Disconnecting..." : "Disconnect"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={isThisLoading}
                        onClick={() => connectMutation.mutate(repo)}
                        className="h-8 text-[12px] bg-white/90 text-black hover:bg-white transition-all cursor-pointer"
                      >
                        {isThisLoading ? "Connecting..." : "Connect"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
