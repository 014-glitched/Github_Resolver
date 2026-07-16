import { auth } from "@/src/lib/auth";
import prisma from "@/src/lib/prisma";
import { headers } from "next/headers";
import { Octokit } from "octokit";

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

    let githubIssues: any[] = [];

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
            (issue) => !issue.pull_request, // filter PRs from the issue list
        )
    }catch(err: any){
        console.error("[issues/GET] Failed to fetch from GitHub:", err?.message);
        return Response.json(
            { error: "Failed to fetch issues from Github" },
            { status: 502 }
        )
    }

    // ── Fetch existing resolve jobs for this repo
    const existingJobs = await prisma.githubIssueJob.findMany({
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
    const jobMap = new Map(existingJobs.map((job) => [job.issueNumber, job]))

    // ── Merge issues with job status
    const issues = githubIssues.map((issue) => {
        const job = jobMap.get(issue.number) ?? null

        return {
            // GitHub issue fields
            number: issue.number,
            title: issue.title,
            body: issue.body ?? "",
            url: issue.html_url,
            state: issue.state,
            labels: issue.labels.map((l: any) =>
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