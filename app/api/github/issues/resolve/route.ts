import { inngest } from "@/src/inngest/client";
import { auth } from "@/src/lib/auth";
import prisma from "@/src/lib/prisma";
import { headers } from "next/headers";

/**
 * POST /api/github/issues/resolve
 *
 * Creates a GithubIssueJob and fires the Inngest resolve function.
 * Called when the user clicks "Resolve with AI" and confirms in the modal.
 *
 * Body: {
 *   repoId        string  — our internal repo ID
 *   issueNumber   number  — GitHub issue number (#42)
 *   issueTitle    string  — issue title (stored as snapshot)
 *   issueBody     string  — issue description (stored as snapshot)
 *   issueUrl      string  — link back to the GitHub issue
 *   strategy      string  — "same" | "new" | "custom"
 *   customBranch  string? — only when strategy === "custom"
 * }
 */
export async function POST(req: Request) {
  // ── Auth check ────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse + validate body ─────────────────────────────────
  let body: {
    repoId: string;
    issueNumber: number;
    issueTitle: string;
    issueBody: string;
    issueUrl: string;
    strategy: string;
    customBranch?: string;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    repoId,
    issueNumber,
    issueTitle,
    issueBody,
    issueUrl,
    strategy,
    customBranch,
  } = body;

  if (!repoId || !issueNumber || !issueTitle) {
    return Response.json(
      { error: "repoId, issueNumber and issueTitle are required" },
      { status: 400 },
    );
  }

  if (!["same", "new", "custom"].includes(strategy)) {
    return Response.json(
      { error: "strategy must be same | new | custom" },
      { status: 400 },
    );
  }

  if (strategy === "custom" && !customBranch?.trim()) {
    return Response.json(
      { error: "customBranch is required when strategy is custom" },
      { status: 400 },
    );
  }

  // ── Verify repo belongs to this user ──────────────────────
  const repo = await prisma.repo.findUnique({
    where: { id: repoId },
  });

  if (!repo || repo.userId !== session.user.id) {
    return Response.json({ error: "Repo not found" }, { status: 404 });
  }

  // ── Idempotency check ─────────────────────────────────────
  const existingJob = await prisma.githubIssueJob.findUnique({
    where: {
      repoId_issueNumber: {
        repoId,
        issueNumber,
      },
    },
  });

  if (existingJob) {
    // If it previously failed or was cancelled, delete and allow retry
    if (
      existingJob.status === "FAILED" ||
      existingJob.status === "CANCELLED"
    ) {
      await prisma.githubIssueJob.delete({
        where: { id: existingJob.id },
      });
      // Falls through to create a fresh job below
    } else {
      // Active or completed job — return it so UI can show status
      return Response.json(
        {
          error: "A resolve job already exists for this issue",
          job: existingJob,
        },
        { status: 409 },
      );
    }
  }

  // ── Determine branch name ─────────────────────────────────
  let branchName: string | null = null;

  if (strategy === "custom") {
    branchName = customBranch!.trim();
  } else if (strategy === "new") {
    branchName = `fix/issue-${issueNumber}`;
  }
  // strategy === "same" → branchName stays null,
  // Inngest resolves it from the repo default branch at runtime

  // ── Create the job ────────────────────────────────────────
  const job = await prisma.githubIssueJob.create({
    data: {
      userId: session.user.id,
      repoId,
      issueNumber,
      issueTitle,
      issueBody: issueBody ?? "",
      issueUrl: issueUrl ?? "",
      strategy,
      branchName,
      status: "QUEUED",
    },
  });

  // ── Fire Inngest function ─────────────────────────────────
  await inngest.send({
    name: "github/issue.resolve",
    data: {
      jobId: job.id,
      repoId,
      userId: session.user.id,
      issueNumber,
      issueTitle,
      issueBody: issueBody ?? "",
      issueUrl: issueUrl ?? "",
      strategy,
      branchName,
    },
  });

  return Response.json({ job }, { status: 201 });
}