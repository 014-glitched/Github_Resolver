import { auth } from "@/src/lib/auth";
import prisma from "@/src/lib/prisma";
import type { IssueJobStatus } from "@prisma/client";
import { headers } from "next/headers";
import { Octokit } from "octokit";

type IssueJobSummary = {
    id: string;
    issueNumber: number;
    status: IssueJobStatus;
    prUrl: string | null;
    prNumber: number | null;
    errorMsg: string | null;
    verifyVerdict: string | null;
    createdAt: Date;
    completedAt: Date | null;
};

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

export async function GET(req: Request) {
    const session = await auth.api.getSession({ headers: await headers() })

    if(!session?.user){
        return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const repoId = searchParams.get("repoId")

    if(!repoId){
        return Response.json({ error: "repoId is required" }, { status: 400 })
    }
    // ── Verify repo belongs to this user
    const repo = await prisma.repo.findUnique({
        where: { id: repoId }
    })
    if(!repo || repo.userId !== session.user.id){
        return Response.json({ error: "Repo not found" }, { status: 404 })
    }

    // ── Get GitHub access token
    const account = await prisma.account.findFirst({
        where: {
            userId: session?.user.id,
            providerId: "github"
        }
    })
    if(!account?.accessToken){
        return Response.json(
            { error: "No GitHub access token found" },
            { status: 401 }
        )
    }

    // ── Fetch open issues from GitHub API
    const octokit = new Octokit({ auth: account?.accessToken })
    const [owner, repoName] = repo.fullName.split("/")

    let githubIssues: GithubIssueItem[] = [];

    try{
        // GitHub returns PRs in the issues list too — filter them out
        // by checking that pull_request field is absent
        const response = await octokit.rest.issues.listForRepo({
            owner,
            repo: repoName,
            state: "open",
            per_page: 100,
        })
        githubIssues = response.data.filter(
            (issue) => !issue.pull_request,
        ) as GithubIssueItem[]
    }catch(err: unknown){
        const message = err instanceof Error ? err.message : String(err)
        console.error("[issues/GET] Failed to fetch from GitHub:", message);
        return Response.json(
            { error: "Failed to fetch issues from Github" },
            { status: 502 }
        )
    }

    // ── Fetch existing resolve jobs for this repo
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
        }
    })
    // Build a map for O(1) lookup: issueNumber → job
    const jobMap = new Map<number, IssueJobSummary>(
        existingJobs.map((job: IssueJobSummary) => [job.issueNumber, job]),
    )

    // ── Merge issues with job status
    const issues = githubIssues.map((issue: GithubIssueItem) => {
        const job = jobMap.get(issue.number) ?? null

        return {
            // GitHub issue fields
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
        
            // Resolve job fields — null if no job exists yet
            job,
        }
    })
    return Response.json({ issues, repoFullName: repo.fullName });
}
