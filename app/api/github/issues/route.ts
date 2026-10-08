import { auth } from "@/src/lib/auth";
import prisma from "@/src/lib/prisma";
import {
  getTriagesForRepo,
  toTriageView,
  type IssueTriageRow,
} from "@/src/lib/triage/view";
import { headers } from "next/headers";
import { Octokit } from "octokit";

type GithubIssueItem = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  labels: Array<string | { name?: string | null }>;
  user: { login?: string | null; avatar_url?: string | null } | null;
  created_at: string;
  updated_at: string;
  comments: number;
  pull_request?: unknown;
};

type IssueJobSummary = {
  id: string;
  issueNumber: number;
  status: string;
  prUrl: string | null;
  prNumber: number | null;
  errorMsg: string | null;
  verifyVerdict: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const repoId = searchParams.get("repoId");

  if (!repoId) {
    return Response.json({ error: "repoId is required" }, { status: 400 });
  }

  const repo = await prisma.repo.findUnique({
    where: { id: repoId },
  });
  if (!repo || repo.userId !== session.user.id) {
    return Response.json({ error: "Repo not found" }, { status: 404 });
  }

  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      providerId: "github",
    },
  });
  if (!account?.accessToken) {
    return Response.json(
      { error: "No GitHub access token found" },
      { status: 401 },
    );
  }

  const octokit = new Octokit({ auth: account.accessToken });
  const [owner, repoName] = repo.fullName.split("/");

  let githubIssues: GithubIssueItem[] = [];

  try {
    const response = await octokit.rest.issues.listForRepo({
      owner,
      repo: repoName,
      state: "open",
      per_page: 100,
    });
    githubIssues = response.data.filter(
      (issue) => !("pull_request" in issue && issue.pull_request),
    ) as GithubIssueItem[];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[issues/GET] Failed to fetch from GitHub:", message);
    return Response.json(
      { error: "Failed to fetch issues from Github" },
      { status: 502 },
    );
  }

  const existingJobs: IssueJobSummary[] = await prisma.githubIssueJob.findMany({
    where: { repoId },
    select: {
      id: true,
      issueNumber: true,
      status: true,
      prUrl: true,
      prNumber: true,
      errorMsg: true,
      verifyVerdict: true,
      createdAt: true,
      completedAt: true,
    },
  });

  const jobMap = new Map<number, IssueJobSummary>(
    existingJobs.map((job: IssueJobSummary) => [job.issueNumber, job]),
  );

  // Triage is optional — never fail the whole issues list if lookup fails
  let triageMap = new Map<number, IssueTriageRow>();
  try {
    triageMap = await getTriagesForRepo(repoId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[issues/GET] triage lookup failed:", message);
  }

  const issues = githubIssues.map((issue: GithubIssueItem) => {
    const job = jobMap.get(issue.number) ?? null;
    const triageRow = triageMap.get(issue.number);
    const triage = triageRow
      ? toTriageView(triageRow, issue.updated_at)
      : null;

    return {
      number: issue.number,
      title: issue.title,
      body: issue.body ?? "",
      url: issue.html_url,
      state: issue.state,
      labels: issue.labels.map((l: string | { name?: string | null }) =>
        typeof l === "string" ? l : l.name ?? "",
      ),
      author: issue.user?.login ?? "unknown",
      authorAvatar: issue.user?.avatar_url ?? null,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      commentsCount: issue.comments,
      job,
      triage,
    };
  });

  return Response.json({ issues, repoFullName: repo.fullName });
}
